import { useEffect, useMemo, useState } from 'react'
import { TherapistStatsShell } from '../components/TherapistStatsShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

const pageTabs = [
  { id: 'current', label: '현재 미션' },
  { id: 'create', label: '미션 생성' },
  { id: 'history', label: '이전 미션 기록' },
]

const statusTabs = [
  { value: '', label: '전체' },
  { value: 'PENDING', label: '진행 중' },
  { value: 'SUBMITTED', label: '보고됨' },
  { value: 'REVIEWED', label: '검토 완료' },
  { value: 'CANCELED', label: '취소됨' },
]

const thinkOptions = [
  { value: '', label: '기본값' },
  { value: 'false', label: '끄기' },
  { value: 'low', label: '낮음' },
  { value: 'medium', label: '보통' },
  { value: 'high', label: '높음' },
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
  HANDLING_EXCLUSION: '소외에 대처하기',
  HANDLING_CYBERBULLYING: '사이버 괴롭힘 대처하기',
  HANDLING_RUMORS: '소문과 험담 대처하기',
  REPUTATION_MANAGEMENT: '평판 관리하기',
}

const statusLabelMap = {
  PENDING: '진행 중',
  SUBMITTED: '부모 보고됨',
  REVIEWED: '검토 완료',
  CANCELED: '취소됨',
}

const completionLabelMap = {
  DONE: '완료',
  PARTIAL: '부분 수행',
  NOT_DONE: '수행하지 못함',
}

const initiationLabelMap = {
  SELF: '아이 스스로 시작',
  HINT: '힌트 후 시작',
  PROMPTED: '직접 안내 후 시작',
}

const emptyGenerateInput = {
  therapistInstruction: '',
  dueDate: '',
  topK: 5,
  similarityThreshold: 0.65,
  think: 'medium',
}

function missionId(item) {
  return item?.homeworkId || item?.id
}

function strategyLabel(item) {
  return item?.strategyFocusLabel || strategyLabelMap[item?.strategyFocus] || item?.strategyFocus || '연습 목표'
}

function statusLabel(item) {
  return item?.statusLabel || statusLabelMap[item?.status] || item?.status || '-'
}

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

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function buildGenerateBody(input) {
  return {
    therapistInstruction: input.therapistInstruction || null,
    dueDate: input.dueDate || null,
    topK: Number(input.topK) || 5,
    similarityThreshold: Number(input.similarityThreshold) || 0.65,
    think: input.think || null,
  }
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

function Card({ children, className = '' }) {
  return <section className={`stats-panel ${className}`}>{children}</section>
}

function MetricCard({ label, value, sub }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </article>
  )
}

function MissionCard({ item, active, onSelect }) {
  return (
    <button
      className={`w-full rounded-xl border bg-white p-4 text-left transition ${active ? 'border-[var(--brand-200)] ring-2 ring-[var(--brand-100)]' : 'border-slate-200 hover:border-[var(--brand-200)]'}`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">W{item.week || '-'} · {strategyLabel(item)}</p>
          <p className="mt-1 text-xs text-slate-500">마감일: {formatDate(item.dueDate)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.overdue ? 'bg-rose-50 text-rose-700' : item.dueSoon ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
          {statusLabel(item)}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">{item.instruction || '미션 내용 없음'}</p>
      {item.report ? <p className="mt-2 text-xs font-bold text-[var(--brand-700)]">부모 보고 있음</p> : null}
    </button>
  )
}

function MissionInfo({ mission }) {
  if (!mission) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
        표시할 미션이 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="주차" value={`W${mission.week || '-'}`} />
        <MetricCard label="연습 목표" value={strategyLabel(mission)} />
        <MetricCard label="마감일" value={formatDate(mission.dueDate)} />
        <MetricCard label="상태" value={statusLabel(mission)} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-bold text-slate-400">수행 지시</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{mission.instruction || '-'}</p>
        <p className="mt-4 text-xs font-bold text-slate-400">전략 팁</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{mission.strategyTip || '-'}</p>
        <p className="mt-4 text-xs text-slate-400">생성일: {formatDateTime(mission.createdAt)}</p>
      </div>

      {mission.report ? (
        <div className="rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] p-4">
          <p className="text-xs font-bold text-[var(--brand-700)]">부모 보고</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-700">
            <p>완료 정도: {mission.report.completedLabel || completionLabelMap[mission.report.completed] || '-'}</p>
            <p>시작 방식: {mission.report.initiatedByLabel || initiationLabelMap[mission.report.initiatedBy] || '-'}</p>
            <p>자발성: {mission.report.spontaneousFlag ? '예' : '아니오'}</p>
            <p>보호자 관찰: {mission.report.parentObservation || '-'}</p>
            <p>또래 반응: {mission.report.peerResponseObserved || '-'}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function GenerateForm({ input, setInput, showAdvanced, setShowAdvanced, submitting, onGenerate }) {
  return (
    <Card>
      <div className="panel-head">
        <p>미션 생성</p>
        <span>서버가 아동 통계와 RAG 검색을 자동 처리합니다.</span>
      </div>

      <div className="mt-4 space-y-4">
        <label className="block text-sm">
          <p className="mb-1 text-xs font-bold text-slate-500">추가 지시</p>
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) => setInput((prev) => ({ ...prev, therapistInstruction: event.target.value }))}
            placeholder="예: 또래와 이야기하기를 자연스럽게 연습"
            value={input.therapistInstruction}
          />
        </label>

        <label className="block text-sm">
          <p className="mb-1 text-xs font-bold text-slate-500">마감일</p>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) => setInput((prev) => ({ ...prev, dueDate: event.target.value }))}
            type="date"
            value={input.dueDate}
          />
        </label>

        <button className="child-pill" onClick={() => setShowAdvanced((value) => !value)} type="button">
          {showAdvanced ? '고급 설정 닫기' : '고급 설정'}
        </button>

        {showAdvanced ? (
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
            <label className="text-sm">
              <p className="mb-1 text-xs font-bold text-slate-500">참고 자료 개수</p>
              <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" min="1" onChange={(event) => setInput((prev) => ({ ...prev, topK: event.target.value }))} type="number" value={input.topK} />
            </label>
            <label className="text-sm">
              <p className="mb-1 text-xs font-bold text-slate-500">자료 관련도 기준</p>
              <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" max="1" min="0" onChange={(event) => setInput((prev) => ({ ...prev, similarityThreshold: event.target.value }))} step="0.01" type="number" value={input.similarityThreshold} />
            </label>
            <label className="text-sm">
              <p className="mb-1 text-xs font-bold text-slate-500">추론 깊이</p>
              <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(event) => setInput((prev) => ({ ...prev, think: event.target.value }))} value={input.think}>
                {thinkOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
        ) : null}

        <div className="flex justify-end">
          <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={submitting} onClick={onGenerate} type="button">
            {submitting ? '생성 중...' : '미션 생성'}
          </button>
        </div>
      </div>
    </Card>
  )
}

function GeneratedMissionModal({ mission, draft, setDraft, submitting, onCancel, onPublish }) {
  if (!mission) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-500)]">생성된 미션 확인</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">발행 전 세부사항 수정</h2>
            <p className="mt-1 text-sm text-slate-500">수행 지시, 전략 팁, 마감일을 확인한 뒤 발행하거나 취소할 수 있습니다.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{statusLabel(mission)}</span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            <p className="mb-1 text-xs font-bold text-slate-500">주차</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(event) => setDraft((prev) => ({ ...prev, week: event.target.value }))} type="number" value={draft.week} />
          </label>
          <label className="text-sm md:col-span-2">
            <p className="mb-1 text-xs font-bold text-slate-500">전략 초점</p>
            <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" readOnly value={strategyLabel({ ...mission, strategyFocus: draft.strategyFocus })} />
          </label>
        </div>

        <label className="mt-4 block text-sm">
          <p className="mb-1 text-xs font-bold text-slate-500">수행 지시</p>
          <textarea className="min-h-32 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(event) => setDraft((prev) => ({ ...prev, instruction: event.target.value }))} value={draft.instruction} />
        </label>

        <label className="mt-4 block text-sm">
          <p className="mb-1 text-xs font-bold text-slate-500">전략 팁</p>
          <textarea className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(event) => setDraft((prev) => ({ ...prev, strategyTip: event.target.value }))} value={draft.strategyTip} />
        </label>

        <label className="mt-4 block text-sm">
          <p className="mb-1 text-xs font-bold text-slate-500">마감일</p>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(event) => setDraft((prev) => ({ ...prev, dueDate: event.target.value }))} type="date" value={draft.dueDate} />
        </label>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50" disabled={submitting} onClick={onCancel} type="button">
            취소
          </button>
          <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={submitting} onClick={onPublish} type="button">
            발행
          </button>
        </div>
      </div>
    </div>
  )
}

export function TherapistOfflinePage() {
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [summary, setSummary] = useState(null)
  const [currentMission, setCurrentMission] = useState(null)
  const [missions, setMissions] = useState([])
  const [pageTab, setPageTab] = useState('current')
  const [historyStatus, setHistoryStatus] = useState('')
  const [selectedMissionId, setSelectedMissionId] = useState(null)
  const [generateInput, setGenerateInput] = useState(emptyGenerateInput)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [generatedMission, setGeneratedMission] = useState(null)
  const [generatedDraft, setGeneratedDraft] = useState(toEditableMission(null))
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const selectedChild = useMemo(() => children.find((child) => child.childId === selectedChildId) || children[0] || null, [children, selectedChildId])
  const selectedMission = useMemo(() => missions.find((item) => missionId(item) === selectedMissionId) || null, [missions, selectedMissionId])

  useEffect(() => {
    let ignore = false
    async function loadChildren() {
      if (!accessToken) {
        setLoading(false)
        return
      }
      try {
        const res = await apiFetch('/children/accessible', { method: 'GET', token: accessToken })
        const payload = extractApiPayload(res) || []
        if (!ignore) {
          setChildren(payload)
          setSelectedChildId(payload[0]?.childId || null)
        }
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      }
    }
    loadChildren()
    return () => { ignore = true }
  }, [accessToken])

  async function loadData(preferredMissionId = selectedMissionId) {
    if (!accessToken || !selectedChildId) return
    setLoading(true)
    try {
      const query = historyStatus ? `?status=${historyStatus}` : ''
      const [summaryRes, currentRes, listRes] = await Promise.all([
        apiFetch(`/therapist/children/${selectedChildId}/homework/summary`, { method: 'GET', token: accessToken }),
        apiFetch(`/therapist/children/${selectedChildId}/homework/current`, { method: 'GET', token: accessToken }),
        apiFetch(`/therapist/children/${selectedChildId}/homework${query}`, { method: 'GET', token: accessToken }),
      ])
      const list = normalizePage(extractApiPayload(listRes))
      const current = extractApiPayload(currentRes) || null
      const nextId = preferredMissionId && list.some((item) => missionId(item) === preferredMissionId)
        ? preferredMissionId
        : missionId(current) || missionId(list[0]) || null
      setSummary(extractApiPayload(summaryRes))
      setCurrentMission(current)
      setMissions(list)
      setSelectedMissionId(nextId)
      setFeedback('')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedChildId, historyStatus])

  async function handleGenerate() {
    if (!selectedChildId) return
    setSubmitting(true)
    setFeedback('')
    try {
      const res = await apiFetch(`/therapist/children/${selectedChildId}/homework/generate-offline-mission`, {
        method: 'POST',
        token: accessToken,
        body: buildGenerateBody(generateInput),
      })
      const created = extractApiPayload(res)
      setGeneratedMission(created)
      setGeneratedDraft(toEditableMission(created))
      setGenerateInput(emptyGenerateInput)
      await loadData(missionId(created))
      setFeedback('미션이 생성되었습니다. 모달에서 내용을 확인한 뒤 발행하거나 취소해 주세요.')
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
      await apiFetch(`/therapist/children/${selectedChildId}/homework/${missionId(generatedMission)}/cancel`, {
        method: 'PATCH',
        token: accessToken,
      })
      setGeneratedMission(null)
      setGeneratedDraft(toEditableMission(null))
      await loadData(null)
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
      const res = await apiFetch(`/therapist/children/${selectedChildId}/homework/${missionId(generatedMission)}`, {
        method: 'PATCH',
        token: accessToken,
        body: buildUpdateBody(generatedDraft),
      })
      const published = extractApiPayload(res)
      setGeneratedMission(null)
      setGeneratedDraft(toEditableMission(null))
      setPageTab('current')
      await loadData(missionId(published))
      setFeedback('미션을 발행했습니다.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <TherapistStatsShell activeId="offline" subtitle="진행 중인 미션을 확인하고, 아동 통계 기반 RAG 미션을 생성합니다." title="오프라인 미션">
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      <Card className="mt-4">
        <div className="panel-head">
          <p>아동 선택</p>
          <span>{selectedChild?.name || '-'}</span>
        </div>
        <div className="child-selector mt-4">
          {children.map((child) => (
            <button className={`child-pill ${selectedChildId === child.childId ? 'active' : ''}`} key={child.childId} onClick={() => setSelectedChildId(child.childId)} type="button">{child.name}</button>
          ))}
        </div>
      </Card>

      <div className="child-selector mt-4">
        {pageTabs.map((tab) => (
          <button className={`child-pill ${pageTab === tab.id ? 'active' : ''}`} key={tab.id} onClick={() => setPageTab(tab.id)} type="button">{tab.label}</button>
        ))}
      </div>

      {loading ? <div className="stats-loading">미션 정보를 불러오는 중입니다...</div> : null}

      {!loading && pageTab === 'current' ? (
        <div className="mt-4 space-y-4">
          <Card>
            <div className="panel-head">
              <p>진행 중인 미션</p>
              <span>{currentMission?.report ? '부모 보고 있음' : '부모 보고 없음'}</span>
            </div>
            <div className="mt-4">
              <MissionInfo mission={currentMission} />
            </div>
          </Card>

          <section className="stats-grid bottom-grid">
            <MetricCard label="전체 배정" value={summary?.assignedCount ?? 0} />
            <MetricCard label="진행 중" value={summary?.pendingCount ?? 0} />
            <MetricCard label="보고됨" value={summary?.submittedCount ?? 0} />
            <MetricCard label="검토 완료" value={summary?.reviewedCount ?? 0} />
            <MetricCard label="제출률" value={percent(summary?.submissionRate)} />
          </section>
        </div>
      ) : null}

      {!loading && pageTab === 'create' ? (
        <div className="mt-4">
          <GenerateForm
            input={generateInput}
            onGenerate={handleGenerate}
            setInput={setGenerateInput}
            setShowAdvanced={setShowAdvanced}
            showAdvanced={showAdvanced}
            submitting={submitting}
          />
        </div>
      ) : null}

      {!loading && pageTab === 'history' ? (
        <section className="stats-grid mt-4">
          <Card>
            <div className="panel-head">
              <p>이전 미션 기록</p>
              <span>{statusTabs.find((tab) => tab.value === historyStatus)?.label}</span>
            </div>
            <div className="child-selector mt-4">
              {statusTabs.map((tab) => (
                <button className={`child-pill ${historyStatus === tab.value ? 'active' : ''}`} key={tab.value || 'all'} onClick={() => setHistoryStatus(tab.value)} type="button">{tab.label}</button>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {missions.length ? missions.map((item) => (
                <MissionCard active={missionId(item) === selectedMissionId} item={item} key={missionId(item)} onSelect={() => setSelectedMissionId(missionId(item))} />
              )) : <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">해당 조건의 미션이 없습니다.</p>}
            </div>
          </Card>

          <Card>
            <div className="panel-head">
              <p>기록 상세</p>
              <span>{selectedMission ? statusLabel(selectedMission) : '-'}</span>
            </div>
            <div className="mt-4">
              <MissionInfo mission={selectedMission} />
            </div>
          </Card>
        </section>
      ) : null}

      <GeneratedMissionModal
        draft={generatedDraft}
        mission={generatedMission}
        onCancel={handleCancelGenerated}
        onPublish={handlePublishGenerated}
        setDraft={setGeneratedDraft}
        submitting={submitting}
      />
    </TherapistStatsShell>
  )
}
