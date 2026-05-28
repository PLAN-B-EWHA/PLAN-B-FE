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

const dayLabels = ['월', '화', '수', '목', '금', '토', '일']

const trendCopy = {
  IMPROVING: '최근 좋아지고 있어요',
  STABLE: '꾸준히 유지 중이에요',
  DECLINING: '최근엔 조금 더 연습이 필요해요',
}

const confidenceCopy = {
  LOW: '기록이 더 필요해요',
  MEDIUM: '참고할 만한 흐름이에요',
  HIGH: '흐름이 꽤 안정적이에요',
}

function formatPlayedAt(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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

function SoftPanel({ children, className = '' }) {
  return <article className={`rounded-[1.2rem] border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)] ${className}`}>{children}</article>
}

function SectionLabel({ title, sub }) {
  return (
    <div className="mt-6 flex items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-500)]">보호자 인사이트</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">{title}</h2>
      </div>
      {sub ? <p className="text-xs text-slate-400">{sub}</p> : null}
    </div>
  )
}

function WeeklyParticipationCard({ weeklyParticipation }) {
  const markers = Array.isArray(weeklyParticipation?.dayMarkers) ? weeklyParticipation.dayMarkers : []

  return (
    <SoftPanel className="bg-[linear-gradient(180deg,#f0fdfa_0%,#ffffff_100%)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">이번 주 참여</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            {weeklyParticipation ? `${weeklyParticipation.completedDays} / ${weeklyParticipation.recommendedPerWeek}일` : '기록 수집 중'}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {weeklyParticipation?.displayMessage || '이번 주 학습 기록을 모으고 있어요.'}
          </p>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {dayLabels.map((label, index) => {
            const done = Boolean(markers[index])
            return (
              <div className="flex flex-col items-center gap-1" key={label}>
                <span className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black ${done ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-300'}`}>
                  {done ? '✓' : '-'}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </SoftPanel>
  )
}

function HighlightCard({ weeklyHighlight }) {
  const highlights = weeklyHighlight?.highlights || []

  return (
    <SoftPanel>
      <p className="text-sm font-semibold text-slate-900">이번 주 잘한 점</p>
      <div className="mt-4 space-y-3">
        {highlights.length ? (
          highlights.slice(0, 3).map((item, index) => (
            <p className="rounded-xl bg-[var(--brand-50)] px-4 py-3 text-sm font-medium leading-6 text-slate-700" key={`${item}-${index}`}>
              {item}
            </p>
          ))
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
            {weeklyHighlight?.fallbackMessage || '조금씩 기록이 쌓이면 이번 주의 좋은 변화가 여기에 표시돼요.'}
          </p>
        )}
      </div>
    </SoftPanel>
  )
}

function ParentEmotionCard({ emotion }) {
  const hasData = Boolean(emotion?.dataReady)
  const confidence = confidenceCopy[emotion?.confidenceLevel] || '기록을 살펴보는 중이에요'
  const trend = hasData ? trendCopy[emotion?.trendDirection] || '변화를 지켜보고 있어요' : '기록 수집 중이에요'

  return (
    <SoftPanel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-black text-slate-950">{emotionLabelMap[emotion.emotion] || emotion.emotion}</p>
          <p className="mt-1 text-sm text-slate-500">{hasData ? trend : '아직 판단하지 않고 차분히 모으는 중이에요.'}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${hasData ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {hasData ? emotion.successRateLevel || '진행 중' : '수집 중'}
        </span>
      </div>
      <div className="mt-4 grid gap-2">
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{emotion.fluencyLevelForParent || '표현 흐름을 관찰하고 있어요'}</p>
        <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500 ring-1 ring-slate-200">{confidence}</p>
      </div>
    </SoftPanel>
  )
}

function DialogueProgressCard({ item }) {
  return (
    <SoftPanel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[var(--brand-500)]">WEEK {String(item.weekNumber).padStart(2, '0')}</p>
          <p className="mt-1 text-base font-black text-slate-950">{item.theme}</p>
        </div>
        <span className="rounded-full bg-[var(--brand-50)] px-3 py-1 text-xs font-bold text-[var(--brand-700)]">
          {item.statusLabelParent || '준비 중'}
        </span>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">오프라인 미션</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {item.offlineMission?.assignedCount > 0 ? '가정 미션 기록이 함께 쌓이고 있어요.' : '아직 배정된 가정 미션이 없어요.'}
        </p>
      </div>
    </SoftPanel>
  )
}

function DialogueSummaryCard({ item }) {
  const confidence = confidenceCopy[item?.confidenceLevel] || '기록을 살펴보는 중이에요'
  const trend = item?.dataReady ? trendCopy[item?.trendDirection] || '변화를 지켜보고 있어요' : '기록 수집 중이에요'

  return (
    <SoftPanel>
      <p className="text-base font-black text-slate-950">{item.theme}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{item.masteryJudgmentForParent || '차근차근 대화 흐름을 연습하고 있어요.'}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{trend}</span>
        <span className="rounded-full bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold text-[var(--brand-700)]">{confidence}</span>
      </div>
    </SoftPanel>
  )
}

function HistoryPreview({ expressionHistoryPage, dialogueHistoryPage }) {
  const expressionItems = expressionHistoryPage?.content || []
  const dialogueItems = dialogueHistoryPage?.content || []

  return (
    <SoftPanel>
      <p className="text-sm font-semibold text-slate-900">최근 기록</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400">표정 활동</p>
          {expressionItems.length ? expressionItems.slice(0, 5).map((session) => (
            <div className="rounded-xl border border-slate-200 px-3 py-2" key={session.sessionId}>
              <p className="text-sm font-semibold text-slate-800">{emotionLabelMap[session.emotion] || session.emotion}</p>
              <p className="mt-1 text-xs text-slate-400">{formatPlayedAt(session.playedAt)} 활동</p>
            </div>
          )) : <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">표정 활동 기록이 아직 없어요.</p>}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400">대화 활동</p>
          {dialogueItems.length ? dialogueItems.slice(0, 5).map((session) => (
            <div className="rounded-xl border border-slate-200 px-3 py-2" key={session.sessionId}>
              <p className="text-sm font-semibold text-slate-800">{session.theme}</p>
              <p className="mt-1 text-xs text-slate-400">{formatPlayedAt(session.playedAt)} 활동</p>
            </div>
          )) : <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">대화 활동 기록이 아직 없어요.</p>}
        </div>
      </div>
    </SoftPanel>
  )
}

export function ParentDashboardPage() {
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [weeklyParticipation, setWeeklyParticipation] = useState(null)
  const [weeklyHighlight, setWeeklyHighlight] = useState(null)
  const [expressionSummary, setExpressionSummary] = useState(null)
  const [dialogueSummary, setDialogueSummary] = useState([])
  const [dialogueProgress, setDialogueProgress] = useState(null)
  const [expressionHistoryPage, setExpressionHistoryPage] = useState(null)
  const [dialogueHistoryPage, setDialogueHistoryPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statLoading, setStatLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

  const selectedChild = useMemo(() => children.find((child) => child.childId === selectedChildId) || children[0] || null, [children, selectedChildId])

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
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadChildren()
    return () => {
      ignore = true
    }
  }, [accessToken])

  useEffect(() => {
    let ignore = false

    async function loadStats() {
      if (!accessToken || !selectedChildId) {
        setWeeklyParticipation(null)
        setWeeklyHighlight(null)
        setExpressionSummary(null)
        setDialogueSummary([])
        setDialogueProgress(null)
        setExpressionHistoryPage(null)
        setDialogueHistoryPage(null)
        return
      }

      setStatLoading(true)
      try {
        const [participationRes, highlightRes, expressionRes, dialogueRes, progressRes, expressionHistoryRes, dialogueHistoryRes] = await Promise.all([
          apiFetch(`/parent/children/${selectedChildId}/weekly-participation`, { method: 'GET', token: accessToken }),
          apiFetch(`/parent/children/${selectedChildId}/weekly-highlight`, { method: 'GET', token: accessToken }),
          apiFetch(`/parent/children/${selectedChildId}/expression/summary`, { method: 'GET', token: accessToken }),
          apiFetch(`/parent/children/${selectedChildId}/dialogue/summary`, { method: 'GET', token: accessToken }),
          apiFetch(`/parent/children/${selectedChildId}/dialogue/progress`, { method: 'GET', token: accessToken }),
          apiFetch(`/parent/children/${selectedChildId}/expression/history?page=0&size=5`, { method: 'GET', token: accessToken }),
          apiFetch(`/parent/children/${selectedChildId}/dialogue/history?page=0&size=5`, { method: 'GET', token: accessToken }),
        ])

        if (!ignore) {
          setWeeklyParticipation(extractApiPayload(participationRes))
          setWeeklyHighlight(extractApiPayload(highlightRes))
          setExpressionSummary(extractApiPayload(expressionRes))
          setDialogueSummary(extractApiPayload(dialogueRes) || [])
          setDialogueProgress(extractApiPayload(progressRes))
          setExpressionHistoryPage(extractApiPayload(expressionHistoryRes))
          setDialogueHistoryPage(extractApiPayload(dialogueHistoryRes))
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) {
          setFeedback(extractApiErrorMessage(error))
          setWeeklyParticipation(null)
          setWeeklyHighlight(null)
          setExpressionSummary(null)
          setDialogueSummary([])
          setDialogueProgress(null)
        }
      } finally {
        if (!ignore) setStatLoading(false)
      }
    }

    loadStats()
    return () => {
      ignore = true
    }
  }, [accessToken, selectedChildId])

  return (
    <ParentShell
      childCount={children.length}
      heading="보호자 통계 대시보드"
      selectedChild={selectedChild}
      subheading={selectedChild ? `${selectedChild.name}의 이번 주 흐름을 격려 중심으로 확인해요.` : '학생을 먼저 등록해 주세요.'}
    >
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}
      {loading ? <div className="stats-loading">학생 목록을 불러오는 중입니다...</div> : null}

      {!loading && children.length === 0 ? (
        <SoftPanel className="mt-6 text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950">등록된 학생이 아직 없어요</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">먼저 학생을 등록하면 통계 화면을 바로 확인할 수 있어요.</p>
        </SoftPanel>
      ) : null}

      {!loading && children.length > 0 ? (
        <>
          <section className="mt-4 grid gap-4 xl:grid-cols-[320px_1fr]">
            <SoftPanel>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">학생 선택</p>
                <span className="rounded-full bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold text-[var(--brand-700)]">{children.length}명</span>
              </div>
              <div className="space-y-3">
                {children.map((child) => (
                  <button
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${selectedChild?.childId === child.childId ? 'border-[var(--brand-200)] bg-[var(--brand-50)]' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    key={child.childId}
                    onClick={() => setSelectedChildId(child.childId)}
                    type="button"
                  >
                    <ChildAvatar child={child} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{child.name}</p>
                      <p className="text-xs text-slate-400">{calculateAgeLabel(child.birthDate)} · {getGenderLabel(child.gender)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </SoftPanel>
            <WeeklyParticipationCard weeklyParticipation={weeklyParticipation} />
          </section>

          {statLoading ? <p className="mt-3 text-xs text-slate-400">통계를 업데이트 중입니다...</p> : null}

          <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <HighlightCard weeklyHighlight={weeklyHighlight} />
            <SoftPanel>
              <p className="text-sm font-semibold text-slate-900">오늘의 한마디</p>
              <p className="mt-4 text-base leading-8 text-slate-700">
                {expressionSummary?.encouragementMessage || '기록이 쌓이면 아이에게 맞춘 격려 문장이 표시돼요.'}
              </p>
            </SoftPanel>
          </section>

          <SectionLabel title="표정 학습 요약" sub="숫자 대신 흐름과 상태로 표시해요" />
          <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(expressionSummary?.emotions || []).length ? (
              expressionSummary.emotions.map((emotion) => <ParentEmotionCard emotion={emotion} key={emotion.emotion} />)
            ) : (
              <SoftPanel className="md:col-span-2 xl:col-span-3 text-center text-sm text-slate-500">표정 학습 기록을 모으고 있어요.</SoftPanel>
            )}
          </section>

          <SectionLabel title="대화 학습 진행도" sub="주차별 로드맵" />
          <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(dialogueProgress?.themes || []).length ? (
              dialogueProgress.themes.map((item) => <DialogueProgressCard item={item} key={`${item.weekNumber}-${item.theme}`} />)
            ) : (
              <SoftPanel className="md:col-span-2 xl:col-span-4 text-center text-sm text-slate-500">대화 진행 기록을 모으고 있어요.</SoftPanel>
            )}
          </section>

          <SectionLabel title="대화 학습 요약" sub="단정 대신 참고 흐름으로 표시해요" />
          <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dialogueSummary.length ? (
              dialogueSummary.map((item) => <DialogueSummaryCard item={item} key={item.theme} />)
            ) : (
              <SoftPanel className="md:col-span-2 xl:col-span-3 text-center text-sm text-slate-500">대화 학습 요약이 아직 없습니다.</SoftPanel>
            )}
          </section>

          <section className="mt-6">
            <HistoryPreview expressionHistoryPage={expressionHistoryPage} dialogueHistoryPage={dialogueHistoryPage} />
          </section>
        </>
      ) : null}
    </ParentShell>
  )
}
