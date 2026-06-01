import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ParentShell } from '../components/ParentShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { calculateAgeLabel, canWriteNote, getGenderLabel } from '../lib/childUtils'

const dayLabels = ['월', '화', '수', '목', '금', '토', '일']

function percent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return `${Math.round(value * 100)}%`
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

function KpiCard({ label, value, note, trend }) {
  return (
    <article className="kpi">
      <div className="k-top">
        <p className="k-label">{label}</p>
        {trend ? <span className="trend">~ 11%p</span> : null}
      </div>
      <p className="k-num">{value}</p>
      <p className="k-note">{note}</p>
    </article>
  )
}

function WeeklyDots({ participation }) {
  const markers = participation?.dayMarkers || []
  const todayIndex = (new Date().getDay() + 6) % 7

  return (
    <div className="week dots">
      {dayLabels.map((label, index) => {
        const done = Boolean(markers[index])
        return (
          <div className={`day ${done ? 'done' : ''} ${todayIndex === index ? 'today' : ''}`} key={label}>
            <div className="circle">{done ? '✓' : index === todayIndex ? '-' : ''}</div>
            <span className="lbl">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function MissionCard({ mission, onOpen }) {
  if (!mission) {
    return (
      <article className="stats-panel mission-panel">
        <div className="card-head">
          <p className="card-title">이번 주 오프라인 미션</p>
          <span className="badge badge-muted">대기</span>
        </div>
        <p className="empty-note">현재 배정된 오프라인 미션이 없습니다. 치료사가 새 미션을 배정하면 여기에 표시됩니다.</p>
      </article>
    )
  }

  const statusLabel = {
    PENDING: '진행 중',
    SUBMITTED: '확인 대기',
    REVIEWED: '검토 완료',
    EXPIRED: '기한 만료',
    CANCELED: '취소됨',
  }[mission.status] || mission.status

  return (
    <article className="stats-panel mission-panel">
      <div className="card-head">
        <div>
          <p className="card-title">이번 주 오프라인 미션</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="badge badge-info">이번 주 미션 · W{mission.week}</span>
            <span className="badge badge-warn">{statusLabel}</span>
          </div>
        </div>
      </div>
      <div className="mission-row">
        <div>
          <h2>{mission.strategyFocusLabel || mission.strategyFocus || '정보 교환하기'}</h2>
          <p>{mission.instruction || '일상적인 상황에서 아이가 좋아하는 주제에 대해 질문을 던지고, 아이도 질문을 되돌려줄 수 있도록 유도하세요.'}</p>
          <p className="mission-date">마감 · {formatDate(mission.dueDate)}</p>
        </div>
        <button className="btn btn-primary" onClick={onOpen} type="button">
          {mission.status === 'PENDING' ? '수행 기록 남기기' : '자세히 보기'}
        </button>
      </div>
      {mission.report?.therapistReviewComment ? <div className="note-ok mt-4">치료사 피드백 · {mission.report.therapistReviewComment}</div> : null}
    </article>
  )
}

function SelectedStudentCard({ children, selectedChild, onSelect }) {
  return (
    <aside className="stats-panel">
      <div className="card-head">
        <p className="card-title">선택 학생</p>
      </div>
      <div className="grid gap-2">
        {children.map((child) => (
          <button
            className={`student-select ${selectedChild?.childId === child.childId ? 'active' : ''}`}
            key={child.childId}
            onClick={() => onSelect(child.childId)}
            type="button"
          >
            <span className="student-avatar">{child.name?.[0] || '?'}</span>
            <span className="student-main">
              <strong>{child.name}</strong>
              <small>{calculateAgeLabel(child.birthDate)} · {getGenderLabel(child.gender)}</small>
            </span>
            <span className="student-state">선택됨</span>
          </button>
        ))}
      </div>
    </aside>
  )
}

function MissionStatusCard({ summary }) {
  const completion = summary?.completionRate ?? 0
  const spontaneous = summary?.spontaneousRate ?? 0

  return (
    <aside className="stats-panel mission-status-panel">
      <div className="card-head">
        <p className="card-title">미션 현황</p>
      </div>
      <div className="progress-stack">
        <div>
          <div className="progress-head"><span>완료율</span><strong>{percent(completion)}</strong></div>
          <div className="bar"><i style={{ width: percent(completion) === '-' ? '0%' : percent(completion) }} /></div>
        </div>
        <div>
          <div className="progress-head"><span>자발성</span><strong>{percent(spontaneous)}</strong></div>
          <div className="bar blue"><i style={{ width: percent(spontaneous) === '-' ? '0%' : percent(spontaneous) }} /></div>
        </div>
      </div>
    </aside>
  )
}

export function ParentHomePage() {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [expressionSummary, setExpressionSummary] = useState(null)
  const [currentMission, setCurrentMission] = useState(null)
  const [missionSummary, setMissionSummary] = useState(null)
  const [weeklyParticipation, setWeeklyParticipation] = useState(null)
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
        setCurrentMission(null)
        setMissionSummary(null)
        setWeeklyParticipation(null)
        return
      }

      setStatLoading(true)
      try {
        const canLoadHomework = canWriteNote(selectedChild)
        const [expressionRes, missionRes, currentMissionRes, participationRes] = await Promise.all([
          apiFetch(`/parent/children/${selectedChildId}/expression/summary`, { method: 'GET', token: accessToken }),
          canLoadHomework ? apiFetch(`/parent/children/${selectedChildId}/homework/summary`, { method: 'GET', token: accessToken }) : Promise.resolve(null),
          canLoadHomework ? apiFetch(`/parent/children/${selectedChildId}/homework/current`, { method: 'GET', token: accessToken }) : Promise.resolve(null),
          apiFetch(`/parent/children/${selectedChildId}/weekly-participation`, { method: 'GET', token: accessToken }),
        ])
        if (!ignore) {
          setExpressionSummary(extractApiPayload(expressionRes))
          setMissionSummary(missionRes ? extractApiPayload(missionRes) : null)
          setCurrentMission(currentMissionRes ? extractApiPayload(currentMissionRes) || null : null)
          setWeeklyParticipation(extractApiPayload(participationRes) || null)
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      } finally {
        if (!ignore) setStatLoading(false)
      }
    }
    loadHomeStats()
    return () => { ignore = true }
  }, [accessToken, selectedChildId, selectedChild])

  const readyEmotions = useMemo(
    () => (expressionSummary?.emotions || []).filter((emotion) => emotion.dataReady),
    [expressionSummary],
  )
  const avgSuccessRate = readyEmotions.length
    ? readyEmotions.reduce((sum, emotion) => sum + emotion.successRate, 0) / readyEmotions.length
    : null
  const improvingCount = readyEmotions.filter((emotion) => emotion.trendDirection === 'IMPROVING').length

  return (
    <ParentShell
      actions={(
        <>
          <button className="btn btn-primary" onClick={() => navigate('/app/analysis')} type="button">아이 성장 보기</button>
          <button className="btn btn-ghost" onClick={() => navigate('/app/offline')} type="button">오프라인 현황 보기</button>
        </>
      )}
      childCount={children.length}
      heading="보호자 홈"
      selectedChild={selectedChild}
      subheading={selectedChild ? `${selectedChild.name}의 오늘 학습과 할 일을 확인하세요.` : '학생을 등록하면 요약이 표시됩니다.'}
    >
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}
      {loading ? <div className="stats-loading">학생 목록을 불러오는 중입니다...</div> : null}

      {!loading && children.length === 0 ? (
        <section className="stats-panel text-center">
          <p className="eyebrow">Create Student</p>
          <h2 className="text-2xl font-black text-slate-950">먼저 학생을 등록해 주세요</h2>
          <p className="sub mt-2">등록 후 감정 학습, 대화 학습, 오프라인 미션 요약을 볼 수 있습니다.</p>
          <button className="btn btn-primary mt-6" onClick={() => navigate('/app/children')} type="button">학생 등록하기</button>
        </section>
      ) : null}

      {!loading && children.length > 0 ? (
        <>
          <section className="parent-kpi-grid">
            <KpiCard label="등록 학생" note="현재 보호자 계정 기준" value={`${children.length}명`} />
            <KpiCard label="평균 표정 정답률" note={readyEmotions.length ? `${readyEmotions.length}개 감정 기준` : '데이터 수집 중'} trend={avgSuccessRate != null} value={avgSuccessRate == null ? '-' : percent(avgSuccessRate)} />
            <KpiCard label="향상 중인 감정" note="상승 추세 감정 수" trend={improvingCount > 0} value={readyEmotions.length ? `${improvingCount}개` : '-'} />
            <KpiCard label="이번 주 미션 제출률" note={missionSummary ? `전체 ${missionSummary.assignedCount}건 중 ${missionSummary.submittedCount ?? 0}건` : '미션 없음'} value={missionSummary ? percent(missionSummary.submissionRate) : '-'} />
            <KpiCard label="이번 주 참여" note={weeklyParticipation ? `권장 ${weeklyParticipation.recommendedPerWeek}일 기준` : '참여 기록 없음'} value={weeklyParticipation ? `${weeklyParticipation.completedDays}일` : '-'} />
          </section>

          <section className="parent-overview-grid">
            <div className="parent-overview-main">
              <article className="stats-panel encouragement-panel">
                <div className="card-head">
                  <p className="card-title">오늘의 격려와 가정 연습</p>
                  <button className="link-action" onClick={() => navigate('/app/analysis')} type="button">성장 흐름 보기 ›</button>
                </div>
                <div className="insight">
                  {expressionSummary?.encouragementMessage ? (
                    <>
                      <span className="insight-icon">↗</span>
                      <p className="txt">
                        {expressionSummary.encouragementMessage}
                        <span>꾸준한 가정 연습이 잘 이어지고 있어요.</span>
                      </p>
                    </>
                  ) : (
                    <p className="empty-message">아직 분석 데이터가 충분하지 않아요. 게임을 더 진행하면 맞춤 메시지가 생성돼요.</p>
                  )}
                </div>
              </article>

              <MissionCard mission={currentMission} onOpen={() => navigate('/app/offline')} />

              <article className="stats-panel participation-panel">
                <div className="card-head">
                  <p className="card-title">이번 주 참여</p>
                  <span className="count">
                    {weeklyParticipation ? `${weeklyParticipation.completedDays}/${weeklyParticipation.recommendedPerWeek}일` : '-'}
                  </span>
                </div>
                <WeeklyDots participation={weeklyParticipation} />
                {statLoading ? <p className="empty-note mt-3">요약 통계를 업데이트 중입니다...</p> : null}
              </article>
            </div>

            <div className="parent-overview-side">
              <SelectedStudentCard children={children} onSelect={setSelectedChildId} selectedChild={selectedChild} />
              <MissionStatusCard summary={missionSummary} />
            </div>
          </section>
        </>
      ) : null}
    </ParentShell>
  )
}
