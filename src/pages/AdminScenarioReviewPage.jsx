import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminSidebarNav } from '../components/AdminSidebarNav'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

const statusOptions = [
  { value: '', label: '전체' },
  { value: 'DRAFT', label: '초안' },
  { value: 'PUBLISHED', label: '배포됨' },
  { value: 'REJECTED', label: '반려' },
  { value: 'ARCHIVED', label: '보관됨' },
]

const sourceOptions = [
  { value: '', label: '전체' },
  { value: 'SERVER_LLM', label: 'SERVER_LLM' },
  { value: 'UNITY_LOCAL', label: 'UNITY_LOCAL' },
]

const statusLabelMap = {
  DRAFT: '초안',
  PUBLISHED: '배포됨',
  REJECTED: '반려',
  ARCHIVED: '보관됨',
}

const statusClassMap = {
  DRAFT: 'bg-blue-50 text-blue-700 border-blue-100',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-100',
  ARCHIVED: 'bg-slate-100 text-slate-700 border-slate-200',
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function normalizePage(payload) {
  return {
    content: Array.isArray(payload?.content) ? payload.content : [],
    page: payload?.page ?? 0,
    size: payload?.size ?? 20,
    totalElements: payload?.totalElements ?? 0,
    totalPages: payload?.totalPages ?? 0,
    last: Boolean(payload?.last),
  }
}

function statusBadge(status) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClassMap[status] || statusClassMap.DRAFT}`}>
      {statusLabelMap[status] || status || '-'}
    </span>
  )
}

function readScenarioId(item) {
  return item?.scenario_id || item?.scenarioId
}

function ScenarioDetail({ detail, loading, openTurns, toggleTurn, onOpenStatus }) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">상세 정보를 불러오는 중입니다...</div>
  }

  if (!detail) {
    return <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">목록에서 시나리오를 선택하세요.</div>
  }

  const metadata = detail.metadata || {}
  const cast = detail.cast || {}
  const turns = Array.isArray(detail.dialogue_flow) ? detail.dialogue_flow : detail.dialogueFlow || []

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-400">scenario_id</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{detail.scenario_id || detail.scenarioId}</h2>
          </div>
          <button className="rounded-xl bg-[var(--brand-500)] px-3 py-2 text-sm font-bold text-white" onClick={() => onOpenStatus(detail)} type="button">
            상태 변경
          </button>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <p>상태: {statusBadge(detail.approval_status || detail.approvalStatus)}</p>
          <p>출처: {detail.source || '-'}</p>
          <p>주차: {metadata.week ?? '-'}</p>
          <p>테마: {metadata.theme || '-'}</p>
          <p>로비 제목: {metadata.lobby_title || metadata.lobbyTitle || '-'}</p>
          <p>배경 이미지: {metadata.background_image_id || metadata.backgroundImageId || '-'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-black text-slate-900">Cast</p>
        <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <p>main_character: {cast.main_character || cast.mainCharacter || '-'}</p>
          <p>main_char_pos: {cast.main_char_pos || cast.mainCharPos || '-'}</p>
          <p>sub_characters: {cast.sub_characters || cast.subCharacters || '-'}</p>
          <p>sub_char_pos: {cast.sub_char_pos || cast.subCharPos || '-'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-black text-slate-900">Metadata</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>relationship_stage: {metadata.relationship_stage || metadata.relationshipStage || '-'}</p>
          <p className="whitespace-pre-wrap">scenario_seed: {metadata.scenario_seed || metadata.scenarioSeed || '-'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-slate-900">Dialogue Flow</p>
          <span className="text-xs font-bold text-slate-400">{turns.length} turns</span>
        </div>
        <div className="mt-3 space-y-2">
          {turns.map((turn, index) => {
            const key = turn.turn_id ?? turn.turnId ?? index
            const open = Boolean(openTurns[key])
            const options = Array.isArray(turn.options) ? turn.options : []
            return (
              <div className="rounded-xl border border-slate-200" key={key}>
                <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => toggleTurn(key)} type="button">
                  <span className="text-sm font-bold text-slate-900">Turn {turn.turn_id ?? turn.turnId ?? index + 1}</span>
                  <span className="text-xs text-slate-500">{options.length} options · {open ? '접기' : '열기'}</span>
                </button>
                {open ? (
                  <div className="border-t border-slate-200 px-4 py-3">
                    <p className="text-xs font-bold text-slate-400">internal_monologue</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{turn.internal_monologue || turn.internalMonologue || '-'}</p>
                    <p className="mt-3 text-xs font-bold text-slate-400">npc_utterance</p>
                    <ul className="mt-1 space-y-1 text-sm text-slate-700">
                      {(turn.npc_utterance || turn.npcUtterance || []).map((line, idx) => <li key={`${key}-npc-${idx}`}>{line}</li>)}
                    </ul>
                    <div className="mt-4 space-y-3">
                      {options.map((option, optionIndex) => (
                        <div className="rounded-xl bg-slate-50 p-3" key={`${key}-option-${optionIndex}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-700">score {option.score ?? '-'}</span>
                            <span className="text-xs font-bold text-slate-400">option {optionIndex + 1}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-900">{option.text || '-'}</p>
                          <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">feedback: {option.feedback || '-'}</p>
                          <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">peers_logic: {option.peers_logic || option.peersLogic || '-'}</p>
                          {(option.npc_reaction || option.npcReaction || []).length ? (
                            <ul className="mt-2 space-y-1 text-xs text-slate-600">
                              {(option.npc_reaction || option.npcReaction).map((line, idx) => <li key={`${key}-reaction-${optionIndex}-${idx}`}>{line}</li>)}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-black text-slate-900">Final Summary</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{detail.final_summary?.total_learning_point || detail.finalSummary?.totalLearningPoint || '-'}</p>
      </div>
    </div>
  )
}

function StatusModal({ target, nextStatus, reviewNote, setNextStatus, setReviewNote, submitting, onClose, onConfirm }) {
  if (!target) return null
  const currentStatus = target.approval_status || target.approvalStatus

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-500)]">상태 변경 확인</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">{readScenarioId(target)}</h2>
        <p className="mt-2 text-sm text-slate-500">현재 상태 {statusLabelMap[currentStatus] || currentStatus || '-'}에서 새 상태로 변경합니다.</p>

        <label className="mt-4 block text-sm">
          <p className="mb-1 text-xs font-bold text-slate-500">변경 상태</p>
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(event) => setNextStatus(event.target.value)} value={nextStatus}>
            {statusOptions.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        {nextStatus === 'PUBLISHED' ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            PUBLISHED로 변경하면 Unity에 노출될 수 있습니다. 배포 전 내용을 다시 확인해 주세요.
          </div>
        ) : null}

        <label className="mt-4 block text-sm">
          <p className="mb-1 text-xs font-bold text-slate-500">review_note</p>
          <textarea className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(event) => setReviewNote(event.target.value)} placeholder="예: 검수 완료" value={reviewNote} />
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50" disabled={submitting} onClick={onClose} type="button">취소</button>
          <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={submitting} onClick={onConfirm} type="button">{submitting ? '변경 중...' : '변경'}</button>
        </div>
      </div>
    </div>
  )
}

export function AdminScenarioReviewPage() {
  const navigate = useNavigate()
  const { accessToken, logout } = useAuth()
  const [filters, setFilters] = useState({ status: 'DRAFT', source: '', week: '', keyword: '', size: 20 })
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [page, setPage] = useState(0)
  const [pageData, setPageData] = useState(normalizePage(null))
  const [selectedRow, setSelectedRow] = useState(null)
  const [detail, setDetail] = useState(null)
  const [openTurns, setOpenTurns] = useState({})
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [statusTarget, setStatusTarget] = useState(null)
  const [nextStatus, setNextStatus] = useState('PUBLISHED')
  const [reviewNote, setReviewNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const params = useMemo(() => {
    const query = new URLSearchParams()
    if (filters.status) query.set('status', filters.status)
    if (filters.source) query.set('source', filters.source)
    if (filters.week) query.set('week', filters.week)
    if (debouncedKeyword) query.set('keyword', debouncedKeyword)
    query.set('page', String(page))
    query.set('size', String(filters.size))
    query.set('sort', 'updatedAt,desc')
    return query.toString()
  }, [filters, debouncedKeyword, page])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedKeyword(filters.keyword.trim())
      setPage(0)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [filters.keyword])

  async function loadList() {
    setLoading(true)
    try {
      const res = await apiFetch(`/admin/scenarios?${params}`, { method: 'GET', token: accessToken })
      const payload = normalizePage(extractApiPayload(res))
      setPageData(payload)
      setFeedback('')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (accessToken) loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, params])

  async function loadDetail(row) {
    const id = readScenarioId(row)
    if (!id) return
    setSelectedRow(row)
    setDetailLoading(true)
    setOpenTurns({})
    try {
      const res = await apiFetch(`/admin/scenarios/${encodeURIComponent(id)}`, { method: 'GET', token: accessToken })
      setDetail(extractApiPayload(res))
      setFeedback('')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setDetailLoading(false)
    }
  }

  function openStatusModal(target) {
    const currentStatus = target.approval_status || target.approvalStatus
    setStatusTarget(target)
    setNextStatus(currentStatus === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED')
    setReviewNote('')
  }

  async function handleStatusChange() {
    const id = readScenarioId(statusTarget)
    if (!id || !nextStatus) return
    setSubmitting(true)
    try {
      await apiFetch(`/admin/scenarios/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          approval_status: nextStatus,
          review_note: reviewNote || null,
        },
      })
      const previous = statusTarget.approval_status || statusTarget.approvalStatus
      setFeedback(`${id}: ${statusLabelMap[previous] || previous} → ${statusLabelMap[nextStatus] || nextStatus} 변경 완료`)
      setStatusTarget(null)
      await loadList()
      await loadDetail({ scenario_id: id })
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[var(--app-canvas)] text-slate-900">
      <div className="grid min-h-screen grid-cols-1 grid-rows-[64px_1fr] lg:grid-cols-[320px_1fr] lg:grid-rows-[64px_1fr]">
        <header className="col-span-full flex items-center border-b border-slate-200 bg-white px-5">
          <p className="text-lg font-black text-slate-900">My Expression Friend</p>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggleButton />
            <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm" onClick={handleLogout} type="button">로그아웃</button>
          </div>
        </header>

        <AdminSidebarNav activeId="scenario-review" />

        <main className="min-w-0 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950">시나리오 검수</h1>
              <p className="mt-2 text-sm text-slate-500">목록을 훑고 상세를 확인한 뒤 상태를 변경합니다.</p>
            </div>
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700" disabled={loading} onClick={loadList} type="button">새로고침</button>
          </div>

          {feedback ? <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{feedback}</div> : null}

          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-5">
              <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(event) => { setFilters((prev) => ({ ...prev, status: event.target.value })); setPage(0) }} value={filters.status}>
                {statusOptions.map((item) => <option key={item.value || 'all-status'} value={item.value}>{item.label}</option>)}
              </select>
              <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(event) => { setFilters((prev) => ({ ...prev, source: event.target.value })); setPage(0) }} value={filters.source}>
                {sourceOptions.map((item) => <option key={item.value || 'all-source'} value={item.value}>{item.label}</option>)}
              </select>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" max="16" min="1" onChange={(event) => { setFilters((prev) => ({ ...prev, week: event.target.value })); setPage(0) }} placeholder="주차" type="number" value={filters.week} />
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-1" onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))} placeholder="scenario_id / theme / character 검색" value={filters.keyword} />
              <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(event) => { setFilters((prev) => ({ ...prev, size: Number(event.target.value) })); setPage(0) }} value={filters.size}>
                <option value={20}>20개</option>
                <option value={50}>50개</option>
              </select>
            </div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-black text-slate-900">시나리오 목록</p>
                <span className="text-xs font-bold text-slate-400">{pageData.totalElements}건</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-3">scenario_id</th>
                      <th className="px-3 py-3">week</th>
                      <th className="px-3 py-3">theme</th>
                      <th className="px-3 py-3">main_character</th>
                      <th className="px-3 py-3">source</th>
                      <th className="px-3 py-3">approval_status</th>
                      <th className="px-3 py-3">updated_at</th>
                      <th className="px-3 py-3">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={8}>불러오는 중...</td></tr>
                    ) : pageData.content.length ? pageData.content.map((row) => {
                      const id = readScenarioId(row)
                      const selected = id && id === readScenarioId(selectedRow)
                      return (
                        <tr className={`border-t border-slate-100 ${selected ? 'bg-[var(--brand-50)]' : 'hover:bg-slate-50'}`} key={id}>
                          <td className="px-3 py-3">
                            <button className="font-bold text-slate-950" onClick={() => loadDetail(row)} type="button">{id}</button>
                          </td>
                          <td className="px-3 py-3">{row.week ?? '-'}</td>
                          <td className="px-3 py-3">{row.theme || '-'}</td>
                          <td className="px-3 py-3">{row.main_character || row.mainCharacter || '-'}</td>
                          <td className="px-3 py-3">{row.source || '-'}</td>
                          <td className="px-3 py-3">{statusBadge(row.approval_status || row.approvalStatus)}</td>
                          <td className="px-3 py-3">{formatDateTime(row.updated_at || row.updatedAt)}</td>
                          <td className="px-3 py-3">
                            <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-bold text-slate-700" onClick={() => openStatusModal(row)} type="button">상태</button>
                          </td>
                        </tr>
                      )
                    }) : (
                      <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={8}>조건에 맞는 시나리오가 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
                <button className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40" disabled={page <= 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button">이전</button>
                <span className="text-slate-500">{pageData.page + 1} / {Math.max(pageData.totalPages, 1)}</span>
                <button className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40" disabled={pageData.last || loading} onClick={() => setPage((value) => value + 1)} type="button">다음</button>
              </div>
            </div>

            <aside className="max-h-[calc(100vh-180px)] overflow-y-auto">
              <ScenarioDetail
                detail={detail}
                loading={detailLoading}
                onOpenStatus={openStatusModal}
                openTurns={openTurns}
                toggleTurn={(key) => setOpenTurns((prev) => ({ ...prev, [key]: !prev[key] }))}
              />
            </aside>
          </section>
        </main>
      </div>

      <StatusModal
        nextStatus={nextStatus}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleStatusChange}
        reviewNote={reviewNote}
        setNextStatus={setNextStatus}
        setReviewNote={setReviewNote}
        submitting={submitting}
        target={statusTarget}
      />
    </div>
  )
}
