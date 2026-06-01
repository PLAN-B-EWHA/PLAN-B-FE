import { useEffect, useMemo, useState } from 'react'
import { ParentShell } from '../components/ParentShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { MissionCalendar } from '../lib/MissionCalendar'
import { calculateAgeLabel, canWriteNote, getGenderLabel } from '../lib/childUtils'
import { IconCalendar, IconChat, IconCheckbox, IconList, IconPerson, IconSliders, IconStatus, IconTarget } from '../lib/MissionIcons'

const pageTabs = [
  { id: 'today', label: '오늘 할 미션' },
  { id: 'report', label: '수행 기록' },
  { id: 'history', label: '미션 기록' },
]

const completionOptions = [
  { value: 'DONE', label: '완료' },
  { value: 'PARTIAL', label: '부분 수행' },
  { value: 'NOT_DONE', label: '수행 못함' },
]

const initiationOptions = [
  { value: 'SELF', label: '아이 스스로 시작' },
  { value: 'HINT', label: '힌트 후 시작' },
  { value: 'PROMPTED', label: '안내 후 시작' },
]

const strategyLabelMap = {
  INFORMATION_EXCHANGE: '정보 교환하기',
  CONVERSATION_MAINTENANCE: '대화 유지하기',
  FINDING_COMMON_GROUND: '공통점 찾기',
  CONVERSATION_INITIATION: '대화 시작하기',
  CONVERSATION_EXIT: '대화 마무리하기',
  DIGITAL_COMMUNICATION: '디지털 의사소통',
  FRIEND_SELECTION: '친구 선택하기',
  HUMOR_USE: '유머 사용하기',
  GOOD_SPORTSMANSHIP: '좋은 스포츠맨십',
  PLAYING_TOGETHER: '함께 놀기',
  CONFLICT_RESOLUTION: '갈등 해결하기',
  HANDLING_TEASING: '놀림에 대처하기',
  HANDLING_EXCLUSION: '따돌림 대처',
  HANDLING_CYBERBULLYING: '사이버 괴롭힘 대처',
  HANDLING_RUMORS: '소문과 뒷담화 대처',
  REPUTATION_MANAGEMENT: '평판 관리하기',
}

const statusConfig = {
  PENDING:   { label: '진행 전',   color: 'info',    dot: true },
  SUBMITTED: { label: '확인 대기', color: 'warn',    dot: true },
  REVIEWED:  { label: '완료됨',    color: 'success', dot: true },
  CANCELED:  { label: '취소됨',    color: 'muted',   dot: true },
  EXPIRED:   { label: '기한 만료', color: 'danger',  dot: true },
}

const defaultReportForm = {
  completed: 'DONE',
  initiatedBy: 'SELF',
  spontaneousFlag: false,
  parentObservation: '',
  peerResponseObserved: '',
}

function missionId(item) { return item?.homeworkId || item?.id }

function strategyLabel(item) {
  return item?.strategyFocusLabel || strategyLabelMap[item?.strategyFocus] || item?.strategyFocus || '연습 목표'
}

function getStatusCfg(status) { return statusConfig[status] || { label: status || '-', color: 'muted', dot: false } }

function normalizePage(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

function percent(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`
}

function percentNum(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(Math.max(0, Math.min(1, n)) * 100)
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

function buildReportForm(mission) {
  return {
    completed: mission?.report?.completed || 'DONE',
    initiatedBy: mission?.report?.initiatedBy || 'SELF',
    spontaneousFlag: Boolean(mission?.report?.spontaneousFlag),
    parentObservation: mission?.report?.parentObservation || '',
    peerResponseObserved: mission?.report?.peerResponseObserved || '',
  }
}

// ── 상태 점 뱃지
function StatusDotBadge({ status }) {
  const cfg = getStatusCfg(status)
  return <span className={`ms-dot-badge ms-dot-${cfg.color}`}>● {cfg.label}</span>
}

// ── 미션 아이콘 원
function MissionIconBubble({ status }) {
  const cfg = getStatusCfg(status)
  return (
    <div className={`ms-icon-circle ms-icon-${cfg.color}`}>
      <svg fill="none" height="22" viewBox="0 0 22 22" width="22" xmlns="http://www.w3.org/2000/svg">
        <path clipRule="evenodd" d="M11 2C6.03 2 2 6.03 2 11c0 1.5.37 2.91 1.02 4.15L2 20l4.97-1.01A8.96 8.96 0 0 0 11 20c4.97 0 9-4.03 9-9s-4.03-9-9-9Z" fill="currentColor" fillRule="evenodd" opacity=".25" />
        <path d="M8 10.5h6M8 13.5h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      </svg>
    </div>
  )
}

// ── 진행률 도넛
function DonutRing({ value, label }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const fill = ((value || 0) / 100) * circ
  return (
    <div className="ms-donut">
      <svg height="110" width="110">
        <circle cx="55" cy="55" fill="none" r={r} stroke="var(--line)" strokeWidth="10" />
        <circle
          cx="55" cy="55" fill="none" r={r}
          stroke="var(--brand)"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          strokeWidth="10"
          transform="rotate(-90 55 55)"
        />
      </svg>
      <div className="ms-donut-label">
        <strong>{value}%</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

// ── 3열 메타 그리드
function MetaInfoGrid({ items }) {
  return (
    <div className="ms-meta-grid">
      {items.map(({ icon, label, value }) => (
        <div className="ms-meta-cell" key={label}>
          <p>{icon && <span className="ms-meta-icon">{icon}</span>}{label}</p>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  )
}

// ── 수행 방법 번호 목록
function StepList({ steps }) {
  if (!steps?.length) return null
  return (
    <ol className="ms-step-list">
      {steps.map((step, i) => (
        <li key={i}>
          <span className="ms-step-num">{i + 1}</span>
          <p>{step}</p>
        </li>
      ))}
    </ol>
  )
}

// ── 말해줄 문장 버블
function ScriptBubble({ text }) {
  if (!text) return null
  return (
    <div className="ms-bubble">
      <div className="ms-bubble-inner">
        <span className="ms-bubble-to">아이에게</span>
        <p>{text}</p>
      </div>
    </div>
  )
}

// ── 미션 가이드 섹션
function MissionGuide({ mission }) {
  const goal = mission?.goal || mission?.strategyFocusLabel || strategyLabel(mission)
  const parentGuide = mission?.parentGuide || mission?.parentTip || null
  const script = mission?.exampleScript || mission?.examplePhrase || mission?.scriptPhrase || null
  const steps = mission?.steps || mission?.executionSteps || null
  const hasSteps = Array.isArray(steps) && steps.length > 0

  if (!goal && !parentGuide && !script && !hasSteps) return null

  return (
    <section className="ms-guide-section">
      <h3 className="ms-guide-title">미션 가이드</h3>
      <p className="ms-guide-sub">집에서 자연스럽게 할 수 있도록 정리했어요.</p>

      {goal ? (
        <div className="ms-guide-row">
          <div className="ms-guide-left">
            <span className="ms-guide-icon">⊙</span>
            <span className="ms-guide-label">목표</span>
          </div>
          <p className="ms-guide-content">{goal}</p>
        </div>
      ) : null}

      {parentGuide ? (
        <div className="ms-guide-row">
          <div className="ms-guide-left">
            <span className="ms-guide-icon">♀</span>
            <span className="ms-guide-label">보호자 안내</span>
          </div>
          <p className="ms-guide-content">{parentGuide}</p>
        </div>
      ) : null}

      {script ? (
        <div className="ms-guide-row">
          <div className="ms-guide-left">
            <span className="ms-guide-icon">💬</span>
            <span className="ms-guide-label">말해줄 문장</span>
          </div>
          <ScriptBubble text={script} />
        </div>
      ) : null}

      {hasSteps ? (
        <div className="ms-guide-row">
          <div className="ms-guide-left">
            <span className="ms-guide-icon">≡</span>
            <span className="ms-guide-label">수행 방법</span>
          </div>
          <StepList steps={steps} />
        </div>
      ) : null}
    </section>
  )
}

// ── 미션 목록 아이템
function MissionItem({ item, onSelect }) {
  const cfg = getStatusCfg(item.status)
  return (
    <button className="ms-list-item" onClick={onSelect} type="button">
      <MissionIconBubble status={item.status} />
      <div className="ms-list-body">
        <span className="ms-list-week">W{item.week || '-'}</span>
        <strong className="ms-list-title">{strategyLabel(item)}</strong>
        <span className="ms-list-date">마감일 · {formatDate(item.dueDate)}</span>
      </div>
      <div className="ms-list-right">
        <span className={`ms-dot-badge ms-dot-${cfg.color}`}>● {cfg.label}</span>
        <span className="ms-chevron">›</span>
      </div>
    </button>
  )
}

// ── 보고서 폼 모달
function ReportModal({ mission, form, setForm, submitting, onSubmit, onClose }) {
  if (!mission) return null
  const hasReport = Boolean(mission.report?.reportId || mission.report)

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-head">
          <button aria-label="닫기" className="modal-close" onClick={onClose} type="button">×</button>
          <h2>수행 기록 {hasReport ? '수정' : '남기기'}</h2>
          <p className="modal-meta">{strategyLabel(mission)} · {formatDate(mission.dueDate)}</p>
        </div>
        <form className="modal-body offline-report-form" onSubmit={(e) => { e.preventDefault(); onSubmit(hasReport) }}>
          <fieldset>
            <legend>완료 정도</legend>
            <div className="segmented">
              {completionOptions.map((opt) => (
                <button className={form.completed === opt.value ? 'active' : ''} key={opt.value} onClick={() => setForm((p) => ({ ...p, completed: opt.value }))} type="button">{opt.label}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>시작 방식</legend>
            <div className="segmented">
              {initiationOptions.map((opt) => (
                <button className={form.initiatedBy === opt.value ? 'active' : ''} key={opt.value} onClick={() => setForm((p) => ({ ...p, initiatedBy: opt.value }))} type="button">{opt.label}</button>
              ))}
            </div>
          </fieldset>
          <label className="offline-check">
            <input checked={form.spontaneousFlag} onChange={(e) => setForm((p) => ({ ...p, spontaneousFlag: e.target.checked }))} type="checkbox" />
            아이가 자발적으로 시도했어요
          </label>
          <label>
            보호자 관찰 메모
            <textarea className="input" onChange={(e) => setForm((p) => ({ ...p, parentObservation: e.target.value }))} placeholder="어떤 상황에서 어떻게 시도했는지 적어주세요." rows={4} value={form.parentObservation} />
          </label>
          <label>
            또래나 가족의 반응
            <textarea className="input" onChange={(e) => setForm((p) => ({ ...p, peerResponseObserved: e.target.value }))} placeholder="상대방 반응이나 이어진 대화를 적어주세요." rows={3} value={form.peerResponseObserved} />
          </label>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose} type="button">취소</button>
            <button className="btn btn-primary" disabled={submitting} type="submit">{submitting ? '저장 중...' : hasReport ? '기록 수정' : '기록 제출'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── LLM 응답 파서
function parseStrategyTip(text) {
  if (!text) return null
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const result = { missionName: null, goal: null, parentGuide: null, scriptSentence: null, steps: [], checkpoints: [], easyAdjust: null, hardAdjust: null }
  let section = null
  const FIELDS = [
    ['미션 이름', 'missionName'], ['목표', 'goal'], ['보호자 안내', 'parentGuide'],
    ['아이에게 말해줄 문장', 'scriptSentence'], ['쉽게 조절하기', 'easyAdjust'], ['어렵게 조절하기', 'hardAdjust'],
  ]
  const LIST_FIELDS = { '수행 방법': 'steps', '관찰 체크포인트': 'checkpoints' }
  for (const line of lines) {
    let matched = false
    for (const [label, key] of FIELDS) {
      if (line.startsWith(`${label}:`)) { result[key] = line.slice(label.length + 1).trim(); section = null; matched = true; break }
    }
    if (matched) continue
    for (const [label, key] of Object.entries(LIST_FIELDS)) {
      if (line.startsWith(`${label}:`)) { section = key; matched = true; break }
    }
    if (matched) continue
    if (line.startsWith('- ') && section) result[section].push(line.slice(2).trim())
  }
  const hasContent = Object.values(result).some((v) => (Array.isArray(v) ? v.length > 0 : v !== null))
  return hasContent ? result : null
}

// ── 파싱된 미션 가이드 뷰
function ParsedStrategyView({ parsed, instruction }) {
  if (!parsed && !instruction) return null
  return (
    <div className="thr-parsed-view">
      {instruction ? (
        <div className="thr-detail-instruction">
          <p className="thr-detail-instruction-label">생성 지시 / 미션 안내</p>
          <p>{instruction}</p>
        </div>
      ) : null}
      {parsed?.goal ? (
        <div className="thr-detail-row">
          <span className="thr-detail-row-icon"><IconTarget /></span>
          <span className="thr-detail-row-label">목표</span>
          <p className="thr-detail-row-content">{parsed.goal}</p>
        </div>
      ) : null}
      {parsed?.parentGuide ? (
        <div className="thr-detail-row">
          <span className="thr-detail-row-icon"><IconPerson /></span>
          <span className="thr-detail-row-label">보호자 안내</span>
          <p className="thr-detail-row-content">{parsed.parentGuide}</p>
        </div>
      ) : null}
      {parsed?.scriptSentence ? (
        <div className="thr-detail-row">
          <span className="thr-detail-row-icon"><IconChat /></span>
          <span className="thr-detail-row-label">말해줄 문장</span>
          <div className="thr-detail-bubble">
            <span className="thr-detail-bubble-tag">아이에게</span>
            <p>{parsed.scriptSentence}</p>
          </div>
        </div>
      ) : null}
      {parsed?.steps?.length > 0 ? (
        <div className="thr-detail-row">
          <span className="thr-detail-row-icon"><IconList /></span>
          <span className="thr-detail-row-label">수행 방법</span>
          <ol className="thr-detail-steps">
            {parsed.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      ) : null}
      {parsed?.checkpoints?.length > 0 ? (
        <div className="thr-detail-row">
          <span className="thr-detail-row-icon"><IconCheckbox /></span>
          <span className="thr-detail-row-label">관찰 체크포인트</span>
          <ul className="thr-detail-steps thr-detail-steps-check">
            {parsed.checkpoints.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      ) : null}
      {(parsed?.easyAdjust || parsed?.hardAdjust) ? (
        <div className="thr-detail-row">
          <span className="thr-detail-row-icon"><IconSliders /></span>
          <span className="thr-detail-row-label">난이도 조절</span>
          <div>
            {parsed.easyAdjust ? <p className="thr-detail-row-content thr-adjust easy">쉽게: {parsed.easyAdjust}</p> : null}
            {parsed.hardAdjust ? <p className="thr-detail-row-content thr-adjust hard">어렵게: {parsed.hardAdjust}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── 미션 상세 모달 (치료사 스타일)
function DetailModal({ mission, onClose, onRecord }) {
  if (!mission) return null
  const cfg = getStatusCfg(mission.status)
  const canRecord = mission.status === 'PENDING' || mission.status === 'SUBMITTED'
  const parsed = parseStrategyTip(mission.strategyTip)

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="thr-detail-modal">

        {/* 헤더 */}
        <div className="thr-detail-head">
          <div className="thr-detail-chips">
            <span className="chip chip-info">W{mission.week || '-'} · {strategyLabel(mission)}</span>
            <span className={`ms-dot-badge ms-dot-${cfg.color}`}>● {cfg.label}</span>
          </div>
          <button aria-label="닫기" className="thr-detail-close" onClick={onClose} type="button">×</button>
        </div>

        {/* 본문 */}
        <div className="thr-detail-body">
          <h2 className="thr-detail-title">{parsed?.missionName || strategyLabel(mission)}</h2>
          <p className="thr-detail-sub">미션 · {formatDate(mission.dueDate)} 마감</p>

          {/* 3-col 메타 */}
          <div className="thr-detail-meta">
            <div className="thr-detail-meta-cell">
              <span className="thr-detail-meta-label"><IconTarget size={13} /> 연습 목표</span>
              <strong>{strategyLabel(mission)}</strong>
            </div>
            <div className="thr-detail-meta-cell">
              <span className="thr-detail-meta-label"><IconCalendar size={13} /> 마감일</span>
              <strong>{formatDate(mission.dueDate)}</strong>
            </div>
            <div className="thr-detail-meta-cell">
              <span className="thr-detail-meta-label"><IconStatus size={13} /> 상태</span>
              <strong>{cfg.label}</strong>
            </div>
          </div>

          {/* 파싱된 미션 가이드 */}
          <ParsedStrategyView
            instruction={mission.instruction || null}
            parsed={parsed}
          />

          {/* 치료사 피드백 */}
          {mission.report?.therapistReviewComment ? (
            <div className="thr-detail-report success" style={{ marginTop: 14 }}>
              <p className="thr-detail-report-label">치료사 피드백</p>
              <p>{mission.report.therapistReviewComment}</p>
            </div>
          ) : null}
        </div>

        {/* 푸터 */}
        <div className="thr-detail-footer">
          <button className="btn btn-ghost" onClick={onClose} type="button">닫기</button>
          {canRecord ? (
            <button className="btn btn-primary" onClick={() => { onClose(); onRecord(mission) }} type="button">
              {mission.report ? '수행 기록 수정' : '수행 기록 남기기'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── 상태별 필터 탭 정의
const listFilters = [
  { value: '',          label: '할 일',    filterFn: () => true },
  { value: 'SUBMITTED', label: '확인 대기', filterFn: (m) => m.status === 'SUBMITTED' },
  { value: 'REVIEWED',  label: '완료됨',   filterFn: (m) => m.status === 'REVIEWED' },
  { value: 'CANCELED',  label: '취소됨',   filterFn: (m) => m.status === 'CANCELED' },
  { value: 'EXPIRED',   label: '기한 만료', filterFn: (m) => m.status === 'EXPIRED' },
]

export function ParentOfflinePage() {
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [current, setCurrent] = useState(null)
  const [allMissions, setAllMissions] = useState([])
  const [summary, setSummary] = useState(null)
  const [pageTab, setPageTab] = useState('today')
  const [listFilter, setListFilter] = useState('')
  const [detailMission, setDetailMission] = useState(null)
  const [reportMission, setReportMission] = useState(null)
  const [reportForm, setReportForm] = useState(defaultReportForm)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const selectedChild = useMemo(() => children.find((c) => c.childId === selectedChildId) || children[0] || null, [children, selectedChildId])

  const filteredMissions = useMemo(() => {
    const filter = listFilters.find((f) => f.value === listFilter)
    return filter ? allMissions.filter(filter.filterFn) : allMissions
  }, [allMissions, listFilter])

  const currentMission = current || allMissions.find((m) => m.status === 'PENDING') || allMissions[0] || null

  useEffect(() => {
    let ignore = false
    async function loadChildren() {
      if (!accessToken) { setLoading(false); return }
      try {
        const res = await apiFetch('/children/accessible', { method: 'GET', token: accessToken })
        const payload = extractApiPayload(res) || []
        const noteChildren = payload.filter(canWriteNote)
        if (!ignore) { setChildren(noteChildren); setSelectedChildId(noteChildren[0]?.childId || null) }
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      }
    }
    loadChildren()
    return () => { ignore = true }
  }, [accessToken])

  async function loadHomework(childId = selectedChildId) {
    if (!accessToken || !childId) { setLoading(false); return }
    setLoading(true)
    try {
      const [currentRes, summaryRes, listRes] = await Promise.all([
        apiFetch(`/parent/children/${childId}/homework/current`, { method: 'GET', token: accessToken }),
        apiFetch(`/parent/children/${childId}/homework/summary`, { method: 'GET', token: accessToken }),
        apiFetch(`/parent/children/${childId}/homework`, { method: 'GET', token: accessToken }),
      ])
      setCurrent(extractApiPayload(currentRes) || null)
      setSummary(extractApiPayload(summaryRes))
      setAllMissions(normalizePage(extractApiPayload(listRes)))
      setFeedback('')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadHomework() }, [accessToken, selectedChildId])

  async function openDetail(item) {
    setDetailMission(item)
    if (!item || !selectedChildId) return
    try {
      const res = await apiFetch(`/parent/children/${selectedChildId}/homework/${missionId(item)}`, { method: 'GET', token: accessToken })
      const detail = extractApiPayload(res)
      if (detail) setDetailMission(detail)
    } catch (_) { /* keep existing item */ }
  }

  function openReport(mission) {
    setDetailMission(null)
    setReportMission(mission)
    setReportForm(buildReportForm(mission))
  }

  async function handleSubmitReport(isUpdate) {
    if (!reportMission || !selectedChildId) return
    setSubmitting(true); setFeedback('')
    try {
      await apiFetch(`/parent/children/${selectedChildId}/homework/${missionId(reportMission)}/reports`, {
        method: isUpdate ? 'PATCH' : 'POST',
        token: accessToken,
        body: {
          completed: reportForm.completed,
          initiatedBy: reportForm.initiatedBy,
          strategyApplied: reportMission.strategyFocus || null,
          parentObservation: reportForm.parentObservation,
          peerResponseObserved: reportForm.peerResponseObserved,
          spontaneousFlag: reportForm.spontaneousFlag,
        },
      })
      setFeedback(isUpdate ? '수행 기록을 수정했습니다.' : '수행 기록을 제출했습니다.')
      setReportMission(null)
      await loadHomework()
    } catch (error) {
      setFeedback(extractApiErrorMessage(error) || '저장 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const completion = percentNum(summary?.completionRate)
  const submission = percentNum(summary?.submissionRate)
  const spontaneous = percentNum(summary?.spontaneousRate)

  return (
    <ParentShell childCount={children.length} heading="오프라인 미션" selectedChild={selectedChild} subheading="집에서 연습할 미션을 확인하고 수행 기록을 남겨 주세요.">
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      {/* 학생 선택 - 비today 탭에서만 표시 */}
      {pageTab !== 'today' && children.length > 1 ? (
        <div className="ms-student-row">
          <span className="ms-student-label">학생</span>
          <div className="ms-student-chips">
            {children.map((child) => (
              <button
                className={`ms-student-chip ${selectedChildId === child.childId ? 'active' : ''}`}
                key={child.childId}
                onClick={() => setSelectedChildId(child.childId)}
                type="button"
              >
                <span className="ms-student-avatar">♙</span>
                {child.name} · {calculateAgeLabel(child.birthDate)} · {getGenderLabel(child.gender)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 페이지 탭 */}
      <div className="ms-tabs">
        {pageTabs.map((tab) => (
          <button
            className={`ms-tab ${pageTab === tab.id ? 'active' : ''}`}
            key={tab.id}
            onClick={() => setPageTab(tab.id)}
            type="button"
          >
            {tab.label}
            {tab.id === 'report' && allMissions.length > 0 ? (
              <span className="ms-tab-count">{allMissions.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {loading ? <div className="stats-loading">미션 정보를 불러오는 중입니다...</div> : null}

      {/* ── 오늘 할 미션 탭 ── */}
      {!loading && pageTab === 'today' ? (
        <div className="ms-today-grid">
          <div className="ms-today-main">
            <section className="stats-panel ms-hero-card">
              {currentMission ? (
                <>
                  <div className="ms-hero-badges">
                    <span className="chip chip-info">이번 주 미션 · W{currentMission.week || '-'}</span>
                    <StatusDotBadge status={currentMission.status} />
                  </div>
                  <h2 className="ms-hero-title">{strategyLabel(currentMission)}</h2>
                  {(currentMission.missionSubtitle || currentMission.description) ? (
                    <p className="ms-hero-sub">미션 · {currentMission.missionSubtitle || currentMission.description}</p>
                  ) : null}

                  <MetaInfoGrid items={[
                    { icon: '⊙', label: '연습 목표', value: strategyLabel(currentMission) },
                    { icon: '📅', label: '마감일', value: formatDate(currentMission.dueDate) },
                    { icon: null, label: '수행 기록', value: currentMission.report ? '작성됨' : '아직 없음' },
                  ]} />

                  {currentMission.instruction ? (
                    <div className="ms-instruction-box">
                      <p className="ms-instruction-label">오늘의 미션</p>
                      <p>{currentMission.instruction}</p>
                    </div>
                  ) : null}

                  <div className="ms-hero-actions">
                    <button className="btn btn-primary" onClick={() => openReport(currentMission)} type="button">수행 기록 남기기</button>
                    <button className="btn btn-ghost" onClick={() => openDetail(currentMission)} type="button">전체 가이드 보기</button>
                  </div>
                </>
              ) : (
                <div className="empty-card">치료사가 미션을 배정하면 여기에서 바로 확인할 수 있어요.</div>
              )}
            </section>

            {currentMission ? <MissionGuide mission={currentMission} /> : null}
          </div>

          <div className="ms-today-side">
            <section className="stats-panel ms-progress-card">
              <p className="card-title">이번 주 진행률</p>
              <div className="ms-donut-row">
                <DonutRing label="완료율" value={completion} />
                <div className="ms-donut-bars">
                  <div>
                    <div className="progress-head"><span>제출률</span><strong>{percent(summary?.submissionRate)}</strong></div>
                    <div className="bar"><i style={{ width: `${submission}%` }} /></div>
                  </div>
                  <div className="mt-3">
                    <div className="progress-head"><span>자발성</span><strong>{percent(summary?.spontaneousRate)}</strong></div>
                    <div className="bar blue"><i style={{ width: `${spontaneous}%` }} /></div>
                  </div>
                </div>
              </div>
              <div className="ms-stat-cols">
                <div className="ms-stat-cell">
                  <span>완전 완료</span>
                  <strong>{summary?.reviewedCount ?? 0}</strong>
                </div>
                <div className={`ms-stat-cell ${(summary?.expiredCount ?? 0) > 0 ? 'danger' : ''}`}>
                  <span>기한 지남</span>
                  <strong>{summary?.expiredCount ?? 0}</strong>
                </div>
              </div>
            </section>

            {allMissions.length ? (
              <MissionCalendar labelOf={strategyLabel} missions={allMissions} onSelectMission={openDetail} />
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ── 수행 기록 탭 ── */}
      {!loading && pageTab === 'report' ? (
        <section className="stats-panel ms-list-card">
          <h3 className="ms-list-card-title">할 일 목록</h3>
          <p className="ms-list-card-sub">미션을 누르면 수행 가이드와 기록 작성 창이 열려요.</p>

          <div className="ms-filter-tabs">
            {listFilters.map((f) => {
              const count = f.value === '' ? allMissions.length : allMissions.filter(f.filterFn).length
              return (
                <button
                  className={`ms-filter-tab ${listFilter === f.value ? 'active' : ''}`}
                  key={f.value || 'all'}
                  onClick={() => setListFilter(f.value)}
                  type="button"
                >
                  {f.label}
                  {count > 0 ? <span className="ms-filter-count">{count}</span> : null}
                </button>
              )
            })}
          </div>

          <div className="ms-mission-list">
            {filteredMissions.length ? filteredMissions.map((item) => (
              <MissionItem item={item} key={missionId(item)} onSelect={() => openDetail(item)} />
            )) : (
              <div className="empty-card">해당 조건의 미션이 없습니다.</div>
            )}
          </div>
        </section>
      ) : null}

      {/* ── 미션 기록 탭 ── */}
      {!loading && pageTab === 'history' ? (
        <section className="stats-panel ms-list-card">
          <h3 className="ms-list-card-title">미션 기록</h3>
          <p className="ms-list-card-sub">전체 미션 이력을 확인하고 달력에서 날짜별로 조회할 수 있어요.</p>

          <div className="ms-filter-tabs">
            {listFilters.map((f) => {
              const count = f.value === '' ? allMissions.length : allMissions.filter(f.filterFn).length
              return (
                <button
                  className={`ms-filter-tab ${listFilter === f.value ? 'active' : ''}`}
                  key={f.value || 'all'}
                  onClick={() => setListFilter(f.value)}
                  type="button"
                >
                  {f.label}
                  {count > 0 ? <span className="ms-filter-count">{count}</span> : null}
                </button>
              )
            })}
          </div>

          <div className="ms-mission-list">
            {filteredMissions.length ? filteredMissions.map((item) => (
              <MissionItem item={item} key={missionId(item)} onSelect={() => openDetail(item)} />
            )) : (
              <div className="empty-card">아직 표시할 미션이 없습니다.</div>
            )}
          </div>

          {allMissions.length ? (
            <div className="mt-6">
              <MissionCalendar labelOf={strategyLabel} missions={allMissions} onSelectMission={openDetail} />
            </div>
          ) : null}
        </section>
      ) : null}

      <DetailModal mission={detailMission} onClose={() => setDetailMission(null)} onRecord={openReport} />

      <ReportModal
        form={reportForm}
        mission={reportMission}
        onClose={() => setReportMission(null)}
        onSubmit={handleSubmitReport}
        setForm={setReportForm}
        submitting={submitting}
      />
    </ParentShell>
  )
}
