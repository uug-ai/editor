import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { DropZone } from './components/DropZone'
import { ExportBar } from './components/ExportBar'
import type { Job } from './components/ExportBar'
import {
  FilmIcon,
  MarkInIcon,
  MarkOutIcon,
  PauseIcon,
  PlayIcon,
  StepBackIcon,
  StepForwardIcon,
  UploadIcon,
} from './components/icons'
import { Timeline } from './components/Timeline'
import { filmstrip, probe, trim } from './media'
import type { Probe } from './media'
import { clamp, formatTime, moveEnd, moveStart } from './time'
import type { Range } from './time'

const filmstripFrames = 14
/** Twice the height the filmstrip is shown at, so thumbnails stay sharp on high-density screens. */
const filmstripHeight = 112
/** For stepping through videos whose frame rate can't be read. */
const fallbackFrameRate = 30

/** An object URL for `blob` that lives as long as the blob is passed in. */
function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return blob ? url : null
}

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files')

export function App() {
  const video = useRef<HTMLVideoElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  /** What the file says about itself; undefined while it's being read, null when it can't be. */
  const [info, setInfo] = useState<Probe | null | undefined>(undefined)
  /** The duration the video element reports once it has loaded the metadata. */
  const [mediaDuration, setMediaDuration] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<Range>({ start: 0, end: 0 })
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [frames, setFrames] = useState<(string | undefined)[]>([])
  const [job, setJob] = useState<Job>({ state: 'idle' })
  const [dropping, setDropping] = useState(false)
  const videoUrl = useObjectUrl(file)
  const downloadUrl = useObjectUrl(job.state === 'done' ? job.clip.blob : null)

  // Recordings made in the browser often leave the duration out, and the video element then says Infinity.
  const duration =
    mediaDuration === null ? null : Number.isFinite(mediaDuration) ? mediaDuration : (info?.duration ?? null)
  const frame = 1 / (info?.frameRate ?? fallbackFrameRate)
  const loadError =
    error ?? (mediaDuration === Infinity && info === null ? "Couldn't tell how long this video is." : null)
  const ready = file !== null && duration !== null && loadError === null

  useEffect(() => {
    document.title = file ? `${file.name} · Editor` : 'Editor'
  }, [file])

  useEffect(() => {
    if (duration !== null) setRange({ start: 0, end: duration })
  }, [duration])

  useEffect(() => {
    if (!file) return
    let live = true
    void probe(file).then((result) => live && setInfo(result))
    return () => {
      live = false
    }
  }, [file])

  useEffect(() => {
    if (!file) return
    const abort = new AbortController()
    const urls: string[] = []
    const onFrame = (index: number, url: string) => {
      urls.push(url)
      setFrames((current) => current.map((old, i) => (i === index ? url : old)))
    }
    // Without thumbnails the timeline still works, so failures stay quiet.
    filmstrip(file, filmstripFrames, filmstripHeight, onFrame, abort.signal).catch(() => {})
    return () => {
      abort.abort()
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [file])

  // Follow playback every frame, and stop at the end of the clip.
  useEffect(() => {
    const element = video.current
    if (!playing || !element) return
    let id = 0
    const tick = () => {
      if (element.currentTime >= range.end) {
        element.pause()
        element.currentTime = range.end
        setTime(range.end)
        return
      }
      setTime(element.currentTime)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [playing, range.end])

  /** Drops the trimmed clip, or stops the trim, once it no longer matches what's being edited. */
  const resetJob = () => {
    if (job.state === 'running') job.abort.abort()
    if (job.state !== 'idle') setJob({ state: 'idle' })
  }

  const openFile = (next: File) => {
    video.current?.pause()
    resetJob()
    setFile(next)
    setInfo(undefined)
    setMediaDuration(null)
    setError(null)
    setTime(0)
    setPlaying(false)
    setFrames(Array.from({ length: filmstripFrames }, () => undefined))
  }

  const choose = () => picker.current?.click()

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    event.target.value = '' // so choosing the same file again still opens it
    if (picked) openFile(picked)
  }

  const changeRange = (next: Range) => {
    if (next.start === range.start && next.end === range.end) return
    resetJob()
    setRange(next)
  }

  const seek = (t: number) => {
    const element = video.current
    if (!element || duration === null) return
    if (!element.paused) element.pause()
    const next = clamp(t, 0, duration)
    element.currentTime = next
    setTime(next)
  }

  const step = (by: number) => seek((video.current?.currentTime ?? time) + by)

  /** Plays the clip from the playhead, or from its start when the playhead is outside it. */
  const togglePlay = () => {
    const element = video.current
    if (!element) return
    if (!element.paused) {
      element.pause()
      return
    }
    if (element.currentTime < range.start || element.currentTime >= range.end - 0.001) {
      element.currentTime = range.start
    }
    void element.play()
  }

  const markIn = () => changeRange(moveStart(range, video.current?.currentTime ?? time, frame))
  const markOut = () => changeRange(moveEnd(range, video.current?.currentTime ?? time, duration ?? 0, frame))

  const startTrim = async () => {
    if (!file) return
    const abort = new AbortController()
    const current = (j: Job) => j.state === 'running' && j.abort === abort
    setJob({ state: 'running', progress: 0, abort })
    try {
      const clip = await trim(
        file,
        range,
        (progress) => setJob((j) => (current(j) ? { ...j, progress } : j)),
        abort.signal,
      )
      setJob((j) => (current(j) ? { state: 'done', clip } : j))
    } catch (cause) {
      if (abort.signal.aborted) return
      const message = cause instanceof Error ? cause.message : String(cause)
      setJob((j) => (current(j) ? { state: 'failed', message } : j))
    }
  }

  const cancelTrim = () => {
    if (job.state !== 'running') return
    job.abort.abort()
    setJob({ state: 'idle' })
  }

  // Registered again on every render so the shortcuts always act on the latest state.
  useEffect(() => {
    if (!ready) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable]')) return
      switch (event.key.toLowerCase()) {
        case ' ':
          if (target.closest('button, a')) return // the focused control handles it
          togglePlay()
          break
        case 'k':
          togglePlay()
          break
        case 'i':
          markIn()
          break
        case 'o':
          markOut()
          break
        case 'arrowleft':
          step(event.shiftKey ? -1 : -frame)
          break
        case 'arrowright':
          step(event.shiftKey ? 1 : frame)
          break
        default:
          return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div
      className="app"
      onDragOver={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setDropping(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false)
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        setDropping(false)
        const dropped = event.dataTransfer.files[0]
        if (dropped) openFile(dropped)
      }}
    >
      <header className="topbar">
        <span className="brand">
          <FilmIcon />
          Editor
        </span>
        {file && (
          <>
            <span className="file-name" title={file.name}>
              {file.name}
            </span>
            <button className="button" onClick={choose}>
              <UploadIcon size={18} />
              Open another
            </button>
          </>
        )}
      </header>

      <main className={`stage${file ? '' : ' empty'}`}>
        {!file && <DropZone onOpen={choose} />}
        {videoUrl && (
          <video
            ref={video}
            className="preview"
            src={videoUrl}
            preload="auto"
            playsInline
            hidden={loadError !== null}
            onClick={togglePlay}
            onLoadedMetadata={(event) => setMediaDuration(event.currentTarget.duration)}
            onPlay={() => setPlaying(true)}
            onPause={(event) => {
              setPlaying(false)
              setTime(event.currentTarget.currentTime)
            }}
            onError={() => setError("This browser can't play this video. Try an MP4 (H.264) or WebM file.")}
          />
        )}
        {file && loadError && (
          <div className="stage-message" role="alert">
            <p>{loadError}</p>
            <button className="button" onClick={choose}>
              Choose another video
            </button>
          </div>
        )}
        {file && !loadError && duration === null && <div className="stage-message">Loading video…</div>}
      </main>

      {ready && (
        <section className="controls" aria-label="Trim">
          <div className="transport">
            <div className="transport-group">
              <button className="icon-button" title="Previous frame (←)" aria-label="Previous frame" onClick={() => step(-frame)}>
                <StepBackIcon />
              </button>
              <button
                className="icon-button play"
                title={playing ? 'Pause (Space)' : 'Play clip (Space)'}
                aria-label={playing ? 'Pause' : 'Play clip'}
                onClick={togglePlay}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button className="icon-button" title="Next frame (→)" aria-label="Next frame" onClick={() => step(frame)}>
                <StepForwardIcon />
              </button>
              <span className="timecode">
                <strong>{formatTime(time)}</strong> / {formatTime(duration)}
              </span>
            </div>
            <div className="transport-group">
              <button className="button" title="Start the clip at the playhead (I)" onClick={markIn}>
                <MarkInIcon />
                Set start
                <kbd>I</kbd>
              </button>
              <button className="button" title="End the clip at the playhead (O)" onClick={markOut}>
                <MarkOutIcon />
                Set end
                <kbd>O</kbd>
              </button>
            </div>
          </div>

          <Timeline
            duration={duration}
            range={range}
            time={time}
            frames={frames}
            frame={frame}
            onRange={changeRange}
            onSeek={seek}
          />

          <ExportBar range={range} job={job} downloadUrl={downloadUrl} onTrim={startTrim} onCancel={cancelTrim} />
        </section>
      )}

      <input ref={picker} type="file" accept="video/*,.mkv,.mov,.webm" hidden onChange={onPick} />
      {dropping && (
        <div className="drop-overlay" aria-hidden="true">
          Drop to open
        </div>
      )}
    </div>
  )
}
