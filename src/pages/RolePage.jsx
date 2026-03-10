import { KO } from '../constants/messages.ko'
import { useAuth } from '../contexts/AuthContext'

function RolePage({ title, allowRoles }) {
  const { user } = useAuth()
  const t = KO.rolePage

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl p-6 md:p-10">
      <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm text-slate-600">{t.allowedOnly}: {allowRoles.join(', ')}</p>
        <p className="mt-2 text-sm text-slate-700">{t.currentRoles}: {(user?.roles || []).join(', ') || KO.common.none}</p>
      </section>
    </main>
  )
}

export default RolePage
