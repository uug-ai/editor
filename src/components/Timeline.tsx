import { useRef } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { clamp, formatTime, moveEnd, moveStart, ticks } from '../time'
import type { Range } from '../time'

type Drag = 'start' | 'end' | 'scrub'

interface Props {
  duration: number
  range: Range
  time: number
  /** Thumbnail URLs spread evenly over the video; missing ones are still decoding. */
  frames: readonly (string | undefined)[]
  /** The shortest clip allowed, and how far the arrow keys move a handle: one frame. */
  frame: number
  onRange: (range: Range) => void
  onSeek: (time: number) => void
}

/** A filmstrip of the video with a handle at each end of the clip and the playhead. Drag anywhere else to scrub. */
export function Timeline({ duration, range, time, frames, frame, onRange, onSeek }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ kind: Drag; offset: number } | null>(null)
  const at = (t: number) => `${(t / duration) * 100}%`

  const timeAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect()
    return clamp((clientX - rect.left) / rect.width, 0, 1) * duration
  }

  /** Moves a handle or the playhead; the preview follows the handle so you can see the frame you cut at. */
  const move = (kind: Drag, t: number) => {
    if (kind === 'start') {
      const next = moveStart(range, t, frame)
      onRange(next)
      onSeek(next.start)
    } else if (kind === 'end') {
      const next = moveEnd(range, t, duration, frame)
      onRange(next)
      onSeek(next.end)
    } else {
      onSeek(t)
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-handle]')
    const kind = (handle?.dataset.handle as Drag | undefined) ?? 'scrub'
    const t = timeAt(event.clientX)
    // Grabbing a handle off-centre shouldn't make it jump.
    drag.current = { kind, offset: kind === 'scrub' ? 0 : t - range[kind] }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    handle?.focus()
    if (kind === 'scrub') move('scrub', t)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) move(drag.current.kind, timeAt(event.clientX) - drag.current.offset)
  }

  const onPointerUp = () => {
    drag.current = null
  }

  const onHandleKey = (kind: 'start' | 'end') => (event: KeyboardEvent) => {
    const by = event.shiftKey ? 1 : frame
    const value = range[kind]
    const next: Record<string, number> = {
      ArrowLeft: value - by,
      ArrowDown: value - by,
      ArrowRight: value + by,
      ArrowUp: value + by,
      Home: 0,
      End: duration,
    }
    if (!(event.key in next)) return
    event.preventDefault()
    event.stopPropagation()
    move(kind, next[event.key])
  }

  const handle = (kind: 'start' | 'end', label: string) => (
    <div
      className={`timeline-handle ${kind}`}
      style={{ left: at(range[kind]) }}
      data-handle={kind}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={range[kind]}
      aria-valuetext={formatTime(range[kind])}
      onKeyDown={onHandleKey(kind)}
    />
  )

  return (
    <div className="timeline">
      <div
        ref={track}
        className="timeline-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="filmstrip">
          {frames.map((url, i) => (url ? <img key={i} src={url} alt="" draggable={false} /> : <span key={i} />))}
        </div>
        <div className="timeline-shade" style={{ left: 0, width: at(range.start) }} />
        <div className="timeline-shade" style={{ left: at(range.end), right: 0 }} />
        <div className="timeline-selection" style={{ left: at(range.start), width: at(range.end - range.start) }} />
        {handle('start', 'Start of clip')}
        {handle('end', 'End of clip')}
        <div className="playhead" style={{ left: at(clamp(time, 0, duration)) }} />
      </div>
      <div className="timeline-scale" aria-hidden="true">
        {ticks(duration, 8).map((t) => (
          <span key={t} style={{ left: at(t) }}>
            {formatTime(t, t % 1 === 0 ? 0 : 2)}
          </span>
        ))}
      </div>
    </div>
  )
}
