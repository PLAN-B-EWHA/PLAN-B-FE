import { useTheme } from '../contexts/ThemeContext'

export function ThemeToggleButton() {
  const { isDarkMode, toggleTheme } = useTheme()

  return (
    <button
      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      onClick={toggleTheme}
      type="button"
    >
      <div>
        <p className="text-sm font-semibold text-slate-900">다크 모드</p>
        <p className="mt-1 text-xs text-slate-400">{isDarkMode ? '어두운 화면으로 보고 있어요' : '밝은 화면으로 보고 있어요'}</p>
      </div>
      <div className={`relative h-7 w-12 rounded-full transition ${isDarkMode ? 'bg-[var(--brand-500)]' : 'bg-slate-200'}`}>
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${isDarkMode ? 'left-6' : 'left-1'}`}
        />
      </div>
    </button>
  )
}
