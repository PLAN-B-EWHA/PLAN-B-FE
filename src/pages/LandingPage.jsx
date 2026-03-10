import { Link, Navigate } from 'react-router-dom'
import { KO } from '../constants/messages.ko'
import { useAuth } from '../contexts/AuthContext'

function LandingPage() {
  const { isAuthenticated, isBootstrapping } = useAuth()
  const t = KO.landing

  if (!isBootstrapping && isAuthenticated) {
    return <Navigate to="/home" replace />
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-10">
      <section className="w-full rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-sm backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">MyExpressionFriend</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{t.subtitle}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            to="/login"
            className="rounded-lg bg-sky-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            {t.login}
          </Link>
          <Link
            to="/signup"
            className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            {t.signup}
          </Link>
        </div>
      </section>
    </main>
  )
}

export default LandingPage
