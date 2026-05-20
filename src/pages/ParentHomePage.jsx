import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ParentShell } from '../components/ParentShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { calculateAgeLabel, getGenderLabel } from '../lib/childUtils'

function percent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return `${Math.round(value * 100)}%`
}

function fixed(value, digits = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return value.toFixed(digits)
}

function HomeStatCard({ label, value, sub }) {
  return (
    <article className="rounded-[1.2rem] border border-slate-200 bg-white px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-3 text-[28px] font-black leading-none tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{sub}</p>
    </article>
  )
}

export function ParentHomePage() {
  const navigate = useNavigate()
  const { accessToken } = useAuth()

  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [expressionSummary, setExpressionSummary] = useState(null)
  const [dialogueSummary, setDialogueSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [statLoading, setStatLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

  const selectedChild = useMemo(
    () => children.find((child) => child.childId === selectedChildId) || children[0] || null,
    [children, selectedChildId],
  )

  useEffect(() => {
    let ignore = false

    async function loadChildren() {
      if (!accessToken) {
        setLoading(false)
        return
      }

      try {
        const response = await apiFetch('/children/my', { method: 'GET', token: accessToken })
        const payload = extractApiPayload(response) || []

        if (!ignore) {
          setChildren(payload)
          setSelectedChildId(payload[0]?.childId || null)
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) {
          setFeedback(extractApiErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadChildren()

    return () => {
      ignore = true
    }
  }, [accessToken])

  useEffect(() => {
    let ignore = false

    async function loadHomeStats() {
      if (!accessToken || !selectedChildId) {
        setExpressionSummary(null)
        setDialogueSummary([])
        return
      }

      setStatLoading(true)

      try {
        const [expressionRes, dialogueRes] = await Promise.all([
          apiFetch(`/parent/children/${selectedChildId}/expression/summary`, { method: 'GET', token: accessToken }),
          apiFetch(`/parent/children/${selectedChildId}/dialogue/summary`, { method: 'GET', token: accessToken }),
        ])

        if (!ignore) {
          setExpressionSummary(extractApiPayload(expressionRes))
          setDialogueSummary(extractApiPayload(dialogueRes) || [])
        }
      } catch (error) {
        if (!ignore) {
          setExpressionSummary(null)
          setDialogueSummary([])
          setFeedback(extractApiErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setStatLoading(false)
        }
      }
    }

    loadHomeStats()

    return () => {
      ignore = true
    }
  }, [accessToken, selectedChildId])

  const readyEmotions = useMemo(
    () => (expressionSummary?.emotions || []).filter((emotion) => emotion.dataReady),
    [expressionSummary?.emotions],
  )

  const avgSuccessRate = useMemo(() => {
    if (!readyEmotions.length) return null
    return readyEmotions.reduce((sum, emotion) => sum + emotion.successRate, 0) / readyEmotions.length
  }, [readyEmotions])

  const avgFluency = useMemo(() => {
    if (!readyEmotions.length) return null
    return readyEmotions.reduce((sum, emotion) => sum + emotion.fluencyIndex, 0) / readyEmotions.length
  }, [readyEmotions])

  const recommendedPracticeCount = useMemo(() => {
    const hardEmotions = readyEmotions.filter((emotion) => emotion.successRate < 0.7).length
    const hardDialogueThemes = (dialogueSummary || []).filter((item) => item.dataReady && item.strategyMasteryIndex < 0.65).length
    const plan = Math.max(2, Math.min(5, hardEmotions + hardDialogueThemes))
    return `${plan}개`
  }, [dialogueSummary, readyEmotions])

  return (
    <ParentShell
      childCount={children.length}
      heading="보호자 홈"
      selectedChild={selectedChild}
      subheading={selectedChild ? `${selectedChild.name}의 오늘 학습과 할 일을 확인해요.` : '학생을 등록해 홈을 시작해요.'}
    >
      {feedback ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{feedback}</div>
      ) : null}

      {loading ? (
        <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">학생 목록을 불러오는 중입니다...</div>
      ) : null}

      {!loading && children.length === 0 ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-[var(--brand-200)] bg-[linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)] p-10 text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950">홈을 시작하려면 학생 등록이 필요해요</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">학생 등록 후 오늘 할 일과 학습 요약이 자동으로 표시됩니다.</p>
          <button
            className="mt-6 rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => navigate('/app/children')}
            type="button"
          >
            학생 등록하러 가기
          </button>
        </div>
      ) : null}

      {!loading && children.length > 0 ? (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">가정 케어</p>
              <h1 className="mt-2 text-[28px] font-black tracking-tight text-slate-950">오늘의 격려와 가정 연습</h1>
              <p className="mt-1 text-sm text-slate-400">숫자보다 아이의 성장 흐름과 집에서 할 행동을 우선 보여줘요.</p>
            </div>
            <div className="md:ml-auto flex flex-wrap gap-2">
              <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-white" onClick={() => navigate('/app/analysis')} type="button">
                아이 성장 보기
              </button>
              <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700" onClick={() => navigate('/app/offline')} type="button">
                오프라인 현황 보기
              </button>
            </div>
          </div>

          <section className="mt-5 grid gap-3 xl:grid-cols-4">
            <HomeStatCard label="등록 학생" sub="현재 보호자 계정 기준" value={`${children.length}명`} />
            <HomeStatCard label="평균 정답률" sub="준비된 감정 기준" value={avgSuccessRate == null ? '-' : percent(avgSuccessRate)} />
            <HomeStatCard label="평균 유창성" sub="감정 표현 자연스러움" value={avgFluency == null ? '-' : fixed(avgFluency, 1)} />
            <HomeStatCard label="오늘 권장 연습" sub="집에서 해볼 활동 수" value={recommendedPracticeCount} />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
            <article className="app-hero rounded-[1.35rem] p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">오늘의 격려</p>
                <button className="text-xs font-semibold text-[var(--brand-600)]" onClick={() => navigate('/app/analysis')} type="button">성장 흐름 보기</button>
              </div>
              <p className="rounded-xl border border-[var(--brand-200)] bg-white px-4 py-4 text-sm leading-7 text-slate-700">
                {expressionSummary?.encouragementMessage || `${selectedChild?.name || '아이'}의 데이터가 쌓이면 맞춤형 격려 문장이 표시됩니다.`}
              </p>
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">1. {selectedChild?.name}와 감정 카드 10분 연습</div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">2. 대화 게임 후 잘한 부분 1개를 바로 칭찬하기</div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">3. 오프라인 현황 보기 후 내일 연습 1개만 미리 정하기</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-white" onClick={() => navigate('/app/analysis')} type="button">
                  가정 연습 시작
                </button>
                <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700" onClick={() => navigate('/app/offline')} type="button">
                  오프라인 확인하기
                </button>
              </div>
            </article>

            <article className="app-card rounded-[1.35rem] p-5">
              <p className="text-sm font-semibold text-slate-900">선택 학생</p>
              <div className="mt-3 space-y-3">
                {children.map((child) => (
                  <button
                    key={child.childId}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                      selectedChild?.childId === child.childId ? 'border-[var(--brand-200)] bg-[var(--brand-50)]' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedChildId(child.childId)}
                    type="button"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{child.name}</p>
                      <p className="text-xs text-slate-400">{calculateAgeLabel(child.birthDate)} · {getGenderLabel(child.gender)}</p>
                    </div>
                    <span className="text-xs text-slate-400">선택</span>
                  </button>
                ))}
              </div>
              {statLoading ? <p className="mt-3 text-xs text-slate-400">요약 통계를 업데이트 중입니다...</p> : null}
            </article>
          </section>
        </>
      ) : null}
    </ParentShell>
  )
}
