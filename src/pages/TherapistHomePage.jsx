import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TherapistStatsShell } from '../components/TherapistStatsShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

function percent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return `${Math.round(value * 100)}%`
}

function fixed(value, digits = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return value.toFixed(digits)
}

function StatCard({ label, value, sub }) {
  return (
    <article className="stats-panel">
      <p className="stats-chip-label">{label}</p>
      <p className="stats-chip-value">{value}</p>
      <p className="stats-chip-sub">{sub}</p>
    </article>
  )
}

export function TherapistHomePage() {
  const navigate = useNavigate()
  const { accessToken } = useAuth()

  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [expressionSummary, setExpressionSummary] = useState(null)
  const [dialogueSummary, setDialogueSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')

  const selectedChild = useMemo(
    () => children.find((child) => child.childId === selectedChildId) || children[0] || null,
    [children, selectedChildId],
  )

  const lowRapportCount = useMemo(
    () => (dialogueSummary || []).filter((item) => item.dataReady && item.rapportIndex < 0.5).length,
    [dialogueSummary],
  )

  const lowSuccessCount = useMemo(
    () => (expressionSummary?.emotions || []).filter((item) => item.dataReady && item.successRate < 0.5).length,
    [expressionSummary],
  )

  const highFatigueCount = useMemo(
    () => (dialogueSummary || []).filter((item) => item.dataReady && item.turnFatigue >= 0.33).length,
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
        const response = await apiFetch('/children/accessible', { method: 'GET', token: accessToken })
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

    async function loadHomeStats() {
      if (!accessToken || !selectedChildId) {
        setExpressionSummary(null)
        setDialogueSummary([])
        return
      }

      try {
        const [expressionRes, dialogueRes] = await Promise.all([
          apiFetch(`/therapist/children/${selectedChildId}/expression/summary`, { method: 'GET', token: accessToken }),
          apiFetch(`/therapist/children/${selectedChildId}/dialogue/summary`, { method: 'GET', token: accessToken }),
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
      }
    }

    loadHomeStats()

    return () => {
      ignore = true
    }
  }, [accessToken, selectedChildId])

  return (
    <TherapistStatsShell
      activeId="home"
      subtitle="치료사가 바로 확인해야 할 핵심 지표를 요약합니다."
      title="개요 · 오늘의 임상 요약"
    >
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      {loading ? (
        <div className="stats-loading">학생 및 통계 데이터를 불러오는 중입니다...</div>
      ) : (
        <>
          <section className="stats-grid bottom-grid" style={{ marginTop: 16 }}>
            <StatCard label="담당 아동" sub="조회 가능한 아동 수" value={`${children.length}명`} />
            <StatCard label="저성공 감정" sub="성공률 50% 미만" value={`${lowSuccessCount}개`} />
            <StatCard label="라포 주의 주제" sub="라포 50% 미만" value={`${lowRapportCount}개`} />
            <StatCard label="고피로 주제" sub="턴 피로도 0.33 이상" value={`${highFatigueCount}개`} />
          </section>

          <section className="stats-panel" style={{ marginTop: 16 }}>
            <div className="panel-head">
              <p>아동 빠른 전환</p>
              <span>{selectedChild?.name || '-'}</span>
            </div>
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
          </section>

          <section className="stats-panel" style={{ marginTop: 16 }}>
            <div className="panel-head">
              <p>바로 가기</p>
            </div>
            <div className="child-selector">
              <button className="child-pill active" onClick={() => navigate('/app/analysis')} type="button">통계 자세히 보기</button>
              <button className="child-pill" onClick={() => navigate('/app/children')} type="button">아동 관리 이동</button>
              <button className="child-pill" onClick={() => navigate('/app/alerts')} type="button">알림 확인</button>
            </div>
          </section>
        </>
      )}
    </TherapistStatsShell>
  )
}
