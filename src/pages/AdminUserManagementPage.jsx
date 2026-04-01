import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

const roleOptions = ['PENDING', 'PARENT', 'THERAPIST', 'ADMIN']

function StatCard({ label, value, tone = 'default' }) {
  const toneClass =
    tone === 'brand'
      ? 'text-[var(--brand-700)]'
      : tone === 'warn'
        ? 'text-amber-700'
        : 'text-slate-950'

  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`mt-3 text-[28px] font-black leading-none tracking-tight ${toneClass}`}>{value}</p>
    </article>
  )
}

function roleBadgeClass(role) {
  if (role === 'ADMIN') {
    return 'bg-slate-900 text-white'
  }

  if (role === 'THERAPIST') {
    return 'bg-[var(--brand-50)] text-[var(--brand-700)]'
  }

  if (role === 'PARENT') {
    return 'bg-emerald-50 text-emerald-700'
  }

  return 'bg-amber-50 text-amber-700'
}

function normalizeRole(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) {
    return user.roles[0]
  }

  return user?.role || user?.memberRole || 'PENDING'
}

export function AdminUserManagementPage() {
  const navigate = useNavigate()
  const { accessToken, jwtPayload, logout, user } = useAuth()
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingUserId, setSavingUserId] = useState(null)
  const [feedback, setFeedback] = useState('')

  const displayName = user?.name || jwtPayload?.name || 'Admin'

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) {
      return users
    }

    return users.filter((item) =>
      [item.name, item.email, normalizeRole(item), String(item.userId ?? '')]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    )
  }, [search, users])

  const selectedUser =
    filteredUsers.find((item) => item.userId === selectedUserId) ||
    users.find((item) => item.userId === selectedUserId) ||
    filteredUsers[0] ||
    users[0] ||
    null

  const pendingCount = useMemo(
    () => users.filter((item) => normalizeRole(item) === 'PENDING').length,
    [users],
  )

  const therapistCount = useMemo(
    () => users.filter((item) => normalizeRole(item) === 'THERAPIST').length,
    [users],
  )

  useEffect(() => {
    let ignore = false

    async function loadUsers() {
      if (!accessToken) {
        setLoading(false)
        return
      }

      try {
        const response = await apiFetch('/admin/users', {
          method: 'GET',
          token: accessToken,
        })
        const payload = extractApiPayload(response)
        const nextUsers = Array.isArray(payload) ? payload : payload?.content || []

        if (!ignore) {
          setUsers(nextUsers)
          setSelectedUserId((current) => current || nextUsers[0]?.userId || null)
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) {
          setFeedback(extractApiErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadUsers()

    return () => {
      ignore = true
    }
  }, [accessToken])

  useEffect(() => {
    if (selectedUser) {
      setSelectedUserId(selectedUser.userId)
    }
  }, [selectedUser])

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const response = await apiFetch('/admin/users', {
        method: 'GET',
        token: accessToken,
      })
      const payload = extractApiPayload(response)
      const nextUsers = Array.isArray(payload) ? payload : payload?.content || []
      setUsers(nextUsers)
      setSelectedUserId((current) => current || nextUsers[0]?.userId || null)
      setFeedback('')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setRefreshing(false)
    }
  }

  async function handleRoleChange(userId, nextRole) {
    setSavingUserId(userId)
    setFeedback('')

    try {
      const response = await apiFetch(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          role: nextRole,
        },
      })

      const payload = extractApiPayload(response)

      setUsers((current) =>
        current.map((item) =>
          item.userId === userId
            ? payload && typeof payload === 'object'
              ? { ...item, ...payload }
              : { ...item, role: nextRole, roles: [nextRole] }
            : item,
        ),
      )
      setFeedback('사용자 역할을 변경했습니다.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSavingUserId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--app-canvas)] text-slate-900">
      <div className="grid min-h-screen grid-cols-1 grid-rows-[64px_1fr] lg:grid-cols-[280px_1fr] lg:grid-rows-[64px_1fr]">
        <header className="col-span-full flex items-center gap-5 border-b border-slate-200 bg-white px-5 md:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-500)] text-xs font-black text-white">ME</div>
            <div>
              <p className="text-[15px] font-black tracking-tight text-slate-950">My Expression Friend</p>
              <p className="text-[11px] font-medium text-slate-400">Admin Console</p>
            </div>
          </div>

          <div className="hidden h-6 w-px bg-slate-200 lg:block" />

          <div className="hidden lg:block">
            <p className="text-sm font-bold text-slate-900">회원 역할 관리</p>
            <p className="text-xs text-slate-400">관리자 권한으로 전체 사용자를 조회하고 역할을 변경할 수 있습니다.</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-slate-400">Signed in as</p>
              <p className="text-sm font-semibold text-slate-700">{displayName}</p>
            </div>
            <button
              className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.12)]"
              onClick={handleLogout}
              type="button"
            >
              로그아웃
            </button>
          </div>
        </header>

        <aside className="hidden border-r border-slate-200 bg-white px-4 py-5 lg:flex lg:flex-col">
          <div className="rounded-[1.5rem] border border-[var(--brand-200)] bg-[linear-gradient(180deg,#f7fbfc_0%,#ffffff_100%)] p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-600)]">Admin Panel</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">사용자 역할 승급</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">승인 대기 사용자, 보호자, 치료사, 관리자 권한을 한 곳에서 관리합니다.</p>
          </div>

          <div className="mt-4 grid gap-3">
            <StatCard label="전체 사용자" value={`${users.length}명`} tone="brand" />
            <StatCard label="승인 대기" value={`${pendingCount}명`} tone="warn" />
            <StatCard label="치료사" value={`${therapistCount}명`} tone="brand" />
          </div>

          <div className="mt-auto pt-6">
            <ThemeToggleButton />
          </div>
        </aside>

        <main className="overflow-y-auto px-5 py-6 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">User Directory</p>
              <h1 className="mt-2 text-[28px] font-black tracking-tight text-slate-950">전체 회원 역할 관리</h1>
              <p className="mt-1 text-sm text-slate-500">사용자를 선택한 뒤 역할을 변경하면 즉시 반영됩니다.</p>
            </div>
            <div className="md:ml-auto flex gap-2">
              <button
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                onClick={handleRefresh}
                type="button"
              >
                {refreshing ? '새로고침 중...' : '새로고침'}
              </button>
            </div>
          </div>

          {feedback ? (
            <div className="mt-5 rounded-2xl border border-[var(--brand-200)] bg-[var(--brand-50)] px-4 py-3 text-sm font-medium text-[var(--brand-700)]">
              {feedback}
            </div>
          ) : null}

          <section className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div>
                  <p className="text-sm font-semibold text-slate-900">사용자 목록</p>
                  <p className="mt-1 text-xs text-slate-400">이메일, 이름, 역할로 검색할 수 있습니다.</p>
                </div>
                <input
                  className="md:ml-auto w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-4 focus:ring-[rgba(3,150,166,0.12)] md:max-w-[280px]"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="이름, 이메일, 역할 검색"
                  value={search}
                />
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[0.7fr_1.2fr_1.2fr_0.8fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  <span>ID</span>
                  <span>이름</span>
                  <span>이메일</span>
                  <span>현재 역할</span>
                </div>

                <div>
                  {loading ? (
                    <div className="px-4 py-10 text-center text-sm text-slate-400">사용자 목록을 불러오는 중입니다...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-slate-400">조건에 맞는 사용자가 없습니다.</div>
                  ) : (
                    filteredUsers.map((item) => {
                      const currentRole = normalizeRole(item)
                      const isSelected = selectedUser?.userId === item.userId

                      return (
                        <button
                          key={item.userId}
                          className={`grid w-full grid-cols-[0.7fr_1.2fr_1.2fr_0.8fr] items-center gap-3 border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 ${
                            isSelected ? 'bg-[var(--brand-50)]' : 'bg-white hover:bg-slate-50'
                          }`}
                          onClick={() => setSelectedUserId(item.userId)}
                          type="button"
                        >
                          <span className="text-sm font-semibold text-slate-500">{item.userId}</span>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{item.name || '-'}</p>
                          </div>
                          <p className="truncate text-sm text-slate-600">{item.email || '-'}</p>
                          <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeClass(currentRole)}`}>
                            {currentRole}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </article>

            <article className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.04)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">선택한 사용자</p>
                <p className="mt-1 text-xs text-slate-400">역할 변경은 즉시 PATCH 요청을 보냅니다.</p>
              </div>

              {selectedUser ? (
                <>
                  <div className="mt-5 rounded-2xl bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Member</p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{selectedUser.name || '이름 없음'}</h2>
                        <p className="mt-1 text-sm text-slate-500">{selectedUser.email || '이메일 없음'}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeClass(normalizeRole(selectedUser))}`}>
                        {normalizeRole(selectedUser)}
                      </span>
                    </div>

                    <dl className="mt-5 grid gap-3">
                      <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                        <dt className="text-sm text-slate-500">사용자 ID</dt>
                        <dd className="text-sm font-semibold text-slate-900">{selectedUser.userId}</dd>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                        <dt className="text-sm text-slate-500">현재 역할</dt>
                        <dd className="text-sm font-semibold text-slate-900">{normalizeRole(selectedUser)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {roleOptions.map((role) => {
                      const active = normalizeRole(selectedUser) === role

                      return (
                        <button
                          key={role}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            active
                              ? 'border-[var(--brand-500)] bg-[var(--brand-50)]'
                              : 'border-slate-200 bg-white hover:border-[var(--brand-200)] hover:bg-slate-50'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                          disabled={savingUserId === selectedUser.userId || active}
                          onClick={() => handleRoleChange(selectedUser.userId, role)}
                          type="button"
                        >
                          <p className="text-sm font-bold text-slate-900">{role}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {role === 'PENDING'
                              ? '승인 대기 상태로 전환합니다.'
                              : role === 'PARENT'
                                ? '보호자 권한으로 설정합니다.'
                                : role === 'THERAPIST'
                                  ? '치료사 권한으로 승급합니다.'
                                  : '관리자 권한으로 설정합니다.'}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                  선택된 사용자가 없습니다.
                </div>
              )}
            </article>
          </section>
        </main>
      </div>
    </div>
  )
}
