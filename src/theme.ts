import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
const storageKey = 'editor.theme'
const darkQuery = '(prefers-color-scheme: dark)'
const preference = (value: string | null | undefined): Theme | null =>
  value === 'light' || value === 'dark' ? value : null

export function useTheme() {
  const [choice, setChoice] = useState(() => preference(document.documentElement.dataset.themePreference))
  const [system, setSystem] = useState<Theme>(() => matchMedia(darkQuery).matches ? 'dark' : 'light')
  const [error, setError] = useState<string | null>(() => document.documentElement.dataset.themeError ?? null)
  const theme = choice ?? system

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const query = matchMedia(darkQuery)
    const onChange = () => setSystem(query.matches ? 'dark' : 'light')
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return
      try {
        if (event.storageArea !== localStorage) return
      } catch (cause) {
        console.warn('Could not synchronize Editor theme preference', cause)
        setError("Couldn't synchronize your theme preference.")
        return
      }
      if (event.newValue !== null && preference(event.newValue) === null) {
        console.warn('Ignoring invalid Editor theme preference')
      }
      setChoice(preference(event.newValue))
      setError(null)
    }
    query.addEventListener('change', onChange)
    onChange()
    window.addEventListener('storage', onStorage)
    return () => {
      query.removeEventListener('change', onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setChoice(next)
    try {
      localStorage.setItem(storageKey, next)
      setError(null)
    } catch (cause) {
      console.warn('Could not save Editor theme preference', cause)
      setError("Couldn't save your theme. It will reset when this page closes.")
    }
  }

  return { theme, toggle, error }
}
