import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const THEME_KEY = 'mef_theme'
const PALETTE_KEY = 'mef_palette'
const ThemeContext = createContext(null)

function getPreferredTheme() {
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getPreferredPalette() {
  const stored = window.localStorage.getItem(PALETTE_KEY)
  if (stored === 'clinical' || stored === 'sage-clinical' || stored === 'deep') {
    return stored
  }
  return 'clinical'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getPreferredTheme)
  const [palette, setPalette] = useState(getPreferredPalette)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.palette = palette
    window.localStorage.setItem(PALETTE_KEY, palette)
  }, [palette])

  const value = useMemo(
    () => ({
      theme,
      palette,
      isDarkMode: theme === 'dark',
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
      setPalette,
    }),
    [palette, theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return context
}
