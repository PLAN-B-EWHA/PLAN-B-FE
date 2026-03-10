import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import FeedbackBanner from '../components/FeedbackBanner'
import PaginationBar from '../components/PaginationBar'
import {
  accessibleChildrenRequest,
  generateTestReportRequest,
  myReportsRequest,
  reportDetailRequest,
  reportExportBlobRequest,
  reportPreferenceRequest,
  updateReportPreferenceRequest,
} from '../api'
import { useAuth } from '../contexts/AuthContext'
import { KO } from '../constants/messages.ko'
import { resolveErrorMessage } from '../utils/errorMessage'

function ReportsPage() {
  const { withAuthRetry } = useAuth()
  const t = KO.reports
  const [searchParams, setSearchParams] = useSearchParams()

  const [preference, setPreference] = useState(null)
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [children, setChildren] = useState([])
  const [reportsPage, setReportsPage] = useState(0)
  const [reportsSize, setReportsSize] = useState(10)
  const [reportsTotalPages, setReportsTotalPages] = useState(0)
  const [reportsTotalElements, setReportsTotalElements] = useState(0)

  const [enabled, setEnabled] = useState(false)
  const [scheduleType, setScheduleType] = useState('WEEKLY')
  const [deliveryTime, setDeliveryTime] = useState('09:00')
  const [timezone, setTimezone] = useState('Asia/Seoul')
  const [modelName, setModelName] = useState('default')
  const [maxTokens, setMaxTokens] = useState(1200)
  const [promptTemplate, setPromptTemplate] = useState('')
  const [targetChildId, setTargetChildId] = useState('')

  const [generatePrompt, setGeneratePrompt] = useState('')
  const [generateMaxTokens, setGenerateMaxTokens] = useState('')
  const [generateChildId, setGenerateChildId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [showPreferencePanel, setShowPreferencePanel] = useState(true)
  const [showGeneratePanel, setShowGeneratePanel] = useState(true)
  const [exportingKey, setExportingKey] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadPreference = async (childListParam) => {
    const response = await withAuthRetry((token) => reportPreferenceRequest(token))
    const data = response?.data
    setPreference(data)
    setEnabled(Boolean(data?.enabled))
    setScheduleType(data?.scheduleType || 'WEEKLY')
    setDeliveryTime((data?.deliveryTime || '09:00').slice(0, 5))
    setTimezone(data?.timezone || 'Asia/Seoul')
    setModelName(data?.modelName || 'default')
    setMaxTokens(data?.maxTokens || 1200)
    setPromptTemplate(data?.promptTemplate || '')

    const childList = childListParam || children
    const prefTarget = data?.targetChildId || ''
    if (prefTarget) {
      setTargetChildId(prefTarget)
      setGenerateChildId(prefTarget)
    } else if (childList.length > 0) {
      setTargetChildId(childList[0].childId)
      setGenerateChildId(childList[0].childId)
    } else {
      setTargetChildId('')
      setGenerateChildId('')
    }
  }

  const loadReports = async (page = reportsPage, size = reportsSize) => {
    const response = await withAuthRetry((token) => myReportsRequest(token, page, size))
    const data = response?.data || {}
    setReports(data?.content || [])
    setReportsTotalPages(data?.totalPages || 0)
    setReportsTotalElements(data?.totalElements || 0)
  }

  const loadChildren = async () => {
    const response = await withAuthRetry((token) => accessibleChildrenRequest(token))
    const list = response?.data || []
    setChildren(list)
    return list
  }

  const loadInitial = async () => {
    setLoading(true)
    setError('')
    try {
      const [childList] = await Promise.all([loadChildren(), loadReports(reportsPage, reportsSize)])
      await loadPreference(childList)
    } catch (e) {
      setError(resolveErrorMessage(e, t.loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitial()
  }, [])

  useEffect(() => {
    loadReports(reportsPage, reportsSize)
  }, [reportsPage, reportsSize])

  useEffect(() => {
    const reportId = searchParams.get('reportId')
    if (!reportId) return
    if (selectedReport?.reportId === reportId) return

    openDetail(reportId)
  }, [searchParams])

  const savePreference = async () => {
    setError('')
    setSuccess('')

    const payload = {
      enabled,
      scheduleType,
      deliveryTime: `${deliveryTime}:00`,
      timezone,
      childScope: 'SPECIFIC_CHILD',
      targetChildId: targetChildId || null,
      modelName,
      maxTokens: Number(maxTokens),
      promptTemplate: promptTemplate || null,
    }

    try {
      await withAuthRetry((token) => updateReportPreferenceRequest(token, payload))
      setSuccess(t.saveSuccess)
      await loadPreference()
    } catch (e) {
      setError(resolveErrorMessage(e, t.saveError))
    }
  }

  const generateTest = async () => {
    setError('')
    setSuccess('')
    setGenerating(true)

    const payload = {
      targetChildId: generateChildId || null,
      promptOverride: generatePrompt || null,
      maxTokens: generateMaxTokens ? Number(generateMaxTokens) : null,
    }

    try {
      await withAuthRetry((token) => generateTestReportRequest(token, payload))
      setSuccess(t.generateSuccess)
      setReportsPage(0)
      await loadReports(0, reportsSize)
    } catch (e) {
      setError(resolveErrorMessage(e, t.generateError))
    } finally {
      setGenerating(false)
    }
  }

  const openDetail = async (reportId) => {
    setError('')
    try {
      const response = await withAuthRetry((token) => reportDetailRequest(token, reportId))
      setSelectedReport(response?.data || null)
    } catch (e) {
      setError(resolveErrorMessage(e, t.detailError))
    }
  }

  const closeDetail = () => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('reportId')
    setSearchParams(nextParams, { replace: true })
    setSelectedReport(null)
  }

  const exportReport = async (reportId, format) => {
    setError('')
    const key = `${reportId}:${format}`
    setExportingKey(key)

    try {
      const blob = await withAuthRetry((token) => reportExportBlobRequest(token, reportId, format))
      const ext = format === 'csv' ? 'csv' : 'pdf'
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `report-${reportId}.${ext}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      setSuccess(format === 'csv' ? 'CSV 내보내기가 완료되었습니다.' : 'PDF 내보내기가 완료되었습니다.')
    } catch (e) {
      setError(resolveErrorMessage(e, format === 'csv' ? 'CSV 내보내기에 실패했습니다.' : 'PDF 내보내기에 실패했습니다.'))
    } finally {
      setExportingKey('')
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <section className="rounded-2xl border border-violet-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Reports</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadInitial}
              disabled={loading}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? t.refreshing : KO.common.refresh}
            </button>
            <Link to="/" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              {t.home}
            </Link>
          </div>
        </div>

        <FeedbackBanner error={error} success={success} />

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{t.settingTitle}</h2>
              <button
                type="button"
                onClick={() => setShowPreferencePanel((prev) => !prev)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                {showPreferencePanel ? t.collapse : t.expand}
              </button>
            </div>

            {showPreferencePanel && (
              <div className="mt-3 grid gap-3">
              <label className="text-xs font-semibold text-slate-700">
                {t.targetChild}
                <select
                  value={targetChildId}
                  onChange={(e) => setTargetChildId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {children.length === 0 && <option value="">{t.noChild}</option>}
                  {children.map((child) => (
                    <option key={child.childId} value={child.childId}>
                      {child.name} ({child.childId})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                {t.autoEnable}
              </label>

              <label className="text-xs font-semibold text-slate-700">
                {t.schedule}
                <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="DAILY">DAILY</option>
                  <option value="WEEKLY">WEEKLY</option>
                  <option value="MONTHLY">MONTHLY</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700">
                {t.deliveryTime}
                <input type="time" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <label className="text-xs font-semibold text-slate-700">
                {t.timezone}
                <input type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <label className="text-xs font-semibold text-slate-700">
                {t.modelName}
                <input type="text" value={modelName} onChange={(e) => setModelName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <label className="text-xs font-semibold text-slate-700">
                {t.maxTokens}
                <input type="number" min={1} value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <label className="text-xs font-semibold text-slate-700">
                {t.prompt}
                <textarea rows={4} value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <button
                type="button"
                onClick={savePreference}
                disabled={!targetChildId}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {t.save}
              </button>
              </div>
            )}

            {preference && <p className="mt-3 text-xs text-slate-500">{t.nextIssue}: {preference.nextIssueAt || KO.common.none}</p>}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{t.testTitle}</h2>
              <button
                type="button"
                onClick={() => setShowGeneratePanel((prev) => !prev)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                {showGeneratePanel ? t.collapse : t.expand}
              </button>
            </div>

            {showGeneratePanel && (
              <div className="mt-3 grid gap-3">
              <label className="text-xs font-semibold text-slate-700">
                {t.promptOverride}
                <textarea rows={4} value={generatePrompt} onChange={(e) => setGeneratePrompt(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <label className="text-xs font-semibold text-slate-700">
                {t.testChild}
                <select
                  value={generateChildId}
                  onChange={(e) => setGenerateChildId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {children.length === 0 && <option value="">{t.noChild}</option>}
                  {children.map((child) => (
                    <option key={child.childId} value={child.childId}>
                      {child.name} ({child.childId})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700">
                {t.testMaxTokens}
                <input type="number" min={1} value={generateMaxTokens} onChange={(e) => setGenerateMaxTokens(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <button
                type="button"
                onClick={generateTest}
                disabled={!generateChildId || generating}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {generating ? t.generating : t.generate}
              </button>
              </div>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t.historyTitle}</h2>

          <div className="mt-3 space-y-3">
            {reports.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{t.noReport}</p>}

            {reports.map((report) => (
              <article key={report.reportId} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{report.title || t.untitled}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{report.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{t.issuedAt}: {report.issuedAt || KO.common.none}</p>
                <p className="mt-1 text-xs text-slate-500">{t.model}: {report.modelName || KO.common.none}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => openDetail(report.reportId)} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700">
                  {t.openDetail}
                  </button>
                  <button
                    type="button"
                    onClick={() => exportReport(report.reportId, 'pdf')}
                    disabled={exportingKey === `${report.reportId}:pdf`}
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {exportingKey === `${report.reportId}:pdf` ? 'PDF 생성 중...' : 'PDF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => exportReport(report.reportId, 'csv')}
                    disabled={exportingKey === `${report.reportId}:csv`}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {exportingKey === `${report.reportId}:csv` ? 'CSV 생성 중...' : 'CSV'}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <PaginationBar
            page={reportsPage}
            totalPages={reportsTotalPages}
            totalElements={reportsTotalElements}
            size={reportsSize}
            labels={t.pagination}
            onPageChange={setReportsPage}
            onSizeChange={(nextSize) => {
              setReportsPage(0)
              setReportsSize(nextSize)
            }}
          />
        </section>
      </section>

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" onClick={closeDetail}>
          <section
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">{t.detailTitle}</h2>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                {t.closeDetail}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">{t.id}: {selectedReport.reportId}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{selectedReport.title}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {selectedReport.reportBody || selectedReport.summary || KO.common.none}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => exportReport(selectedReport.reportId, 'pdf')}
                disabled={exportingKey === `${selectedReport.reportId}:pdf`}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {exportingKey === `${selectedReport.reportId}:pdf` ? 'PDF 생성 중...' : 'PDF 내보내기'}
              </button>
              <button
                type="button"
                onClick={() => exportReport(selectedReport.reportId, 'csv')}
                disabled={exportingKey === `${selectedReport.reportId}:csv`}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {exportingKey === `${selectedReport.reportId}:csv` ? 'CSV 생성 중...' : 'CSV 내보내기'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default ReportsPage
