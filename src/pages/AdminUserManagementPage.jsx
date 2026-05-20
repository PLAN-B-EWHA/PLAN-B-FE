import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminSidebarNav } from '../components/AdminSidebarNav'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

const roleOptions = ['PENDING', 'PARENT', 'THERAPIST', 'ADMIN']

function normalizeRole(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) return user.roles[0]
  return user?.role || user?.memberRole || 'PENDING'
}

function roleBadgeClass(role) {
  if (role === 'ADMIN') return 'bg-slate-900 text-white'
  if (role === 'THERAPIST') return 'bg-[var(--brand-50)] text-[var(--brand-700)]'
  if (role === 'PARENT') return 'bg-emerald-50 text-emerald-700'
  return 'bg-amber-50 text-amber-700'
}

export function AdminUserManagementPage() {
  const navigate = useNavigate()
  const { accessToken, logout } = useAuth()
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState(null)
  const [feedback, setFeedback] = useState('')

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return users
    return users.filter((item) => [item.name, item.email, normalizeRole(item), item.userId]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword)))
  }, [search, users])

  const selectedUser = filteredUsers.find((item) => item.userId === selectedUserId) || filteredUsers[0] || null

  useEffect(() => {
    let ignore = false
    async function loadUsers() {
      if (!accessToken) {
        setLoading(false)
        return
      }
      try {
        const res = await apiFetch('/admin/users', { method: 'GET', token: accessToken })
        const payload = extractApiPayload(res)
        const list = Array.isArray(payload) ? payload : payload?.content || []
        if (!ignore) {
          setUsers(list)
          setSelectedUserId(list[0]?.userId || null)
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    loadUsers()
    return () => { ignore = true }
  }, [accessToken])

  async function handleRoleChange(userId, role) {
    setSavingUserId(userId)
    setFeedback('')
    try {
      const res = await apiFetch(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        token: accessToken,
        body: { role },
      })
      const updated = extractApiPayload(res)
      setUsers((prev) => prev.map((item) => item.userId === userId ? { ...item, ...updated, role, roles: [role] } : item))
      setFeedback('권한이 변경되었습니다.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSavingUserId(null)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[var(--app-canvas)] text-slate-900">
      <div className="grid min-h-screen grid-cols-1 grid-rows-[64px_1fr] lg:grid-cols-[320px_1fr] lg:grid-rows-[64px_1fr]">
        <header className="col-span-full flex items-center border-b border-slate-200 bg-white px-5">
          <p className="text-lg font-black text-slate-900">My Expression Friend</p>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggleButton />
            <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm" onClick={handleLogout} type="button">로그아웃</button>
          </div>
        </header>

        <AdminSidebarNav activeId="users" />

        <main className="p-5">
          <h1 className="text-3xl font-black tracking-tight text-slate-950">회원 승격/권한</h1>
          <p className="mt-2 text-sm text-slate-500">사용자 역할을 조회하고 승격합니다.</p>

          {feedback ? <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{feedback}</div> : null}

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">사용자 목록</p>
                <input className="ml-auto rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(e) => setSearch(e.target.value)} placeholder="이름/이메일/권한 검색" value={search} />
              </div>

              <div className="mt-3 space-y-2">
                {loading ? <p className="text-sm text-slate-500">불러오는 중...</p> : null}
                {!loading && !filteredUsers.length ? <p className="text-sm text-slate-500">사용자가 없습니다.</p> : null}
                {filteredUsers.map((item) => {
                  const active = selectedUser?.userId === item.userId
                  return (
                    <button key={item.userId} className={`w-full rounded-xl border px-3 py-3 text-left ${active ? 'border-[var(--brand-200)] bg-[var(--brand-50)]' : 'border-slate-200 bg-white'}`} onClick={() => setSelectedUserId(item.userId)} type="button">
                      <p className="text-sm font-semibold text-slate-900">{item.name || '-'}</p>
                      <p className="text-xs text-slate-500">{item.email || '-'} · {item.userId}</p>
                    </button>
                  )
                })}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              {!selectedUser ? <p className="text-sm text-slate-500">사용자를 선택해 주세요.</p> : (
                <>
                  <p className="text-sm font-semibold text-slate-900">선택 사용자</p>
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-base font-bold text-slate-900">{selectedUser.name || '-'}</p>
                    <p className="text-sm text-slate-500">{selectedUser.email || '-'}</p>
                    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeClass(normalizeRole(selectedUser))}`}>{normalizeRole(selectedUser)}</span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {roleOptions.map((role) => {
                      const active = normalizeRole(selectedUser) === role
                      return (
                        <button key={role} className={`rounded-xl border px-3 py-3 text-left ${active ? 'border-[var(--brand-500)] bg-[var(--brand-50)]' : 'border-slate-200 bg-white'} disabled:opacity-60`} disabled={active || savingUserId === selectedUser.userId} onClick={() => handleRoleChange(selectedUser.userId, role)} type="button">
                          <p className="text-sm font-semibold text-slate-900">{role}</p>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </article>
          </section>
        </main>
      </div>
    </div>
  )
}
