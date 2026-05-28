import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TherapistStatsShell } from '../components/TherapistStatsShell'
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

const tabs = [
  { id: 'expression', label: '표정 분석' },
  { id: 'dialogue', label: '대화 분석' },
  { id: 'progress', label: '대화 진행도' },
  { id: 'history', label: '히스토리' },
]

function asNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeRate(value) {
  const n = asNumber(value)
  if (n == null) return null
  if (n > 1) return n / 100
  if (n < 0) return 0
  return n
}

function percent(value) {
  const n = normalizeRate(value)
  if (n == null) return '-'
  return `${Math.round(n * 100)}%`
}

function fixed(value, digits = 2) {
  const n = asNumber(value)
  if (n == null) return '-'
  return n.toFixed(digits)
}

function formatPlayedAt(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR')
}

function getActiveNavId(pathname) {
  if (pathname.startsWith('/app/analysis')) return 'analysis'
  if (pathname.startsWith('/app/children')) return 'children'
  if (pathname.startsWith('/app/alerts')) return 'alerts'
  if (pathname.startsWith('/app/settings')) return 'settings'
  return 'home'
}

function ChildAvatar({ child, large = false }) {
  const imageUrl = resolveUploadUrl(child?.profileImageUrl)
  const sizeClass = large ? 'h-12 w-12 rounded-xl' : 'h-10 w-10 rounded-lg'

  if (imageUrl) {
    return <img alt={child?.name || 'child'} className={`${sizeClass} object-cover`} src={imageUrl} />
  }

  return <div className={`stats-avatar ${sizeClass}`}>{child?.name?.[0] || '?'}</div>
}

function MetricChip({ label, value, sub }) {
  return (
    <div className="stats-chip">
      <p className="stats-chip-label">{label}</p>
      <p className="stats-chip-value">{value}</p>
      {sub ? <p className="stats-chip-sub">{sub}</p> : null}
    </div>
  )
}

function sampleChartPoints(points, maxPoints = 28) {
  const validPoints = (points || [])
    .map((point, index) => ({ point, index, value: normalizeRate(point?.value ?? point?.finalAccuracy ?? point?.scoreRate) }))
    .filter((item) => item.value != null)

  if (validPoints.length <= maxPoints) return validPoints

  const lastIndex = validPoints.length - 1
  return Array.from({ length: maxPoints }, (_, index) => {
    const sourceIndex = Math.round((index / (maxPoints - 1)) * lastIndex)
    return validPoints[sourceIndex]
  })
}

function LineChart({ points, valueKey = 'scoreRate', labelKey = 'weekNumber' }) {
  const normalizedPoints = (points || []).map((point) => ({ ...point, value: normalizeRate(point?.[valueKey]) }))
  const sampledPoints = sampleChartPoints(normalizedPoints)
  const values = sampledPoints.map((item) => item.value)

  if (!values.length) return <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">chart data 없음</div>

  const width = 320
  const height = 96
  const topPad = 10
  const bottomPad = 10
  const chartHeight = height - topPad - bottomPad
  const step = values.length > 1 ? width / (values.length - 1) : width
  const path = values
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${index * step} ${topPad + (1 - value) * chartHeight}`)
    .join(' ')

  return (
    <div className="chart-shell">
      <svg className="chart-line-svg" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
        <line className="chart-grid-line" x1="0" x2={width} y1={topPad} y2={topPad} />
        <line className="chart-grid-line" x1="0" x2={width} y1={height - bottomPad} y2={height - bottomPad} />
        <path className="chart-line-path" d={path} />
        {sampledPoints.map((item, index) => {
          const radius = sampledPoints.length > 18 ? 2.5 : 4
          const originalLabel = item.point?.[labelKey] || item.index + 1
          return (
            <circle
              className="chart-line-point"
              cx={index * step}
              cy={topPad + (1 - item.value) * chartHeight}
              key={`${originalLabel}-${item.index}`}
              r={radius}
            />
          )
        })}
      </svg>
      {normalizedPoints.length > sampledPoints.length ? (
        <p className="chart-sample-note">전체 {normalizedPoints.length}개 중 {sampledPoints.length}개 지점으로 요약 표시</p>
      ) : null}
    </div>
  )
}

function RiskList({ expressionRows, dialogueSummary }) {
  const risks = [
    ...expressionRows
      .filter((item) => item.confidenceLevel === 'LOW' || item.trendDirection === 'DECLINING' || item.dataReady === false)
      .map((item) => `${emotionLabelMap[item.emotion] || item.emotion}: ${item.confidenceLevel || '-'} / ${item.trendDirection || '-'} / dataReady=${item.dataReady}`),
    ...dialogueSummary
      .filter((item) => item.confidenceLevel === 'LOW' || item.trendDirection === 'DECLINING' || item.dataReady === false)
      .map((item) => `${item.theme}: ${item.confidenceLevel || '-'} / ${item.trendDirection || '-'} / dataReady=${item.dataReady}`),
  ]

  return (
    <article className="stats-panel">
      <div className="panel-head">
        <p>주의 필요 항목</p>
        <span>{risks.length} items</span>
      </div>
      {risks.length ? (
        <div className="mt-3 space-y-2">
          {risks.slice(0, 8).map((item) => (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700" key={item}>{item}</p>
          ))}
        </div>
      ) : (
        <p className="empty-message">현재 조건에 걸리는 항목이 없습니다.</p>
      )}
    </article>
  )
}

function ExpressionTab({ expressionRows }) {
  return (
    <>
      <section className="stats-grid">
        <article className="stats-panel" style={{ overflowX: 'auto' }}>
          <div className="panel-head">
            <p>감정별 raw metrics</p>
            <span>rows = {expressionRows.length}</span>
          </div>
          <table className="mt-4 w-full min-w-[980px] text-left text-xs">
            <thead className="text-slate-400">
              <tr className="border-b border-slate-200">
                <th className="py-2">emotion</th>
                <th>successRate</th>
                <th>fluencyIndex</th>
                <th>avgSessionDurationSec</th>
                <th>retryReductionRate</th>
                <th>trendSlope</th>
                <th>trendDirection</th>
                <th>confidenceScore</th>
                <th>confidenceLevel</th>
                <th>dataReady</th>
              </tr>
            </thead>
            <tbody>
              {expressionRows.map((row) => (
                <tr className="border-b border-slate-100 text-slate-700" key={row.emotion}>
                  <td className="py-3 font-bold">{emotionLabelMap[row.emotion] || row.emotion}</td>
                  <td>{percent(row.successRate)}</td>
                  <td>{fixed(row.fluencyIndex, 2)}</td>
                  <td>{fixed(row.avgSessionDurationSec, 1)}</td>
                  <td>{percent(row.retryReductionRate)}</td>
                  <td>{fixed(row.trendSlope, 4)}</td>
                  <td>{row.trendDirection || '-'}</td>
                  <td>{fixed(row.confidenceScore, 2)}</td>
                  <td>{row.confidenceLevel || '-'}</td>
                  <td>{String(row.dataReady)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {expressionRows.map((row) => (
          <article className="stats-panel" key={`chart-${row.emotion}`}>
            <div className="panel-head">
              <p>{emotionLabelMap[row.emotion] || row.emotion} sessionTrend</p>
              <span>{row.sessionTrend?.length || 0} pts</span>
            </div>
            <LineChart points={row.sessionTrend || []} valueKey="finalAccuracy" labelKey="sessionNumber" />
          </article>
        ))}
      </section>
    </>
  )
}

function DialogueTab({ dialogueSummary }) {
  return (
    <>
      <section className="stats-grid">
        <article className="stats-panel" style={{ overflowX: 'auto' }}>
          <div className="panel-head">
            <p>주제별 raw metrics</p>
            <span>themes = {dialogueSummary.length}</span>
          </div>
          <table className="mt-4 w-full min-w-[1100px] text-left text-xs">
            <thead className="text-slate-400">
              <tr className="border-b border-slate-200">
                <th className="py-2">theme</th>
                <th>strategyMasteryIndex</th>
                <th>emaValue</th>
                <th>emaAlpha</th>
                <th>consistencyStd</th>
                <th>retryReductionRate</th>
                <th>qualityDistribution</th>
                <th>trendSlope</th>
                <th>trendDirection</th>
                <th>confidenceScore</th>
                <th>confidenceLevel</th>
              </tr>
            </thead>
            <tbody>
              {dialogueSummary.map((item) => (
                <tr className="border-b border-slate-100 text-slate-700" key={item.theme}>
                  <td className="py-3 font-bold">{item.theme}</td>
                  <td>{percent(item.strategyMasteryIndex)}</td>
                  <td>{fixed(item.emaValue, 2)}</td>
                  <td>{fixed(item.emaAlpha, 2)}</td>
                  <td>{fixed(item.consistencyStd, 2)}</td>
                  <td>{percent(item.retryReductionRate)}</td>
                  <td>
                    0:{percent(item.qualityDistribution?.score0Rate)} / 1:{percent(item.qualityDistribution?.score1Rate)} / 2:{percent(item.qualityDistribution?.score2Rate)}
                  </td>
                  <td>{fixed(item.trendSlope, 4)}</td>
                  <td>{item.trendDirection || '-'}</td>
                  <td>{fixed(item.confidenceScore, 2)}</td>
                  <td>{item.confidenceLevel || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dialogueSummary.map((item) => (
          <article className="stats-panel" key={`weekly-${item.theme}`}>
            <div className="panel-head">
              <p>{item.theme} weeklyTrend</p>
              <span>{item.weeklyTrend?.length || 0} pts</span>
            </div>
            <LineChart points={item.weeklyTrend || []} />
          </article>
        ))}
      </section>
    </>
  )
}

function ProgressTab({ dialogueProgress }) {
  return (
    <section className="stats-grid">
      {(dialogueProgress?.themes || []).map((item) => (
        <article className="stats-panel" key={`${item.weekNumber}-${item.theme}`}>
          <div className="panel-head">
            <p>Week {item.weekNumber} · {item.theme}</p>
            <span>{item.status}</span>
          </div>
          <p className="mt-3 text-lg font-black text-slate-950">{item.statusLabelTherapist || '-'}</p>
          <p className="mt-2 text-xs text-slate-500">sessionCount {item.sessionCount} · EMA {fixed(item.emaValue, 2)} · consistencyStd {fixed(item.consistencyStd, 2)}</p>
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            offline assigned {item.offlineMission?.assignedCount || 0} / submitted {item.offlineMission?.submittedCount || 0} / success {percent(item.offlineMission?.successRate)}
          </p>
        </article>
      ))}
    </section>
  )
}

function Pager({ page, setPage }) {
  return (
    <div className="mt-3 flex items-center justify-between">
      <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40" disabled={!page || page.first} onClick={() => setPage((p) => Math.max(0, p - 1))} type="button">이전</button>
      <span className="text-xs text-slate-500">{page ? `${page.number + 1} / ${Math.max(1, page.totalPages)}` : '-'}</span>
      <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40" disabled={!page || page.last} onClick={() => setPage((p) => p + 1)} type="button">다음</button>
    </div>
  )
}

function HistoryTab({
  expressionHistoryPage,
  dialogueHistoryPage,
  expressionFilter,
  setExpressionFilter,
  dialogueFilter,
  setDialogueFilter,
  expressionOptions,
  dialogueOptions,
  setExpressionPageIndex,
  setDialoguePageIndex,
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <article className="stats-panel">
        <div className="panel-head">
          <p>expression history</p>
          <select className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700" onChange={(event) => setExpressionFilter(event.target.value)} value={expressionFilter}>
            <option value="">all emotions</option>
            {expressionOptions.map((emotion) => <option key={emotion} value={emotion}>{emotionLabelMap[emotion] || emotion}</option>)}
          </select>
        </div>
        <div className="mt-3 space-y-2">
          {(expressionHistoryPage?.content || []).map((session) => (
            <div className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600" key={session.sessionId}>
              <strong className="text-slate-900">{emotionLabelMap[session.emotion] || session.emotion}</strong> · {formatPlayedAt(session.playedAt)} · accuracy {percent(session.finalAccuracy)} · tries {session.totalTries}
            </div>
          ))}
        </div>
        <Pager page={expressionHistoryPage} setPage={setExpressionPageIndex} />
      </article>

      <article className="stats-panel">
        <div className="panel-head">
          <p>dialogue history</p>
          <select className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700" onChange={(event) => setDialogueFilter(event.target.value)} value={dialogueFilter}>
            <option value="">all themes</option>
            {dialogueOptions.map((theme) => <option key={theme} value={theme}>{theme}</option>)}
          </select>
        </div>
        <div className="mt-3 space-y-2">
          {(dialogueHistoryPage?.content || []).map((session) => (
            <div className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600" key={session.sessionId}>
              <strong className="text-slate-900">{session.theme}</strong> · {formatPlayedAt(session.playedAt)} · scoreRate {percent(session.scoreRate)} · duration {session.durationSeconds}s
            </div>
          ))}
        </div>
        <Pager page={dialogueHistoryPage} setPage={setDialoguePageIndex} />
      </article>
    </section>
  )
}

export function TherapistDashboardPage() {
  const location = useLocation()
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [expressionSummary, setExpressionSummary] = useState(null)
  const [dialogueSummary, setDialogueSummary] = useState([])
  const [dialogueProgress, setDialogueProgress] = useState(null)
  const [expressionHistoryPage, setExpressionHistoryPage] = useState(null)
  const [dialogueHistoryPage, setDialogueHistoryPage] = useState(null)
  const [expressionFilter, setExpressionFilter] = useState('')
  const [dialogueFilter, setDialogueFilter] = useState('')
  const [expressionPageIndex, setExpressionPageIndex] = useState(0)
  const [dialoguePageIndex, setDialoguePageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('expression')
  const [loadingChildren, setLoadingChildren] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)
  const [feedback, setFeedback] = useState('')

  const activeNavId = getActiveNavId(location.pathname)
  const selectedChild = useMemo(() => children.find((child) => child.childId === selectedChildId) || children[0] || null, [children, selectedChildId])
  const expressionRows = useMemo(() => (expressionSummary?.emotions || []).filter((item) => item.emotion), [expressionSummary])
  const expressionOptions = useMemo(() => expressionRows.map((item) => item.emotion), [expressionRows])
  const dialogueOptions = useMemo(() => dialogueSummary.map((item) => item.theme), [dialogueSummary])

  const confidenceSummary = useMemo(() => {
    const values = [...expressionRows.map((item) => item.confidenceLevel), ...dialogueSummary.map((item) => item.confidenceLevel)].filter(Boolean)
    if (!values.length) return '-'
    if (values.includes('LOW')) return 'LOW 포함'
    if (values.includes('MEDIUM')) return 'MEDIUM 이상'
    return 'HIGH'
  }, [dialogueSummary, expressionRows])

  const trendSummary = useMemo(() => {
    const values = [...expressionRows.map((item) => item.trendDirection), ...dialogueSummary.map((item) => item.trendDirection)].filter(Boolean)
    if (!values.length) return '-'
    if (values.includes('DECLINING')) return 'DECLINING 포함'
    if (values.includes('IMPROVING')) return 'IMPROVING 포함'
    return 'STABLE'
  }, [dialogueSummary, expressionRows])

  const avgTrendSlope = useMemo(() => {
    const values = [...expressionRows.map((item) => asNumber(item.trendSlope)), ...dialogueSummary.map((item) => asNumber(item.trendSlope))].filter((value) => value != null)
    if (!values.length) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }, [dialogueSummary, expressionRows])

  useEffect(() => {
    let ignore = false

    async function loadChildren() {
      if (!accessToken) {
        setLoadingChildren(false)
        return
      }

      try {
        const response = await apiFetch('/children/accessible', { method: 'GET', token: accessToken })
        const payload = extractApiPayload(response) || []
        if (!ignore) {
          setChildren(payload)
          setSelectedChildId(payload[0]?.childId || null)
        }
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      } finally {
        if (!ignore) setLoadingChildren(false)
      }
    }

    loadChildren()
    return () => {
      ignore = true
    }
  }, [accessToken])

  useEffect(() => {
    setExpressionPageIndex(0)
    setDialoguePageIndex(0)
    setExpressionFilter('')
    setDialogueFilter('')
  }, [selectedChildId])

  useEffect(() => {
    setExpressionPageIndex(0)
  }, [expressionFilter])

  useEffect(() => {
    setDialoguePageIndex(0)
  }, [dialogueFilter])

  useEffect(() => {
    let ignore = false

    async function loadStats() {
      if (!accessToken || !selectedChildId) {
        setExpressionSummary(null)
        setDialogueSummary([])
        setDialogueProgress(null)
        return
      }

      setLoadingStats(true)
      try {
        const [exprRes, dialogueRes, progressRes] = await Promise.all([
          apiFetch(`/therapist/children/${selectedChildId}/expression/summary`, { method: 'GET', token: accessToken }),
          apiFetch(`/therapist/children/${selectedChildId}/dialogue/summary`, { method: 'GET', token: accessToken }),
          apiFetch(`/therapist/children/${selectedChildId}/dialogue/progress`, { method: 'GET', token: accessToken }),
        ])

        if (!ignore) {
          setExpressionSummary(extractApiPayload(exprRes))
          setDialogueSummary(extractApiPayload(dialogueRes) || [])
          setDialogueProgress(extractApiPayload(progressRes))
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) {
          setExpressionSummary(null)
          setDialogueSummary([])
          setDialogueProgress(null)
          setFeedback(extractApiErrorMessage(error))
        }
      } finally {
        if (!ignore) setLoadingStats(false)
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
      if (!accessToken || !selectedChildId) return

      try {
        const expressionParams = new URLSearchParams({ page: String(expressionPageIndex), size: '10' })
        const dialogueParams = new URLSearchParams({ page: String(dialoguePageIndex), size: '10' })
        if (expressionFilter) expressionParams.set('emotion', expressionFilter)
        if (dialogueFilter) dialogueParams.set('theme', dialogueFilter)

        const [expressionRes, dialogueRes] = await Promise.all([
          apiFetch(`/therapist/children/${selectedChildId}/expression/history?${expressionParams.toString()}`, { method: 'GET', token: accessToken }),
          apiFetch(`/therapist/children/${selectedChildId}/dialogue/history?${dialogueParams.toString()}`, { method: 'GET', token: accessToken }),
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
      }
    }

    loadHistory()
    return () => {
      ignore = true
    }
  }, [accessToken, selectedChildId, expressionFilter, dialogueFilter, expressionPageIndex, dialoguePageIndex])

  return (
    <TherapistStatsShell
      activeId={activeNavId}
      subtitle={`아동 ${selectedChild?.name || '-'} · raw metrics / trend / confidence`}
      title="통계 · 치료사용 분석 대시보드"
    >
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      <section className="stats-child-summary">
        <div className="child-card-left">
          <ChildAvatar child={selectedChild} large />
          <div>
            <p className="child-name">{selectedChild?.name || '선택된 아동 없음'}</p>
            <p className="child-meta">child_id: {selectedChild?.childId || '-'} · {calculateAgeLabel(selectedChild?.birthDate)} · {getGenderLabel(selectedChild?.gender)}</p>
          </div>
        </div>

        <div className="child-metrics">
          <MetricChip label="데이터 충분도" value={confidenceSummary} sub="confidenceLevel 집계" />
          <MetricChip label="최근 추세" value={trendSummary} sub={`avg slope ${fixed(avgTrendSlope, 4)}`} />
          <MetricChip label="분석 항목" value={`${expressionRows.length + dialogueSummary.length}`} sub="expression + dialogue" />
        </div>
      </section>

      {loadingChildren || loadingStats ? <div className="stats-loading">통계 데이터를 불러오는 중입니다...</div> : null}

      {!loadingStats && selectedChild ? (
        <>
          <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
            <div className="stats-panel">
              <div className="panel-head">
                <p>아동 선택</p>
                <span>{children.length}명</span>
              </div>
              <div className="child-selector mt-4">
                {children.map((child) => (
                  <button className={`child-pill ${selectedChildId === child.childId ? 'active' : ''}`} key={child.childId} onClick={() => setSelectedChildId(child.childId)} type="button">
                    {child.name}
                  </button>
                ))}
              </div>
            </div>
            <RiskList expressionRows={expressionRows} dialogueSummary={dialogueSummary} />
          </section>

          <div className="mt-5 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button className={`child-pill ${activeTab === tab.id ? 'active' : ''}`} key={tab.id} onClick={() => setActiveTab(tab.id)} type="button">
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {activeTab === 'expression' ? <ExpressionTab expressionRows={expressionRows} /> : null}
            {activeTab === 'dialogue' ? <DialogueTab dialogueSummary={dialogueSummary} /> : null}
            {activeTab === 'progress' ? <ProgressTab dialogueProgress={dialogueProgress} /> : null}
            {activeTab === 'history' ? (
              <HistoryTab
                dialogueFilter={dialogueFilter}
                dialogueHistoryPage={dialogueHistoryPage}
                dialogueOptions={dialogueOptions}
                expressionFilter={expressionFilter}
                expressionHistoryPage={expressionHistoryPage}
                expressionOptions={expressionOptions}
                setDialogueFilter={setDialogueFilter}
                setDialoguePageIndex={setDialoguePageIndex}
                setExpressionFilter={setExpressionFilter}
                setExpressionPageIndex={setExpressionPageIndex}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </TherapistStatsShell>
  )
}
