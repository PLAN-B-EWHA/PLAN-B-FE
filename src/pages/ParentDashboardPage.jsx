import { useEffect, useMemo, useState } from 'react'
import { ParentShell } from '../components/ParentShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { calculateAgeLabel, getGenderLabel, resolveUploadUrl } from '../lib/childUtils'

const emotionLabelMap = {
  happy: '기쁨',
  sad: '슬픔',
  angry: '분노',
  disgust: '혐오',
  surprise: '놀람',
  fear: '공포',
}

const fluencyToneMap = {
  내재화: 'text-emerald-600 bg-emerald-50',
  '의식적 노력 단계': 'text-amber-700 bg-amber-50',
  '학습 필요 단계': 'text-rose-700 bg-rose-50',
}

const fluencyHelpMap = {
  내재화: '도움 없이도 자연스럽게 감정을 표현하는 단계예요.',
  '의식적 노력 단계': '생각하면 할 수 있지만 아직 연습이 더 필요한 단계예요.',
  '학습 필요 단계': '기초 연습이 필요한 시작 단계예요.',
}

function percent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return `${Math.round(value * 100)}%`
}

function fixed(value, digits = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return value.toFixed(digits)
}

function resolveLanguageGrade(avgSuccessRate, avgFluencyIndex) {
  const success = typeof avgSuccessRate === 'number' ? avgSuccessRate : 0
  const fluency = typeof avgFluencyIndex === 'number' ? avgFluencyIndex : 0

  if (success >= 0.8 && fluency >= 0.75) {
    return {
      label: '자동화 단계',
      detail: '도움 없이도 자연스럽게 표현하는 흐름입니다.',
      tone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    }
  }

  if (success >= 0.6 && fluency >= 0.5) {
    return {
      label: '의식적 노력 단계',
      detail: '생각하면 할 수 있어요. 꾸준한 연습이 중요해요.',
      tone: 'text-amber-700 bg-amber-50 border-amber-200',
    }
  }

  return {
    label: '기초 강화 단계',
    detail: '쉬운 감정부터 반복 연습하면 빠르게 올라올 수 있어요.',
    tone: 'text-rose-700 bg-rose-50 border-rose-200',
  }
}

function formatPlayedAt(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR')
}

function formatDurationSeconds(sec) {
  const n = Number(sec)
  if (!Number.isFinite(n)) return '-'
  const min = Math.floor(n / 60)
  const rem = Math.floor(n % 60)
  return `${min}분 ${rem}초`
}

function ChildAvatar({ child }) {
  const imageUrl = resolveUploadUrl(child?.profileImageUrl)

  if (imageUrl) {
    return <img alt={child?.name || 'child'} className="h-10 w-10 rounded-full object-cover" src={imageUrl} />
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-50)] text-sm font-bold text-[var(--brand-700)]">
      {child?.name?.[0] || '?'}
    </div>
  )
}

function StatCard({ label, value, sub }) {
  return (
    <article className="rounded-[1.2rem] border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-3 text-[28px] font-black leading-none tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{sub}</p>
    </article>
  )
}

function InfoTooltip({ text }) {
  return (
    <span className="group relative inline-flex">
      <span className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-bold text-slate-500">
        i
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 rounded-lg bg-[rgba(15,23,42,0.88)] px-2.5 py-2 text-[11px] font-medium leading-5 text-white opacity-0 shadow-[0_10px_24px_rgba(15,23,42,0.24)] transition group-hover:opacity-100">
        {text}
      </span>
    </span>
  )
}

function EmotionDonut({ rate }) {
  const percentValue = Math.max(0, Math.min(100, Math.round((rate || 0) * 100)))
  return (
    <div
      className="relative h-16 w-16 rounded-full"
      style={{ background: `conic-gradient(var(--brand-500) ${percentValue}%, #e2e8f0 ${percentValue}% 100%)` }}
    >
      <div className="absolute inset-[7px] flex items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700">{percentValue}%</div>
    </div>
  )
}

function EmotionMiniTrend({ sessionTrend }) {
  if (!Array.isArray(sessionTrend) || !sessionTrend.length) {
    return <p className="mt-3 text-xs text-slate-400">세션 추이 데이터 없음</p>
  }

  const values = sessionTrend
    .map((point) => Number(point?.finalAccuracy))
    .filter((value) => Number.isFinite(value))

  if (!values.length) {
    return <p className="mt-3 text-xs text-slate-400">세션 추이 데이터 없음</p>
  }

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">세션 흐름</p>
        <InfoTooltip text="세션별 정답률 변화를 막대로 보여줘요. 높을수록 좋아요." />
      </div>
      <div className="flex items-end gap-1.5">
        {sessionTrend.map((point, idx) => {
          const accuracy = Number(point?.finalAccuracy)
          const safeAccuracy = Number.isFinite(accuracy) ? Math.max(0, Math.min(1, accuracy)) : 0
          const success = Boolean(point?.isSuccess)
          return (
            <div className="flex flex-col items-center gap-1" key={`${point?.sessionNumber || idx}`}>
              <div
                className={`w-2.5 rounded-sm ${success ? 'bg-[var(--brand-500)]' : 'bg-slate-300'}`}
                style={{ height: `${16 + safeAccuracy * 28}px` }}
              />
              <span className="text-[10px] text-slate-400">{point?.sessionNumber || idx + 1}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ParentEmotionCard({ emotion }) {
  const levelClass = fluencyToneMap[emotion.fluencyLevel] || 'text-slate-600 bg-slate-100'
  const fluencyHelp = fluencyHelpMap[emotion.fluencyLevel] || '감정 표현의 자연스러움과 안정성을 보여주는 단계예요.'

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-900">{emotionLabelMap[emotion.emotion] || emotion.emotion}</p>
          <p className="mt-1 text-xs text-slate-400">세션 {emotion.sessionCount}회</p>
        </div>
        <EmotionDonut rate={emotion.successRate} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          정답률 {percent(emotion.successRate)}
          <InfoTooltip text="맞게 표현한 비율이에요. 높을수록 감정 인식/표현이 안정적이에요." />
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${levelClass}`}>
          <span className="inline-flex items-center gap-1.5">
            {emotion.fluencyLevel}
            <InfoTooltip text={fluencyHelp} />
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          유창성 {fixed(emotion.fluencyIndex, 1)}
          <InfoTooltip text="감정을 얼마나 자연스럽고 부드럽게 표현하는지 보여주는 지표예요." />
        </span>
      </div>

      {!emotion.dataReady ? (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">데이터 수집 중 (3회 이상 필요)</p>
      ) : null}
      <EmotionMiniTrend sessionTrend={emotion.sessionTrend} />
    </article>
  )
}

function ParentDialogueCard({ item }) {
  const masteryLabel = item?.strategyMasteryIndex >= 0.8 ? '숙달됨' : item?.strategyMasteryIndex >= 0.6 ? '성장 중' : '연습 중'
  const reactionLabel = item?.rapportLevel || (item?.rapportIndex >= 0.75 ? '긍정 반응 안정' : item?.rapportIndex >= 0.5 ? '긍정 반응 형성 중' : '반응 연습 필요')

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{item.theme}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-400">
            {reactionLabel}
            <InfoTooltip text="대화 반응의 안정감을 보호자용 문장으로 보여줘요." />
          </p>
        </div>
        <span className="rounded-full bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold text-[var(--brand-700)]">
          {masteryLabel}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-[var(--brand-500)]" style={{ width: `${Math.max(0, Math.min(100, (item.strategyMasteryIndex || 0) * 100))}%` }} />
      </div>

      {!item.dataReady ? (
        <p className="mt-3 text-xs font-medium text-slate-500">아직 데이터 수집 중이에요. 3회 이상이면 더 정확해져요.</p>
      ) : (
        <p className="mt-3 text-xs text-slate-600">
          {item.fatigueSeverity || '집중 흐름은 안정적으로 유지되고 있어요.'}
        </p>
      )}
    </article>
  )
}

function getParentThemeProgress(item) {
  const sessions = Number(item?.sessionCount || item?.n || 0)
  const mastery = Number(item?.strategyMasteryIndex || 0)
  if (sessions >= 3 && mastery >= 0.65) return { label: '완료', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (sessions >= 1) return { label: '진행 중', tone: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { label: '시작 전', tone: 'bg-slate-100 text-slate-600 border-slate-200' }
}

export function ParentDashboardPage() {
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [expressionSummary, setExpressionSummary] = useState(null)
  const [dialogueSummary, setDialogueSummary] = useState([])
  const [expressionHistoryPage, setExpressionHistoryPage] = useState(null)
  const [dialogueHistoryPage, setDialogueHistoryPage] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expressionHistoryFilter, setExpressionHistoryFilter] = useState('')
  const [dialogueHistoryFilter, setDialogueHistoryFilter] = useState('')
  const [expressionHistoryPageIndex, setExpressionHistoryPageIndex] = useState(0)
  const [dialogueHistoryPageIndex, setDialogueHistoryPageIndex] = useState(0)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [statLoading, setStatLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

  const selectedChild = useMemo(() => children.find((child) => child.childId === selectedChildId) || children[0] || null, [children, selectedChildId])

  const readyEmotions = useMemo(
    () => (expressionSummary?.emotions || []).filter((emotion) => emotion.dataReady),
    [expressionSummary?.emotions],
  )

  const avgSuccessRate = useMemo(() => {
    if (!readyEmotions.length) return null
    return readyEmotions.reduce((sum, item) => sum + item.successRate, 0) / readyEmotions.length
  }, [readyEmotions])

  const avgFluency = useMemo(() => {
    if (!readyEmotions.length) return null
    return readyEmotions.reduce((sum, item) => sum + item.fluencyIndex, 0) / readyEmotions.length
  }, [readyEmotions])

  const bestTheme = useMemo(() => {
    if (!dialogueSummary.length) return null
    return [...dialogueSummary].sort((a, b) => b.strategyMasteryIndex - a.strategyMasteryIndex)[0]
  }, [dialogueSummary])
  const languageGrade = useMemo(
    () => resolveLanguageGrade(avgSuccessRate, avgFluency),
    [avgFluency, avgSuccessRate],
  )
  const encouragementTone = useMemo(() => {
    if ((expressionSummary?.topImprovedEmotions || []).length >= 2) return '좋은 성장 흐름'
    if ((expressionSummary?.topImprovedEmotions || []).length >= 1) return '꾸준히 좋아지고 있어요'
    return '성장 데이터 수집 중'
  }, [expressionSummary?.topImprovedEmotions])
  const expressionFilterOptions = useMemo(
    () => (expressionSummary?.emotions || []).map((item) => item.emotion),
    [expressionSummary?.emotions],
  )
  const dialogueFilterOptions = useMemo(
    () => (dialogueSummary || []).map((item) => item.theme),
    [dialogueSummary],
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
    setExpressionHistoryPageIndex(0)
    setDialogueHistoryPageIndex(0)
  }, [selectedChildId])

  useEffect(() => {
    setExpressionHistoryPageIndex(0)
  }, [expressionHistoryFilter])

  useEffect(() => {
    setDialogueHistoryPageIndex(0)
  }, [dialogueHistoryFilter])

  useEffect(() => {
    let ignore = false

    async function loadStats() {
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
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) {
          setFeedback(extractApiErrorMessage(error))
          setExpressionSummary(null)
          setDialogueSummary([])
        }
      } finally {
        if (!ignore) {
          setStatLoading(false)
        }
      }
    }

    loadStats()

    return () => {
      ignore = true
    }
  }, [accessToken, selectedChildId])

  useEffect(() => {
    let ignore = false

    async function loadHistory() {
      if (!accessToken || !selectedChildId) {
        setExpressionHistoryPage(null)
        setDialogueHistoryPage(null)
        return
      }

      setHistoryLoading(true)
      try {
        const expressionParams = new URLSearchParams({
          page: String(expressionHistoryPageIndex),
          size: '5',
        })
        if (expressionHistoryFilter) expressionParams.set('emotion', expressionHistoryFilter)

        const dialogueParams = new URLSearchParams({
          page: String(dialogueHistoryPageIndex),
          size: '5',
        })
        if (dialogueHistoryFilter) dialogueParams.set('theme', dialogueHistoryFilter)

        const [expressionRes, dialogueRes] = await Promise.all([
          apiFetch(`/parent/children/${selectedChildId}/expression/history?${expressionParams.toString()}`, {
            method: 'GET',
            token: accessToken,
          }),
          apiFetch(`/parent/children/${selectedChildId}/dialogue/history?${dialogueParams.toString()}`, {
            method: 'GET',
            token: accessToken,
          }),
        ])

        if (!ignore) {
          setExpressionHistoryPage(extractApiPayload(expressionRes))
          setDialogueHistoryPage(extractApiPayload(dialogueRes))
        }
      } catch {
        if (!ignore) {
          setExpressionHistoryPage(null)
          setDialogueHistoryPage(null)
        }
      } finally {
        if (!ignore) {
          setHistoryLoading(false)
        }
      }
    }

    loadHistory()

    return () => {
      ignore = true
    }
  }, [
    accessToken,
    selectedChildId,
    expressionHistoryFilter,
    dialogueHistoryFilter,
    expressionHistoryPageIndex,
    dialogueHistoryPageIndex,
  ])

  return (
    <ParentShell
      childCount={children.length}
      heading="보호자 통계 대시보드"
      selectedChild={selectedChild}
      subheading={selectedChild ? `${selectedChild.name}의 학습 변화를 한눈에 확인해요.` : '학생을 먼저 등록해 주세요.'}
    >
      {feedback ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{feedback}</div>
      ) : null}

      {loading ? (
        <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">학생 목록을 불러오는 중입니다...</div>
      ) : null}

      {!loading && children.length === 0 ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-[var(--brand-200)] bg-[linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)] p-10 text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950">등록된 학생이 아직 없어요</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">먼저 학생을 등록하면 통계 화면을 바로 확인할 수 있어요.</p>
        </div>
      ) : null}

      {!loading && children.length > 0 ? (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">보호자 인사이트</p>
              <h1 className="mt-2 text-[28px] font-black tracking-tight text-slate-950">언어 등급 중심 성장 분석</h1>
              <p className="mt-1 text-sm text-slate-400">어려운 수치보다 등급, 격려 메시지, 오늘의 연습 방향을 먼저 보여줘요.</p>
            </div>
          </div>

          <section className="mt-5 grid gap-3 xl:grid-cols-4">
            <StatCard label="등록 학생" value={`${children.length}명`} sub="현재 보호자 계정 기준" />
            <StatCard label="현재 언어 등급" value={languageGrade.label} sub={languageGrade.detail} />
            <StatCard label="이번 주 격려 상태" value={encouragementTone} sub="긍정 피드백 중심으로 확인" />
            <StatCard label="추천 대화 주제" value={bestTheme?.theme || '-'} sub={bestTheme ? '현재 성장 흐름이 좋아요' : '아직 요약 데이터 없음'} />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[340px_1fr]">
            <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">학생 선택</p>
                <span className="rounded-full bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold text-[var(--brand-700)]">{children.length}명</span>
              </div>
              <div className="space-y-3">
                {children.map((child) => (
                  <button
                    key={child.childId}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      selectedChild?.childId === child.childId ? 'border-[var(--brand-200)] bg-[var(--brand-50)]' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedChildId(child.childId)}
                    type="button"
                  >
                    <ChildAvatar child={child} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{child.name}</p>
                      <p className="text-xs text-slate-400">
                        {calculateAgeLabel(child.birthDate)} · {getGenderLabel(child.gender)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </article>

            <article className="rounded-[1.2rem] border border-slate-200 bg-[linear-gradient(180deg,#eef2ff_0%,#ffffff_100%)] p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">이번 주 격려 메시지</p>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${languageGrade.tone}`}>
                  {languageGrade.label}
                </span>
              </div>
              <p className="mt-4 text-base leading-8 text-slate-700">
                {expressionSummary?.encouragementMessage || '학습 데이터가 누적되면 맞춤형 격려 메시지가 표시됩니다.'}
              </p>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">이번 주 상승 감정</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(expressionSummary?.topImprovedEmotions || []).length ? (
                    expressionSummary.topImprovedEmotions.map((emotion) => (
                      <span key={emotion} className="rounded-full bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold text-[var(--brand-700)]">
                        {emotionLabelMap[emotion] || emotion}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">아직 표시할 개선 감정이 없습니다.</span>
                  )}
                </div>
              </div>

              {statLoading ? <p className="mt-4 text-xs text-slate-400">통계를 업데이트 중입니다...</p> : null}
            </article>
          </section>

          <div className="mt-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              감정 개요
              <InfoTooltip text="아이의 감정 표현 변화를 한눈에 확인할 수 있어요." />
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(expressionSummary?.emotions || []).length ? (
              expressionSummary.emotions.map((emotion) => <ParentEmotionCard emotion={emotion} key={emotion.emotion} />)
            ) : (
              <div className="col-span-full rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">표정 통계 데이터가 아직 없습니다.</div>
            )}
          </section>

          <div className="mt-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              대화 요약
              <InfoTooltip text="대화 주제별 상호작용 상태와 변화를 확인할 수 있어요." />
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">16주 주제 진행</p>
              <span className="text-xs text-slate-400">완료/진행/시작 전</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(dialogueSummary || []).length ? (
                dialogueSummary.map((item) => {
                  const progress = getParentThemeProgress(item)
                  return (
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${progress.tone}`} key={`parent-progress-${item.theme}`}>
                      {item.theme} · {progress.label}
                    </span>
                  )
                })
              ) : (
                <span className="text-xs text-slate-500">주제 진행 데이터가 아직 없습니다.</span>
              )}
            </div>
          </section>

          <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dialogueSummary.length ? (
              dialogueSummary.map((item) => <ParentDialogueCard item={item} key={item.theme} />)
            ) : (
              <div className="col-span-full rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">대화 통계 데이터가 아직 없습니다.</div>
            )}
          </section>

          <div className="mt-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              학습 기록
              <InfoTooltip text="최근 플레이 흐름을 시간순으로 확인할 수 있어요." />
            </span>
            <div className="h-px flex-1 bg-slate-200" />
            <button
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600"
              onClick={() => setIsHistoryOpen((current) => !current)}
              type="button"
            >
              {isHistoryOpen ? '접기' : '펼치기'}
            </button>
          </div>

          {isHistoryOpen ? <section className="mt-4 grid gap-4 xl:grid-cols-2">
            <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">표정 기록</p>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                  onChange={(event) => setExpressionHistoryFilter(event.target.value)}
                  value={expressionHistoryFilter}
                >
                  <option value="">전체 감정</option>
                  {expressionFilterOptions.map((emotion) => (
                    <option key={emotion} value={emotion}>
                      {emotionLabelMap[emotion] || emotion}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {(expressionHistoryPage?.content || []).length ? (
                  expressionHistoryPage.content.map((session) => (
                    <div className="rounded-xl border border-slate-200 p-3" key={session.sessionId}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">{emotionLabelMap[session.emotion] || session.emotion}</p>
                        <span className="text-xs text-slate-400">{formatPlayedAt(session.playedAt)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                        <span>정확도 {percent(session.finalAccuracy)}</span>
                        <span>시도 {session.totalTries}회</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-7 text-center text-sm text-slate-500">표정 기록이 없습니다.</div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40"
                  disabled={!expressionHistoryPage || expressionHistoryPage.first}
                  onClick={() => setExpressionHistoryPageIndex((p) => Math.max(0, p - 1))}
                  type="button"
                >
                  이전
                </button>
                <span className="text-xs text-slate-500">
                  {expressionHistoryPage ? `${expressionHistoryPage.number + 1} / ${Math.max(1, expressionHistoryPage.totalPages)}` : '-'}
                </span>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40"
                  disabled={!expressionHistoryPage || expressionHistoryPage.last}
                  onClick={() => setExpressionHistoryPageIndex((p) => p + 1)}
                  type="button"
                >
                  다음
                </button>
              </div>
            </article>

            <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">대화 기록</p>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                  onChange={(event) => setDialogueHistoryFilter(event.target.value)}
                  value={dialogueHistoryFilter}
                >
                  <option value="">전체 주제</option>
                  {dialogueFilterOptions.map((theme) => (
                    <option key={theme} value={theme}>
                      {theme}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                      {(dialogueHistoryPage?.content || []).length ? (
                        dialogueHistoryPage.content.map((session) => (
                          <div className="rounded-xl border border-slate-200 p-3" key={session.sessionId}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">{session.theme}</p>
                        <span className="text-xs text-slate-400">{formatPlayedAt(session.playedAt)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                        <span>결과 {session.scoreRate >= 0.7 ? '좋았어요' : '연습 중이에요'}</span>
                        <span>시간 {formatDurationSeconds(session.durationSeconds)}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">세부 턴 정보는 치료사 화면에서 확인할 수 있어요.</p>
                          </div>
                        ))
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-7 text-center text-sm text-slate-500">대화 기록이 없습니다.</div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40"
                  disabled={!dialogueHistoryPage || dialogueHistoryPage.first}
                  onClick={() => setDialogueHistoryPageIndex((p) => Math.max(0, p - 1))}
                  type="button"
                >
                  이전
                </button>
                <span className="text-xs text-slate-500">
                  {dialogueHistoryPage ? `${dialogueHistoryPage.number + 1} / ${Math.max(1, dialogueHistoryPage.totalPages)}` : '-'}
                </span>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40"
                  disabled={!dialogueHistoryPage || dialogueHistoryPage.last}
                  onClick={() => setDialogueHistoryPageIndex((p) => p + 1)}
                  type="button"
                >
                  다음
                </button>
              </div>
            </article>
          </section> : null}

          {isHistoryOpen && historyLoading ? <p className="mt-3 text-xs text-slate-400">히스토리 데이터를 불러오는 중입니다...</p> : null}
        </>
      ) : null}
    </ParentShell>
  )
}
