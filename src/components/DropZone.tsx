import { UploadIcon } from './icons'

interface Props {
  onOpen: () => void
}

/** The empty state: drop a video anywhere on the page, or choose one. */
export function DropZone({ onOpen }: Props) {
  return (
    <div className="drop-zone">
      <span className="drop-zone-icon">
        <UploadIcon size={28} />
      </span>
      <h1>Trim a video</h1>
      <p>Drop a video here, or choose one from your computer. It never leaves your browser.</p>
      <button className="button primary" onClick={onOpen}>
        Choose a video
      </button>
      <p className="drop-zone-formats">MP4, MOV, WebM or MKV</p>
    </div>
  )
}
