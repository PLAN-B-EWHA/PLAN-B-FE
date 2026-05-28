import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminSidebarNav } from '../components/AdminSidebarNav'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

const initialForm = {
  character: 'Minjun',
  startIndex: 0,
  endIndex: 10,
  topK: 5,
  similarityThreshold: 0.65,
  useProModel: false,
  think: 'high',
  persistToDb: true,
  writeBackupJson: true,
}

const characterOptions = [
  { label: '민준', value: 'Minjun' },
  { label: '서연', value: 'Seoyeon' },
  { label: '지후', value: 'Jihu' },
  { label: '하은', value: 'Haeun' },
]

const thinkOptions = [
  { label: '기본값', value: '' },
  { label: '끄기', value: 'false' },
  { label: '켜기', value: 'true' },
  { label: '낮음', value: 'low' },
  { label: '보통', value: 'medium' },
  { label: '높음', value: 'high' },
]

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
              think: form.think,
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
          <p className="mt-2 text-sm text-slate-500">캐릭터별 범위를 작게 나눠 시나리오를 생성하고, 필요하면 DB 저장 및 백업 JSON 저장까지 실행합니다.</p>

          {feedback ? <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{feedback}</div> : null}

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <p className="text-xs font-semibold text-slate-500">캐릭터</p>
                <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" onChange={(e) => update('character', e.target.value)} value={form.character}>
                  {characterOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <p className="text-xs font-semibold text-slate-500">참고 자료 개수</p>
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2" min="1" onChange={(e) => update('topK', e.target.value)} placeholder="5" type="number" value={form.topK} />
              </label>
              <label className="space-y-1 text-sm">
                <p className="text-xs font-semibold text-slate-500">시작 행</p>
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2" min="0" onChange={(e) => update('startIndex', e.target.value)} placeholder="0" type="number" value={form.startIndex} />
              </label>
              <label className="space-y-1 text-sm">
                <p className="text-xs font-semibold text-slate-500">끝 행</p>
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2" min="1" onChange={(e) => update('endIndex', e.target.value)} placeholder="10" type="number" value={form.endIndex} />
              </label>
              <label className="space-y-1 text-sm">
                <p className="text-xs font-semibold text-slate-500">자료 관련도 기준</p>
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2" max="1" min="0" onChange={(e) => update('similarityThreshold', e.target.value)} placeholder="0.65" step="0.01" type="number" value={form.similarityThreshold} />
              </label>
              <label className="space-y-1 text-sm">
                <p className="text-xs font-semibold text-slate-500">CSV 파일</p>
                <input accept=".csv,text/csv" className="w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => setFile(e.target.files?.[0] || null)} type="file" />
              </label>
              <label className="space-y-1 text-sm">
                <p className="text-xs font-semibold text-slate-500">추론 깊이</p>
                <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" onChange={(e) => update('think', e.target.value)} value={form.think}>
                  {thinkOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><input checked={form.useProModel} onChange={(e) => update('useProModel', e.target.checked)} type="checkbox" />고성능 모델 사용</label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><input checked={form.persistToDb} onChange={(e) => update('persistToDb', e.target.checked)} type="checkbox" />DB 저장</label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><input checked={form.writeBackupJson} onChange={(e) => update('writeBackupJson', e.target.checked)} type="checkbox" />백업 JSON 저장</label>
            </div>

            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              think=high는 품질은 좋아질 수 있지만 느리고 비용이 늘 수 있습니다. 참고 자료 개수를 너무 크게 하면 입력 컨텍스트가 길어져 느려질 수 있습니다.
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
