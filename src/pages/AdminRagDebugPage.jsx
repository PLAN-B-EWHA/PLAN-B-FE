import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminSidebarNav } from '../components/AdminSidebarNav'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

const initialRequest = {
  childId: '',
  request: '',
  retrievalQuery: '',
  childSummary: '',
  additionalContext: '',
  topK: 4,
  similarityThreshold: 0.2,
  useProModel: false,
}

function buildBody(form) {
  return {
    childId: form.childId || null,
    request: form.request || '',
    retrievalQuery: form.retrievalQuery || '',
    childSummary: form.childSummary || '',
    additionalContext: form.additionalContext || '',
    topK: Number(form.topK) || 4,
    similarityThreshold: Number(form.similarityThreshold) || 0.2,
    useProModel: Boolean(form.useProModel),
  }
}

function ResultCard({ title, result }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">generatedText</p>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{result?.generatedText || '-'}</pre>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">ragContext</p>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{result?.ragContext || '-'}</pre>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">prompt</p>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{result?.prompt || '-'}</pre>
        </div>
      </div>
    </article>
  )
}

export function AdminRagDebugPage() {
  const navigate = useNavigate()
  const { accessToken, logout } = useAuth()
  const [form, setForm] = useState(initialRequest)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [reportResult, setReportResult] = useState(null)
  const [offlineResult, setOfflineResult] = useState(null)
  const [scenarioDebugResult, setScenarioDebugResult] = useState(null)
  const [scenarioResult, setScenarioResult] = useState(null)

  async function callApi(path, setter) {
    setLoading(true)
    setFeedback('')
    try {
      const res = await apiFetch(path, {
        method: 'POST',
        token: accessToken,
        body: buildBody(form),
      })
      const payload = extractApiPayload(res)
      setter(payload)
      setFeedback('요청이 완료되었습니다.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setLoading(false)
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

        <AdminSidebarNav activeId="rag-debug" />

        <main className="p-5">
          <h1 className="text-3xl font-black tracking-tight text-slate-950">RAG 디버그 생성</h1>
          <p className="mt-2 text-sm text-slate-500">시나리오/리포트/오프라인 미션 생성 결과를 관리자 검토용으로 확인합니다.</p>

          {feedback ? <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{feedback}</div> : null}

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <input className="rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setForm((p) => ({ ...p, childId: e.target.value }))} placeholder="childId (UUID)" value={form.childId} />
              <input className="rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setForm((p) => ({ ...p, retrievalQuery: e.target.value }))} placeholder="retrievalQuery" value={form.retrievalQuery} />
              <input className="rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setForm((p) => ({ ...p, topK: e.target.value }))} placeholder="topK" type="number" value={form.topK} />
              <input className="rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setForm((p) => ({ ...p, similarityThreshold: e.target.value }))} placeholder="similarityThreshold" step="0.01" type="number" value={form.similarityThreshold} />
            </div>
            <textarea className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setForm((p) => ({ ...p, request: e.target.value }))} placeholder="request" value={form.request} />
            <textarea className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setForm((p) => ({ ...p, childSummary: e.target.value }))} placeholder="childSummary" value={form.childSummary} />
            <textarea className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setForm((p) => ({ ...p, additionalContext: e.target.value }))} placeholder="additionalContext" value={form.additionalContext} />
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
              <input checked={form.useProModel} onChange={(e) => setForm((p) => ({ ...p, useProModel: e.target.checked }))} type="checkbox" />
              useProModel
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-xl bg-[var(--brand-500)] px-3 py-2 text-sm font-semibold text-white" disabled={loading} onClick={() => callApi('/admin/rag/debug/generate/report', setReportResult)} type="button">디버그 리포트 생성</button>
              <button className="rounded-xl bg-[var(--brand-500)] px-3 py-2 text-sm font-semibold text-white" disabled={loading} onClick={() => callApi('/admin/rag/debug/generate/offline-mission', setOfflineResult)} type="button">디버그 오프라인 미션 생성</button>
              <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" disabled={loading} onClick={() => callApi('/admin/rag/generate/scenario', setScenarioResult)} type="button">시나리오 생성</button>
              <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" disabled={loading} onClick={() => callApi('/admin/rag/debug/generate/scenario', setScenarioDebugResult)} type="button">디버그 시나리오 생성</button>
            </div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-2">
            {reportResult ? <ResultCard result={reportResult} title="Debug Report" /> : null}
            {offlineResult ? <ResultCard result={offlineResult} title="Debug Offline Mission" /> : null}
            {scenarioDebugResult ? <ResultCard result={scenarioDebugResult} title="Debug Scenario" /> : null}
            {scenarioResult ? (
              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Scenario (Non-debug)</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{typeof scenarioResult === 'string' ? scenarioResult : JSON.stringify(scenarioResult, null, 2)}</pre>
              </article>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  )
}
