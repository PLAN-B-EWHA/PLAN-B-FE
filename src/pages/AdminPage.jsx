import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FeedbackBanner from '../components/FeedbackBanner'
import { listUsersRequest, promoteUserRoleRequest } from '../api'
import { KO } from '../constants/messages.ko'
import { useAuth } from '../contexts/AuthContext'
import { resolveErrorMessage } from '../utils/errorMessage'

const PROMOTABLE_ROLES = ['PARENT', 'THERAPIST', 'TEACHER']

function AdminPage() {
  const { withAuthRetry, logout } = useAuth()
  const navigate = useNavigate()
  const t = KO.admin
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [roleSelections, setRoleSelections] = useState({})

  const pendingUsers = useMemo(
    () => users.filter((user) => (user.roles || []).map((r) => String(r).toUpperCase()).includes('PENDING')),
    [users],
  )

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await withAuthRetry((token) => listUsersRequest(token))
      const data = response?.data || []
      setUsers(data)

      const nextSelections = {}
      data.forEach((user) => {
        nextSelections[user.userId] = 'PARENT'
      })
      setRoleSelections(nextSelections)
    } catch (e) {
      setError(resolveErrorMessage(e, t.loadError))
    } finally {
      setLoading(false)
    }
  }

  const onChangeRole = (userId, role) => {
    setRoleSelections((prev) => ({ ...prev, [userId]: role }))
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const promote = async (userId) => {
    const role = roleSelections[userId]
    if (!role) return

    setError('')
    setSuccess('')

    try {
      await withAuthRetry((token) => promoteUserRoleRequest(token, userId, role))
      setSuccess(`${t.promoteDone}: ${userId} -> ${role}`)
      await loadUsers()
    } catch (e) {
      setError(resolveErrorMessage(e, t.promoteError))
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">ADMIN</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadUsers} disabled={loading} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400">
              {loading ? t.listLoading : t.listLoad}
            </button>
            <button type="button" onClick={handleLogout} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">{t.logout}</button>
          </div>
        </div>

        <FeedbackBanner error={error} success={success} />

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">{t.email}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">{t.name}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">{t.roles}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">{t.promote}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">{t.noUser}</td>
                </tr>
              )}

              {users.map((user) => {
                const roles = (user.roles || []).map((r) => String(r).toUpperCase())
                const isPending = roles.includes('PENDING')

                return (
                  <tr key={user.userId}>
                    <td className="px-4 py-3 text-slate-800">{user.email}</td>
                    <td className="px-4 py-3 text-slate-700">{user.name}</td>
                    <td className="px-4 py-3 text-slate-700">{roles.join(', ') || KO.common.none}</td>
                    <td className="px-4 py-3">
                      {isPending ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <select value={roleSelections[user.userId] || 'PARENT'} onChange={(e) => onChangeRole(user.userId, e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                            {PROMOTABLE_ROLES.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => promote(user.userId)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">{t.promote}</button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">{t.noPromote}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-500">{t.pendingOnly}</p>
        <p className="mt-1 text-xs text-slate-500">{t.pendingCount}: {pendingUsers.length}</p>
      </section>
    </main>
  )
}

export default AdminPage
