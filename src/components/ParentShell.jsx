import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ThemeToggleButton } from './ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'
import { calculateAgeLabel, resolveUploadUrl } from '../lib/childUtils'
import { SidebarNavIcon } from './SidebarNavIcon'

const navItems = [
  { id: 'home', label: '개요', path: '/app' },
  { id: 'children', label: '학생 관리', path: '/app/children' },
  { id: 'analysis', label: '통계', path: '/app/analysis' },
  { id: 'offline', label: '오프라인', path: '/app/offline' },
  { id: 'reports', label: '리포트', path: '/app/reports' },
  { id: 'alerts', label: '알림', path: '/app/alerts' },
  { id: 'settings', label: '설정', path: '/app/settings' },
]

function getActiveId(pathname) {
  if (pathname.startsWith('/app/children')) return 'children'
  if (pathname.startsWith('/app/analysis')) return 'analysis'
  if (pathname.startsWith('/app/offline')) return 'offline'
  if (pathname.startsWith('/app/reports')) return 'reports'
  if (pathname.startsWith('/app/alerts')) return 'alerts'
  if (pathname.startsWith('/app/settings')) return 'settings'
  return 'home'
}

function SidebarAvatar({ child }) {
  const imageUrl = resolveUploadUrl(child?.profileImageUrl)

  if (imageUrl) {
    return <img alt={child?.name || 'student'} className="h-11 w-11 rounded-full object-cover" src={imageUrl} />
  }

  return <div className="stats-profile-avatar">PA</div>
}

export function ParentShell({ actions, children, selectedChild, childCount = 0, heading, subheading }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { jwtPayload, logout, user } = useAuth()
  const [isNavOpen, setIsNavOpen] = useState(false)
  const activeId = getActiveId(location.pathname)
  const displayName = user?.name || jwtPayload?.name || '보호자'

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
            <SidebarAvatar child={selectedChild} />
            <div className="stats-profile-meta">
              <p className="stats-profile-name">{displayName}</p>
              <p className="stats-profile-sub">보호자 계정</p>
              <p className="stats-profile-role">보호자 모드</p>
              {selectedChild ? (
                <p className="stats-profile-sub mt-1">{selectedChild.name} · {calculateAgeLabel(selectedChild.birthDate)} · {childCount}명</p>
              ) : null}
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
            <p className="eyebrow">가족 케어</p>
            <h1>{heading || '개요'}</h1>
            <p>{subheading || '자녀 진행 상황을 확인합니다.'}</p>
          </div>
          {actions ? <div className="head-actions">{actions}</div> : null}
        </header>

        {children}
      </main>
    </div>
  )
}
