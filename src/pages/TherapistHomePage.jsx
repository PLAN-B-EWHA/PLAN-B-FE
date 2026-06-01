import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TherapistStatsShell } from '../components/TherapistStatsShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { canAssignMission } from '../lib/childUtils'

const dayLabels = ['월', '화', '수', '목', '금', '토', '일']

function percent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return `${Math.round(value * 100)}%`
}

function StatCard({ label, value, sub, highlight, onClick }) {
  return (
    <article
      className={`kpi therapist-kpi ${onClick ? 'cursor-pointer hover:border-[var(--accent-line)]' : ''} ${highlight ? 'kpi-warn' : ''}`}
      onClick={onClick}
    >
      <div className="k-top">
        <p className="k-label">{label}</p>
        {highlight ? <span className="badge badge-warn">확인 필요</span> : null}
      </div>
      <p className="k-num">{value}</p>
      <p className="k-note">{sub}</p>
    </article>
  )
}

function TherapistWeekCard({ weeklyParticipation, navigate }) {
  const markers = weeklyParticipation?.dayMarkers || []

  return (
    <section className="stats-panel therapist-week-card">
      <div className="card-head">
        <p className="card-title">이번 주 참여</p>
        <span className="badge badge-success">{weeklyParticipation?.goalAchieved ? '목표 달성' : '진행 중'}</span>
      </div>

      <div className="therapist-week-dots">
        {dayLabels.map((day, index) => {
          const done = Boolean(markers[index])
          return (
            <div className="therapist-week-day" key={day}>
              <span className={done ? 'done' : ''}>{done ? '✓' : '-'}</span>
              <p>{day}</p>
            </div>
          )
        })}
      </div>

      <div className="therapist-week-metrics">
        <div>
          <p>게임</p>
          <strong>{weeklyParticipation?.gameCompletedDays ?? 0}일</strong>
        </div>
        <div>
          <p>미션</p>
          <strong>{weeklyParticipation?.offlineMissionCompletedDays ?? 0}일</strong>
        </div>
        <div className={weeklyParticipation?.goalAchieved ? 'ok' : ''}>
          <p>달성</p>
          <strong>{weeklyParticipation?.goalAchieved ? '예' : '아니오'}</strong>
        </div>
      </div>

      <div className="therapist-shortcuts">
        <p>바로 가기</p>
        <div className="child-selector">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/app/analysis')} type="button">통계 자세히 보기</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app/offline')} type="button">오프라인 미션</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app/children')} type="button">아동 관리</button>
        </div>
      </div>
    </section>
  )
}

export function TherapistHomePage() {
  const navigate = useNavigate()
  const { accessToken } = useAuth()

  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [expressionSummary, setExpressionSummary] = useState(null)
  const [dialogueSummary, setDialogueSummary] = useState([])
  const [missionSummary, setMissionSummary] = useState(null)
  const [weeklyParticipation, setWeeklyParticipation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')

  const selectedChild = useMemo(
    () => children.find((child) => child.childId === selectedChildId) || children[0] || null,
    [children, selectedChildId],
  )

  useEffect(() => {
    let ignore = false
    async function loadChildren() {
      if (!accessToken) { setLoading(false); return }
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
    return () => { ignore = true }
  }, [accessToken])

  useEffect(() => {
    let ignore = false
    async function loadHomeStats() {
      if (!accessToken || !selectedChildId) {
        setExpressionSummary(null)
        setDialogueSummary([])
        setMissionSummary(null)
        setWeeklyParticipation(null)
        return
      }
      try {
        const canLoadHomework = canAssignMission(selectedChild)
        const [expressionRes, dialogueRes, missionRes, participationRes] = await Promise.all([
          apiFetch(`/therapist/children/${selectedChildId}/expression/summary`, { method: 'GET', token: accessToken }),
          apiFetch(`/therapist/children/${selectedChildId}/dialogue/summary`, { method: 'GET', token: accessToken }),
          canLoadHomework ? apiFetch(`/therapist/children/${selectedChildId}/homework/summary`, { method: 'GET', token: accessToken }) : Promise.resolve(null),
          apiFetch(`/therapist/children/${selectedChildId}/weekly-participation`, { method: 'GET', token: accessToken }),
        ])
        if (!ignore) {
          setExpressionSummary(extractApiPayload(expressionRes))
          setDialogueSummary(extractApiPayload(dialogueRes) || [])
          setMissionSummary(missionRes ? extractApiPayload(missionRes) : null)
          setWeeklyParticipation(extractApiPayload(participationRes) || null)
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
    return () => { ignore = true }
  }, [accessToken, selectedChildId, selectedChild])

  const lowSuccessCount = useMemo(
    () => (expressionSummary?.emotions || []).filter((item) => item.dataReady && item.successRate < 0.5).length,
    [expressionSummary],
  )

  const lowRapportCount = useMemo(
    () => (dialogueSummary || []).filter((item) => item.dataReady && item.rapportIndex < 0.5).length,
    [dialogueSummary],
  )

  const decliningCount = useMemo(
    () => (dialogueSummary || []).filter((item) => item.dataReady && item.trendDirection === 'DECLINING').length,
    [dialogueSummary],
  )

  const pendingReviewCount = missionSummary?.submittedCount ?? 0

  const riskItems = useMemo(() => {
    const items = []
    ;(expressionSummary?.emotions || [])
      .filter((e) => e.dataReady && e.successRate < 0.5)
      .slice(0, 3)
      .forEach((e) => items.push({ label: `${e.emotion || e.emotionTarget} 표정`, desc: `성공률 ${percent(e.successRate)}`, type: 'expr' }))
    ;(dialogueSummary || [])
      .filter((d) => d.dataReady && (d.trendDirection === 'DECLINING' || d.rapportIndex < 0.5))
      .slice(0, 3)
      .forEach((d) => items.push({
        label: d.theme,
        desc: d.trendDirection === 'DECLINING' ? '하락 추세' : `라포 ${percent(d.rapportIndex)}`,
        type: 'dlg',
      }))
    return items.slice(0, 5)
  }, [expressionSummary, dialogueSummary])

  return (
    <TherapistStatsShell
      activeId="home"
      subtitle="치료사가 바로 확인해야 할 핵심 지표를 요약합니다."
      title="오늘의 임상 요약"
    >
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      {loading ? (
        <div className="stats-loading">아동 및 통계 데이터를 불러오는 중입니다...</div>
      ) : (
        <>
          <section className="therapist-kpi-grid">
            <StatCard label="담당 아동" sub="조회 가능한 아동 수" value={`${children.length}명`} />
            <StatCard
              label="검토 대기"
              sub="부모 보고 후 미검토"
              value={`${pendingReviewCount}건`}
              highlight={pendingReviewCount > 0}
              onClick={pendingReviewCount > 0 ? () => navigate('/app/offline') : undefined}
            />
            <StatCard label="저성공 감정" sub="성공률 50% 미만" value={`${lowSuccessCount}개`} />
            <StatCard label="하락 추세 주제" sub="대화 점수 하락 중" value={`${decliningCount}개`} highlight={decliningCount > 0} />
            <StatCard label="라포 주의" sub="라포 지수 50% 미만" value={`${lowRapportCount}개`} />
          </section>

          {pendingReviewCount > 0 ? (
            <button className="therapist-alert" onClick={() => navigate('/app/offline')} type="button">
              <span className="alert-ico">▣</span>
              <span>
                <strong>{selectedChild?.name || '선택 아동'}의 미션 보고 {pendingReviewCount}건이 검토를 기다리고 있어요.</strong>
                <small>오프라인 미션 페이지에서 확인하고 피드백을 남겨 주세요.</small>
              </span>
              <b>바로 가기 →</b>
            </button>
          ) : null}

          <div className="therapist-home-grid">
            <section className="stats-panel therapist-child-panel">
              <div className="card-head">
                <p className="card-title">아동 빠른 전환</p>
                <span className="count">현재 {selectedChild?.name || '-'}</span>
              </div>
              <div className="child-selector mt-3">
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

              {riskItems.length > 0 ? (
                <div className="therapist-risk-list">
                  <p className="risk-title">주의 신호 · {selectedChild?.name}</p>
                  {riskItems.map((item) => (
                    <div className="risk-row" key={`${item.type}-${item.label}`}>
                      <span>{item.label}</span>
                      <strong>{item.desc}</strong>
                    </div>
                  ))}
                </div>
              ) : expressionSummary || dialogueSummary.length > 0 ? (
                <div className="note-ok therapist-ok">✓ 현재 주의 신호가 없어요.</div>
              ) : (
                <p className="empty-note mt-4">통계 데이터가 쌓이면 주의 신호가 표시됩니다.</p>
              )}
            </section>

            <TherapistWeekCard navigate={navigate} weeklyParticipation={weeklyParticipation} />
          </div>
        </>
      )}
    </TherapistStatsShell>
  )
}
