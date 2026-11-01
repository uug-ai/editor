(() => {
  const root = document.documentElement
  let preference = null
  try {
    const saved = localStorage.getItem('editor.theme')
    if (saved === 'light' || saved === 'dark') preference = saved
    else if (saved !== null) console.warn('Ignoring invalid Editor theme preference')
  } catch (error) {
    console.warn('Could not read Editor theme preference', error)
    root.dataset.themeError = "Couldn't restore your theme preference."
  }
  if (preference) root.dataset.themePreference = preference
  root.dataset.theme = preference ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
})()
