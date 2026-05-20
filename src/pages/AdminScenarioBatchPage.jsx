import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminSidebarNav } from '../components/AdminSidebarNav'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

const initialForm = {
  character: 'Minjun',
  startIndex: 0,
  endIndex: 2,
  topK: 4,
  similarityThreshold: 0.2,
  useProModel: true,
  persistToDb: true,
  writeBackupJson: true,
}

export function AdminScenarioBatchPage() {
  const navigate = useNavigate()
  const { accessToken, logout } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [result, setResult] = useState(null)

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!file) {
      setFeedback('seed.csv 파일을 선택해 주세요.')
      return
    }

    setLoading(true)
    setFeedback('')

    try {
      const formData = new FormData()
      formData.append(
        'request',
        new Blob(
          [
            JSON.stringify({
              character: form.character,
              startIndex: Number(form.startIndex),
              endIndex: Number(form.endIndex),
              topK: Number(form.topK),
              similarityThreshold: Number(form.similarityThreshold),
              useProModel: Boolean(form.useProModel),
              persistToDb: Boolean(form.persistToDb),
              writeBackupJson: Boolean(form.writeBackupJson),
            }),
          ],
          { type: 'application/json' },
        ),
      )
      formData.append('file', file)

      const res = await apiFetch('/admin/scenarios/generate-from-seed', {
        method: 'POST',
        token: accessToken,
        body: formData,
      })

      const payload = extractApiPayload(res)
      setResult(payload)
      setFeedback('배치 생성 요청이 완료되었습니다.')
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

        <AdminSidebarNav activeId="scenario-batch" />

        <main className="p-5">
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Seed CSV 배치 시나리오 생성</h1>
          <p className="mt-2 text-sm text-slate-500">캐릭터별 범위를 지정해 시나리오를 생성하고, 필요하면 DB 저장 및 백업 JSON 저장까지 실행합니다.</p>

          {feedback ? <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{feedback}</div> : null}

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <p className="text-xs font-semibold text-slate-500">character</p>
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => update('character', e.target.value)} placeholder="character" value={form.character} />
              </label>
              <label className="space-y-1 text-sm">
                <p className="text-xs font-semibold text-slate-500">topK</p>
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => update('topK', e.target.value)} placeholder="topK" type="number" value={form.topK} />
              </label>
              <label className="space-y-1 text-sm">
                <p className="text-xs font-semibold text-slate-500">startIndex</p>
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => update('startIndex', e.target.value)} placeholder="startIndex" type="number" value={form.startIndex} />
              </label>
              <label className="space-y-1 text-sm">
                <p className="text-xs font-semibold text-slate-500">endIndex</p>
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => update('endIndex', e.target.value)} placeholder="endIndex" type="number" value={form.endIndex} />
              </label>
              <label className="space-y-1 text-sm">
                <p className="text-xs font-semibold text-slate-500">similarityThreshold</p>
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => update('similarityThreshold', e.target.value)} placeholder="similarityThreshold" step="0.01" type="number" value={form.similarityThreshold} />
              </label>
              <label className="space-y-1 text-sm">
                <p className="text-xs font-semibold text-slate-500">file (seed.csv)</p>
                <input accept=".csv,text/csv" className="w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setFile(e.target.files?.[0] || null)} type="file" />
              </label>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><input checked={form.useProModel} onChange={(e) => update('useProModel', e.target.checked)} type="checkbox" />useProModel</label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><input checked={form.persistToDb} onChange={(e) => update('persistToDb', e.target.checked)} type="checkbox" />persistToDb</label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><input checked={form.writeBackupJson} onChange={(e) => update('writeBackupJson', e.target.checked)} type="checkbox" />writeBackupJson</label>
            </div>

            <div className="mt-4 flex justify-end">
              <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-white" disabled={loading} onClick={handleSubmit} type="button">{loading ? '생성 중...' : '배치 생성 실행'}</button>
            </div>
          </section>

          {result ? (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">응답 결과</p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(result, null, 2)}</pre>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  )
}
