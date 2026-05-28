import { useEffect, useMemo, useState } from 'react'
import { ParentShell } from '../components/ParentShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

const pageTabs = [
  { id: 'today', label: '오늘 할 미션' },
  { id: 'report', label: '수행 기록' },
  { id: 'history', label: '미션 기록' },
]

const statusTabs = [
  { value: 'PENDING', label: '할 일' },
  { value: 'SUBMITTED', label: '확인 대기' },
  { value: 'REVIEWED', label: '완료됨' },
  { value: 'CANCELED', label: '취소됨' },
]

const completionOptions = [
  { value: 'DONE', label: '완료' },
  { value: 'PARTIAL', label: '부분 수행' },
  { value: 'NOT_DONE', label: '수행하지 못함' },
]

const initiationOptions = [
  { value: 'SELF', label: '아이 스스로 시작' },
  { value: 'HINT', label: '힌트 후 시작' },
  { value: 'PROMPTED', label: '직접 안내 후 시작' },
]

const completionLabelMap = Object.fromEntries(completionOptions.map((item) => [item.value, item.label]))

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
  SUBMITTED: '확인 대기',
  REVIEWED: '검토 완료',
  CANCELED: '취소됨',
}

const defaultReportForm = {
  completed: 'DONE',
  initiatedBy: 'SELF',
  spontaneousFlag: false,
  parentObservation: '',
  peerResponseObserved: '',
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

function buildReportForm(mission) {
  return {
    completed: mission?.report?.completed || 'DONE',
    initiatedBy: mission?.report?.initiatedBy || 'SELF',
    spontaneousFlag: Boolean(mission?.report?.spontaneousFlag),
    parentObservation: mission?.report?.parentObservation || '',
    peerResponseObserved: mission?.report?.peerResponseObserved || '',
  }
}

function Card({ children, className = '' }) {
  return <section className={`stats-panel ${className}`}>{children}</section>
}

function MetricCard({ label, value }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </article>
  )
}

function MissionInfo({ mission, tipOpen, setTipOpen }) {
  if (!mission) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
        <p className="text-lg font-black text-slate-950">오늘 할 미션이 없어요.</p>
        <p className="mt-2 text-sm text-slate-500">새 미션이 배정되면 이곳에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="미션" value={`W${mission.week || '-'}`} />
        <MetricCard label="연습 목표" value={strategyLabel(mission)} />
        <MetricCard label="마감일" value={formatDate(mission.dueDate)} />
        <MetricCard label="상태" value={statusLabel(mission)} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-bold text-slate-400">오늘의 미션</p>
        <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-800">{mission.instruction || '미션 안내가 아직 없습니다.'}</p>

        <button className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700" onClick={() => setTipOpen((value) => !value)} type="button">
          {tipOpen ? '도움말 닫기' : '도움말 보기'}
        </button>

        {tipOpen ? (
          <div className="mt-3 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] px-4 py-4">
            <p className="text-xs font-bold text-[var(--brand-700)]">도움말</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{mission.strategyTip || '짧게 시도하고, 아이가 편하게 말할 수 있도록 기다려 주세요.'}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MissionList({ missions, onSelect, selectedMissionId }) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {missions.length ? missions.map((item) => (
        <button
          className={`rounded-xl border bg-white p-4 text-left transition ${selectedMissionId === missionId(item) ? 'border-[var(--brand-200)] ring-2 ring-[var(--brand-100)]' : 'border-slate-200 hover:border-[var(--brand-200)]'}`}
          key={missionId(item)}
          onClick={() => onSelect(item)}
          type="button"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-950">{strategyLabel(item)}</p>
              <p className="mt-1 text-xs text-slate-500">마감일: {formatDate(item.dueDate)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.overdue ? 'bg-rose-50 text-rose-700' : item.dueSoon ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
              {statusLabel(item)}
            </span>
          </div>
          {item.report?.completed ? <p className="mt-3 text-sm text-slate-600">수행 기록: {item.report.completedLabel || completionLabelMap[item.report.completed]}</p> : null}
          {item.report?.therapistReviewComment ? (
            <div className="mt-3 rounded-xl bg-[var(--brand-50)] px-3 py-2">
              <p className="text-xs font-bold text-[var(--brand-700)]">치료사 피드백</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{item.report.therapistReviewComment}</p>
            </div>
          ) : null}
        </button>
      )) : <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">해당 상태의 미션이 없습니다.</p>}
    </div>
  )
}

function ReportForm({ mission, form, setForm, submitting, onSubmit, showActions = true }) {
  if (!mission) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
        수행 기록을 남길 미션을 선택해 주세요.
      </div>
    )
  }

  const hasReport = Boolean(mission.report?.reportId)

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-bold text-slate-400">선택한 미션</p>
        <p className="mt-2 text-lg font-black text-slate-950">{strategyLabel(mission)}</p>
        <p className="mt-1 text-sm text-slate-500">마감일: {formatDate(mission.dueDate)} · 상태: {statusLabel(mission)}</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">완료 정도</p>
        <div className="child-selector">
          {completionOptions.map((option) => (
            <button className={`child-pill ${form.completed === option.value ? 'active' : ''}`} key={option.value} onClick={() => setForm((prev) => ({ ...prev, completed: option.value }))} type="button">
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">시작 방식</p>
        <div className="child-selector">
          {initiationOptions.map((option) => (
            <button className={`child-pill ${form.initiatedBy === option.value ? 'active' : ''}`} key={option.value} onClick={() => setForm((prev) => ({ ...prev, initiatedBy: option.value }))} type="button">
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
        <input checked={form.spontaneousFlag} onChange={(event) => setForm((prev) => ({ ...prev, spontaneousFlag: event.target.checked }))} type="checkbox" />
        아이가 자발적으로 했나요?
      </label>

      <textarea className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(event) => setForm((prev) => ({ ...prev, parentObservation: event.target.value }))} placeholder="보호자가 본 모습을 적어 주세요." value={form.parentObservation} />
      <textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(event) => setForm((prev) => ({ ...prev, peerResponseObserved: event.target.value }))} placeholder="상대방이나 또래의 반응이 있었다면 적어 주세요." value={form.peerResponseObserved} />

      {showActions ? (
        <div className="flex justify-end">
          <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={submitting} onClick={() => onSubmit(hasReport)} type="button">
            {submitting ? '저장 중...' : hasReport ? '기록 수정하기' : '기록 제출하기'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ReportModal({ mission, form, setForm, submitting, onClose, onSubmit }) {
  if (!mission) return null
  const hasReport = Boolean(mission.report?.reportId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-500)]">수행 기록</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{hasReport ? '기록 수정하기' : '기록 제출하기'}</h2>
            <p className="mt-1 text-sm text-slate-500">{strategyLabel(mission)} · {formatDate(mission.dueDate)}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{statusLabel(mission)}</span>
        </div>

        <div className="mt-5">
          <ReportForm form={form} mission={mission} onSubmit={onSubmit} setForm={setForm} showActions={false} submitting={submitting} />
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50" disabled={submitting} onClick={onClose} type="button">
            취소
          </button>
          <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={submitting} onClick={() => onSubmit(hasReport)} type="button">
            {submitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ summary }) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      <MetricCard label="제출률" value={percent(summary?.submissionRate)} />
      <MetricCard label="완료 비율" value={percent(summary?.completionRate)} />
      <MetricCard label="자발성 비율" value={percent(summary?.spontaneousRate)} />
      <MetricCard label="기한 지난 미션" value={summary?.overduePendingCount ?? 0} />
      <MetricCard label="곧 마감" value={summary?.dueSoonPendingCount ?? 0} />
    </div>
  )
}

export function ParentOfflinePage() {
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [current, setCurrent] = useState(null)
  const [selectedMission, setSelectedMission] = useState(null)
  const [selectedMissionId, setSelectedMissionId] = useState(null)
  const [summary, setSummary] = useState(null)
  const [missions, setMissions] = useState([])
  const [pageTab, setPageTab] = useState('today')
  const [activeStatus, setActiveStatus] = useState('PENDING')
  const [reportForm, setReportForm] = useState(defaultReportForm)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [tipOpen, setTipOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
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
        const res = await apiFetch('/children/my', { method: 'GET', token: accessToken })
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

  useEffect(() => {
    let ignore = false
    async function loadHomework() {
      if (!accessToken || !selectedChildId) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const [currentRes, summaryRes, listRes] = await Promise.all([
          apiFetch(`/parent/children/${selectedChildId}/homework/current`, { method: 'GET', token: accessToken }),
          apiFetch(`/parent/children/${selectedChildId}/homework/summary`, { method: 'GET', token: accessToken }),
          apiFetch(`/parent/children/${selectedChildId}/homework?status=${activeStatus}`, { method: 'GET', token: accessToken }),
        ])

        const currentPayload = extractApiPayload(currentRes) || null
        const listPayload = normalizePage(extractApiPayload(listRes))
        const nextMission = resolveSelectedMission(currentPayload, listPayload)
        if (!ignore) {
          setCurrent(currentPayload)
          setSelectedMission(nextMission)
          setSelectedMissionId(missionId(nextMission) || null)
          setSummary(extractApiPayload(summaryRes))
          setMissions(listPayload)
          setReportForm(buildReportForm(nextMission))
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    loadHomework()
    return () => { ignore = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedChildId, activeStatus])

  function resolveSelectedMission(currentPayload, listPayload) {
    const list = Array.isArray(listPayload) ? listPayload : []
    const previous = selectedMissionId ? list.find((item) => missionId(item) === selectedMissionId) : null
    if (previous) return previous
    if (currentPayload && (!activeStatus || currentPayload.status === activeStatus)) return currentPayload
    return list[0] || null
  }

  async function reloadAfterSubmit(preferredMission = null) {
    const [currentRes, summaryRes, listRes] = await Promise.all([
      apiFetch(`/parent/children/${selectedChildId}/homework/current`, { method: 'GET', token: accessToken }),
      apiFetch(`/parent/children/${selectedChildId}/homework/summary`, { method: 'GET', token: accessToken }),
      apiFetch(`/parent/children/${selectedChildId}/homework?status=${activeStatus}`, { method: 'GET', token: accessToken }),
    ])
    const currentPayload = extractApiPayload(currentRes) || null
    const listPayload = normalizePage(extractApiPayload(listRes))
    const selectedId = missionId(preferredMission) || selectedMissionId || missionId(selectedMission)
    const nextSelected = preferredMission
      || listPayload.find((item) => missionId(item) === selectedId)
      || (currentPayload && (!activeStatus || currentPayload.status === activeStatus) ? currentPayload : null)
      || listPayload[0]
      || null

    setCurrent(currentPayload)
    setSummary(extractApiPayload(summaryRes))
    setMissions(listPayload)
    setSelectedMission(nextSelected)
    setSelectedMissionId(missionId(nextSelected) || null)
    setReportForm(buildReportForm(nextSelected))
  }

  async function handleSelectMission(item, nextTab = null) {
    const id = missionId(item)
    if (!id || !selectedChildId) return
    setSelectedMissionId(id)
    setSelectedMission(item)
    setReportForm(buildReportForm(item))
    setTipOpen(false)
    setReportModalOpen(false)
    if (nextTab) setPageTab(nextTab)

    try {
      const detailRes = await apiFetch(`/parent/children/${selectedChildId}/homework/${id}`, { method: 'GET', token: accessToken })
      const detail = extractApiPayload(detailRes)
      if (detail) {
        setSelectedMission(detail)
        setReportForm(buildReportForm(detail))
      }
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    }
  }

  async function handleSubmitReport(isUpdate) {
    if (!selectedMission?.homeworkId || !selectedChildId) return
    setSubmitting(true)
    setFeedback('')
    try {
      const savedRes = await apiFetch(`/parent/children/${selectedChildId}/homework/${selectedMission.homeworkId}/reports`, {
        method: isUpdate ? 'PATCH' : 'POST',
        token: accessToken,
        body: {
          completed: reportForm.completed,
          initiatedBy: reportForm.initiatedBy,
          strategyApplied: selectedMission.strategyFocus || null,
          parentObservation: reportForm.parentObservation,
          peerResponseObserved: reportForm.peerResponseObserved,
          spontaneousFlag: reportForm.spontaneousFlag,
        },
      })
      const savedMission = extractApiPayload(savedRes)
      setFeedback(isUpdate ? '수행 기록을 수정했습니다.' : '수행 기록을 제출했습니다.')
      await reloadAfterSubmit(savedMission || selectedMission)
      setReportModalOpen(false)
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ParentShell childCount={children.length} heading="오프라인 미션" selectedChild={selectedChild} subheading="오늘 집에서 할 미션을 확인하고 수행 기록을 남겨요.">
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      <Card className="mt-4">
        <div className="panel-head">
          <p>학생 선택</p>
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

      {loading ? <div className="stats-loading">미션을 불러오는 중입니다...</div> : null}

      {!loading && pageTab === 'today' ? (
        <div className="mt-4 space-y-4">
          <Card>
            <div className="panel-head">
              <p>오늘 할 미션</p>
              <span>{current?.report ? '수행 기록 있음' : '수행 기록 없음'}</span>
            </div>
            <div className="mt-4">
              <MissionInfo mission={current} setTipOpen={setTipOpen} tipOpen={tipOpen} />
            </div>
            {current ? (
              <div className="mt-4 flex justify-end">
                <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-bold text-white" onClick={() => handleSelectMission(current, 'report')} type="button">
                  수행 기록 남기기
                </button>
              </div>
            ) : null}
          </Card>
          <SummaryCard summary={summary} />
        </div>
      ) : null}

      {!loading && pageTab === 'report' ? (
        <section className="stats-grid mt-4">
          <Card>
            <div className="panel-head">
              <p>할 일 목록</p>
              <span>{statusTabs.find((item) => item.value === activeStatus)?.label}</span>
            </div>
            <div className="child-selector mt-4">
              {statusTabs.map((tab) => (
                <button className={`child-pill ${activeStatus === tab.value ? 'active' : ''}`} key={tab.value} onClick={() => setActiveStatus(tab.value)} type="button">{tab.label}</button>
              ))}
            </div>
            <MissionList missions={missions} onSelect={(item) => handleSelectMission(item)} selectedMissionId={selectedMissionId} />
          </Card>

          <Card>
            <div className="panel-head">
              <p>세부 사항</p>
              <span>{selectedMission ? statusLabel(selectedMission) : '-'}</span>
            </div>
            <div className="mt-4">
              <MissionInfo mission={selectedMission} setTipOpen={setTipOpen} tipOpen={tipOpen} />
              {selectedMission ? (
                <div className="mt-4 flex justify-end">
                  <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-bold text-white" onClick={() => setReportModalOpen(true)} type="button">
                    {selectedMission.report ? '수행 기록 수정' : '수행 기록 제출'}
                  </button>
                </div>
              ) : null}
            </div>
          </Card>
        </section>
      ) : null}

      {!loading && pageTab === 'history' ? (
        <section className="stats-grid mt-4">
          <Card>
            <div className="panel-head">
              <p>미션 기록</p>
              <span>{statusTabs.find((item) => item.value === activeStatus)?.label}</span>
            </div>
            <div className="child-selector mt-4">
              {statusTabs.map((tab) => (
                <button className={`child-pill ${activeStatus === tab.value ? 'active' : ''}`} key={tab.value} onClick={() => setActiveStatus(tab.value)} type="button">{tab.label}</button>
              ))}
            </div>
            <MissionList missions={missions} onSelect={(item) => handleSelectMission(item)} selectedMissionId={selectedMissionId} />
          </Card>

          <Card>
            <div className="panel-head">
              <p>기록 상세</p>
              <span>{selectedMission ? statusLabel(selectedMission) : '-'}</span>
            </div>
            <div className="mt-4">
              <MissionInfo mission={selectedMission} setTipOpen={setTipOpen} tipOpen={tipOpen} />
            </div>
          </Card>
        </section>
      ) : null}

      <ReportModal
        form={reportForm}
        mission={reportModalOpen ? selectedMission : null}
        onClose={() => setReportModalOpen(false)}
        onSubmit={handleSubmitReport}
        setForm={setReportForm}
        submitting={submitting}
      />
    </ParentShell>
  )
}
