import { Link, useNavigate } from 'react-router-dom'
import { healthRequest } from '../api'
import { KO } from '../constants/messages.ko'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const t = KO.dashboard
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const onHealthCheck = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await healthRequest()
      setHealth(response?.data || response)
    } catch (e) {
      setError(e.message)
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
      <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Authenticated</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.title}</h1>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            {KO.parentHome.links.logout}
          </button>
        </div>

        <div className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p><span className="font-semibold">{KO.parentHome.user.name}:</span> {user?.name}</p>
          <p><span className="font-semibold">{KO.parentHome.user.email}:</span> {user?.email}</p>
          <p><span className="font-semibold">{KO.parentHome.user.roles}:</span> {(user?.roles || []).join(', ') || KO.common.none}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/admin" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">{t.admin}</Link>
          <Link to="/parent" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{t.parent}</Link>
          <Link to="/therapist" className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700">{t.therapist}</Link>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={onHealthCheck}
            disabled={loading}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? t.healthChecking : t.healthCheck}
          </button>

          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          {health && (
            <pre className="mt-3 overflow-x-auto rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              {JSON.stringify(health, null, 2)}
            </pre>
          )}
        </div>
      </section>
    </main>
  )
}

export default DashboardPage
