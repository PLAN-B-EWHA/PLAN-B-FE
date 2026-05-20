import { useTheme } from '../contexts/ThemeContext'

export function ThemeToggleButton() {
  const { isDarkMode, toggleTheme, palette, setPalette } = useTheme()
  const palettes = ['clinical', 'sage-clinical', 'deep']
  const paletteColors = {
    clinical: '#2f6e89',
    'sage-clinical': '#5f7d51',
    deep: '#4f6ea8',
  }

  function cyclePalette() {
    const index = palettes.indexOf(palette)
    const next = palettes[(index + 1) % palettes.length]
    setPalette(next)
  }

  return (
    <section className="theme-compact-controls">
      <button className="theme-circle-btn" onClick={cyclePalette} type="button">
        <span className="theme-circle-fill" style={{ backgroundColor: paletteColors[palette] || paletteColors.clinical }} />
      </button>
      <button className="theme-mode-btn compact" onClick={toggleTheme} type="button">
        <div className={`theme-toggle ${isDarkMode ? 'dark' : ''}`}>
          <span />
        </div>
      </button>
    </section>
  )
}
