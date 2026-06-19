import { useEffect, useMemo, useState } from 'react'
import { ParentShell } from '../components/ParentShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { calculateAgeLabel, getGenderLabel, resolveUploadUrl } from '../lib/childUtils'

const dayLabels = ['월', '화', '수', '목', '금', '토', '일']

const emotionLabelMap = {
  happy: '기쁨',
  sad: '슬픔',
  angry: '분노',
  disgust: '싫음',
  surprise: '놀람',
  fear: '두려움',
}

const roadmapFallback = [
  '정보 교환하기', '대화 유지하기', '공통점 찾기', '대화 시작하기',
  '감정 나누기', '부탁과 거절', '칭찬 주고받기', '의견 말하기',
  '좋은 스포츠맨십', '함께 놀기', '갈등 해결하기', '놀림에 대처하기',
  '따돌림 대처', '사이버 불링 대처', '소문과 뒷담화 대처', '평판 관리하기',
]

function percent(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${Math.round((n > 1 ? n : n * 100))}%`
}

function formatPlayedAt(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ChildAvatar({ child }) {
  const imageUrl = resolveUploadUrl(child?.profileImageUrl)
  if (imageUrl) {
    return <img alt={child?.name || 'student'} src={imageUrl} />
  }
  return <span>{child?.name?.[0] || '?'}</span>
}

function StudentSelectCard({ children, selectedChild, onSelect }) {
  return (
    <article className="stats-panel parent-stat-student">
      <div className="card-head">
        <p className="card-title">학생 선택</p>
        <span className="count">{children.length}명</span>
      </div>
      <div className="child-list">
        {children.map((child) => (
          <button
            className={`child-list-item ${selectedChild?.childId === child.childId ? 'active' : ''}`}
            key={child.childId}
            onClick={() => onSelect(child.childId)}
            type="button"
          >
            <span className="student-avatar stat-avatar"><ChildAvatar child={child} /></span>
            <span>
              <strong>{child.name}</strong>
              <small>{calculateAgeLabel(child.birthDate)} · {getGenderLabel(child.gender)}</small>
            </span>
          </button>
        ))}
      </div>
    </article>
  )
}

function WeeklyCard({ weeklyParticipation }) {
  const markers = weeklyParticipation?.dayMarkers || []
  return (
    <article className="stats-panel parent-weekly-card">
      <div>
        <p className="card-title">이번 주 참여</p>
        <div className="weekly-big">
          <strong>{weeklyParticipation?.completedDays ?? 0}</strong>
          <span>/ {weeklyParticipation?.recommendedPerWeek ?? 3}일</span>
        </div>
        <p className="sub">{weeklyParticipation?.displayMessage || '이번 주 목표를 확인하고 있어요.'}</p>
        <div className="weekly-tags">
          <span className="chip chip-neutral">게임 {weeklyParticipation?.gameCompletedDays ?? 0}일</span>
          <span className="chip chip-violet">오프라인 미션 {weeklyParticipation?.offlineMissionCompletedDays ?? 0}일</span>
        </div>
      </div>
      <div className="parent-week-dots">
        {dayLabels.map((day, index) => {
          const done = Boolean(markers[index])
          return (
            <div className="parent-week-day" key={day}>
              <span className={done ? 'done' : ''}>{done ? '✓' : '-'}</span>
              <p>{day}</p>
            </div>
          )
        })}
      </div>
    </article>
  )
}

function HighlightsCard({ weeklyHighlight }) {
  const highlights = weeklyHighlight?.highlights || []
  return (
    <article className="stats-panel">
      <div className="card-head"><p className="card-title">이번 주 잘한 점</p></div>
      <div className="highlight-list">
        {highlights.length > 0 ? highlights.slice(0, 2).map((item, index) => (
          <div className="insight" key={`${item}-${index}`}>
            <span className="num">{index + 1}</span>
            <p className="txt">{item}</p>
          </div>
        )) : (
          <p className="empty-message">{weeklyHighlight?.fallbackMessage || '이번 주 하이라이트 데이터가 아직 없어요.'}</p>
        )}
      </div>
    </article>
  )
}

function EncouragementCard({ expressionSummary }) {
  const topEmotions = expressionSummary?.topImprovedEmotions || []
  const message = expressionSummary?.encouragementMessage
  return (
    <article className="stats-panel parent-encouragement-card">
      <div className="card-head"><p className="card-title">오늘의 한마디</p></div>
      {message
        ? <h3>{message}</h3>
        : <p className="empty-message">아직 분석 데이터가 충분하지 않아요. 게임을 더 진행하면 맞춤 메시지가 생성돼요.</p>}
      {topEmotions.length > 0 ? (
        <>
          <div className="divider" />
          <p className="sub">가장 많이 성장한 표정</p>
          <div className="weekly-tags">
            {topEmotions.slice(0, 3).map((emotion) => (
              <span className="chip chip-success" key={emotion}>{emotionLabelMap[emotion] || emotion}</span>
            ))}
          </div>
        </>
      ) : null}
    </article>
  )
}

function EmotionCard({ emotion }) {
  const label = emotionLabelMap[emotion.emotion] || emotion.emotion
  const improving = emotion.trendDirection === 'IMPROVING'
  const retry = Number(emotion.retryReductionRate)
  return (
    <article className="stats-panel parent-emotion-card">
      <div className="card-head">
        <div>
          <h3>{label}</h3>
          <p className="sub">{improving ? '최근 좋아지고 있어요' : '꾸준히 유지 중이에요'}</p>
        </div>
        <span className="badge badge-success">{improving ? '개선 중' : '안정적 숙달'}</span>
      </div>
      <div className="lines">
        <div className="ln">자연스럽게 표현해요</div>
        <div className="ln good">흐름이 꽤 안정적이에요</div>
        <div className="ln">처음보다 재시도 횟수가 줄고 있어요{Number.isFinite(retry) ? ` (${percent(retry)} 감소)` : ''}</div>
      </div>
    </article>
  )
}

function RoadmapCard({ item, index }) {
  const status = item?.status || (index === 0 ? 'COMPLETED' : 'NOT_STARTED')
  const complete = status === 'COMPLETED'
  const title = item?.theme || roadmapFallback[index]
  return (
    <article className="wk">
      <div className="wk-top">
        <div>
          <p className="wk-no">WEEK {String(item?.weekNumber || index + 1).padStart(2, '0')}</p>
          <h4>{title}</h4>
        </div>
        <span className={`badge ${complete ? 'badge-success' : 'badge-muted'}`}>{complete ? '완료' : '미시작'}</span>
      </div>
      <div className="wk-note">
        <b>오프라인 미션</b>
        {item?.offlineMission?.assignedCount > 0 ? `${item.offlineMission.assignedCount}건 배정됨` : '아직 배정된 가정 미션이 없어요.'}
      </div>
    </article>
  )
}

function DialogueSummary({ dialogueSummary }) {
  const item = dialogueSummary[0]
  if (!item) return null
  const complete = item.status === 'COMPLETED'
  return (
    <article className="stats-panel parent-dialogue-summary">
      <div className="dialogue-summary-head">
        <h3>{item.theme}</h3>
        <span className={`badge ${complete ? 'badge-success' : 'badge-muted'}`}>{complete ? '완성' : '진행 중'}</span>
      </div>
      <p className="sub">{item.masteryJudgmentForParent || '아직 연습 중이에요'}</p>
      <div className="weekly-tags">
        <span className="chip chip-neutral">꾸준히 유지 중이에요</span>
        <span className="chip chip-neutral">흐름이 꽤 안정적이에요</span>
      </div>
    </article>
  )
}

function HistoryPreview({ expressionHistoryPage, dialogueHistoryPage }) {
  const expressionItems = expressionHistoryPage?.content || []
  const dialogueItems = dialogueHistoryPage?.content || []
  return (
    <article className="stats-panel parent-history-card">
      <div className="card-head"><p className="card-title">최근 기록</p></div>
      <div className="parent-history-grid">
        <div>
          <p className="history-title">표정 활동</p>
          {(expressionItems.length ? expressionItems : []).slice(0, 5).map((session) => (
            <div className="rec" key={session.sessionId}>
              <span className="rec-name">{emotionLabelMap[session.emotion] || session.emotion}</span>
              <span className="rec-time">{formatPlayedAt(session.playedAt)}</span>
            </div>
          ))}
          {!expressionItems.length ? <div className="empty-note">표정 활동 기록이 없습니다.</div> : null}
        </div>
        <div>
          <p className="history-title">대화 활동</p>
          {(dialogueItems.length ? dialogueItems : []).slice(0, 5).map((session) => (
            <div className="rec" key={session.sessionId}>
              <span className="rec-name">{session.theme}</span>
              <span className="rec-time">{formatPlayedAt(session.playedAt)}</span>
            </div>
          ))}
          {!dialogueItems.length ? <div className="empty-note">대화 활동 기록이 없습니다.</div> : null}
        </div>
      </div>
    </article>
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
    async function loadStats() {
      if (!accessToken || !selectedChildId) return
      setStatLoading(true)
      try {
        const [participationRes, highlightRes, expressionRes, dialogueRes, progressRes, exprHistoryRes, dialogueHistoryRes] = await Promise.all([
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
          setExpressionHistoryPage(extractApiPayload(exprHistoryRes))
          setDialogueHistoryPage(extractApiPayload(dialogueHistoryRes))
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      } finally {
        if (!ignore) setStatLoading(false)
      }
    }
    loadStats()
    return () => { ignore = true }
  }, [accessToken, selectedChildId])

  const emotions = expressionSummary?.emotions || []
  const readyEmotions = emotions.filter((emotion) => emotion?.emotion && emotion.dataReady !== false)
  const roadmapItems = dialogueProgress?.themes?.length
    ? dialogueProgress.themes
    : roadmapFallback.map((theme, index) => ({ theme, weekNumber: index + 1, status: index === 0 ? 'COMPLETED' : 'NOT_STARTED' }))

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
        <section className="stats-panel empty-state">
          <div className="es-title">등록된 학생이 없습니다.</div>
        </section>
      ) : null}

      {!loading && children.length > 0 ? (
        <>
          {statLoading ? <p className="empty-note mb-3">통계를 업데이트 중입니다...</p> : null}
          <section className="parent-stat-top">
            <StudentSelectCard children={children} onSelect={setSelectedChildId} selectedChild={selectedChild} />
            <WeeklyCard weeklyParticipation={weeklyParticipation} />
          </section>

          <section className="parent-stat-two">
            <HighlightsCard weeklyHighlight={weeklyHighlight} />
            <EncouragementCard expressionSummary={expressionSummary} />
          </section>

          <div className="section-head parent-stat-section-head">
            <div>
              <div className="s-eyebrow">보호자 인사이트</div>
              <div className="s-title">표정 학습 요약</div>
            </div>
            <div className="s-note">숫자 대신 흐름과 상태로 표시해요</div>
          </div>
          <section className="parent-emotion-grid">
            {readyEmotions.length > 0 ? (
              readyEmotions.slice(0, 4).map((emotion) => (
                <EmotionCard emotion={emotion} key={emotion.emotion} />
              ))
            ) : (
              <article className="stats-panel parent-emotion-card">
                <div className="card-head">
                  <div>
                    <h3>표정 활동 기록이 없습니다.</h3>
                    <p className="sub">게임 기록이 쌓이면 표정별 흐름을 보여드릴게요.</p>
                  </div>
                  <span className="badge badge-muted">기록 없음</span>
                </div>
              </article>
            )}
          </section>

          <div className="section-head parent-stat-section-head">
            <div>
              <div className="s-eyebrow">보호자 인사이트</div>
              <div className="s-title">대화 학습 진행도</div>
            </div>
            <div className="s-note">주차별 로드맵</div>
          </div>
          <section className="roadmap parent-roadmap">
            {roadmapItems.slice(0, 16).map((item, index) => <RoadmapCard index={index} item={item} key={`${item.weekNumber}-${item.theme}`} />)}
          </section>

          <div className="section-head parent-stat-section-head">
            <div>
              <div className="s-eyebrow">보호자 인사이트</div>
              <div className="s-title">대화 학습 요약</div>
            </div>
            <div className="s-note">판정 대신 참고 흐름으로 표시해요</div>
          </div>
          <DialogueSummary dialogueSummary={dialogueSummary} />

          <section className="mt-6 mb-8">
            <HistoryPreview dialogueHistoryPage={dialogueHistoryPage} expressionHistoryPage={expressionHistoryPage} />
          </section>
        </>
      ) : null}
    </ParentShell>
  )
}
