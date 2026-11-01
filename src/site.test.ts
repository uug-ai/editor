import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const title = 'UUG.AI Editor | Online Video Trimmer'
const url = 'https://edit.uug.ai/'
const hosts = [url, 'https://edit.uug.lol/', 'https://editor.uug.lol/']
const script = readFileSync(new URL('../public/analytics.js', import.meta.url), 'utf8')
const attributes = html.match(/<script id="analytics"([^>]*)>/)![1]
const dataset = Object.fromEntries([...attributes.matchAll(/data-([a-z-]+)="([^"]*)"/g)]
  .map(([, name, value]) => [name.replace(/-[a-z]/g, (match) => match[1].toUpperCase()), value]))
const consentKey = 'uug-analytics-consent'
type Options = {
  preference?: string | null
  readFailure?: boolean
  writeFailure?: boolean
  cookieFailure?: boolean
  missingControls?: boolean
}

function analytics(location: string, options: Options = {}) {
  let saved = options.preference ?? null
  const localStorage = {
    getItem: vi.fn(() => {
      if (options.readFailure) throw new Error('Storage blocked')
      return saved
    }),
    setItem: vi.fn((_key: string, value: string) => {
      if (options.writeFailure) throw new Error('Storage blocked')
      saved = value
    }),
  }
  const buttons = ['granted', 'denied'].map((preference) => {
    const listeners = new Map<string, () => void>()
    return {
      dataset: { analyticsConsent: preference },
      addEventListener: vi.fn((name: string, listener: () => void) => listeners.set(name, listener)),
      click: () => listeners.get('click')!(),
    }
  })
  const banner = { hidden: true, querySelectorAll: vi.fn(() => buttons), addEventListener: vi.fn() }
  const status = { hidden: true, textContent: '' }
  const listeners = new Map<string, (event: { key: string | null; newValue: string | null }) => void>()
  const dataLayer: ArrayLike<unknown>[] = []
  const window = {
    location: new URL(location), dataLayer,
    addEventListener: vi.fn((name: string, listener: (event: { key: string | null; newValue: string | null }) => void) => listeners.set(name, listener)),
  }
  const cookieWrites: string[] = []
  const document = {
    currentScript: { dataset },
    title: 'UUG.AI Editor | private-video.mp4',
    referrer: 'https://draw.uug.lol/b/private-referrer',
    querySelector: vi.fn((selector: string) => {
      if (selector === '#cookie-banner') return options.missingControls ? null : banner
      if (selector === '[data-analytics-status]') return status
      if (selector === 'link[rel="canonical"]') return { href: html.match(/rel="canonical" href="([^"]+)"/)![1] }
      if (selector === 'meta[property="og:title"]') return { content: html.match(/property="og:title" content="([^"]+)"/)![1] }
      return null
    }),
    get cookie() {
      if (options.cookieFailure) throw new Error('Cookies blocked')
      return `${dataset.cookiePrefix}_ga=owned; ${dataset.cookiePrefix}_ga_SESSION=owned; draw_ga=other; learn_ga=other; _ga=parent`
    },
    set cookie(value: string) { cookieWrites.push(value) },
    createElement: vi.fn(() => ({ async: false, src: '', onerror: () => {} })),
    head: { appendChild: vi.fn() },
  }
  const console = { error: vi.fn(), warn: vi.fn() }
  const run = () => runInNewContext(script, { window, document, localStorage, console })
  run()
  return {
    window, document, console, localStorage, banner, status, cookieWrites, run,
    choose: (preference: string) => buttons.find((button) => button.dataset.analyticsConsent === preference)!.click(),
    storage: (key: string | null, newValue: string | null) => listeners.get('storage')!({ key, newValue }),
    calls: () => window.dataLayer.map((entry) => Array.from(entry)),
  }
}

describe('site metadata', () => {
  it('keeps search and social metadata consistent and concise', () => {
    expect(html).toContain(`<title>${title}</title>`)
    expect(title.length).toBeLessThanOrEqual(60)
    expect(html).toContain(`<link rel="canonical" href="${url}"`)
    expect(html).toContain(`<meta property="og:title" content="${title}"`)
    expect(html).toContain(`<meta name="twitter:title" content="${title}"`)
    expect(html).toContain(`<meta property="og:url" content="${url}"`)
    expect(html).toContain(`<meta property="og:image" content="${url}android-chrome-512x512.png"`)
    expect(html).toContain(`<meta name="twitter:image" content="${url}android-chrome-512x512.png"`)
    const description = html.match(/<meta name="description" content="([^"]+)"/)![1]
    expect(description.length).toBeLessThanOrEqual(160)
    expect(description.length).toBeGreaterThan(50)
    const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])
    expect(data).toMatchObject({ '@type': 'WebApplication', url, description, publisher: { name: 'UUG.AI' } })
    expect(readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8')).toContain(`<loc>${url}</loc>`)
    expect(readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8')).toContain(`Sitemap: ${url}sitemap.xml`)
    for (const icon of ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png']) {
      expect(html).toContain(`href="/${icon}?v=uug-midnight"`)
      expect(readFileSync(new URL(`../public/${icon}`, import.meta.url)).length).toBeGreaterThan(0)
    }
  })

  it('includes Learn-style consent controls and a deferred local controller', () => {
    expect(attributes).toContain('defer src="/analytics.js"')
    expect(dataset).toMatchObject({ productionHost: 'edit.uug.ai', stagingHost: 'edit.uug.lol', legacyHost: 'editor.uug.lol', cookiePrefix: 'edit' })
    expect(html).toContain('aria-labelledby="cookie-heading" hidden')
    expect(html).toContain('We use cookies')
    expect(html).toContain('Accept cookies')
    expect(html).toContain('Reject cookies')
    expect(html).toContain('https://uug.ai/privacy/')
    expect(html).toContain('cookieless usage data')
  })
})

describe('analytics', () => {
  it.each(hosts)('tracks %s without sending filenames, query strings or referrers', (host) => {
    const { window, document } = analytics(`${host}?filename=private-video.mp4#secret`)
    const calls = window.dataLayer.map((entry) => Array.from(entry))
    expect(calls[0]).toEqual(['consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    }])
    expect(calls[2]).toEqual(['config', 'G-928MMDN0Q9', {
      send_page_view: false,
      page_title: title,
      page_location: url,
      page_referrer: '',
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: new URL(host).hostname,
      cookie_prefix: 'edit',
      cookie_expires: 31536000,
      cookie_flags: 'SameSite=Lax;Secure',
    }])
    expect(calls[3]).toEqual(['event', 'page_view', { send_to: 'G-928MMDN0Q9' }])
    expect(JSON.stringify(calls)).not.toContain('private')
    expect(document.head.appendChild).toHaveBeenCalledOnce()
    expect(document.createElement.mock.results[0].value).toMatchObject({
      async: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-928MMDN0Q9',
    })
  })

  it('shows the banner until choosing and persists acceptance without another tag or page view', () => {
    const fixture = analytics(url)
    expect(fixture.banner.hidden).toBe(false)
    fixture.choose('granted')
    expect(fixture.localStorage.setItem).toHaveBeenCalledWith(consentKey, 'granted')
    expect(fixture.calls().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'granted' }])
    expect(fixture.banner.hidden).toBe(true)
    expect(fixture.document.head.appendChild).toHaveBeenCalledOnce()
    expect(fixture.calls().filter((call) => call[0] === 'event')).toHaveLength(1)
  })

  it('restores acceptance after denied defaults and before configuration', () => {
    const fixture = analytics(url, { preference: 'granted' })
    expect(fixture.calls()[0][1]).toBe('default')
    expect(fixture.calls()[1]).toEqual(['consent', 'update', { analytics_storage: 'granted' }])
    expect(fixture.calls()[3][0]).toBe('config')
    expect(fixture.banner.hidden).toBe(true)
    expect(fixture.cookieWrites).toEqual([])
  })

  it.each(hosts)('persists rejection and clears only this app cookies on %s', (host) => {
    const domain = new URL(host).hostname
    const fixture = analytics(host, { preference: 'granted' })
    fixture.choose('denied')
    expect(fixture.localStorage.setItem).toHaveBeenCalledWith(consentKey, 'denied')
    expect(fixture.calls().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }])
    expect(fixture.banner.hidden).toBe(true)
    expect(fixture.cookieWrites).toEqual([
      'edit_ga=; Max-Age=0; Path=/; Secure; SameSite=Lax',
      `edit_ga=; Max-Age=0; Path=/; Secure; SameSite=Lax; Domain=${domain}`,
      'edit_ga_SESSION=; Max-Age=0; Path=/; Secure; SameSite=Lax',
      `edit_ga_SESSION=; Max-Age=0; Path=/; Secure; SameSite=Lax; Domain=${domain}`,
    ])
    const restored = analytics(host, { preference: 'denied' })
    expect(restored.banner.hidden).toBe(true)
    expect(restored.calls().filter((call) => call[1] === 'update')).toEqual([])
  })

  it('syncs consent changes, deletion and storage resets across tabs', () => {
    const fixture = analytics(url, { preference: 'granted' })
    fixture.storage('unrelated', 'denied')
    expect(fixture.calls().filter((call) => call[1] === 'update')).toHaveLength(1)
    fixture.storage(consentKey, 'denied')
    expect(fixture.calls().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }])
    expect(fixture.banner.hidden).toBe(true)
    fixture.storage(consentKey, null)
    expect(fixture.banner.hidden).toBe(false)
    fixture.storage(consentKey, 'granted')
    fixture.storage(null, null)
    expect(fixture.banner.hidden).toBe(false)
    expect(fixture.calls().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }])
    expect(fixture.document.head.appendChild).toHaveBeenCalledOnce()
  })

  it('reports blocked storage reads with cookies denied', () => {
    const fixture = analytics(url, { readFailure: true })
    expect(fixture.status.textContent).toContain('could not be read')
    expect(fixture.status.hidden).toBe(false)
    expect(fixture.banner.hidden).toBe(false)
    expect(fixture.calls()[0]).toContainEqual(expect.objectContaining({ analytics_storage: 'denied' }))
    expect(fixture.console.warn).toHaveBeenCalled()
  })

  it('reports blocked storage writes and applies the choice only to the page', () => {
    const fixture = analytics(url, { writeFailure: true })
    fixture.choose('granted')
    expect(fixture.status.textContent).toContain('could not be saved')
    expect(fixture.status.hidden).toBe(false)
    expect(fixture.banner.hidden).toBe(false)
    expect(fixture.calls().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'granted' }])
  })

  it('asks again for invalid stored preferences without granting consent', () => {
    const fixture = analytics(url, { preference: 'unexpected' })
    expect(fixture.banner.hidden).toBe(false)
    expect(fixture.status.textContent).toContain('not recognized')
    expect(fixture.calls().filter((call) => call[1] === 'update')).toEqual([])
  })

  it('does not load analytics when consent controls are missing', () => {
    const fixture = analytics(url, { missingControls: true })
    expect(fixture.calls()).toEqual([])
    expect(fixture.document.createElement).not.toHaveBeenCalled()
    expect(fixture.console.error).toHaveBeenCalledWith('Analytics is disabled because consent controls or site metadata are missing.')
  })

  it('initializes only once', () => {
    const fixture = analytics(url)
    fixture.run()
    expect(fixture.document.head.appendChild).toHaveBeenCalledOnce()
    expect(fixture.calls().filter((call) => call[0] === 'event')).toHaveLength(1)
  })

  it('reports cookie cleanup errors without blocking cookieless measurement', () => {
    const fixture = analytics(url, { cookieFailure: true })
    expect(fixture.status.textContent).toContain('could not be cleared')
    expect(fixture.status.hidden).toBe(false)
    expect(fixture.document.head.appendChild).toHaveBeenCalledOnce()
  })

  it.each(['http://localhost:5176/', 'http://127.0.0.1:5176/', 'https://preview.uug.lol/', 'https://edit.uug.ai.example.com/', 'https://edit.uug.lol.example.com/', 'https://editor.uug.lol.example.com/', 'http://edit.uug.ai/', 'http://edit.uug.lol/', 'http://editor.uug.lol/'])(
    'does not track development or other hosts: %s', (location) => {
      const { window, document, banner, localStorage } = analytics(location)
      expect(window.dataLayer).toEqual([])
      expect(document.createElement).not.toHaveBeenCalled()
      expect(banner.hidden).toBe(true)
      expect(localStorage.getItem).not.toHaveBeenCalled()
    },
  )

  it('reports tag load failures', () => {
    const { document, console, status, banner } = analytics(url, { preference: 'granted' })
    document.createElement.mock.results[0].value.onerror()
    expect(status.textContent).toBe('Google Analytics could not be loaded. You can still use the app.')
    expect(status.hidden).toBe(false)
    expect(banner.hidden).toBe(false)
    expect(console.warn).toHaveBeenCalled()
  })
})
