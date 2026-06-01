import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ThemeToggleButton } from './ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'
import { SidebarNavIcon } from './SidebarNavIcon'

const navItems = [
  { id: 'home', label: '개요', path: '/app' },
  { id: 'children', label: '아동 관리', path: '/app/children' },
  { id: 'analysis', label: '분석', path: '/app/analysis' },
  { id: 'offline', label: '오프라인', path: '/app/offline' },
  { id: 'reports', label: '리포트', path: '/app/reports' },
  { id: 'alerts', label: '알림', path: '/app/alerts' },
  { id: 'settings', label: '설정', path: '/app/settings' },
]

export function TherapistStatsShell({ activeId, title, subtitle, children }) {
  const navigate = useNavigate()
  const { jwtPayload, user, logout } = useAuth()
  const [isNavOpen, setIsNavOpen] = useState(false)

  const displayName = user?.name || jwtPayload?.name || '치료사'

  function handleNavigate(path) {
    navigate(path)
    setIsNavOpen(false)
  }

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="stats-root">
      <header className="stats-app-header">
        <p className="stats-app-brand">My Expression Friend</p>
        <div className="stats-app-actions">
          <button
            aria-expanded={isNavOpen}
            aria-label={isNavOpen ? '메뉴 닫기' : '메뉴 열기'}
            className="stats-menu-toggle"
            onClick={() => setIsNavOpen((value) => !value)}
            type="button"
          >
            <span aria-hidden="true" className="stats-menu-lines">
              <span />
              <span />
              <span />
            </span>
          </button>
          <ThemeToggleButton />
        </div>
      </header>

      {isNavOpen ? (
        <button
          aria-label="메뉴 닫기"
          className="stats-sidebar-backdrop"
          onClick={() => setIsNavOpen(false)}
          type="button"
        />
      ) : null}

      <aside className={`stats-sidebar ${isNavOpen ? 'mobile-open' : ''}`}>
        <div>
          <nav className="stats-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`stats-nav-item ${activeId === item.id ? 'active' : ''}`}
                onClick={() => handleNavigate(item.path)}
                type="button"
              >
                <SidebarNavIcon id={item.id} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="stats-sidebar-bottom">
          <div className="stats-profile-card">
            <div className="stats-profile-avatar">DR</div>
            <div className="stats-profile-meta">
              <p className="stats-profile-name">{displayName}</p>
              <p className="stats-profile-sub">치료사 계정</p>
              <p className="stats-profile-role">치료사 모드</p>
            </div>
          </div>
          <button className="stats-logout-btn" onClick={handleLogout} type="button">
            로그아웃
          </button>
        </div>
      </aside>

      <main className="stats-main">
        <header className="stats-topbar">
          <div>
            <p className="eyebrow">치료사 워크스페이스</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </header>

        {children}
      </main>
    </div>
  )
}
