/** The part of the video to keep, in seconds. */
export interface Range {
  start: number
  end: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Moves the start of a range to `time`, keeping at least `minLength` before the end. */
export function moveStart(range: Range, time: number, minLength: number): Range {
  return { start: clamp(time, 0, Math.max(0, range.end - minLength)), end: range.end }
}

/** Moves the end of a range to `time`, keeping at least `minLength` after the start. */
export function moveEnd(range: Range, time: number, duration: number, minLength: number): Range {
  return { start: range.start, end: clamp(time, Math.min(duration, range.start + minLength), duration) }
}

/** Formats seconds as m:ss.cc, or h:mm:ss.cc from an hour on. */
export function formatTime(seconds: number, digits = 2): string {
  const scale = 10 ** digits
  const total = Math.round(Math.max(0, seconds) * scale)
  const fraction = total % scale
  const whole = (total - fraction) / scale
  const s = String(whole % 60).padStart(2, '0')
  const m = Math.floor(whole / 60) % 60
  const h = Math.floor(whole / 3600)
  const tail = digits > 0 ? `.${String(fraction).padStart(digits, '0')}` : ''
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}${tail}` : `${m}:${s}${tail}`
}

const tickSteps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]

/** Evenly spaced, round times for a ruler under the timeline, at most `maxTicks` + 1 of them. */
export function ticks(duration: number, maxTicks: number): number[] {
  if (!(duration > 0)) return []
  const step = tickSteps.find((s) => duration / s <= maxTicks) ?? Math.ceil(duration / maxTicks / 3600) * 3600
  const count = Math.floor(duration / step + 1e-9)
  return Array.from({ length: count + 1 }, (_, i) => Math.round(i * step * 1000) / 1000)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
