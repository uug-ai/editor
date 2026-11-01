import { describe, expect, it } from 'vitest'
import { formatBytes, formatTime, moveEnd, moveStart, ticks } from './time'

describe('formatTime', () => {
  it('shows minutes, seconds and hundredths', () => {
    expect(formatTime(0)).toBe('0:00.00')
    expect(formatTime(5.5)).toBe('0:05.50')
    expect(formatTime(65.123)).toBe('1:05.12')
  })

  it('rounds up into the next second and minute', () => {
    expect(formatTime(59.999)).toBe('1:00.00')
    expect(formatTime(1.996, 1)).toBe('0:02.0')
  })

  it('adds hours from an hour on', () => {
    expect(formatTime(3600)).toBe('1:00:00.00')
    expect(formatTime(3725.5, 0)).toBe('1:02:06')
  })

  it('never goes negative', () => {
    expect(formatTime(-3)).toBe('0:00.00')
  })
})

describe('moveStart', () => {
  it('moves the start inside the video', () => {
    expect(moveStart({ start: 0, end: 10 }, 4, 0.1)).toEqual({ start: 4, end: 10 })
    expect(moveStart({ start: 2, end: 10 }, -1, 0.1)).toEqual({ start: 0, end: 10 })
  })

  it('keeps the minimum length before the end', () => {
    expect(moveStart({ start: 0, end: 10 }, 12, 0.5)).toEqual({ start: 9.5, end: 10 })
  })
})

describe('moveEnd', () => {
  it('moves the end inside the video', () => {
    expect(moveEnd({ start: 0, end: 10 }, 6, 10, 0.1)).toEqual({ start: 0, end: 6 })
    expect(moveEnd({ start: 0, end: 6 }, 20, 10, 0.1)).toEqual({ start: 0, end: 10 })
  })

  it('keeps the minimum length after the start', () => {
    expect(moveEnd({ start: 4, end: 10 }, 1, 10, 0.5)).toEqual({ start: 4, end: 4.5 })
  })
})

describe('ticks', () => {
  it('picks the smallest round step that fits', () => {
    expect(ticks(10, 6)).toEqual([0, 2, 4, 6, 8, 10])
    expect(ticks(95, 6)).toEqual([0, 30, 60, 90])
    expect(ticks(1.2, 6)).toEqual([0, 0.25, 0.5, 0.75, 1])
  })

  it('handles long and empty videos', () => {
    expect(ticks(5 * 3600, 6)).toEqual([0, 3600, 7200, 10800, 14400, 18000])
    expect(ticks(30 * 3600, 6)).toEqual([0, 18000, 36000, 54000, 72000, 90000, 108000])
    expect(ticks(0, 6)).toEqual([])
  })
})

describe('formatBytes', () => {
  it('picks a readable unit', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(42 * 1024 * 1024)).toBe('42 MB')
  })
})
