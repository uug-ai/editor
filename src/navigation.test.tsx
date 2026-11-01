import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Header } from './components/Header'

const bootstrap = readFileSync(new URL('../public/theme.js', import.meta.url), 'utf8')

function initialize(saved: string | null, dark = false, blocked = false) {
  const dataset: Record<string, string> = {}
  const console = { warn: vi.fn() }
  runInNewContext(bootstrap, {
    document: { documentElement: { dataset } },
    localStorage: {
      getItem: vi.fn((key: string) => {
        expect(key).toBe('editor.theme')
        if (blocked) throw new Error('Storage blocked')
        return saved
      }),
    },
    matchMedia: (query: string) => {
      expect(query).toBe('(prefers-color-scheme: dark)')
      return { matches: dark }
    },
    console,
  })
  return { dataset, console }
}

afterEach(() => vi.unstubAllGlobals())

describe('theme before first paint', () => {
  it.each([false, true])('follows system dark=%s without a preference', (dark) => {
    const { dataset } = initialize(null, dark)
    expect(dataset.theme).toBe(dark ? 'dark' : 'light')
    expect(dataset.themePreference).toBeUndefined()
  })

  it.each(['light', 'dark'])('restores saved %s despite the system preference', (theme) => {
    const { dataset } = initialize(theme, theme === 'light')
    expect(dataset.theme).toBe(theme)
    expect(dataset.themePreference).toBe(theme)
  })

  it('logs an invalid preference and follows the system', () => {
    const { dataset, console } = initialize('unsupported', true)
    expect(dataset.theme).toBe('dark')
    expect(dataset.themePreference).toBeUndefined()
    expect(console.warn).toHaveBeenCalled()
  })

  it('keeps the system theme and exposes storage failures', () => {
    const { dataset, console } = initialize(null, true, true)
    expect(dataset.theme).toBe('dark')
    expect(dataset.themeError).toContain("Couldn't restore")
    expect(console.warn).toHaveBeenCalled()
  })

  it('loads the bootstrap in the head before the app', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    expect(html).toContain('<script src="/theme.js"></script>')
    expect(html.indexOf('<script src="/theme.js"></script>')).toBeLessThan(html.indexOf('</head>'))
  })
})

function header(fileName: string | null = null, dark = false, error?: string) {
  vi.stubGlobal('document', { documentElement: { dataset: { themeError: error } } })
  vi.stubGlobal('matchMedia', () => ({ matches: dark }))
  return renderToStaticMarkup(<Header fileName={fileName} onOpen={() => {}} />)
}

describe('primary navigation', () => {
  it('uses a compact UUG homepage wordmark and links GitHub to the organisation', () => {
    const html = header()
    expect(html).toContain('aria-label="Primary navigation"')
    expect(html).toContain('aria-label="UUG.AI homepage"')
    expect(html).toContain('href="https://uug.ai/"')
    expect(html).toContain('>UUG</a>')
    expect(html).not.toContain('brand-logo')
    expect(html).not.toContain('brand-product')
    expect(html).not.toContain('>Home</a>')
    expect(html).toContain('href="https://github.com/uug-ai"')
    expect(html).toContain('target="_blank" rel="noopener noreferrer"')
    expect(html).toContain('viewBox="3 3 18 18"')
    expect(html).toContain('fill="currentColor"')
    expect(html).not.toContain('Open another')
  })

  it('places GitHub before the theme toggle in keyboard and visual order', () => {
    const html = header()
    const github = html.indexOf('aria-label="UUG.AI on GitHub"')
    const theme = html.indexOf('aria-label="Toggle dark mode"')
    expect(github).toBeGreaterThan(-1)
    expect(theme).toBeGreaterThan(github)
  })

  it.each([false, true])('reports the current dark=%s theme accessibly', (dark) => {
    const html = header(null, dark)
    expect(html).toContain('aria-label="Toggle dark mode"')
    expect(html).toContain(`aria-pressed="${dark}"`)
    expect(html).toContain(dark ? 'Switch to light mode' : 'Switch to dark mode')
    expect(html).toContain(`class="theme-toggle${dark ? ' is-dark' : ''}"`)
    expect(html).toContain('class="theme-toggle-thumb"')
    expect(html).toContain('class="theme-toggle-sun"')
    expect(html).toContain('class="theme-toggle-moon"')
  })

  it('retains the filename and open control while editing', () => {
    const html = header('private-recording.mp4')
    expect(html).toContain('title="private-recording.mp4"')
    expect(html).toContain('Open another')
  })

  it('shows theme-storage failures without removing navigation', () => {
    const html = header(null, false, 'Theme storage blocked')
    expect(html).toContain('role="status">Theme storage blocked')
    expect(html).toContain('aria-label="Toggle dark mode"')
  })
})
