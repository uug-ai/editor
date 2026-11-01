import {
  BlobSource,
  BufferTarget,
  CanvasSink,
  Conversion,
  Input,
  MATROSKA,
  MkvOutputFormat,
  MovOutputFormat,
  MP4,
  Mp4OutputFormat,
  MPEG_TS,
  Output,
  QTFF,
  WEBM,
  WebMOutputFormat,
} from 'mediabunny'
import type { DiscardedTrack, InputFormat, OutputFormat } from 'mediabunny'
import type { Range } from './time'

/** A trimmed video, ready to download. */
export interface Clip {
  blob: Blob
  name: string
  /** Tracks of the original that the clip had to leave out, for example audio this browser can't encode. */
  warnings: string[]
}

/** The video containers the editor opens. Listing them, not all formats, keeps the other demuxers out of the bundle. */
const formats = [MP4, QTFF, WEBM, MATROSKA, MPEG_TS]

function open(file: Blob): Input {
  return new Input({ source: new BlobSource(file), formats })
}

/**
 * Keeps the container of the original so its video and audio can be copied as they are, which is quick and loses
 * no quality. Anything that isn't Matroska or QuickTime becomes an MP4.
 */
function outputFormatFor(format: InputFormat): OutputFormat {
  if (format === WEBM) return new WebMOutputFormat()
  if (format === MATROSKA) return new MkvOutputFormat()
  if (format === QTFF) return new MovOutputFormat()
  return new Mp4OutputFormat()
}

const discardReasons: Partial<Record<DiscardedTrack['reason'], string>> = {
  unknown_source_codec: 'its codec is not recognised',
  undecodable_source_codec: "this browser can't decode its codec",
  no_encodable_target_codec: "this browser can't encode it",
}

function describe({ track, reason }: DiscardedTrack): string {
  return `The ${track.type} track was left out: ${discardReasons[reason] ?? reason.replaceAll('_', ' ')}.`
}

export function trimmedName(name: string, extension: string): string {
  const dot = name.lastIndexOf('.')
  return `${dot > 0 ? name.slice(0, dot) : name}-trimmed${extension}`
}

/**
 * Cuts `range` out of `file`. Packets are copied without re-encoding where the container allows a frame-accurate cut
 * (MP4 and MOV do, through an edit list); otherwise the tracks are re-encoded with WebCodecs.
 */
export async function trim(
  file: File,
  range: Range,
  onProgress: (progress: number) => void,
  signal: AbortSignal,
): Promise<Clip> {
  const input = open(file)
  try {
    const format = outputFormatFor(await input.getFormat())
    const output = new Output({ format, target: new BufferTarget() })
    const conversion = await Conversion.init({
      input,
      output,
      trim: { start: range.start, end: range.end },
      showWarnings: false,
    })
    const discarded = conversion.discardedTracks.filter((d) => d.track.type !== 'subtitle')
    if (!conversion.isValid || !conversion.utilizedTracks.some((track) => track.type === 'video')) {
      throw new Error(discarded.map(describe).join(' ') || "This video can't be trimmed in this browser.")
    }

    signal.throwIfAborted()
    const cancel = () => void conversion.cancel()
    signal.addEventListener('abort', cancel)
    conversion.onProgress = onProgress
    try {
      await conversion.execute()
    } finally {
      signal.removeEventListener('abort', cancel)
    }

    return {
      blob: new Blob([output.target.buffer!], { type: format.mimeType }),
      name: trimmedName(file.name, format.fileExtension),
      warnings: discarded.map(describe),
    }
  } finally {
    input.dispose()
  }
}

export interface Probe {
  /** In seconds. */
  duration: number
  /** Frames per second, or null when the file doesn't say. */
  frameRate: number | null
}

/**
 * Reads what a video element doesn't always report: the frame rate, for stepping one frame at a time, and the
 * duration of recordings whose header leaves it out (the browser says Infinity). Null when the file isn't a video.
 */
export async function probe(file: File): Promise<Probe | null> {
  const input = open(file)
  try {
    const track = await input.getPrimaryVideoTrack()
    if (!track) return null
    const duration = await input.computeDuration()
    const { averagePacketRate } = await track.computePacketStats(120)
    return {
      duration,
      frameRate: Number.isFinite(averagePacketRate) && averagePacketRate > 0 ? averagePacketRate : null,
    }
  } catch {
    return null
  } finally {
    input.dispose()
  }
}

async function toImageUrl(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<string> {
  const blob =
    'convertToBlob' in canvas
      ? await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.75 })
      : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.75))
  if (!blob) throw new Error('Could not encode a thumbnail.')
  return URL.createObjectURL(blob)
}

/**
 * Decodes `count` frames spread evenly over the video and hands each to `onFrame` as an image URL, in order. The
 * caller owns the URLs. Does nothing when this browser can't decode the video.
 */
export async function filmstrip(
  file: File,
  count: number,
  height: number,
  onFrame: (index: number, url: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const input = open(file)
  try {
    const track = await input.getPrimaryVideoTrack()
    if (!track || !(await track.canDecode())) return
    const start = await track.getFirstTimestamp()
    const duration = (await track.computeDuration()) - start
    const sink = new CanvasSink(track, { height })
    const times = Array.from({ length: count }, (_, i) => start + ((i + 0.5) / count) * duration)

    let index = 0
    for await (const frame of sink.canvasesAtTimestamps(times)) {
      if (signal.aborted) return
      if (frame) {
        const url = await toImageUrl(frame.canvas)
        if (signal.aborted) {
          URL.revokeObjectURL(url)
          return
        }
        onFrame(index, url)
      }
      index++
    }
  } finally {
    input.dispose()
  }
}
