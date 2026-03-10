import { Link, useNavigate } from 'react-router-dom'
import { KO } from '../constants/messages.ko'
import { useAuth } from '../contexts/AuthContext'

function PendingHomePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const t = KO.pending

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-10">
      <section className="w-full rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">PENDING</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-3 text-sm text-slate-600">{t.subtitle}</p>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p><span className="font-semibold">{t.email}:</span> {user?.email}</p>
          <p><span className="font-semibold">{t.roles}:</span> {(user?.roles || []).join(', ') || KO.common.none}</p>
        </div>

        <div className="mt-6 flex gap-2">
          <Link to="/home" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            {t.retry}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            {t.logout}
          </button>
        </div>
      </section>
    </main>
  )
}

export default PendingHomePage
