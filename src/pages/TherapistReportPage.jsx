import { useEffect, useMemo, useState } from 'react'
import { TherapistStatsShell } from '../components/TherapistStatsShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { MarkdownView } from '../lib/MarkdownView'
import { canAssignMission, canViewReport } from '../lib/childUtils'

const statusTabs = [
  { value: '', label: '전체' },
  { value: 'DRAFT', label: '초안' },
  { value: 'REVIEWED', label: '검토 완료' },
  { value: 'PUBLISHED', label: '발행됨' },
  { value: 'ARCHIVED', label: '아카이브' },
]

const reportTypeOptions = [
  { value: 'WEEKLY', label: '주간 리포트' },
  { value: 'MONTHLY', label: '월간 리포트' },
  { value: 'CUSTOM', label: '직접 작성' },
]

const statusLabelMap = { DRAFT: '초안', REVIEWED: '검토 완료', PUBLISHED: '발행됨', ARCHIVED: '아카이브' }
const statusColorMap = {
  DRAFT: 'bg-slate-100 text-slate-600',
  REVIEWED: 'bg-amber-50 text-amber-700',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  ARCHIVED: 'bg-slate-50 text-slate-400',
}

const emptyGenerateInput = {
  reportType: 'WEEKLY',
  title: '',
  request: '',
  topK: 5,
  similarityThreshold: 0.0,
  useProModel: false,
}

function fmt(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

function normalizePage(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  return []
}

function Card({ children, className = '' }) {
  return <section className={`stats-panel ${className}`}>{children}</section>
}

function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusColorMap[status] || 'bg-slate-100 text-slate-600'}`}>
      {statusLabelMap[status] || status}
    </span>
  )
}

/* ── 리포트 목록 카드 ── */
function ReportListItem({ report, onOpen }) {
  const typeLabel = reportTypeOptions.find(o => o.value === report.reportType)?.label || report.reportType
  return (
    <button
      className="report"
      onClick={onOpen}
      type="button"
    >
      <div className="r-head">
        <h3>{report.title}</h3>
        <StatusBadge status={report.status} />
      </div>
      <p className="r-meta">
        {typeLabel} · {fmtDate(report.publishedAt || report.createdAt)}
      </p>
      <p className="r-prev">{report.content}</p>
    </button>
  )
}

/* ── 리포트 뷰 모달 ── */
function ReportViewModal({ report, onClose, onEdit, onReview, onPublish, onArchive, submitting }) {
  if (!report) return null
  const typeLabel = reportTypeOptions.find(o => o.value === report.reportType)?.label || report.reportType

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge status={report.status} />
              <span className="text-[11px] text-slate-400">{typeLabel}</span>
            </div>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 leading-snug">{report.title}</h2>
            <p className="mt-1 text-xs text-slate-400">
              생성 {fmt(report.createdAt)}
              {report.reviewedAt ? ` · 검토 ${fmt(report.reviewedAt)}` : ''}
              {report.publishedAt ? ` · 발행 ${fmtDate(report.publishedAt)}` : ''}
            </p>
          </div>
          <button
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            type="button"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 — 마크다운 렌더 */}
        <div className="px-6 py-5">
          <MarkdownView content={report.content} />
        </div>

        {/* RAG 스냅샷 (개발용) */}
        {report.ragContextSnapshot ? (
          <details className="border-t border-slate-100 px-6 pb-3">
            <summary className="cursor-pointer py-2.5 text-[11px] font-bold text-slate-400 hover:text-slate-600">
              RAG 컨텍스트 보기 (개발용)
            </summary>
            <pre className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-slate-50 p-3 text-[10px] leading-5 text-slate-500 whitespace-pre-wrap">
              {report.ragContextSnapshot}
            </pre>
          </details>
        ) : null}

        {/* 액션 */}
        {report.status !== 'ARCHIVED' ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
            {report.status !== 'PUBLISHED' ? (
              <button
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                disabled={submitting}
                onClick={() => { onClose(); onArchive(report) }}
                type="button"
              >
                아카이브
              </button>
            ) : null}
            {report.status === 'DRAFT' ? (
              <button
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={submitting}
                onClick={() => { onClose(); onEdit(report) }}
                type="button"
              >
                수정
              </button>
            ) : null}
            {report.status === 'DRAFT' || report.status === 'REVIEWED' ? (
              <button
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                disabled={submitting}
                onClick={() => { onClose(); onReview(report) }}
                type="button"
              >
                검토 완료
              </button>
            ) : null}
            {report.status === 'REVIEWED' ? (
              <button
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={submitting}
                onClick={() => onPublish(report)}
                type="button"
              >
                {submitting ? '발행 중...' : '발행'}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="border-t border-slate-100 px-6 py-4 text-right">
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50" onClick={onClose} type="button">닫기</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── 수정 / 검토 모달 ── */
function EditModal({ report, mode, onCancel, onConfirm, submitting }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    setTitle(report?.title || '')
    setContent(report?.content || '')
  }, [report])

  if (!report) return null
  const isReview = mode === 'review'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-8">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <p className="text-xs font-black uppercase tracking-widest text-[var(--brand-500)]">
            {isReview ? '검토 완료 처리' : '리포트 수정'}
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
            {isReview ? '내용을 확인하고 검토 완료로 처리합니다' : '리포트 초안을 수정합니다'}
          </h2>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="block text-sm">
            <p className="mb-1 text-xs font-bold text-slate-500">제목</p>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              onChange={(e) => setTitle(e.target.value)}
              value={title}
            />
          </label>
          <label className="block text-sm">
            <p className="mb-1 text-xs font-bold text-slate-500">본문 (마크다운)</p>
            <textarea
              className="min-h-80 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6 font-mono"
              onChange={(e) => setContent(e.target.value)}
              value={content}
            />
          </label>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
            disabled={submitting}
            onClick={onCancel}
            type="button"
          >
            취소
          </button>
          <button
            className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--brand-600)] disabled:opacity-50"
            disabled={submitting}
            onClick={() => onConfirm(title, content)}
            type="button"
          >
            {submitting ? '처리 중...' : isReview ? '검토 완료 처리' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── 초안 생성 폼 ── */
function GenerateForm({ input, setInput, showAdvanced, setShowAdvanced, submitting, onGenerate }) {
  return (
    <Card>
      <div className="panel-head">
        <p>리포트 초안 생성</p>
        <span>아동 통계가 자동으로 포함됩니다. RAG로 관련 자료를 검색한 뒤 AI가 초안을 작성합니다.</span>
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <p className="mb-1 text-xs font-bold text-slate-500">리포트 유형</p>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(e) => setInput((p) => ({ ...p, reportType: e.target.value }))} value={input.reportType}>
              {reportTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <p className="mb-1 text-xs font-bold text-slate-500">제목 (선택 — 비우면 자동)</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(e) => setInput((p) => ({ ...p, title: e.target.value }))} placeholder="예: 5월 4주 주간 리포트" value={input.title} />
          </label>
        </div>

        <label className="block text-sm">
          <p className="mb-1 text-xs font-bold text-slate-500">작성 요청 <span className="text-rose-500">*</span></p>
          <textarea
            className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            onChange={(e) => setInput((p) => ({ ...p, request: e.target.value }))}
            placeholder="예: 이번 주 대화 세션과 표정 인식 결과를 바탕으로 주간 리포트를 작성해 주세요."
            value={input.request}
          />
        </label>

        <button className="child-pill" onClick={() => setShowAdvanced((v) => !v)} type="button">
          {showAdvanced ? '고급 설정 닫기' : '고급 설정'}
        </button>

        {showAdvanced ? (
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
            <label className="text-sm">
              <p className="mb-1 text-xs font-bold text-slate-500">참고 자료 개수</p>
              <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" min="1" max="20" onChange={(e) => setInput((p) => ({ ...p, topK: e.target.value }))} type="number" value={input.topK} />
            </label>
            <label className="text-sm">
              <p className="mb-1 text-xs font-bold text-slate-500">자료 관련도 기준</p>
              <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" max="1" min="0" onChange={(e) => setInput((p) => ({ ...p, similarityThreshold: e.target.value }))} step="0.01" type="number" value={input.similarityThreshold} />
            </label>
            <label className="text-sm">
              <p className="mb-1 text-xs font-bold text-slate-500">고급 모델 사용</p>
              <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(e) => setInput((p) => ({ ...p, useProModel: e.target.value === 'true' }))} value={String(input.useProModel)}>
                <option value="false">기본 모델</option>
                <option value="true">고급 모델</option>
              </select>
            </label>
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            className="rounded-xl bg-[var(--brand-500)] px-5 py-2.5 text-sm font-bold text-white hover:bg-[var(--brand-600)] disabled:opacity-50"
            disabled={submitting || !input.request.trim()}
            onClick={onGenerate}
            type="button"
          >
            {submitting ? 'AI 생성 중...' : '초안 생성'}
          </button>
        </div>
      </div>
    </Card>
  )
}

/* ── 메인 페이지 ── */
export function TherapistReportPage() {
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [reports, setReports] = useState([])
  const [pageTab, setPageTab] = useState('list')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewReport, setViewReport] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editMode, setEditMode] = useState('edit')
  const [generateInput, setGenerateInput] = useState(emptyGenerateInput)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const selectedChild = useMemo(() => children.find((c) => c.childId === selectedChildId) || null, [children, selectedChildId])
  const canReadSelectedReports = canViewReport(selectedChild)
  const canManageSelectedReports = canAssignMission(selectedChild)

  useEffect(() => {
    let ignore = false
    async function loadChildren() {
      if (!accessToken) { setLoading(false); return }
      try {
        const res = await apiFetch('/children/accessible', { method: 'GET', token: accessToken })
        const payload = extractApiPayload(res) || []
        const reportChildren = payload.filter((child) => canViewReport(child) || canAssignMission(child))
        if (!ignore) {
          setChildren(reportChildren)
          setSelectedChildId(reportChildren[0]?.childId || null)
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

  async function loadReports(preferredId) {
    if (!accessToken || !selectedChildId) return
    if (selectedChild && !canViewReport(selectedChild)) {
      setReports([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const query = statusFilter ? `?status=${statusFilter}&size=50` : '?size=50'
      const res = await apiFetch(`/therapist/children/${selectedChildId}/reports${query}`, { method: 'GET', token: accessToken })
      const list = normalizePage(extractApiPayload(res))
      setReports(list)
      setFeedback('')
      if (preferredId) {
        const fresh = list.find(r => r.reportId === preferredId) || null
        if (fresh) setViewReport(fresh)
      }
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedChildId, statusFilter, selectedChild])

  async function handleGenerate() {
    if (!selectedChildId || !canManageSelectedReports || !generateInput.request.trim()) return
    setSubmitting(true)
    setFeedback('')
    try {
      const body = {
        childId: selectedChildId,
        reportType: generateInput.reportType,
        title: generateInput.title || null,
        request: generateInput.request,
        topK: Number(generateInput.topK) || 5,
        similarityThreshold: Number(generateInput.similarityThreshold) || 0.0,
        useProModel: generateInput.useProModel,
      }
      const res = await apiFetch('/therapist/reports/drafts/generate', { method: 'POST', token: accessToken, body })
      const created = extractApiPayload(res)
      setGenerateInput(emptyGenerateInput)
      setPageTab('list')
      setStatusFilter('')
      await loadReports(created?.reportId)
      setFeedback('리포트 초안이 생성되었습니다. 클릭해서 내용을 확인하세요.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditConfirm(title, content) {
    if (!selectedChildId || !canManageSelectedReports || !editTarget) return
    setSubmitting(true)
    try {
      const url = editMode === 'review'
        ? `/therapist/children/${selectedChildId}/reports/${editTarget.reportId}/review`
        : `/therapist/children/${selectedChildId}/reports/${editTarget.reportId}`
      const res = await apiFetch(url, { method: 'PATCH', token: accessToken, body: { title, content } })
      const updated = extractApiPayload(res)
      setEditTarget(null)
      await loadReports(updated?.reportId)
      setFeedback(editMode === 'review' ? '검토 완료로 처리되었습니다.' : '리포트가 저장되었습니다.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePublish(report) {
    if (!selectedChildId || !canManageSelectedReports) return
    setSubmitting(true)
    try {
      const res = await apiFetch(`/therapist/children/${selectedChildId}/reports/${report.reportId}/publish`, { method: 'PATCH', token: accessToken })
      const updated = extractApiPayload(res)
      setViewReport(null)
      await loadReports(updated?.reportId)
      setFeedback('리포트가 발행되었습니다. 보호자에게 알림이 전송됩니다.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleArchive(report) {
    if (!selectedChildId || !canManageSelectedReports) return
    if (!window.confirm('이 리포트를 아카이브하면 보호자에게 표시되지 않습니다. 계속하시겠습니까?')) return
    setSubmitting(true)
    try {
      await apiFetch(`/therapist/children/${selectedChildId}/reports/${report.reportId}/archive`, { method: 'PATCH', token: accessToken })
      setViewReport(null)
      await loadReports(null)
      setFeedback('리포트가 아카이브되었습니다.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  function openEdit(report) {
    setEditMode('edit')
    setEditTarget(report)
  }

  function openReview(report) {
    setEditMode('review')
    setEditTarget(report)
  }

  return (
    <TherapistStatsShell activeId="reports" subtitle="AI/RAG 기반 리포트를 생성하고 검토, 발행합니다." title="리포트 관리">
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
        {[
          { id: 'list', label: '리포트 목록', disabled: !canReadSelectedReports },
          { id: 'generate', label: '초안 생성', disabled: !canManageSelectedReports },
        ].map((tab) => (
          <button className={`child-pill ${pageTab === tab.id ? 'active' : ''}`} disabled={tab.disabled} key={tab.id} onClick={() => setPageTab(tab.id)} type="button">
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? <div className="stats-loading">리포트를 불러오는 중입니다...</div> : null}

      {!loading && pageTab === 'list' && !canReadSelectedReports ? (
        <Card className="mt-4">
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
            선택한 아동의 리포트 조회 권한이 없습니다.
          </div>
        </Card>
      ) : null}

      {!loading && pageTab === 'list' && canReadSelectedReports ? (
        <Card className="mt-4">
          <div className="panel-head">
            <p>리포트 목록</p>
            <span>총 {reports.length}건</span>
          </div>

          <div className="child-selector mt-3">
            {statusTabs.map((tab) => (
              <button className={`child-pill ${statusFilter === tab.value ? 'active' : ''}`} key={tab.value || 'all'} onClick={() => setStatusFilter(tab.value)} type="button">
                {tab.label}
              </button>
            ))}
          </div>

          {reports.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              {selectedChildId ? '해당 조건의 리포트가 없습니다.' : '아동을 선택하세요.'}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {reports.map((report) => (
                <ReportListItem key={report.reportId} report={report} onOpen={() => setViewReport(report)} />
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {!loading && pageTab === 'generate' && canManageSelectedReports ? (
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

      <ReportViewModal
        onArchive={handleArchive}
        onClose={() => setViewReport(null)}
        onEdit={openEdit}
        onPublish={handlePublish}
        onReview={openReview}
        report={viewReport}
        submitting={submitting}
      />

      <EditModal
        mode={editMode}
        onCancel={() => setEditTarget(null)}
        onConfirm={handleEditConfirm}
        report={editTarget}
        submitting={submitting}
      />
    </TherapistStatsShell>
  )
}
