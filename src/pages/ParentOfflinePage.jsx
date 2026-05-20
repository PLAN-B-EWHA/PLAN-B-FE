import { useEffect, useMemo, useState } from 'react'
import { ParentShell } from '../components/ParentShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

const completionOptions = [
  { value: 'DONE', label: '완료' },
  { value: 'PARTIAL', label: '일부 완료' },
  { value: 'NOT_DONE', label: '못함' },
]

const initiationOptions = [
  { value: 'CHILD_INITIATED', label: '아이가 먼저' },
  { value: 'AFTER_HINT', label: '힌트 후' },
  { value: 'PARENT_PROMPTED', label: '부모 유도' },
]

const defaultReport = {
  completionStatus: 'DONE',
  initiationType: 'CHILD_INITIATED',
  observation: '',
  peerResponse: '',
  naturalAttempt: false,
}

function statusLabel(status) {
  if (status === 'SUBMITTED') return '제출 완료'
  if (status === 'REVIEWED' || status === 'DONE') return '검토 완료'
  return '진행 전'
}

function missionCardData(item) {
  return {
    homeworkId: item?.homeworkId || item?.id,
    weekNumber: item?.weekNumber || item?.week || '-',
    title: item?.title || item?.missionTitle || '이번 주 오프라인 미션',
    situationExample: item?.situationExample || item?.exampleSituation || item?.strategyTip || '-',
    parentInstruction: item?.parentInstruction || item?.instructionForParent || item?.missionInstruction || '-',
    observationPoint: item?.observationPoint || item?.observationGuide || '-',
    dueDate: item?.dueDate || item?.deadline || '-',
    status: item?.status || 'PENDING',
  }
}

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeHomeworkList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.homeworks)) return payload.homeworks
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function renderInlineBold(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
    }
    return <span key={`${part}-${index}`}>{part}</span>
  })
}

function PrettyMissionText({ text }) {
  const normalized = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/---+/g, '\n')
    .trim()

  if (!normalized) return <p className="text-sm text-slate-500">-</p>

  const chunks = normalized
    .split(/(?=###\s+)/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  return (
    <div className="space-y-3">
      {chunks.map((chunk, idx) => {
        if (chunk.startsWith('###')) {
          const content = chunk.replace(/^###\s*/, '')
          const lines = content.split('\n').map((line) => line.trim()).filter(Boolean)
          const title = lines[0] || ''
          const body = lines.slice(1)
          return (
            <div key={`section-${idx}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-sm font-semibold text-slate-900">{renderInlineBold(title)}</p>
              {body.length ? (
                <div className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
                  {body.map((line, lineIdx) => <p key={`line-${idx}-${lineIdx}`}>{renderInlineBold(line)}</p>)}
                </div>
              ) : null}
            </div>
          )
        }

        const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean)
        return (
          <div key={`plain-${idx}`} className="space-y-1 text-sm leading-6 text-slate-700">
            {lines.map((line, lineIdx) => <p key={`plain-line-${idx}-${lineIdx}`}>{renderInlineBold(line)}</p>)}
          </div>
        )
      })}
    </div>
  )
}

export function ParentOfflinePage() {
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [missions, setMissions] = useState([])
  const [reportForm, setReportForm] = useState(defaultReport)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const selectedChild = useMemo(() => children.find((c) => c.childId === selectedChildId) || children[0] || null, [children, selectedChildId])

  const currentMission = useMemo(() => {
    if (!missions.length) return null
    const pending = missions.find((item) => item.status === 'PENDING')
    return missionCardData(pending || missions[0])
  }, [missions])

  useEffect(() => {
    let ignore = false
    async function loadChildren() {
      if (!accessToken) return
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
    async function loadMissions() {
      if (!accessToken || !selectedChildId) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const [pendingRes, submittedRes, reviewedRes, allRes] = await Promise.all([
          apiFetch(`/parent/children/${selectedChildId}/homework?status=PENDING`, { method: 'GET', token: accessToken }),
          apiFetch(`/parent/children/${selectedChildId}/homework?status=SUBMITTED`, { method: 'GET', token: accessToken }),
          apiFetch(`/parent/children/${selectedChildId}/homework?status=REVIEWED`, { method: 'GET', token: accessToken }),
          apiFetch(`/parent/children/${selectedChildId}/homework`, { method: 'GET', token: accessToken }),
        ])
        const pending = normalizeHomeworkList(extractApiPayload(pendingRes))
        const submitted = normalizeHomeworkList(extractApiPayload(submittedRes))
        const reviewed = normalizeHomeworkList(extractApiPayload(reviewedRes))
        const all = normalizeHomeworkList(extractApiPayload(allRes))
        const merged = [...pending, ...submitted, ...reviewed]
        const source = merged.length ? merged : all
        const deduped = Array.from(new Map(source.map((item) => [item?.homeworkId || item?.id || JSON.stringify(item), item])).values())
        if (!ignore) {
          setMissions(deduped)
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
  }, [accessToken, selectedChildId])

  async function handleSubmitReport() {
    if (!currentMission?.homeworkId || !selectedChildId) return
    setSubmitting(true)
    setFeedback('')
    try {
      await apiFetch(`/parent/children/${selectedChildId}/homework/${currentMission.homeworkId}/reports`, {
        method: 'POST',
        token: accessToken,
        body: {
          completionStatus: reportForm.completionStatus,
          initiationType: reportForm.initiationType,
          observation: reportForm.observation,
          peerResponse: reportForm.peerResponse,
          naturalAttempt: reportForm.naturalAttempt,
        },
      })
      setFeedback('관찰 기록을 제출했습니다.')
      setReportForm(defaultReport)
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ParentShell childCount={children.length} heading="오프라인 미션" selectedChild={selectedChild} subheading="이번 주에 집에서 해볼 미션과 관찰 기록">
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      <section className="stats-panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><p>학생 선택</p></div>
        <div className="child-selector">
          {children.map((child) => (
            <button className={`child-pill ${selectedChildId === child.childId ? 'active' : ''}`} key={child.childId} onClick={() => setSelectedChildId(child.childId)} type="button">{child.name}</button>
          ))}
        </div>
      </section>

      {loading ? <div className="stats-loading">미션을 불러오는 중입니다...</div> : null}

      {!loading && currentMission ? (
        <>
          <section className="stats-panel" style={{ marginTop: 16 }}>
            <div className="panel-head"><p>이번 주 오프라인 미션</p></div>
            <div className="rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] p-4">
              <p className="text-sm font-semibold text-slate-900">{currentMission.title} (W{currentMission.weekNumber})</p>
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-slate-500">해야 할 상황 예시</p>
                <PrettyMissionText text={currentMission.situationExample} />
              </div>
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-slate-500">부모가 해줄 말</p>
                <PrettyMissionText text={currentMission.parentInstruction} />
              </div>
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-slate-500">관찰 포인트</p>
                <PrettyMissionText text={currentMission.observationPoint} />
              </div>
              <p className="mt-2 text-xs text-slate-500">마감일: {currentMission.dueDate} · 상태: {statusLabel(currentMission.status)}</p>
            </div>
          </section>

          <section className="stats-panel" style={{ marginTop: 16 }}>
            <div className="panel-head"><p>관찰 기록 작성</p></div>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">완료 여부</p>
                <div className="child-selector">
                  {completionOptions.map((option) => (
                    <button className={`child-pill ${reportForm.completionStatus === option.value ? 'active' : ''}`} key={option.value} onClick={() => setReportForm((prev) => ({ ...prev, completionStatus: option.value }))} type="button">{option.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">시작 방식</p>
                <div className="child-selector">
                  {initiationOptions.map((option) => (
                    <button className={`child-pill ${reportForm.initiationType === option.value ? 'active' : ''}`} key={option.value} onClick={() => setReportForm((prev) => ({ ...prev, initiationType: option.value }))} type="button">{option.label}</button>
                  ))}
                </div>
              </div>

              <textarea className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setReportForm((prev) => ({ ...prev, observation: e.target.value }))} placeholder="관찰 내용" value={reportForm.observation} />
              <textarea className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setReportForm((prev) => ({ ...prev, peerResponse: e.target.value }))} placeholder="또래 반응" value={reportForm.peerResponse} />

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input checked={reportForm.naturalAttempt} onChange={(e) => setReportForm((prev) => ({ ...prev, naturalAttempt: e.target.checked }))} type="checkbox" />
                아이가 자연스럽게 시도했어요
              </label>

              <div className="flex justify-end">
                <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-white" disabled={submitting} onClick={handleSubmitReport} type="button">{submitting ? '제출 중...' : '제출하기'}</button>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {!loading && !currentMission ? <div className="stats-panel" style={{ marginTop: 16 }}>현재 표시할 미션이 없습니다.</div> : null}
    </ParentShell>
  )
}
