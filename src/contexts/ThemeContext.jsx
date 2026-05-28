import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const THEME_KEY = 'mef_theme'
const PALETTE_KEY = 'mef_palette'
const FONT_SCALE_KEY = 'mef_font_scale'
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

function getPreferredFontScale() {
  const stored = window.localStorage.getItem(FONT_SCALE_KEY)
  if (stored === 'compact' || stored === 'normal' || stored === 'large') {
    return stored
  }
  return 'normal'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getPreferredTheme)
  const [palette, setPalette] = useState(getPreferredPalette)
  const [fontScale, setFontScale] = useState(getPreferredFontScale)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.palette = palette
    window.localStorage.setItem(PALETTE_KEY, palette)
  }, [palette])

  useEffect(() => {
    document.documentElement.dataset.fontScale = fontScale
    document.documentElement.style.fontSize = fontScale === 'compact' ? '14px' : fontScale === 'large' ? '18px' : '16px'
    window.localStorage.setItem(FONT_SCALE_KEY, fontScale)
  }, [fontScale])

  const value = useMemo(
    () => ({
      theme,
      palette,
      fontScale,
      isDarkMode: theme === 'dark',
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
      setPalette,
      setFontScale,
    }),
    [fontScale, palette, theme],
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
