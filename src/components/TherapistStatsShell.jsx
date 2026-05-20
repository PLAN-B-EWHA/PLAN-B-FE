import { useNavigate } from 'react-router-dom'
import { ThemeToggleButton } from './ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { id: 'home', label: '개요', path: '/app' },
  { id: 'children', label: '아동관리', path: '/app/children' },
  { id: 'analysis', label: '통계', path: '/app/analysis' },
  { id: 'offline', label: '오프라인', path: '/app/offline' },
  { id: 'alerts', label: '알림', path: '/app/alerts' },
  { id: 'settings', label: '설정', path: '/app/settings' },
]

export function TherapistStatsShell({ activeId, title, subtitle, children }) {
  const navigate = useNavigate()
  const { jwtPayload, user, logout } = useAuth()

  const displayName = user?.name || jwtPayload?.name || '치료사'
  const roleLabel = user?.roles?.[0] || jwtPayload?.roles?.[0] || 'THERAPIST'

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="stats-root">
      <aside className="stats-sidebar">
        <div>
          <div className="stats-brand">
            <p className="stats-brand-title">My Expression Friend</p>
          </div>

          <nav className="stats-nav">
            <p>메뉴</p>
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`stats-nav-item ${activeId === item.id ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                type="button"
              >
                <span>•</span>
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
              <p className="stats-profile-sub">치료사 ·</p>
              <p className="stats-profile-role">ROLE_{roleLabel}</p>
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
            <p className="stats-eyebrow">치료사 대시보드</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="stats-topbar-user">
            <ThemeToggleButton />
          </div>
        </header>

        {children}
      </main>
    </div>
  )
}
