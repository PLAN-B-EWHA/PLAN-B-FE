import { useTheme } from '../contexts/ThemeContext'

export function ThemeToggleButton() {
  const { isDarkMode, toggleTheme } = useTheme()

  return (
    <button
      aria-label="화면 모드 변경"
      className="theme-mode-btn compact"
      onClick={toggleTheme}
      title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
      type="button"
    >
      <div className={`theme-toggle ${isDarkMode ? 'dark' : ''}`}>
        <span />
      </div>
    </button>
  )
}
