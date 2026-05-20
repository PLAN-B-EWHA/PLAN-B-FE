import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[rgba(11,105,139,0.14)] bg-white/70 px-4 py-3">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  )
}

export function PendingApprovalPage() {
  const { jwtPayload, logout, refreshSession, user } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [feedback, setFeedback] = useState('')

  const memberName = user?.name || jwtPayload?.name || '회원'
  const memberEmail = user?.email || jwtPayload?.email || '이메일 정보 없음'
  const roles = user?.roles || jwtPayload?.roles || []

  async function handleRefresh() {
    setIsRefreshing(true)
    setFeedback('')

    try {
      await refreshSession()
      setFeedback('승인 상태를 다시 확인했어요. 승인 완료 시 대시보드로 바로 들어갈 수 있습니다.')
    } catch {
      setFeedback('상태를 다시 확인하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(11,105,139,0.12),transparent_28%),linear-gradient(180deg,#eef7f8_0%,#f8fafc_50%,#ffffff_100%)] px-4 py-6 text-slate-900 md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur xl:grid-cols-[1.05fr_0.95fr]">
          <section className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(11,105,139,0.98)_0%,rgba(50,103,137,0.95)_100%)] px-8 py-10 text-white md:px-10 md:py-12">
            <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.95)_0.9px,transparent_0.9px)] [background-size:16px_16px]" />
            <div className="relative">
              <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-cyan-50">
                MY EXPRESSION FRIEND
              </div>

              <div className="mt-12 max-w-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-50/90">Approval Pending</p>
                <h1 className="mt-4 text-4xl font-black leading-tight md:text-5xl">
                  관리자 승인 후
                  <br />
                  서비스를 시작할 수 있어요
                </h1>
                <p className="mt-5 max-w-lg text-base leading-7 text-cyan-50/90">
                  가입은 완료되었고, 현재 계정은 승인 대기 상태입니다. 운영진이 확인을 마치면 보호자 또는 치료사
                  대시보드로 자동 진입할 수 있어요.
                </p>
              </div>

              <div className="mt-10 grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-white/14 bg-white/10 p-5">
                  <p className="text-sm text-cyan-50/80">현재 상태</p>
                  <p className="mt-2 text-2xl font-bold">PENDING</p>
                  <p className="mt-2 text-sm text-cyan-50/80">승인 전에는 일부 기능이 제한됩니다.</p>
                </div>
                <div className="rounded-3xl border border-white/14 bg-white/10 p-5">
                  <p className="text-sm text-cyan-50/80">다음 단계</p>
                  <p className="mt-2 text-2xl font-bold">관리자 확인</p>
                  <p className="mt-2 text-sm text-cyan-50/80">승인 완료 후 바로 메인 화면을 이용할 수 있어요.</p>
                </div>
                <div className="rounded-3xl border border-white/14 bg-white/10 p-5">
                  <p className="text-sm text-cyan-50/80">권장 안내</p>
                  <p className="mt-2 text-2xl font-bold">잠시 후 재확인</p>
                  <p className="mt-2 text-sm text-cyan-50/80">승인까지 시간이 걸릴 수 있으니 조금 뒤 다시 확인해 주세요.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="px-6 py-8 md:px-10 md:py-12">
            <div className="mx-auto max-w-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--brand-500)]">Pending Member</p>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{memberName}님, 승인 대기 중입니다</h2>
                </div>
                <div className="rounded-full bg-[rgba(11,105,139,0.12)] px-4 py-2 text-sm font-semibold text-[var(--brand-700)]">
                  승인 대기
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <InfoRow label="이름" value={memberName} />
                <InfoRow label="이메일" value={memberEmail} />
                <InfoRow label="권한" value={roles.join(', ') || 'PENDING'} />
              </div>

              <div className="mt-8 rounded-[1.75rem] border border-[rgba(11,105,139,0.14)] bg-[linear-gradient(180deg,rgba(11,105,139,0.06)_0%,rgba(11,105,139,0.02)_100%)] p-6">
                <h3 className="text-lg font-bold text-slate-950">승인 전 안내</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <li>가입한 계정 정보는 정상적으로 저장되어 있습니다.</li>
                  <li>관리자 승인 완료 후 다시 로그인하거나 상태를 새로고침하면 바로 이용할 수 있습니다.</li>
                  <li>승인 일정이 오래 지연되면 운영자에게 문의해 주세요.</li>
                </ul>
              </div>

              {feedback ? (
                <div className="mt-5 rounded-2xl border border-[rgba(11,105,139,0.16)] bg-[rgba(11,105,139,0.07)] px-4 py-3 text-sm font-medium text-[var(--brand-700)]">
                  {feedback}
                </div>
              ) : null}

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  className="rounded-full bg-[var(--brand-500)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(11,105,139,0.24)] transition hover:bg-[var(--brand-600)] disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={isRefreshing}
                  onClick={handleRefresh}
                  type="button"
                >
                  {isRefreshing ? '승인 상태 확인 중...' : '승인 상태 다시 확인'}
                </button>
                <button
                  className="rounded-full border border-[rgba(11,105,139,0.18)] bg-white px-5 py-3 text-sm font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-50)]"
                  onClick={logout}
                  type="button"
                >
                  로그아웃
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
