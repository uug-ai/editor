import type { Clip } from '../media'
import { formatBytes, formatTime } from '../time'
import type { Range } from '../time'
import { DownloadIcon, ScissorsIcon } from './icons'

export type Job =
  | { state: 'idle' }
  | { state: 'running'; progress: number; abort: AbortController }
  | { state: 'done'; clip: Clip }
  | { state: 'failed'; message: string }

interface Props {
  range: Range
  job: Job
  /** Where the trimmed clip can be downloaded from, once it's done. */
  downloadUrl: string | null
  onTrim: () => void
  onCancel: () => void
}

/** What will be kept, and the trim: its button, then its progress, then the download. */
export function ExportBar({ range, job, downloadUrl, onTrim, onCancel }: Props) {
  return (
    <div className="export-bar">
      <dl className="clip-summary">
        <div>
          <dt>Start</dt>
          <dd>{formatTime(range.start)}</dd>
        </div>
        <div>
          <dt>End</dt>
          <dd>{formatTime(range.end)}</dd>
        </div>
        <div>
          <dt>Length</dt>
          <dd>{formatTime(range.end - range.start)}</dd>
        </div>
      </dl>

      <div className="export-action" aria-live="polite">
        {job.state === 'idle' && (
          <button className="button primary" onClick={onTrim}>
            <ScissorsIcon />
            Trim video
          </button>
        )}

        {job.state === 'running' && (
          <>
            <div
              className="progress"
              role="progressbar"
              aria-label="Trimming"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(job.progress * 100)}
            >
              <span style={{ width: `${job.progress * 100}%` }} />
            </div>
            <span className="progress-label">Trimming… {Math.round(job.progress * 100)}%</span>
            <button className="button" onClick={onCancel}>
              Cancel
            </button>
          </>
        )}

        {job.state === 'done' && downloadUrl && (
          <>
            <span className="export-file">
              <strong title={job.clip.name}>{job.clip.name}</strong>
              <span>{formatBytes(job.clip.blob.size)}</span>
            </span>
            <a className="button primary" href={downloadUrl} download={job.clip.name}>
              <DownloadIcon />
              Download
            </a>
          </>
        )}

        {job.state === 'failed' && (
          <>
            <span className="export-error" role="alert">
              {job.message}
            </span>
            <button className="button" onClick={onTrim}>
              Try again
            </button>
          </>
        )}
      </div>

      {job.state === 'done' && job.clip.warnings.length > 0 && (
        <p className="export-warning">{job.clip.warnings.join(' ')}</p>
      )}
    </div>
  )
}
