import { useEffect, useMemo, useState } from 'react'
import { TherapistStatsShell } from '../components/TherapistStatsShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { MissionCalendar } from '../lib/MissionCalendar'
import { calculateAgeLabel, canAssignMission, getGenderLabel, resolveUploadUrl } from '../lib/childUtils'
import { IconCalendar, IconChat, IconCheckbox, IconList, IconPerson, IconSliders, IconStatus, IconTarget } from '../lib/MissionIcons'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const pageTabs = [
  { id: 'current',  label: '현재 미션' },
  { id: 'weekly',   label: '주차별 현황' },
  { id: 'create',   label: '미션 생성' },
  { id: 'history',  label: '이전 미션 기록' },
]

const historyFilters = [
  { value: '',          label: '전체' },
  { value: 'PENDING',   label: '진행 중' },
  { value: 'SUBMITTED', label: '보고됨' },
  { value: 'REVIEWED',  label: '검토 완료' },
  { value: 'CANCELED',  label: '취소됨' },
  { value: 'EXPIRED',   label: '기한 만료' },
]

const difficultyOptions   = ['자동', '쉽게', '보통', '도전']
const subjectOptions      = ['보호자 동반', '아동 단독']
const repeatOptions       = ['1회', '주 2회', '매일']

const statusConfig = {
  PENDING:   { label: '진행 전',   color: 'info' },
  SUBMITTED: { label: '검토 대기', color: 'warn' },
  REVIEWED:  { label: '검토 완료', color: 'success' },
  CANCELED:  { label: '취소됨',    color: 'muted' },
  EXPIRED:   { label: '기한 만료', color: 'danger' },
}

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

const completionLabelMap = { DONE: '완료', PARTIAL: '부분 수행', NOT_DONE: '수행 못함' }
const initiationLabelMap  = { SELF: '아이 스스로 시작', HINT: '힌트 후 시작', PROMPTED: '직접 안내 후 시작' }

const emptyGenerateInput = { therapistInstruction: '', dueDate: '', difficulty: '자동', subject: '보호자 동반', repeat: '1회', weekTag: '' }

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

function missionId(item) { return item?.homeworkId || item?.id }
function strategyLabel(item) { return item?.strategyFocusLabel || strategyLabelMap[item?.strategyFocus] || item?.strategyFocus || '연습 목표' }
function getStatusCfg(status) { return statusConfig[status] || { label: status || '-', color: 'muted' } }

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

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function toEditableMission(item) {
  return {
    week: item?.week || '',
    strategyFocus: item?.strategyFocus || '',
    instruction: item?.instruction || '',
    strategyTip: item?.strategyTip || '',
    strategyTipSource: item?.strategyTipSource || 'LLM',
    dueDate: item?.dueDate || '',
  }
}

function buildUpdateBody(draft) {
  return {
    week: draft.week ? Number(draft.week) : null,
    strategyFocus: draft.strategyFocus || null,
    instruction: draft.instruction || '',
    strategyTip: draft.strategyTip || null,
    strategyTipSource: draft.strategyTipSource || 'LLM',
    dueDate: draft.dueDate || null,
  }
}

// ── 공통 컴포넌트 ──────────────────────────────────────────────────────────────

function StatusDotBadge({ status }) {
  const cfg = getStatusCfg(status)
  return <span className={`ms-dot-badge ms-dot-${cfg.color}`}>● {cfg.label}</span>
}

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

// ── 미션 목록 아이템 ───────────────────────────────────────────────────────────

function MissionItem({ item, onSelect }) {
  const cfg = getStatusCfg(item.status)
  const pendingReview = item.status === 'SUBMITTED'
  return (
    <button className="ms-list-item" onClick={onSelect} type="button">
      <MissionIconBubble status={item.status} />
      <div className="ms-list-body">
        <span className="ms-list-week">W{item.week || '-'}</span>
        <strong className="ms-list-title">{strategyLabel(item)}</strong>
        <span className="ms-list-date">📅 마감일 · {formatDate(item.dueDate)}</span>
        {pendingReview ? <span className="ms-dot-badge ms-dot-warn thr-sub-badge">● 검토 대기 중</span> : null}
      </div>
      <div className="ms-list-right">
        <span className={`ms-dot-badge ms-dot-${cfg.color}`}>● {cfg.label}</span>
        <span className="ms-chevron">›</span>
      </div>
    </button>
  )
}

// ── 현재 미션 탭 우측 사이드바 ─────────────────────────────────────────────────

function MissionSidebarPanel({ summary, currentMission, pendingReviewCount }) {
  const overdue = summary?.overdueCount ?? summary?.expiredCount ?? 0
  const expired = summary?.canceledCount ?? 0

  return (
    <section className="stats-panel thr-sidebar-panel">
      <p className="card-title">미션 현황</p>
      {currentMission ? <p className="thr-sidebar-sub">W{currentMission.week || '-'} · {strategyLabel(currentMission)} 기준</p> : null}

      <div className="thr-sidebar-section">
        <p className="thr-sidebar-label">배정 / 검토</p>
        <div className="thr-metric-2x2">
          <div className="thr-metric-cell">
            <span>전체 배정</span>
            <strong>{summary?.assignedCount ?? 0}</strong>
          </div>
          <div className="thr-metric-cell">
            <span>진행 중</span>
            <strong>{summary?.pendingCount ?? 0}</strong>
          </div>
          <div className={`thr-metric-cell ${pendingReviewCount > 0 ? 'highlight-info' : ''}`}>
            <span>검토 대기</span>
            <strong>{summary?.submittedCount ?? pendingReviewCount}</strong>
          </div>
          <div className="thr-metric-cell">
            <span>검토 완료</span>
            <strong>{summary?.reviewedCount ?? 0}</strong>
          </div>
        </div>
      </div>

      <div className="thr-sidebar-section">
        <p className="thr-sidebar-label">성과 지표</p>
        <div className="thr-metric-3col">
          <div className="thr-metric-cell small">
            <span>제출률</span>
            <strong>{percent(summary?.submissionRate)}</strong>
          </div>
          <div className="thr-metric-cell small">
            <span>완료율</span>
            <strong>{percent(summary?.completionRate)}</strong>
          </div>
          <div className="thr-metric-cell small">
            <span>자발성</span>
            <strong>{percent(summary?.spontaneousRate)}</strong>
          </div>
        </div>
      </div>

      <div className="thr-sidebar-section">
        <p className="thr-sidebar-label">리스크</p>
        <div className="thr-metric-2x2">
          <div className={`thr-metric-cell ${overdue > 0 ? 'highlight-danger' : ''}`}>
            <span>기한 초과</span>
            <strong>{overdue}</strong>
          </div>
          <div className="thr-metric-cell">
            <span>기한 만료</span>
            <strong>{expired}</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── 주차별 현황 탭 ─────────────────────────────────────────────────────────────

function WeeklyTable({ summary, weeks, onSelectWeek }) {
  const rows = Array.isArray(weeks) && weeks.length
    ? weeks
    : Array.from({ length: 16 }, (_, i) => ({ week: i + 1 }))

  return (
    <section className="stats-panel">
      <div className="thr-weekly-head">
        <div>
          <h3 className="ms-list-card-title">주차별 미션 현황</h3>
          <p className="ms-list-card-sub">전략 주차를 누르면 해당 미션 상세를 볼 수 있어요.</p>
        </div>
        <span className="chip chip-info">PEERS 16주 커리큘럼 기준</span>
      </div>

      <table className="thr-weekly-table">
        <thead>
          <tr className="thr-weekly-thead">
            <th>주차</th>
            <th>전략</th>
            <th>배정</th>
            <th>제출</th>
            <th>완료</th>
            <th>제출률</th>
            <th>자발성</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, i) => {
            const assigned  = item.assignedCount ?? item.assigned ?? 0
            const submitted = item.submittedCount ?? item.submitted ?? 0
            const reviewed  = item.reviewedCount ?? item.reviewed ?? 0
            const subRate   = percentNum(item.submissionRate)
            const sponRate  = percentNum(item.spontaneousRate)
            const label     = item.strategyFocusLabel || strategyLabelMap[item.strategyFocus] || `주차 ${item.week || i + 1}`
            const subColor  = subRate > 0 && subRate < 50 ? 'var(--danger, #ef4444)' : 'var(--brand, #6366f1)'

            return (
              <tr className="thr-weekly-row" key={item.week || i}>
                <td><span className="thr-weekly-week">W{item.week || i + 1}</span></td>
                <td>
                  <button className="thr-weekly-strategy" onClick={() => onSelectWeek?.(item)} type="button">
                    {label}
                  </button>
                </td>
                <td className="thr-weekly-center">{assigned || '-'}</td>
                <td className="thr-weekly-center">{submitted || '-'}</td>
                <td className="thr-weekly-center">{reviewed || '-'}</td>
                <td className="thr-weekly-bar-cell">
                  <span className="thr-weekly-bar-pct" style={{ color: subRate > 0 && subRate < 50 ? 'var(--danger)' : undefined }}>
                    {subRate > 0 ? `${subRate}%` : '-'}
                  </span>
                  <div className="thr-weekly-bar-track">
                    <div className="thr-weekly-bar-fill" style={{ width: `${subRate}%`, background: subColor }} />
                  </div>
                </td>
                <td className="thr-weekly-bar-cell">
                  <span className="thr-weekly-bar-pct">{sponRate > 0 ? `${sponRate}%` : '-'}</span>
                  <div className="thr-weekly-bar-track">
                    <div className="thr-weekly-bar-fill" style={{ width: `${sponRate}%`, background: 'var(--accent, #3b82f6)' }} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="thr-kpi-row">
        {[
          { label: '전체 제출률', value: percent(summary?.submissionRate), note: `배정 ${summary?.assignedCount ?? 0}건 중 ${summary?.submittedCount ?? 0}건 제출` },
          { label: '전체 완료율', value: percent(summary?.completionRate), note: '제출 후 완료 처리 비율' },
          { label: '전체 자발성', value: percent(summary?.spontaneousRate), note: '제출 건 중 자발 수행 비율' },
        ].map((kpi) => (
          <div className="thr-kpi-cell" key={kpi.label}>
            <p className="thr-kpi-label">{kpi.label}</p>
            <p className="thr-kpi-value">{kpi.value}</p>
            <p className="thr-kpi-unit">{kpi.note}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── 미션 생성 탭 ───────────────────────────────────────────────────────────────

function PillGroup({ label, options, value, onChange }) {
  return (
    <div className="thr-pill-group">
      <p className="thr-pill-label">{label}</p>
      <div className="thr-pills">
        {options.map((opt) => (
          <button
            className={`thr-pill ${value === opt ? 'active' : ''}`}
            key={opt}
            onClick={() => onChange(opt)}
            type="button"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function GeneratingOverlay() {
  return (
    <div className="thr-generating-overlay">
      <div className="thr-generating-inner">
        <div className="thr-spinner" />
        <p className="thr-generating-title">미션을 생성하고 있어요</p>
        <p className="thr-generating-sub">아동 통계와 RAG 검색을 분석 중입니다...</p>
      </div>
    </div>
  )
}

function CreateForm({ input, setInput, showAdvanced, setShowAdvanced, submitting, weekOptions, onGenerate }) {
  return (
    <section className="stats-panel thr-create-card">
      {submitting ? <GeneratingOverlay /> : null}

      <h3 className="ms-list-card-title">미션 생성</h3>
      <p className="ms-list-card-sub">아동 통계와 RAG 검색을 바탕으로 맞춤 미션을 만듭니다.</p>

      <div className="thr-create-info-box">
        <span className="thr-create-info-icon">✦</span>
        <p>서버가 <strong>아동 통계</strong>와 <strong>RAG 검색</strong>을 자동으로 처리해 난이도를 맞춥니다.</p>
      </div>

      <div className="thr-create-field">
        <label className="thr-create-label" htmlFor="thr-instruction">추가 지시 <span>(선택)</span></label>
        <textarea
          className="input"
          id="thr-instruction"
          onChange={(e) => setInput((p) => ({ ...p, therapistInstruction: e.target.value }))}
          placeholder={`예：또래와 이야기하기를 자연스럽게 연습할 수 있도록 해주세요.`}
          rows={5}
          value={input.therapistInstruction}
        />
        <p className="thr-create-hint">비워 두면 현재 주차 전략과 아동 통계만으로 생성합니다.</p>
      </div>

      <div className="thr-create-field">
        <label className="thr-create-label" htmlFor="thr-duedate">마감일</label>
        <input
          className="input thr-date-input"
          id="thr-duedate"
          onChange={(e) => setInput((p) => ({ ...p, dueDate: e.target.value }))}
          type="date"
          value={input.dueDate}
        />
      </div>

      <button className="thr-advanced-toggle" onClick={() => setShowAdvanced((p) => !p)} type="button">
        {showAdvanced ? '▲' : '▼'} 고급 설정
      </button>

      {showAdvanced ? (
        <div className="thr-advanced-panel">
          <div className="thr-advanced-grid">
            <PillGroup label="난이도" onChange={(v) => setInput((p) => ({ ...p, difficulty: v }))} options={difficultyOptions} value={input.difficulty} />
            {weekOptions.length > 0 ? (
              <PillGroup label="커리큘럼 주차" onChange={(v) => setInput((p) => ({ ...p, weekTag: v }))} options={weekOptions} value={input.weekTag} />
            ) : null}
            <PillGroup label="수행 주체" onChange={(v) => setInput((p) => ({ ...p, subject: v }))} options={subjectOptions} value={input.subject} />
            <PillGroup label="반복" onChange={(v) => setInput((p) => ({ ...p, repeat: v }))} options={repeatOptions} value={input.repeat} />
          </div>
        </div>
      ) : null}

      <div className="thr-create-footer">
        <p className="thr-create-footer-note">생성 후 보호자 앱에 즉시 배포됩니다.</p>
        <button className="btn btn-primary" disabled={submitting} onClick={onGenerate} type="button">
          + 미션 생성
        </button>
      </div>
    </section>
  )
}

// ── LLM 응답 파서 ─────────────────────────────────────────────────────────────

function parseStrategyTip(text) {
  if (!text) return null
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const result = { missionName: null, goal: null, parentGuide: null, scriptSentence: null, steps: [], checkpoints: [], easyAdjust: null, hardAdjust: null }
  let section = null

  const FIELDS = [
    ['미션 이름', 'missionName'],
    ['목표', 'goal'],
    ['보호자 안내', 'parentGuide'],
    ['아이에게 말해줄 문장', 'scriptSentence'],
    ['쉽게 조절하기', 'easyAdjust'],
    ['어렵게 조절하기', 'hardAdjust'],
  ]
  const LIST_FIELDS = { '수행 방법': 'steps', '관찰 체크포인트': 'checkpoints' }

  for (const line of lines) {
    let matched = false
    for (const [label, key] of FIELDS) {
      if (line.startsWith(`${label}:`)) {
        result[key] = line.slice(label.length + 1).trim()
        section = null; matched = true; break
      }
    }
    if (matched) continue
    for (const [label, key] of Object.entries(LIST_FIELDS)) {
      if (line.startsWith(`${label}:`)) { section = key; matched = true; break }
    }
    if (matched) continue
    if (line.startsWith('- ') && section) {
      result[section].push(line.slice(2).trim())
    }
  }

  const hasContent = Object.values(result).some((v) => (Array.isArray(v) ? v.length > 0 : v !== null))
  return hasContent ? result : null
}

// ── 파싱된 미션 뷰 (공유) ─────────────────────────────────────────────────────

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

// ── 생성된 미션 확인 모달 ──────────────────────────────────────────────────────

function GeneratedMissionModal({ mission, draft, setDraft, submitting, onCancel, onPublish }) {
  const [editMode, setEditMode] = useState(false)
  if (!mission) return null

  const parsed = parseStrategyTip(draft.strategyTip)

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="thr-detail-modal">

        <div className="thr-detail-head">
          <div className="thr-detail-chips">
            <span className="chip chip-info">W{draft.week || '-'} · {strategyLabelMap[draft.strategyFocus] || draft.strategyFocus || '생성된 미션'}</span>
            <span className="chip chip-neutral">생성 완료</span>
          </div>
          <button aria-label="닫기" className="thr-detail-close" onClick={onCancel} type="button">×</button>
        </div>

        <div className="thr-detail-body">
          <h2 className="thr-detail-title">{parsed?.missionName || strategyLabelMap[draft.strategyFocus] || '생성된 미션'}</h2>
          <p className="thr-detail-sub">내용을 확인한 뒤 발행하거나 취소할 수 있습니다.</p>

          {/* 메타 편집 필드 */}
          <div className="thr-gen-meta-grid">
            <label className="thr-gen-field">
              <span>주차</span>
              <input className="input" onChange={(e) => setDraft((p) => ({ ...p, week: e.target.value }))} type="number" value={draft.week} />
            </label>
            <label className="thr-gen-field">
              <span>전략 코드</span>
              <input className="input" onChange={(e) => setDraft((p) => ({ ...p, strategyFocus: e.target.value }))} value={draft.strategyFocus} />
            </label>
            <label className="thr-gen-field">
              <span>마감일</span>
              <input className="input" onChange={(e) => setDraft((p) => ({ ...p, dueDate: e.target.value }))} type="date" value={draft.dueDate} />
            </label>
          </div>

          {/* 수행 지시 */}
          <div className="thr-gen-field" style={{ marginBottom: 16 }}>
            <span className="thr-create-label">수행 지시</span>
            <textarea className="input" onChange={(e) => setDraft((p) => ({ ...p, instruction: e.target.value }))} rows={4} value={draft.instruction} />
          </div>

          {/* 파싱된 뷰 / 원본 편집 토글 */}
          <div className="thr-gen-toggle-row">
            <p className="thr-create-label" style={{ margin: 0 }}>미션 가이드</p>
            <button className="thr-gen-toggle-btn" onClick={() => setEditMode((p) => !p)} type="button">
              {editMode ? '미리보기' : '직접 편집'}
            </button>
          </div>

          {editMode ? (
            <textarea
              className="input"
              onChange={(e) => setDraft((p) => ({ ...p, strategyTip: e.target.value }))}
              rows={14}
              style={{ width: '100%', marginTop: 8, boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '.82rem' }}
              value={draft.strategyTip}
            />
          ) : (
            <ParsedStrategyView instruction={null} parsed={parsed} />
          )}
        </div>

        <div className="thr-detail-footer">
          <button className="btn btn-danger" disabled={submitting} onClick={onCancel} type="button">생성 취소</button>
          <button className="btn btn-primary" disabled={submitting} onClick={onPublish} type="button">
            {submitting ? '발행 중...' : '미션 발행'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 상세 모달 ──────────────────────────────────────────────────────────────────

function DetailModal({ mission, onClose, onReview }) {
  if (!mission) return null
  const cfg = getStatusCfg(mission.status)

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
          <h2 className="thr-detail-title">{strategyLabel(mission)}</h2>
          {mission.subtitle
            ? <p className="thr-detail-sub">미션 · {mission.subtitle}</p>
            : <p className="thr-detail-sub">미션 · {formatDate(mission.dueDate)} 마감</p>}

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

          {/* 파싱된 미션 가이드 (instruction + strategyTip) */}
          <ParsedStrategyView
            instruction={mission.instruction || null}
            parsed={parseStrategyTip(mission.strategyTip)}
          />

          {/* 보호자 보고 */}
          {mission.report ? (
            <div className="thr-detail-report">
              <p className="thr-detail-report-label">보호자 보고</p>
              <p>완료 정도: <strong>{completionLabelMap[mission.report.completed] || '-'}</strong></p>
              <p>시작 방식: <strong>{initiationLabelMap[mission.report.initiatedBy] || '-'}</strong></p>
              <p>{mission.report.spontaneousFlag ? '자발적으로 수행했어요.' : '안내 후 수행했어요.'}</p>
              {mission.report.parentObservation ? <p>{mission.report.parentObservation}</p> : null}
            </div>
          ) : null}

          {mission.report?.therapistReviewComment ? (
            <div className="thr-detail-report success">
              <p className="thr-detail-report-label">검토 의견</p>
              <p>{mission.report.therapistReviewComment}</p>
            </div>
          ) : null}
        </div>

        {/* 푸터 */}
        <div className="thr-detail-footer">
          <button className="btn btn-ghost" onClick={onClose} type="button">닫기</button>
          {mission.status === 'SUBMITTED'
            ? <button className="btn btn-primary" onClick={() => onReview(mission)} type="button">검토 완료 처리</button>
            : <button className="btn btn-primary" onClick={onClose} type="button">미션 상세 보기</button>}
        </div>
      </div>
    </div>
  )
}

// ── 검토 모달 ──────────────────────────────────────────────────────────────────

function ReviewModal({ error, mission, reviewComment, setReviewComment, submitting, onCancel, onConfirm }) {
  if (!mission) return null
  return (
    <div className="overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <button aria-label="닫기" className="modal-close" onClick={onCancel} type="button">×</button>
          <h2>보호자 보고 검토</h2>
          <p className="modal-meta">W{mission.week || '-'} · {strategyLabel(mission)}</p>
        </div>
        <div className="modal-body">
          {error ? <div className="stats-feedback mb-4">{error}</div> : null}
          {mission.report ? (
            <div className="offline-review-note mb-4">
              <p>완료 정도: <strong>{completionLabelMap[mission.report.completed] || '-'}</strong></p>
              <p>시작 방식: <strong>{initiationLabelMap[mission.report.initiatedBy] || '-'}</strong></p>
              {mission.report.parentObservation ? <p>{mission.report.parentObservation}</p> : null}
            </div>
          ) : null}
          <label className="field-block">
            검토 의견
            <textarea className="input" onChange={(e) => setReviewComment(e.target.value)} placeholder="보호자에게 전달할 피드백을 적어주세요." rows={5} value={reviewComment} />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel} type="button">취소</button>
          <button className="btn btn-primary" disabled={submitting} onClick={onConfirm} type="button">{submitting ? '저장 중...' : '검토 완료'}</button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────────

export function TherapistOfflinePage() {
  const { accessToken } = useAuth()
  const [children, setChildren]         = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [summary, setSummary]           = useState(null)
  const [missions, setMissions]         = useState([])
  const [pageTab, setPageTab]           = useState('current')
  const [historyFilter, setHistoryFilter] = useState('')
  const [detailMission, setDetailMission] = useState(null)
  const [reviewTarget, setReviewTarget] = useState(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [generateInput, setGenerateInput] = useState(emptyGenerateInput)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [generatedMission, setGeneratedMission] = useState(null)
  const [generatedDraft, setGeneratedDraft] = useState(toEditableMission(null))
  const [loading, setLoading]           = useState(true)
  const [submitting, setSubmitting]     = useState(false)
  const [feedback, setFeedback]         = useState('')

  const selectedChild = useMemo(() => children.find((c) => c.childId === selectedChildId) || children[0] || null, [children, selectedChildId])

  const filteredMissions = useMemo(() => {
    if (!historyFilter) return missions
    return missions.filter((m) => m.status === historyFilter)
  }, [missions, historyFilter])

  const pendingReviewCount = missions.filter((m) => m.status === 'SUBMITTED').length
  const currentMission     = missions.find((m) => m.status === 'SUBMITTED') || missions.find((m) => m.status === 'PENDING') || missions[0] || null

  // 주차 옵션 (summary.weeks에서 추출)
  const weekOptions = useMemo(() => {
    const weeks = summary?.weeks || []
    return weeks.slice(0, 6).map((w) => {
      const lbl = w.strategyFocusLabel || strategyLabelMap[w.strategyFocus] || `W${w.week}`
      return `W${w.week} ${lbl.slice(0, 4)}`
    })
  }, [summary])

  useEffect(() => {
    let ignore = false
    async function loadChildren() {
      if (!accessToken) { setLoading(false); return }
      try {
        const res = await apiFetch('/children/accessible', { method: 'GET', token: accessToken })
        const payload = extractApiPayload(res) || []
        const missionChildren = payload.filter(canAssignMission)
        if (!ignore) { setChildren(missionChildren); setSelectedChildId(missionChildren[0]?.childId || null) }
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      }
    }
    loadChildren()
    return () => { ignore = true }
  }, [accessToken])

  async function loadData() {
    if (!accessToken || !selectedChildId) { setLoading(false); return }
    setLoading(true)
    try {
      const [summaryRes, listRes] = await Promise.all([
        apiFetch(`/therapist/children/${selectedChildId}/homework/summary`, { method: 'GET', token: accessToken }),
        apiFetch(`/therapist/children/${selectedChildId}/homework`, { method: 'GET', token: accessToken }),
      ])
      setSummary(extractApiPayload(summaryRes))
      setMissions(normalizePage(extractApiPayload(listRes)))
      setFeedback('')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [accessToken, selectedChildId])

  async function handleGenerate() {
    if (!selectedChildId) return
    setSubmitting(true); setFeedback('')
    try {
      const res = await apiFetch(`/therapist/children/${selectedChildId}/homework/generate-offline-mission`, {
        method: 'POST', token: accessToken,
        body: {
          therapistInstruction: generateInput.therapistInstruction || null,
          dueDate: generateInput.dueDate || null,
          topK: 5, similarityThreshold: 0.65,
          think: generateInput.difficulty === '자동' ? null : generateInput.difficulty === '낮음' ? 'low' : generateInput.difficulty === '높음' ? 'high' : 'medium',
        },
      })
      const created = extractApiPayload(res)
      setGeneratedMission(created)
      setGeneratedDraft(toEditableMission(created))
      setGenerateInput(emptyGenerateInput)
      await loadData()
      setFeedback('미션을 생성했습니다. 내용을 확인한 뒤 발행하거나 취소해 주세요.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancelGenerated() {
    if (!selectedChildId || !generatedMission) return
    setSubmitting(true)
    try {
      await apiFetch(`/therapist/children/${selectedChildId}/homework/${missionId(generatedMission)}/cancel`, { method: 'PATCH', token: accessToken })
      setGeneratedMission(null)
      await loadData()
      setFeedback('생성된 미션을 취소했습니다.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePublishGenerated() {
    if (!selectedChildId || !generatedMission) return
    setSubmitting(true)
    try {
      await apiFetch(`/therapist/children/${selectedChildId}/homework/${missionId(generatedMission)}`, {
        method: 'PATCH', token: accessToken, body: buildUpdateBody(generatedDraft),
      })
      setGeneratedMission(null)
      setPageTab('current')
      await loadData()
      setFeedback('미션을 발행했습니다.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReviewConfirm() {
    if (!selectedChildId || !reviewTarget) return
    setSubmitting(true)
    setReviewError('')
    try {
      await apiFetch(`/therapist/children/${selectedChildId}/homework/${missionId(reviewTarget)}/review`, {
        method: 'PATCH', token: accessToken, body: { reviewComment: reviewComment || null },
      })
      setReviewTarget(null); setReviewComment('')
      await loadData()
      setFeedback('미션 검토를 완료했습니다.')
    } catch (error) {
      setReviewError(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  function openReview(mission) {
    setDetailMission(null)
    setReviewTarget(mission)
    setReviewComment(mission?.report?.therapistReviewComment || '')
    setReviewError('')
  }

  return (
    <TherapistStatsShell activeId="offline" subtitle="진행 중인 가정 미션과 보호자 보고를 확인하고, 아동 흐름에 맞춰 새 미션을 생성합니다." title="오프라인 미션">
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      {/* 아동 선택 – 모든 탭 고정 */}
      {children.length > 0 ? (
        <div className="ms-student-row">
          <span className="ms-student-label">아동</span>
          <div className="ms-student-dropdown-wrap">
            {selectedChild ? (
              <div className="ms-student-photo">
                {resolveUploadUrl(selectedChild.profileImageUrl)
                  ? <img alt={selectedChild.name} src={resolveUploadUrl(selectedChild.profileImageUrl)} />
                  : <span>{selectedChild.name?.[0] || '?'}</span>}
              </div>
            ) : null}
            <select
              className="ms-student-select"
              onChange={(e) => setSelectedChildId(e.target.value)}
              value={selectedChildId ?? ''}
            >
              {children.map((child) => (
                <option key={child.childId} value={child.childId}>
                  {child.name} · {calculateAgeLabel(child.birthDate)} · {getGenderLabel(child.gender)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {/* 탭 */}
      <div className="ms-tabs">
        {pageTabs.map((tab) => (
          <button
            className={`ms-tab ${pageTab === tab.id ? 'active' : ''}`}
            key={tab.id}
            onClick={() => setPageTab(tab.id)}
            type="button"
          >
            {tab.label}
            {tab.id === 'history' && pendingReviewCount > 0 ? (
              <span className="ms-tab-count">{pendingReviewCount}</span>
            ) : null}
          </button>
        ))}
      </div>

      {loading ? <div className="stats-loading">미션 정보를 불러오는 중입니다...</div> : null}

      {/* ── 현재 미션 탭 ── */}
      {!loading && pageTab === 'current' ? (
        <>
          {pendingReviewCount > 0 ? (
            <button
              className="thr-alert-banner"
              onClick={() => { setPageTab('history'); setHistoryFilter('SUBMITTED') }}
              type="button"
            >
              <div className="thr-alert-left">
                <span className="thr-alert-icon">📋</span>
                <div>
                  <p className="thr-alert-title">검토 대기 중인 부모 보고가 {pendingReviewCount}건 있습니다.</p>
                  <p className="thr-alert-sub">이전 미션 기록 탭에서 확인하고 피드백을 남겨 주세요.</p>
                </div>
              </div>
              <span className="thr-alert-action">검토하러 가기 →</span>
            </button>
          ) : null}

          <div className="thr-current-grid">
            <div className="thr-calendar-wrap">
              {missions.length
                ? <MissionCalendar labelOf={strategyLabel} missions={missions} onSelectMission={setDetailMission} />
                : <div className="empty-card">아직 배정된 미션이 없습니다.</div>}
            </div>
            <MissionSidebarPanel
              currentMission={currentMission}
              pendingReviewCount={pendingReviewCount}
              summary={summary}
            />
          </div>
        </>
      ) : null}

      {/* ── 주차별 현황 탭 ── */}
      {!loading && pageTab === 'weekly' ? (
        <WeeklyTable onSelectWeek={setDetailMission} summary={summary} weeks={summary?.weeks} />
      ) : null}

      {/* ── 미션 생성 탭 ── */}
      {!loading && pageTab === 'create' ? (
        <CreateForm
          input={generateInput}
          onGenerate={handleGenerate}
          setInput={setGenerateInput}
          setShowAdvanced={setShowAdvanced}
          showAdvanced={showAdvanced}
          submitting={submitting}
          weekOptions={weekOptions}
        />
      ) : null}

      {/* ── 이전 미션 기록 탭 ── */}
      {!loading && pageTab === 'history' ? (
        <section className="stats-panel ms-list-card">
          <h3 className="ms-list-card-title">이전 미션 기록</h3>
          <p className="ms-list-card-sub">미션을 누르면 가이드와 보고 내용을 확인하고 검토할 수 있어요.</p>

          <div className="ms-filter-tabs">
            {historyFilters.map((f) => {
              const count = f.value === '' ? missions.length : missions.filter((m) => m.status === f.value).length
              return (
                <button
                  className={`ms-filter-tab ${historyFilter === f.value ? 'active' : ''}`}
                  key={f.value || 'all'}
                  onClick={() => setHistoryFilter(f.value)}
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
              <MissionItem item={item} key={missionId(item)} onSelect={() => setDetailMission(item)} />
            )) : <div className="empty-card">해당 조건의 미션이 없습니다.</div>}
          </div>
        </section>
      ) : null}

      <DetailModal mission={detailMission} onClose={() => setDetailMission(null)} onReview={openReview} />
      <GeneratedMissionModal draft={generatedDraft} mission={generatedMission} onCancel={handleCancelGenerated} onPublish={handlePublishGenerated} setDraft={setGeneratedDraft} submitting={submitting} />
      <ReviewModal error={reviewError} mission={reviewTarget} onCancel={() => { setReviewTarget(null); setReviewComment(''); setReviewError('') }} onConfirm={handleReviewConfirm} reviewComment={reviewComment} setReviewComment={setReviewComment} submitting={submitting} />
    </TherapistStatsShell>
  )
}
