import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { trim, trimmedName } from './media'

// These run the real trim on videos made with ffmpeg, which also checks the result. Node has no WebCodecs, so only
// cuts that copy packets without re-encoding can run here.
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

const ffmpeg = (...args: string[]) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args])

function duration(path: string): number {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path])
  return Number(out.toString().trim())
}

/** How alike the first frame of `clip` is to the frame of `source` at `time`, as PSNR in dB (inf when identical). */
function firstFramePsnr(clip: string, source: string, time: number): number {
  const { stderr } = spawnSync(
    'ffmpeg',
    [
      ...['-hide_banner', '-i', clip, '-ss', String(time), '-i', source],
      ...['-filter_complex', '[0:v]setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]psnr'],
      ...['-frames:v', '1', '-f', 'null', '-'],
    ],
    { encoding: 'utf8' },
  )
  const match = /average:(inf|[\d.]+)/.exec(stderr) ?? []
  return match[1] === 'inf' ? Infinity : Number(match[1])
}

describe.skipIf(!hasFfmpeg)('trim', () => {
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'editor-test-'))
    // A frame counter and a tone, with a key frame every second.
    const sources = ['-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440']
    ffmpeg(...sources, '-t', '6', '-c:v', 'libx264', '-g', '30', '-sc_threshold', '0', '-pix_fmt', 'yuv420p', '-c:a', 'aac', join(dir, 'in.mp4'))
    ffmpeg(...sources, '-t', '6', '-c:v', 'libvpx-vp9', '-g', '30', '-b:v', '300k', '-c:a', 'libopus', join(dir, 'in.webm'))
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  async function cut(name: string, start: number, end: number) {
    const file = new File([readFileSync(join(dir, name))], name)
    const progress: number[] = []
    const clip = await trim(file, { start, end }, (p) => progress.push(p), new AbortController().signal)
    const path = join(dir, clip.name)
    writeFileSync(path, new Uint8Array(await clip.blob.arrayBuffer()))
    return { clip, path, progress }
  }

  it('cuts an MP4 between key frames to the exact frame, without re-encoding', async () => {
    const { clip, path, progress } = await cut('in.mp4', 1.5, 4.2)
    expect(clip.name).toBe('in-trimmed.mp4')
    expect(clip.blob.type).toBe('video/mp4')
    expect(clip.warnings).toEqual([])
    expect(progress.at(-1)).toBe(1)
    // The frames before the cut that decoding needs are hidden by an edit list. At the end, a B-frame before the cut
    // can need a frame after it, which then plays too, so the clip may run a few frames long.
    expect(duration(path)).toBeGreaterThanOrEqual(2.7)
    expect(duration(path)).toBeLessThan(2.85)
    // Copied frames decode to exactly the same pixels; re-encoded ones wouldn't.
    expect(firstFramePsnr(path, join(dir, 'in.mp4'), 1.5)).toBe(Infinity)
  })

  // Its Opus packets don't line up with the cut, so a browser re-encodes the audio; Node can't, and drops it.
  it('keeps a WebM a WebM', async () => {
    const { clip, path } = await cut('in.webm', 2, 4)
    expect(clip.name).toBe('in-trimmed.webm')
    expect(clip.blob.type).toBe('video/webm')
    expect(duration(path)).toBeCloseTo(2, 1)
    expect(firstFramePsnr(path, join(dir, 'in.webm'), 2)).toBe(Infinity)
  })

  it('stops when cancelled', async () => {
    const file = new File([readFileSync(join(dir, 'in.mp4'))], 'in.mp4')
    const abort = new AbortController()
    abort.abort()
    await expect(trim(file, { start: 1, end: 2 }, () => {}, abort.signal)).rejects.toThrow()
  })
})

describe('trimmedName', () => {
  it('replaces the extension', () => {
    expect(trimmedName('holiday.final.MOV', '.mov')).toBe('holiday.final-trimmed.mov')
    expect(trimmedName('clip', '.mp4')).toBe('clip-trimmed.mp4')
    expect(trimmedName('.hidden', '.mp4')).toBe('.hidden-trimmed.mp4')
  })
})
