import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage } from '../lib/api'

const REMEMBERED_EMAIL_KEY = 'mef_remembered_email'

const loginInitialState = {
  email: '',
  password: '',
}

const registerInitialState = {
  email: '',
  password: '',
  name: '',
}

function Field({ label, name, type = 'text', value, onChange, placeholder }) {
  return (
    <label className="block space-y-2">
      <span className="text-[13px] font-semibold tracking-tight text-slate-700">{label}</span>
      <input
        className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-100)]"
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  )
}

function AuthTabs({ tab, setTab }) {
  return (
    <div className="mx-auto grid w-full max-w-[240px] grid-cols-2 rounded-full bg-[var(--brand-50)] p-1">
      <button
        className={`rounded-full px-4 py-2.5 text-[13px] font-bold tracking-tight transition ${
          tab === 'login' ? 'bg-[var(--brand-500)] text-white shadow-sm' : 'text-[var(--brand-700)]'
        }`}
        onClick={() => setTab('login')}
        type="button"
      >
        로그인
      </button>
      <button
        className={`rounded-full px-4 py-2.5 text-[13px] font-bold tracking-tight transition ${
          tab === 'register' ? 'bg-[var(--brand-500)] text-white shadow-sm' : 'text-[var(--brand-700)]'
        }`}
        onClick={() => setTab('register')}
        type="button"
      >
        회원가입
      </button>
    </div>
  )
}

function VisualPanel() {
  return (
    <section className="app-hero relative hidden overflow-hidden rounded-[1.8rem] lg:block">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--brand-100)_0%,var(--brand-200)_38%,var(--brand-500)_100%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.9)_0.8px,transparent_0.8px)] [background-size:15px_15px]" />
      <div className="absolute left-[18%] top-[18%] h-[48%] w-[28%] rounded-t-[10rem] rounded-b-[2rem] border border-white/20 bg-[rgba(255,255,255,0.18)] shadow-[0_30px_80px_rgba(15,23,42,0.14)] backdrop-blur-[2px]" />
      <div className="absolute left-[35%] top-[28%] h-[42%] w-[18%] rounded-[1rem] border border-white/18 bg-[rgba(255,255,255,0.14)] backdrop-blur-[2px]" />
      <div className="absolute bottom-[16%] left-[8%] h-[18%] w-[78%] rounded-[2rem] bg-[linear-gradient(180deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0.24)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(180deg,transparent_0%,rgba(15,23,42,0.54)_100%)]" />

      <div className="absolute bottom-12 left-10 right-10 text-white">
        <h1 className="text-[2.6rem] font-black leading-[1.05] tracking-tight">
          나의 표정친구:
          <br />
          감정과 표현을
          <br />
          더 정확히 이해해요
        </h1>
        <p className="mt-3 text-base font-semibold text-slate-100/80">치료소통 통계 플랫폼</p>
      </div>
    </section>
  )
}

export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isHydrating, login, register } = useAuth()
  const [tab, setTab] = useState('login')
  const [loginForm, setLoginForm] = useState(loginInitialState)
  const [registerForm, setRegisterForm] = useState(registerInitialState)
  const [rememberEmail, setRememberEmail] = useState(false)
  const [emailCheck, setEmailCheck] = useState(null)
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY)
    if (!rememberedEmail) return

    setRememberEmail(true)
    setLoginForm((current) => ({ ...current, email: rememberedEmail }))
  }, [])

  if (!isHydrating && isAuthenticated) {
    const target = location.state?.from?.pathname || '/app'
    return <Navigate to={target} replace />
  }

  function handleLoginChange(event) {
    const { name, value } = event.target
    setLoginForm((current) => ({ ...current, [name]: value }))
  }

  function handleRegisterChange(event) {
    const { name, value } = event.target
    setRegisterForm((current) => ({ ...current, [name]: value }))
  }

  async function handleCheckEmail() {
    if (!registerForm.email) {
      setFeedback({ type: 'error', message: '이메일을 먼저 입력해 주세요.' })
      return
    }

    setSubmitting(true)
    setFeedback({ type: '', message: '' })

    try {
      const response = await apiFetch(`/auth/check-email?email=${encodeURIComponent(registerForm.email)}`)
      const available = response?.data?.available
      setEmailCheck(available)
      setFeedback({
        type: available ? 'success' : 'error',
        message: available ? '사용 가능한 이메일입니다.' : '이미 사용 중인 이메일입니다.',
      })
    } catch (error) {
      setEmailCheck(null)
      setFeedback({ type: 'error', message: extractApiErrorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setFeedback({ type: '', message: '' })

    try {
      await login(loginForm)

      if (rememberEmail) {
        window.localStorage.setItem(REMEMBERED_EMAIL_KEY, loginForm.email)
      } else {
        window.localStorage.removeItem(REMEMBERED_EMAIL_KEY)
      }

      navigate('/app', { replace: true })
    } catch (error) {
      setFeedback({ type: 'error', message: extractApiErrorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setFeedback({ type: '', message: '' })

    try {
      await register(registerForm)
      setRegisterForm(registerInitialState)
      setEmailCheck(null)
      setFeedback({ type: 'success', message: '회원가입이 완료되었습니다. 로그인해 주세요.' })
      setTab('login')
      setLoginForm((current) => ({ ...current, email: registerForm.email }))
    } catch (error) {
      setFeedback({ type: 'error', message: extractApiErrorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--app-canvas)] px-3 py-3 text-slate-900 md:px-5 md:py-5">
      <main className="app-card mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1580px] gap-5 p-5 lg:grid-cols-[1.08fr_0.92fr]">
        <VisualPanel />

        <section className="flex min-h-[760px] flex-col px-4 py-3 md:px-8 lg:px-10">
          <div className="flex items-center justify-end">
            <p className="text-[17px] font-black tracking-tight text-slate-950">My Expression Friend</p>
          </div>

          <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col pt-20">
            <div className="min-h-[160px] text-center">
              <p className="text-[13px] font-semibold text-[var(--brand-500)]">Welcome to My Expression Friend</p>
              <div className="mt-5">
                <AuthTabs setTab={setTab} tab={tab} />
              </div>
              <div className="mt-8">
                <p className="mx-auto max-w-[360px] text-sm leading-6 text-slate-500">
                  {tab === 'login'
                    ? '로그인 후 학생 기록, 치료 분석, 권한 관리 화면으로 바로 이동할 수 있습니다.'
                    : '이메일과 이름을 입력하고 계정을 생성해 서비스를 시작해 보세요.'}
                </p>
              </div>
            </div>

            {feedback.message ? (
              <div
                className={`mt-6 rounded-2xl border px-4 py-3 text-[13px] font-semibold ${
                  feedback.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {feedback.message}
              </div>
            ) : null}

            <div className="mt-8 min-h-[360px]">
              {tab === 'login' ? (
                <form className="space-y-5" onSubmit={handleLoginSubmit}>
                  <Field
                    label="이메일 주소"
                    name="email"
                    onChange={handleLoginChange}
                    placeholder="이메일 주소를 입력해 주세요"
                    type="email"
                    value={loginForm.email}
                  />
                  <Field
                    label="비밀번호"
                    name="password"
                    onChange={handleLoginChange}
                    placeholder="비밀번호를 입력해 주세요"
                    type="password"
                    value={loginForm.password}
                  />

                  <div className="flex items-center text-[12px] text-slate-500">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        checked={rememberEmail}
                        className="h-3.5 w-3.5 rounded border-slate-300 accent-[var(--brand-500)]"
                        onChange={(event) => setRememberEmail(event.target.checked)}
                        type="checkbox"
                      />
                      <span className="font-medium">이메일 주소 기억하기</span>
                    </label>
                  </div>

                  <button
                    className="mx-auto mt-6 block w-full max-w-[200px] rounded-full bg-[var(--brand-500)] px-4 py-3.5 text-sm font-bold tracking-tight text-white transition hover:bg-[var(--brand-600)] disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={submitting}
                    type="submit"
                  >
                    {submitting ? '로그인 중...' : '로그인'}
                  </button>
                </form>
              ) : (
                <form className="space-y-5" onSubmit={handleRegisterSubmit}>
                  <Field
                    label="이메일 주소"
                    name="email"
                    onChange={handleRegisterChange}
                    placeholder="이메일 주소를 입력해 주세요"
                    type="email"
                    value={registerForm.email}
                  />
                  <Field
                    label="이름"
                    name="name"
                    onChange={handleRegisterChange}
                    placeholder="이름을 입력해 주세요"
                    value={registerForm.name}
                  />
                  <Field
                    label="비밀번호"
                    name="password"
                    onChange={handleRegisterChange}
                    placeholder="비밀번호를 입력해 주세요"
                    type="password"
                    value={registerForm.password}
                  />

                  <div className="rounded-2xl bg-[var(--brand-50)] px-4 py-3 text-xs font-medium leading-5 text-slate-600">
                    {emailCheck === null
                      ? '가입 전에 이메일 사용 가능 여부를 확인할 수 있어요.'
                      : emailCheck
                        ? '✓ 사용 가능한 이메일입니다.'
                        : '✗ 이미 사용 중인 이메일입니다.'}
                  </div>

                  <div className="flex justify-center">
                    <button
                      className="rounded-full border border-[var(--brand-200)] bg-white px-5 py-2.5 text-[13px] font-bold tracking-tight text-[var(--brand-700)] transition hover:bg-[var(--brand-50)] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={submitting}
                      onClick={handleCheckEmail}
                      type="button"
                    >
                      이메일 중복 확인
                    </button>
                  </div>

                  <button
                    className="mx-auto mt-4 block w-full max-w-[200px] rounded-full bg-[var(--brand-500)] px-4 py-3.5 text-sm font-bold tracking-tight text-white transition hover:bg-[var(--brand-600)] disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={submitting}
                    type="submit"
                  >
                    {submitting ? '가입 처리 중...' : '계정 만들기'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
