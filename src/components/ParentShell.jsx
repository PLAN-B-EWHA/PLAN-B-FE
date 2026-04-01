import { useLocation, useNavigate } from 'react-router-dom'
import { ThemeToggleButton } from './ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'
import { calculateAgeLabel, resolveUploadUrl } from '../lib/childUtils'

const sidebarItems = [
  { id: 'home', label: '홈', path: '/app' },
  { id: 'children', label: '학생', path: '/app/children' },
  { id: 'records', label: '학습 기록' },
  { id: 'memo', label: '치료사 메모', path: '/parent/memo' },
  { id: 'report', label: '진행 리포트' },
  { id: 'settings', label: '설정' },
]

function getActiveId(pathname) {
  if (pathname.startsWith('/app/children')) {
    return 'children'
  }

  if (pathname.startsWith('/parent/memo')) {
    return 'memo'
  }

  return 'home'
}

function SidebarAvatar({ child }) {
  const imageUrl = resolveUploadUrl(child?.profileImageUrl)

  if (imageUrl) {
    return <img alt={child?.name || 'student'} className="h-11 w-11 rounded-full object-cover" src={imageUrl} />
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-500)] text-sm font-bold text-white">
      {child?.name?.[0] || '학'}
    </div>
  )
}

export function ParentShell({ children, selectedChild, childCount = 0, heading, subheading }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { jwtPayload, logout, user } = useAuth()
  const activeId = getActiveId(location.pathname)
  const displayName = user?.name || jwtPayload?.name || '보호자님'

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[var(--app-canvas)] text-slate-900">
      <div className="grid min-h-screen grid-cols-1 grid-rows-[64px_1fr] lg:grid-cols-[240px_1fr] lg:grid-rows-[64px_1fr]">
        <header className="col-span-full flex items-center gap-5 border-b border-slate-200 bg-white px-5 md:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-500)] text-xs font-black text-white">ME</div>
            <div>
              <p className="text-[15px] font-black tracking-tight text-slate-950">My Expression Friend</p>
              <p className="text-[11px] font-medium text-slate-400">보호자 대시보드</p>
            </div>
          </div>

          <div className="hidden h-6 w-px bg-slate-200 lg:block" />

          <div className="hidden lg:block">
            <p className="text-sm font-bold text-slate-900">{heading}</p>
            <p className="text-xs text-slate-400">{subheading}</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-slate-400">Signed in as</p>
              <p className="text-sm font-semibold text-slate-700">{displayName}</p>
            </div>
            <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.12)]" onClick={handleLogout} type="button">
              로그아웃
            </button>
          </div>
        </header>

        <aside className="hidden border-r border-slate-200 bg-white px-3 py-5 lg:flex lg:flex-col">
          <div className="mb-5 rounded-[1.35rem] border border-[var(--brand-200)] bg-[linear-gradient(180deg,#f7fbfc_0%,#ffffff_100%)] px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
            {selectedChild ? (
              <button className="flex w-full items-center gap-3 text-left" onClick={() => navigate('/app/children')} type="button">
                <SidebarAvatar child={selectedChild} />
                <div>
                  <p className="text-sm font-bold text-[var(--brand-700)]">{selectedChild.name}</p>
                  <p className="text-[11px] text-[var(--brand-600)]">
                    {calculateAgeLabel(selectedChild.birthDate)} · {childCount}명 관리 중
                  </p>
                </div>
                <span className="ml-auto text-[10px] font-semibold text-[var(--brand-600)]">열기</span>
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-bold text-[var(--brand-700)]">아직 등록된 학생이 없어요</p>
                <p className="text-[11px] leading-5 text-[var(--brand-600)]">첫 학생을 등록하면 홈과 학생 페이지가 실제 데이터로 채워집니다.</p>
              </div>
            )}
          </div>

          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Menu</div>
          <div className="space-y-1">
            {sidebarItems.map((item) => {
              const isActive = activeId === item.id
              const isAvailable = Boolean(item.path)

              return (
                <button
                  key={item.id}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                    isActive ? 'bg-[var(--brand-50)] text-[var(--brand-700)]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  } ${!isAvailable ? 'opacity-70' : ''}`}
                  onClick={() => {
                    if (item.path) {
                      navigate(item.path)
                    }
                  }}
                  type="button"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold">{item.label[0]}</span>
                  <span>{item.label}</span>
                  {item.id === 'children' && childCount > 0 ? (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand-500)] px-1.5 text-[10px] font-bold text-white">
                      {childCount}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="mt-auto pt-6">
            <ThemeToggleButton />
          </div>
        </aside>

        <main className="overflow-y-auto px-5 py-6 md:px-6">{children}</main>
      </div>
    </div>
  )
}
