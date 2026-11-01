import { GitHubIcon, MoonIcon, SunIcon, UploadIcon } from './icons'
import { useTheme } from '../theme'

export function Header({ fileName, onOpen }: { fileName: string | null; onOpen: () => void }) {
  const { theme, toggle, error } = useTheme()

  return (
    <header className="topbar">
      <nav className="topbar-inner" aria-label="Primary navigation" onKeyDown={(event) => event.stopPropagation()}>
        <a className="brand" href="https://uug.ai/" aria-label="UUG.AI homepage">
          <img className="brand-logo" src="/uug-logo.svg" alt="" width="70" height="23" />
          <span className="brand-product">Editor</span>
        </a>
        <a className="topbar-link" href="https://uug.ai/">Home</a>
        {fileName && (
          <div className="file-context">
            <span className="file-name" title={fileName}>{fileName}</span>
            <button type="button" className="button" onClick={onOpen}>
              <UploadIcon size={18} />
              Open another
            </button>
          </div>
        )}
        <div className="topbar-actions">
          <button
            type="button"
            className="topbar-icon"
            aria-label="Toggle dark mode"
            aria-pressed={theme === 'dark'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggle}
          >
            {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
          </button>
          <a
            className="topbar-icon"
            href="https://github.com/uug-ai"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="UUG.AI on GitHub"
            title="UUG.AI on GitHub"
          >
            <GitHubIcon />
          </a>
        </div>
        {error && <p className="theme-status" role="status">{error}</p>}
      </nav>
    </header>
  )
}
