import { useTheme } from '../contexts/ThemeContext'

export function ThemeToggleButton() {
  const { fontScale, isDarkMode, toggleTheme, palette, setPalette, setFontScale } = useTheme()
  const palettes = ['clinical', 'sage-clinical', 'deep']
  const fontScales = ['compact', 'normal', 'large']
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

  function cycleFontScale() {
    const index = fontScales.indexOf(fontScale)
    const next = fontScales[(index + 1) % fontScales.length]
    setFontScale(next)
  }

  const fontLabel = fontScale === 'compact' ? '가-' : fontScale === 'large' ? '가+' : '가'

  return (
    <section className="theme-compact-controls">
      <button aria-label="색상 팔레트 변경" className="theme-circle-btn" onClick={cyclePalette} title="색상 팔레트" type="button">
        <span className="theme-circle-fill" style={{ backgroundColor: paletteColors[palette] || paletteColors.clinical }} />
      </button>
      <button aria-label="글자 크기 변경" className="theme-font-btn" onClick={cycleFontScale} title="글자 크기" type="button">
        {fontLabel}
      </button>
      <button aria-label="다크 모드 변경" className="theme-mode-btn compact" onClick={toggleTheme} title="다크 모드" type="button">
        <div className={`theme-toggle ${isDarkMode ? 'dark' : ''}`}>
          <span />
        </div>
      </button>
    </section>
  )
}
