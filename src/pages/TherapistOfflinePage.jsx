import { useEffect, useMemo, useState } from 'react'
import { TherapistStatsShell } from '../components/TherapistStatsShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

const statusFilters = [
  { value: 'PENDING', label: '대기중' },
  { value: 'SUBMITTED', label: '제출됨' },
  { value: 'REVIEWED', label: '검토완료' },
]

const emptyDraft = {
  weekNumber: '',
  strategy: '',
  title: '',
  parentInstruction: '',
  strategyTip: '',
  dueDate: '',
}

const emptyAiInput = {
  week: '',
  request: '',
  childSummary: '',
  additionalContext: '',
  topK: 4,
  similarityThreshold: 0.2,
  useProModel: false,
}

function inferStatusLabel(status) {
  if (status === 'SUBMITTED') return '제출됨'
  if (status === 'REVIEWED' || status === 'DONE') return '검토완료'
  return '대기중'
}

function readMissionFields(item) {
  return {
    weekNumber: item?.weekNumber || item?.week || '',
    strategy: item?.strategy || item?.strategyName || '',
    title: item?.title || item?.missionTitle || item?.subject || '오프라인 미션',
    parentInstruction: item?.parentInstruction || item?.instructionForParent || item?.missionInstruction || '',
    strategyTip: item?.strategyTip || item?.tip || '',
    dueDate: item?.dueDate || item?.deadline || '',
  }
}

function missionCreateBody(draft) {
  return {
    week: draft.weekNumber ? Number(draft.weekNumber) : null,
    weekNumber: draft.weekNumber ? Number(draft.weekNumber) : null,
    strategy: draft.strategy || null,
    title: draft.title || null,
    instruction: draft.parentInstruction || null,
    parentInstruction: draft.parentInstruction || null,
    instructionForParent: draft.parentInstruction || null,
    tip: draft.strategyTip || null,
    strategyTip: draft.strategyTip || null,
    dueDate: draft.dueDate || null,
  }
}

function missionGenerateBody(input) {
  return {
    week: input.week ? Number(input.week) : null,
    request: input.request || '',
    childSummary: input.childSummary || '',
    additionalContext: input.additionalContext || '',
    topK: Number.isFinite(Number(input.topK)) ? Number(input.topK) : 4,
    similarityThreshold: Number.isFinite(Number(input.similarityThreshold)) ? Number(input.similarityThreshold) : 0.2,
    useProModel: Boolean(input.useProModel),
  }
}

function toArray(value) {
  return Array.isArray(value) ? value : []
}

export function TherapistOfflinePage() {
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [selectedChildName, setSelectedChildName] = useState('')
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [missions, setMissions] = useState([])
  const [selectedMissionId, setSelectedMissionId] = useState(null)
  const [activeTab, setActiveTab] = useState('manual')
  const [manualDraft, setManualDraft] = useState(emptyDraft)
  const [aiInput, setAiInput] = useState(emptyAiInput)
  const [generatedDraft, setGeneratedDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const selectedMission = useMemo(
    () => missions.find((item) => (item.homeworkId || item.id) === selectedMissionId) || null,
    [missions, selectedMissionId],
  )

  useEffect(() => {
    let ignore = false
    async function loadChildren() {
      if (!accessToken) return
      try {
        const res = await apiFetch('/children/accessible', { method: 'GET', token: accessToken })
        const payload = extractApiPayload(res) || []
        if (!ignore) {
          setChildren(payload)
          setSelectedChildId(payload[0]?.childId || null)
          setSelectedChildName(payload[0]?.name || '')
        }
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      }
    }
    loadChildren()
    return () => { ignore = true }
  }, [accessToken])

  useEffect(() => {
    const selected = children.find((child) => child.childId === selectedChildId)
    setSelectedChildName(selected?.name || '')
  }, [children, selectedChildId])

  useEffect(() => {
    let ignore = false
    async function loadMissions() {
      if (!accessToken || !selectedChildId) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await apiFetch(`/therapist/children/${selectedChildId}/homework?status=${statusFilter}`, { method: 'GET', token: accessToken })
        const payload = toArray(extractApiPayload(res))
        if (!ignore) {
          setMissions(payload)
          setSelectedMissionId(payload[0]?.homeworkId || payload[0]?.id || null)
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    loadMissions()
    return () => { ignore = true }
  }, [accessToken, selectedChildId, statusFilter])

  async function handleGenerateMission() {
    if (!selectedChildId) return
    setSubmitting(true)
    setFeedback('')
    try {
      const res = await apiFetch(`/therapist/children/${selectedChildId}/homework/generate-offline-mission`, {
        method: 'POST',
        token: accessToken,
        body: missionGenerateBody(aiInput),
      })
      const payload = extractApiPayload(res) || {}
      const nextDraft = readMissionFields(payload)
      setGeneratedDraft(nextDraft)
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAssignMission(sourceDraft) {
    if (!selectedChildId) return
    if (!sourceDraft?.parentInstruction?.trim()) {
      setFeedback('부모에게 전달할 지시문을 입력해 주세요.')
      return
    }
    setSubmitting(true)
    setFeedback('')
    try {
      await apiFetch(`/therapist/children/${selectedChildId}/homework`, {
        method: 'POST',
        token: accessToken,
        body: missionCreateBody(sourceDraft),
      })
      setFeedback('미션을 배정했습니다.')
      setManualDraft(emptyDraft)
      setGeneratedDraft(null)
      const res = await apiFetch(`/therapist/children/${selectedChildId}/homework?status=${statusFilter}`, { method: 'GET', token: accessToken })
      const payload = toArray(extractApiPayload(res))
      setMissions(payload)
      setSelectedMissionId(payload[0]?.homeworkId || payload[0]?.id || null)
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <TherapistStatsShell activeId="offline" subtitle="오프라인 미션 생성, 배정, 제출 검토 흐름" title="오프라인 미션">
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      <section className="stats-panel" style={{ marginTop: 16 }}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">아동</p>
          {children.map((child) => (
            <button className={`child-pill ${selectedChildId === child.childId ? 'active' : ''}`} key={child.childId} onClick={() => setSelectedChildId(child.childId)} type="button">{child.name}</button>
          ))}
          <span className="ml-auto text-xs text-slate-500">현재 선택: {selectedChildName || '-'}</span>
        </div>
      </section>

      <section className="stats-grid" style={{ marginTop: 16 }}>
        <article className="stats-panel">
          <div className="panel-head"><p>미션 목록</p></div>
          <div className="child-selector" style={{ marginBottom: 10 }}>
            {statusFilters.map((filter) => (
              <button className={`child-pill ${statusFilter === filter.value ? 'active' : ''}`} key={filter.value} onClick={() => setStatusFilter(filter.value)} type="button">{filter.label}</button>
            ))}
          </div>

          {loading ? <p className="text-sm text-slate-500">불러오는 중...</p> : null}

          {!loading && !missions.length ? <p className="text-sm text-slate-500">해당 상태의 미션이 없습니다.</p> : null}

          <div className="space-y-2">
            {missions.map((item) => {
              const missionId = item.homeworkId || item.id
              const mission = readMissionFields(item)
              const active = missionId === selectedMissionId
              return (
                <button
                  className={`w-full rounded-xl border p-3 text-left ${active ? 'border-[var(--brand-200)] bg-[var(--brand-50)]' : 'border-slate-200 bg-white'}`}
                  key={missionId}
                  onClick={() => setSelectedMissionId(missionId)}
                  type="button"
                >
                  <p className="text-sm font-semibold text-slate-900">W{mission.weekNumber || '-'} · {mission.title}</p>
                  <p className="mt-1 text-xs text-slate-500">전략: {mission.strategy || '-'} · 마감: {mission.dueDate || '-'}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--brand-700)]">상태: {inferStatusLabel(item.status)}</p>
                </button>
              )
            })}
          </div>
        </article>

        <article className="stats-panel">
          <div className="panel-head"><p>미션 상세 / 작성</p></div>

          {selectedMission ? (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {(() => {
                const mission = readMissionFields(selectedMission)
                return (
                  <>
                    <p className="text-sm font-semibold text-slate-900">선택 미션: {mission.title}</p>
                    <p className="mt-1 text-xs text-slate-600">W{mission.weekNumber || '-'} · {mission.strategy || '-'} · {mission.dueDate || '-'}</p>
                    <p className="mt-2 text-sm text-slate-700">{mission.parentInstruction || '지시문 없음'}</p>
                  </>
                )
              })()}
            </div>
          ) : null}

          <div className="child-selector" style={{ marginBottom: 12 }}>
            <button className={`child-pill ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')} type="button">직접 작성</button>
            <button className={`child-pill ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')} type="button">AI 생성</button>
          </div>

          {activeTab === 'manual' ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input className="rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setManualDraft((prev) => ({ ...prev, weekNumber: e.target.value }))} placeholder="주차" value={manualDraft.weekNumber} />
                <input className="rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setManualDraft((prev) => ({ ...prev, strategy: e.target.value }))} placeholder="전략" value={manualDraft.strategy} />
              </div>
              <input className="w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setManualDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="미션 제목" value={manualDraft.title} />
              <textarea className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setManualDraft((prev) => ({ ...prev, parentInstruction: e.target.value }))} placeholder="부모에게 전달할 지시문" value={manualDraft.parentInstruction} />
              <textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setManualDraft((prev) => ({ ...prev, strategyTip: e.target.value }))} placeholder="전략 팁" value={manualDraft.strategyTip} />
              <input className="w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setManualDraft((prev) => ({ ...prev, dueDate: e.target.value }))} type="date" value={manualDraft.dueDate} />
              <div className="flex justify-end">
                <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-white" disabled={submitting} onClick={() => handleAssignMission(manualDraft)} type="button">{submitting ? '배정 중...' : '미션 배정'}</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input className="rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setAiInput((prev) => ({ ...prev, week: e.target.value }))} placeholder="week (예: 4)" type="number" value={aiInput.week} />
                <input className="rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setAiInput((prev) => ({ ...prev, topK: e.target.value }))} placeholder="topK" type="number" value={aiInput.topK} />
              </div>
              <textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setAiInput((prev) => ({ ...prev, request: e.target.value }))} placeholder="request (예: 이번 주 아이가 집에서 대화를 자연스럽게 시작해볼 수 있는 오프라인 미션을 만들어줘.)" value={aiInput.request} />
              <textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setAiInput((prev) => ({ ...prev, childSummary: e.target.value }))} placeholder="아동 요약" value={aiInput.childSummary} />
              <textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setAiInput((prev) => ({ ...prev, additionalContext: e.target.value }))} placeholder="추가 맥락" value={aiInput.additionalContext} />
              <div className="grid gap-3 md:grid-cols-2">
                <input className="rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setAiInput((prev) => ({ ...prev, similarityThreshold: e.target.value }))} placeholder="similarityThreshold (예: 0.2)" step="0.01" type="number" value={aiInput.similarityThreshold} />
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input checked={aiInput.useProModel} onChange={(e) => setAiInput((prev) => ({ ...prev, useProModel: e.target.checked }))} type="checkbox" />
                  useProModel
                </label>
              </div>
              <div className="flex justify-end">
                <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700" disabled={submitting} onClick={handleGenerateMission} type="button">{submitting ? '생성 중...' : '생성하기'}</button>
              </div>

              {generatedDraft ? (
                <div className="space-y-3 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] p-3">
                  <p className="text-sm font-semibold text-slate-900">생성 결과 (수정 후 배정)</p>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setGeneratedDraft((prev) => ({ ...prev, weekNumber: e.target.value }))} placeholder="주차" value={generatedDraft.weekNumber} />
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setGeneratedDraft((prev) => ({ ...prev, strategy: e.target.value }))} placeholder="전략" value={generatedDraft.strategy} />
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setGeneratedDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="미션 제목" value={generatedDraft.title} />
                  <textarea className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setGeneratedDraft((prev) => ({ ...prev, parentInstruction: e.target.value }))} placeholder="부모 지시문" value={generatedDraft.parentInstruction} />
                  <textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setGeneratedDraft((prev) => ({ ...prev, strategyTip: e.target.value }))} placeholder="전략 팁" value={generatedDraft.strategyTip} />
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setGeneratedDraft((prev) => ({ ...prev, dueDate: e.target.value }))} type="date" value={generatedDraft.dueDate} />
                  <div className="flex justify-end">
                    <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-white" disabled={submitting} onClick={() => handleAssignMission(generatedDraft)} type="button">미션 배정</button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </article>
      </section>
    </TherapistStatsShell>
  )
}
