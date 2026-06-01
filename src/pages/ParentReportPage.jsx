import { useEffect, useMemo, useState } from 'react'
import { ParentShell } from '../components/ParentShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { MarkdownView } from '../lib/MarkdownView'
import { PinVerifyModal } from '../lib/PinVerifyModal'
import { canViewReport } from '../lib/childUtils'

const reportTypeLabels = {
  WEEKLY: '주간 리포트',
  MONTHLY: '월간 리포트',
  CUSTOM: '리포트',
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

/* ── 목록 카드 ── */
function ReportListItem({ report, onOpen }) {
  const typeLabel = reportTypeLabels[report.reportType] || report.reportType
  return (
    <button
      className="report"
      onClick={onOpen}
      type="button"
    >
      <div className="r-head">
        <h3>{report.title}</h3>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">발행됨</span>
      </div>
      <p className="r-meta">
        {typeLabel} · {fmtDate(report.publishedAt || report.createdAt)}
      </p>
      <p className="r-prev">{report.content}</p>
    </button>
  )
}

/* ── 뷰 모달 ── */
function ReportViewModal({ report, onClose }) {
  if (!report) return null
  const typeLabel = reportTypeLabels[report.reportType] || report.reportType

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">발행됨</span>
            <span className="ml-2 text-[11px] text-slate-400">{typeLabel}</span>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 leading-snug">{report.title}</h2>
            <p className="mt-1 text-xs text-slate-400">발행일 {fmtDate(report.publishedAt || report.createdAt)}</p>
          </div>
          <button
            aria-label="닫기"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        {/* 본문 — 마크다운 렌더 */}
        <div className="px-6 py-6">
          <MarkdownView content={report.content} />
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button
            className="rounded-xl bg-[var(--brand-500)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--brand-600)]"
            onClick={onClose}
            type="button"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── 메인 페이지 ── */
export function ParentReportPage() {
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [reports, setReports] = useState([])
  const [viewReport, setViewReport] = useState(null)
  const [pinGate, setPinGate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')

  const selectedChild = useMemo(() => children.find((c) => c.childId === selectedChildId) || null, [children, selectedChildId])

  function openReport(report) {
    if (selectedChild?.pinEnabled) {
      setPinGate({ childId: selectedChild.childId, childName: selectedChild.name, onVerified: () => { setPinGate(null); setViewReport(report) } })
    } else {
      setViewReport(report)
    }
  }

  useEffect(() => {
    let ignore = false
    async function loadChildren() {
      if (!accessToken) { setLoading(false); return }
      try {
        const res = await apiFetch('/children/accessible', { method: 'GET', token: accessToken })
        const raw = extractApiPayload(res) || []
        const list = (Array.isArray(raw) ? raw : (raw?.content || [])).filter(canViewReport)
        if (!ignore) {
          setChildren(list)
          setSelectedChildId(list[0]?.childId || null)
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
    async function loadReports() {
      if (!accessToken || !selectedChildId) return
      setLoading(true)
      try {
        const res = await apiFetch(`/parent/children/${selectedChildId}/reports?size=50`, { method: 'GET', token: accessToken })
        const list = normalizePage(extractApiPayload(res))
        if (!ignore) {
          setReports(list)
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    loadReports()
    return () => { ignore = true }
  }, [accessToken, selectedChildId])

  return (
    <ParentShell childCount={children.length} heading="리포트" selectedChild={selectedChild} subheading="치료사가 발행한 리포트를 확인합니다.">
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      {children.length > 1 ? (
        <Card className="mt-4">
          <div className="panel-head">
            <p>자녀 선택</p>
            <span>{selectedChild?.name || '-'}</span>
          </div>
          <div className="child-selector mt-4">
            {children.map((child) => (
              <button className={`child-pill ${selectedChildId === child.childId ? 'active' : ''}`} key={child.childId} onClick={() => setSelectedChildId(child.childId)} type="button">{child.name}</button>
            ))}
          </div>
        </Card>
      ) : null}

      {loading ? <div className="stats-loading">리포트를 불러오는 중입니다...</div> : null}

      {!loading && reports.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
          <p className="text-sm font-semibold text-slate-600">아직 발행된 리포트가 없어요.</p>
          <p className="mt-1 text-xs text-slate-400">치료사가 리포트를 발행하면 이곳에 표시됩니다.</p>
        </div>
      ) : null}

      {!loading && reports.length > 0 ? (
        <Card className="mt-4">
          <div className="panel-head">
            <p>발행된 리포트</p>
            <span>총 {reports.length}건</span>
          </div>
          <div className="mt-4 space-y-2">
            {reports.map((report) => (
              <ReportListItem key={report.reportId} onOpen={() => openReport(report)} report={report} />
            ))}
          </div>
        </Card>
      ) : null}

      <ReportViewModal onClose={() => setViewReport(null)} report={viewReport} />

      {pinGate ? (
        <PinVerifyModal
          accessToken={accessToken}
          childId={pinGate.childId}
          childName={pinGate.childName}
          onClose={() => setPinGate(null)}
          onVerified={pinGate.onVerified}
        />
      ) : null}
    </ParentShell>
  )
}
