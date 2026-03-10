import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import FeedbackBanner from '../components/FeedbackBanner'
import { registerRequest } from '../api'
import { KO } from '../constants/messages.ko'
import { useAuth } from '../contexts/AuthContext'
import { resolveErrorMessage } from '../utils/errorMessage'

function SignupPage() {
  const { isAuthenticated, isBootstrapping } = useAuth()
  const t = KO.signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isBootstrapping && isAuthenticated) {
    return <Navigate to="/home" replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      await registerRequest({ email, password, name })
      setSuccess(t.success)
      setPassword('')
    } catch (e) {
      setError(resolveErrorMessage(e, t.error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
      <section className="w-full rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">MyExpressionFriend</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{t.title}</h1>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t.name}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
              placeholder="홍길동"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t.email}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t.password}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring"
            />
          </div>

          <FeedbackBanner error={error} />
          {success ? <p className="text-sm font-medium text-emerald-700">{success}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {submitting ? t.submitting : t.submit}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          {t.loginHint}{' '}
          <Link to="/login" className="font-semibold text-sky-700 hover:underline">
            {t.loginLink}
          </Link>
        </p>
      </section>
    </main>
  )
}

export default SignupPage
