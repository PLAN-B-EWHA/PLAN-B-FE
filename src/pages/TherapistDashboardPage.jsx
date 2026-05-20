import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TherapistStatsShell } from '../components/TherapistStatsShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { calculateAgeLabel, getGenderLabel, resolveUploadUrl } from '../lib/childUtils'

const sidebarItems = [
  { id: 'home', label: '개요', path: '/app' },
  { id: 'children', label: '아동 관리', path: '/app/children' },
  { id: 'analysis', label: '통계', path: '/app/analysis' },
  { id: 'alerts', label: '알림', path: '/app/alerts' },
  { id: 'settings', label: '설정', path: '/app/settings' },
]

const emotionLabelMap = {
  happy: '기쁨',
  sad: '슬픔',
  angry: '분노',
  disgust: '혐오',
  surprise: '놀람',
  fear: '공포',
}

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

function fixed(value, digits = 1) {
  const n = asNumber(value)
  if (n == null) return '-'
  return n.toFixed(digits)
}

function getWilsonInterval(successRate, sessionCount) {
  const p = normalizeRate(successRate)
  const n = asNumber(sessionCount)
  if (p == null || n == null || n <= 0) return { lower: null, upper: null }

  const z = 1.96
  const denominator = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / denominator
  const margin = (z / denominator) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  }
}

function getThreshold(successRate) {
  const rate = normalizeRate(successRate) || 0
  if (rate >= 0.8) return { label: '안정적 숙달', tone: 'stable' }
  if (rate >= 0.6) return { label: '개선 중', tone: 'improving' }
  return { label: '집중 지도', tone: 'focus' }
}

function getMasteryTone(value) {
  const v = normalizeRate(value) || 0
  if (v >= 0.8) return 'stable'
  if (v >= 0.6) return 'improving'
  return 'focus'
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

function EmotionRow({ item }) {
  const score = normalizeRate(item.successRate)
  const { lower, upper } = getWilsonInterval(item.successRate, item.sessionCount)
  const pointLeft = `${Math.max(0, Math.min(100, (score || 0) * 100))}%`
  const ciLeft = `${Math.max(0, Math.min(100, (lower || 0) * 100))}%`
  const ciWidth = `${Math.max(2, ((upper || 0) - (lower || 0)) * 100)}%`
  const status = getThreshold(item.successRate)

  return (
    <div className="emotion-row">
      <div className="emotion-label-col">
        <span className="emotion-dot" />
        <span className="emotion-name">{emotionLabelMap[item.emotion] || item.emotion}</span>
      </div>

      <div className="emotion-track-wrap">
        <div className="emotion-track" />
        <div className="emotion-ci" style={{ left: ciLeft, width: ciWidth }} />
        <div className="emotion-point" style={{ left: pointLeft }} />
      </div>

      <p className="emotion-score">
        {percent(item.successRate)} <span>{lower != null && upper != null ? `[${percent(lower)}-${percent(upper)}]` : ''}</span>
      </p>

      <span className={`emotion-status ${status.tone}`}>{status.label}</span>

      <p className="emotion-n">n={asNumber(item.sessionCount) || 0}</p>
    </div>
  )
}

function getActiveNavId(pathname) {
  if (pathname.startsWith('/app/analysis')) return 'analysis'
  if (pathname.startsWith('/app/children')) return 'children'
  if (pathname.startsWith('/app/alerts')) return 'alerts'
  if (pathname.startsWith('/app/settings')) return 'settings'
  return 'home'
}

export function TherapistDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { accessToken, jwtPayload, logout, user } = useAuth()

  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)

  const [expressionSummary, setExpressionSummary] = useState(null)
  const [dialogueSummary, setDialogueSummary] = useState([])
  const [dialogueProgress, setDialogueProgress] = useState(null)

  const [loadingChildren, setLoadingChildren] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)
  const [feedback, setFeedback] = useState('')

  const displayName = user?.name || jwtPayload?.name || '치료사'
  const activeNavId = getActiveNavId(location.pathname)

  const selectedChild = useMemo(() => children.find((child) => child.childId === selectedChildId) || children[0] || null, [children, selectedChildId])

  const expressionRows = useMemo(() => {
    const rows = expressionSummary?.emotions || []
    return rows
      .map((item) => ({
        emotion: item.emotion,
        successRate: item.successRate,
        sessionCount: item.sessionCount,
        dataReady: item.dataReady,
        successRateLevel: item.successRateLevel,
        fluencyIndex: item.fluencyIndex,
      }))
      .filter((item) => item.emotion)
  }, [expressionSummary])

  const avgSuccess = useMemo(() => {
    if (!expressionRows.length) return null
    const total = expressionRows.reduce((sum, row) => sum + (normalizeRate(row.successRate) || 0), 0)
    return total / expressionRows.length
  }, [expressionRows])

  const avgEma = useMemo(() => {
    const valid = dialogueSummary.map((item) => asNumber(item.emaValue)).filter((v) => v != null)
    if (!valid.length) return null
    return valid.reduce((sum, v) => sum + v, 0) / valid.length
  }, [dialogueSummary])

  const avgFluency = useMemo(() => {
    const values = expressionRows.map((row) => asNumber(row.fluencyIndex)).filter((v) => v != null)
    if (!values.length) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }, [expressionRows])

  const validSessionCount = useMemo(() => {
    if (!expressionRows.length) return 0
    return expressionRows.reduce((sum, row) => sum + (asNumber(row.sessionCount) || 0), 0)
  }, [expressionRows])

  const weekRangeLabel = useMemo(() => {
    const weeks = (dialogueProgress?.themes || [])
      .map((item) => asNumber(item.weekNumber))
      .filter((v) => v != null)
      .sort((a, b) => a - b)

    if (!weeks.length) return 'Week 01 - 08'
    return `Week ${String(weeks[0]).padStart(2, '0')} - ${String(weeks[weeks.length - 1]).padStart(2, '0')}`
  }, [dialogueProgress])

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
        if (ignore) return
        setChildren(payload)
        setSelectedChildId(payload[0]?.childId || null)
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
        const [exprRes, dialogRes, progressRes] = await Promise.all([
          apiFetch(`/therapist/children/${selectedChildId}/expression/summary`, { method: 'GET', token: accessToken }),
          apiFetch(`/therapist/children/${selectedChildId}/dialogue/summary`, { method: 'GET', token: accessToken }),
          apiFetch(`/therapist/children/${selectedChildId}/dialogue/progress`, { method: 'GET', token: accessToken }),
        ])

        if (ignore) return
        setExpressionSummary(extractApiPayload(exprRes))
        setDialogueSummary(extractApiPayload(dialogRes) || [])
        setDialogueProgress(extractApiPayload(progressRes))
        setFeedback('')
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

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <TherapistStatsShell
      activeId={activeNavId}
      subtitle={`아동 ${selectedChild?.name || '-'} · 기간 ${weekRangeLabel} · 코호트 ${children.length}명`}
      title="통계 · 진행 경과 및 임상 지표"
    >

        {feedback ? <div className="stats-feedback">{feedback}</div> : null}

        <section className="stats-child-summary">
          <div className="child-card-left">
            <ChildAvatar child={selectedChild} large />
            <div>
              <p className="child-name">{selectedChild?.name || '선택된 아동 없음'}</p>
              <p className="child-meta">
                child_id: {selectedChild?.childId || '-'} · {calculateAgeLabel(selectedChild?.birthDate)} · {getGenderLabel(selectedChild?.gender)}
              </p>
            </div>
          </div>

          <div className="child-metrics">
            <MetricChip label="표정 성공률 평균" value={avgSuccess == null ? '-' : percent(avgSuccess)} sub="Wilson CI 기준" />
            <MetricChip label="EMA 평균" value={avgEma == null ? '-' : fixed(avgEma, 2)} sub="주요 4개 테마" />
            <MetricChip label="유효 세션 수" value={String(validSessionCount)} sub="감정별 집계 합산" />
          </div>
        </section>

        {loadingChildren || loadingStats ? <div className="stats-loading">통계 데이터를 불러오는 중입니다...</div> : null}

        {!loadingStats && !!selectedChild ? (
          <>
            <section className="stats-section-head">
              <p>SECTION 01 / 표정 짓기</p>
              <h2>표정 짓기 · Expression</h2>
            </section>

            <section className="stats-grid">
              <article className="stats-panel">
                <div className="panel-head">
                  <p>1-1 감정별 성공률 · WITH WILSON 95% CI</p>
                  <span>n = {validSessionCount}</span>
                </div>

                <div className="emotion-table">
                  {expressionRows.length ? (
                    expressionRows.map((row) => <EmotionRow item={row} key={`emotion-${row.emotion}`} />)
                  ) : (
                    <p className="empty-message">표정 통계 데이터가 아직 없습니다.</p>
                  )}
                </div>

                <div className="legend-row">
                  <span>■ Point estimate</span>
                  <span>■ 95% CI band</span>
                  <span>■ 0-100% axis</span>
                </div>
              </article>

              <article className="stats-panel threshold-panel">
                <p className="threshold-title">1-1 THRESHOLD</p>
                <h3>임계값 · 판정 체계</h3>

                <ul>
                  <li><span className="dot stable" /> 안정적 숙달 <strong>≥ 80%</strong></li>
                  <li><span className="dot improving" /> 개선 중 <strong>60-79%</strong></li>
                  <li><span className="dot focus" /> 집중 지도 <strong>&lt; 60%</strong></li>
                </ul>

                <div className="threshold-note">CI 해석: n이 작으면 구간 폭이 넓어집니다. 최소 3세션 이상에서 추세 판독을 권장합니다.</div>
              </article>
            </section>

            <section className="stats-grid bottom-grid">
              <article className="stats-panel mini-panel">
                <div className="panel-head">
                  <p>1-2 유창성 지수 (첫 시도 기반)</p>
                  <span>v2.1</span>
                </div>
                <div className="big-value">{avgFluency != null ? fixed(avgFluency, 1) : '-'}</div>
                <p className="sub">감정별 fluencyIndex 평균 · 치료사 통계 기준</p>
              </article>

              <article className="stats-panel mini-panel">
                <div className="panel-head">
                  <p>1-3 학습 곡선</p>
                  <span>참고 지표</span>
                </div>
                <div className="mini-trends">
                  {(dialogueSummary || []).slice(0, 4).map((item) => (
                    <div className="trend-row" key={`trend-${item.theme}`}>
                      <span>{item.theme}</span>
                      <div className="trend-line">
                        <div className="trend-fill" style={{ width: `${Math.max(5, (asNumber(item.emaValue) || 0) * 100)}%` }} />
                      </div>
                      <strong>{item.emaValue == null ? '-' : fixed(item.emaValue, 2)}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="stats-section-head">
              <p>SECTION 02 / 선택지형 대화</p>
              <h2>선택지형 대화 · 전략 숙달 및 EMA</h2>
            </section>

            <section className="stats-grid">
              <article className="stats-panel">
                <div className="panel-head">
                  <p>2-1 전략 숙달/품질 분포/EMA</p>
                  <span>themes = {dialogueSummary.length}</span>
                </div>
                <div className="mini-trends">
                  {dialogueSummary.length ? (
                    dialogueSummary.map((item) => {
                      const masteryTone = getMasteryTone(item.strategyMasteryIndex)
                      const q0 = percent(item.qualityDistribution?.score0Rate)
                      const q1 = percent(item.qualityDistribution?.score1Rate)
                      const q2 = percent(item.qualityDistribution?.score2Rate)
                      return (
                        <div className="stats-panel" key={`dialogue-${item.theme}`}>
                          <div className="panel-head">
                            <p>{item.theme}</p>
                            <span className={`emotion-status ${masteryTone}`}>
                              {item.masteryJudgmentForParent || '진행 중'}
                            </span>
                          </div>
                          <div className="trend-row">
                            <span>숙달도</span>
                            <div className="trend-line">
                              <div className="trend-fill" style={{ width: `${Math.max(5, (normalizeRate(item.strategyMasteryIndex) || 0) * 100)}%` }} />
                            </div>
                            <strong>{percent(item.strategyMasteryIndex)}</strong>
                          </div>
                          <div className="trend-row">
                            <span>EMA</span>
                            <div className="trend-line">
                              <div className="trend-fill" style={{ width: `${Math.max(5, (asNumber(item.emaValue) || 0) * 100)}%` }} />
                            </div>
                            <strong>{item.emaValue == null ? '-' : fixed(item.emaValue, 2)}</strong>
                          </div>
                          <p className="sub">
                            품질분포 0/1/2: {q0} / {q1} / {q2} · α {item.emaAlpha == null ? '-' : fixed(item.emaAlpha, 2)} ·
                            일관성 {item.consistencyStd == null ? '-' : fixed(item.consistencyStd, 2)} · 재시도감소율{' '}
                            {item.retryReductionRate == null ? '-' : percent(item.retryReductionRate)}
                          </p>
                        </div>
                      )
                    })
                  ) : (
                    <p className="empty-message">대화 통계 데이터가 아직 없습니다.</p>
                  )}
                </div>
              </article>

              <article className="stats-panel threshold-panel">
                <p className="threshold-title">2-2 주차별 진행</p>
                <h3>주차별 진행도</h3>
                <ul>
                  {(dialogueProgress?.themes || []).slice(0, 8).map((item) => (
                    <li key={`week-${item.weekNumber}-${item.theme}`}>
                      <span className={`dot ${item.status === 'COMPLETED' ? 'stable' : item.status === 'IN_PROGRESS' ? 'improving' : 'focus'}`} />
                      W{item.weekNumber} {item.theme}
                      <strong>{item.statusLabelTherapist || item.status}</strong>
                    </li>
                  ))}
                </ul>
              </article>
            </section>
          </>
        ) : null}

        <footer className="stats-footer">
          <div className="child-selector">
            {children.map((child) => (
              <button
                className={`child-pill ${selectedChildId === child.childId ? 'active' : ''}`}
                key={child.childId}
                onClick={() => setSelectedChildId(child.childId)}
                type="button"
              >
                {child.name}
              </button>
            ))}
          </div>

        </footer>
    </TherapistStatsShell>
  )
}
