import { Link, useLocation } from 'react-router-dom'
import { KO } from '../constants/messages.ko'

function ForbiddenPage() {
  const location = useLocation()
  const requiredRoles = location.state?.requiredRoles || []
  const fromPath = location.state?.from || '/'
  const t = KO.forbidden

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-6 py-10">
      <section className="w-full rounded-2xl border border-rose-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">403 Forbidden</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-3 text-sm text-slate-700">{t.subtitle}</p>
        {requiredRoles.length > 0 && (
          <p className="mt-2 text-sm text-slate-600">{t.required}: {requiredRoles.join(', ')}</p>
        )}

        <div className="mt-6 flex gap-2">
          <Link to="/" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            {t.toDashboard}
          </Link>
          <Link to={fromPath} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            {t.retry}
          </Link>
        </div>
      </section>
    </main>
  )
}

export default ForbiddenPage
