import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'

const sidebarItems = [
  { id: 'dashboard', label: '대시보드', badge: null, path: '/app' },
  { id: 'children', label: '담당 학생', badge: '12', path: '/app/children' },
  { id: 'analysis', label: '학습 분석', badge: null },
  { id: 'alerts', label: '알림', badge: '2' },
  { id: 'reports', label: '리포트', badge: null },
  { id: 'settings', label: '설정', badge: null },
]

const childRows = [
  { name: '이서준', age: '만 14세', stage: '중등 과정 2단계', score: 42, pattern: '유형 C', lastSession: '오늘', tone: 'mid' },
  { name: '박도현', age: '만 15세', stage: '중등 과정 3단계', score: 88, pattern: '유형 A', lastSession: '오늘', tone: 'good' },
  { name: '김민서', age: '만 16세', stage: '고등 준비 1단계', score: 31, pattern: '유형 B', lastSession: '3일 전', tone: 'alert' },
  { name: '최지우', age: '만 14세', stage: '중등 과정 2단계', score: 67, pattern: '유형 A', lastSession: '어제', tone: 'good' },
]

const alerts = [
  { level: 'critical', title: '김민서가 3일 연속 세션에 참여하지 않았어요', body: '치료 중단 가능성이 있어 보호자 연락을 권장합니다.', time: '3시간 전' },
  { level: 'warning', title: '이서준의 분노 표현 유형이 증가했습니다', body: '정확도 보완과 반응 시간 비교 세션을 추천합니다.', time: '오늘 오전 9:12' },
  { level: 'ok', title: '박도현의 기쁨-슬픔 변별 정확도가 안정적입니다', body: '주간 표현 지수 88로 다음 단계 진입을 검토할 수 있습니다.', time: '어제' },
]

const emotionStats = [
  { label: '기쁨', value: 92, state: '안정' },
  { label: '슬픔', value: 78, state: '안정' },
  { label: '놀람', value: 66, state: '관찰' },
  { label: '분노', value: 32, state: '학습 필요' },
  { label: '두려움', value: 44, state: '관찰' },
  { label: '싫음', value: 22, state: '학습 필요' },
]

function StatCard({ label, value, sub, tone = 'default' }) {
  const toneClass = tone === 'good' ? 'text-[var(--brand-600)]' : tone === 'alert' ? 'text-rose-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-950'
  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className={`mt-2 text-[28px] font-black leading-none tracking-tight ${toneClass}`}>{value}</p>
      <p className="mt-2 text-xs text-slate-400">{sub}</p>
    </article>
  )
}

function ScoreBar({ score, tone }) {
  const barClass = tone === 'good' ? 'bg-[var(--brand-500)]' : tone === 'mid' ? 'bg-amber-500' : 'bg-rose-500'
  const textClass = tone === 'good' ? 'text-[var(--brand-700)]' : tone === 'mid' ? 'text-amber-700' : 'text-rose-700'
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`min-w-8 text-xs font-bold ${textClass}`}>{score}</span>
    </div>
  )
}

function AlertCard({ item }) {
  const styles = { critical: 'border-l-4 border-rose-500 bg-rose-50', warning: 'border-l-4 border-amber-500 bg-amber-50', ok: 'border-l-4 border-[var(--brand-500)] bg-[var(--brand-50)]' }
  return (
    <div className={`rounded-xl px-4 py-3 ${styles[item.level]}`}>
      <p className="font-semibold text-slate-900">{item.title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
      <p className="mt-2 text-[11px] text-slate-400">{item.time}</p>
    </div>
  )
}

export function TherapistDashboardPage() {
  const navigate = useNavigate()
  const { jwtPayload, logout, user } = useAuth()
  const [activeNav, setActiveNav] = useState('dashboard')
  const displayName = user?.name || jwtPayload?.name || '치료사님'

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[var(--app-canvas)] text-slate-900">
      <div className="grid min-h-screen grid-cols-1 grid-rows-[56px_1fr] lg:grid-cols-[220px_1fr] lg:grid-rows-[56px_1fr]">
        <header className="col-span-full flex items-center gap-5 border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-500)] text-xs font-black text-white">ME</div>
            <span className="text-[15px] font-bold tracking-tight text-slate-950">My Expression Friend</span>
          </div>
          <div className="hidden h-5 w-px bg-slate-200 sm:block" />
          <span className="hidden text-xs text-slate-400 sm:inline">치료사 대시보드</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-slate-400">Signed in as</p>
              <p className="text-sm font-semibold text-slate-700">{displayName}</p>
            </div>
            <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-white" onClick={handleLogout} type="button">
              로그아웃
            </button>
          </div>
        </header>

        <aside className="hidden border-r border-slate-200 bg-white px-3 py-5 lg:flex lg:flex-col">
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">메인</div>
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  activeNav === item.id ? 'bg-[var(--brand-50)] text-[var(--brand-700)]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
                onClick={() => {
                  setActiveNav(item.id)
                  if (item.path) navigate(item.path)
                }}
                type="button"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold">{item.label[0]}</span>
                <span>{item.label}</span>
                {item.badge ? <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{item.badge}</span> : null}
              </button>
            ))}
          </div>

          <div className="mt-auto pt-6">
            <ThemeToggleButton />
          </div>
        </aside>

        <main className="overflow-y-auto px-5 py-6 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div>
              <h1 className="text-[24px] font-black tracking-tight text-slate-950">오늘의 치료 현황</h1>
              <p className="mt-1 text-sm text-slate-400">담당 학생의 세션 흐름과 즉시 개입이 필요한 신호를 확인해 보세요.</p>
            </div>
            <div className="md:ml-auto flex gap-2">
              <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700" type="button">리포트 다운로드</button>
              <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-medium text-white" type="button">+ 메모 작성</button>
            </div>
          </div>

          <section className="mt-5 grid gap-3 xl:grid-cols-4">
            <StatCard label="담당 학생" sub="활성 치료 진행 중" tone="good" value="12명" />
            <StatCard label="평균 표현 지수" sub="지난주 54 대비 상승" tone="good" value="62점" />
            <StatCard label="즉시 확인 필요" sub="3일 미접속 학생 포함" tone="alert" value="2명" />
            <StatCard label="이번 주 세션 완료" sub="11/12명 진행" value="87%" />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
            <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">담당 학생 목록</div>
                <div className="flex gap-2">
                  <button className="rounded-full bg-[var(--brand-50)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-700)]" type="button">전체</button>
                  <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500" type="button">알림만</button>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_0.8fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-400">
                  <span>학생</span>
                  <span>단계</span>
                  <span>표현 지수</span>
                  <span>학습 유형</span>
                  <span>마지막 세션</span>
                </div>
                <div>
                  {childRows.map((child) => (
                    <div key={child.name} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_0.8fr] items-center gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-50)] text-sm font-bold text-[var(--brand-700)]">{child.name[0]}</div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{child.name}</p>
                          <p className="text-xs text-slate-400">{child.age}</p>
                        </div>
                      </div>
                      <span className="text-sm text-slate-600">{child.stage}</span>
                      <ScoreBar score={child.score} tone={child.tone} />
                      <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{child.pattern}</span>
                      <span className="text-sm text-slate-400">{child.lastSession}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">알림 및 즉시 개입</div>
                <button className="text-xs font-semibold text-[var(--brand-600)]" type="button">전체 보기</button>
              </div>
              <div className="space-y-3">
                {alerts.map((item) => <AlertCard item={item} key={item.title} />)}
              </div>
            </article>
          </section>

          <div className="mt-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <span>Learning Analytics</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <section className="mt-4 grid gap-4 xl:grid-cols-3">
            <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
              <div className="mb-4 text-sm font-semibold text-slate-900">감정별 표현 지수</div>
              <div className="space-y-3">
                {emotionStats.map((item) => (
                  <div className="flex items-center gap-3" key={item.label}>
                    <span className="w-14 text-right text-xs text-slate-500">{item.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-[var(--brand-500)]" style={{ width: `${item.value}%` }} />
                    </div>
                    <span className="w-8 text-xs font-bold text-[var(--brand-700)]">{item.value}</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.state === '안정' ? 'bg-[var(--brand-50)] text-[var(--brand-700)]' : item.state === '관찰' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                      {item.state}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
              <div className="mb-4 text-sm font-semibold text-slate-900">주간 메모</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                <p className="mb-2 text-[11px] text-slate-400">2026.03.23 작성 · 치료사 공개</p>
                기쁨과 슬픔 인식은 안정적으로 습득 중이며 표정과 방향 단서를 사용할 때 반응 속도가 좋아집니다. 다만 분노와 싫음 카드는 혼동이 있어 비교 세션과 보호자 가정 연계가 필요합니다.
              </div>
            </article>

            <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
              <div className="mb-4 text-sm font-semibold text-slate-900">자극 유형별 정확도</div>
              <div className="space-y-3">
                <div className="flex items-center gap-3"><span className="w-16 text-xs text-slate-500">만화</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[var(--brand-500)]" style={{ width: '84%' }} /></div><span className="text-xs font-bold text-[var(--brand-700)]">84%</span></div>
                <div className="flex items-center gap-3"><span className="w-16 text-xs text-slate-500">일러스트</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-amber-500" style={{ width: '61%' }} /></div><span className="text-xs font-bold text-amber-700">61%</span></div>
                <div className="flex items-center gap-3"><span className="w-16 text-xs text-slate-500">실사 사진</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-rose-500" style={{ width: '38%' }} /></div><span className="text-xs font-bold text-rose-700">38%</span></div>
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  )
}
