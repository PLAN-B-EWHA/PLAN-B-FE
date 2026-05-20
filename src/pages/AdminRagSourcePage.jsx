import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminSidebarNav } from '../components/AdminSidebarNav'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

const useCaseOptions = [
  { value: 'REPORT_GENERATION', label: '리포트 생성' },
  { value: 'OFFLINE_MISSION_GENERATION', label: '오프라인 미션 생성' },
  { value: 'SCENARIO_GENERATION', label: '시나리오 생성' },
]

const sourceTypeOptions = [
  { value: 'THERAPY_GUIDELINE', label: '치료 가이드라인' },
  { value: 'CHILD_LEARNING_RECORD', label: '아동 학습 기록' },
  { value: 'MANUAL_NOTE', label: '관리자 메모' },
]

const initialForm = {
  title: '',
  sourceType: 'THERAPY_GUIDELINE',
  useCase: 'SCENARIO_GENERATION',
  childScoped: false,
  childId: '',
  originalFilename: '',
  contentType: 'text/plain',
  content: '',
}

export function AdminRagSourcePage() {
  const navigate = useNavigate()
  const { accessToken, logout } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [result, setResult] = useState(null)

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.sourceType || !form.useCase || !form.content.trim()) {
      setFeedback('제목, 자료 종류, 사용 목적, 원문 텍스트는 필수입니다.')
      return
    }

    setLoading(true)
    setFeedback('')
    try {
      const res = await apiFetch('/admin/rag/sources/text', {
        method: 'POST',
        token: accessToken,
        body: {
          title: form.title.trim(),
          sourceType: form.sourceType,
          useCase: form.useCase,
          childId: form.childScoped ? form.childId || null : null,
          originalFilename: form.originalFilename || null,
          contentType: form.contentType || 'text/plain',
          content: form.content,
        },
      })
      setResult(extractApiPayload(res))
      setFeedback('RAG 자료 등록이 완료되었습니다.')
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

        <AdminSidebarNav activeId="rag-source" />

        <main className="p-5">
          <h1 className="text-3xl font-black tracking-tight text-slate-950">RAG 자료 등록</h1>
          <p className="mt-2 text-sm text-slate-500">텍스트 붙여넣기 기반 인덱싱 API(`/api/admin/rag/sources/text`) 화면입니다.</p>

          {feedback ? <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{feedback}</div> : null}

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <input className="rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => updateField('title', e.target.value)} placeholder="제목 (필수)" value={form.title} />
              <input className="rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => updateField('originalFilename', e.target.value)} placeholder="원본 파일명 (선택)" value={form.originalFilename} />

              <select className="rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => updateField('useCase', e.target.value)} value={form.useCase}>
                {useCaseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>

              <select className="rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => updateField('sourceType', e.target.value)} value={form.sourceType}>
                {sourceTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>

              <input className="rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => updateField('contentType', e.target.value)} placeholder="contentType" value={form.contentType} />

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input checked={form.childScoped} onChange={(e) => updateField('childScoped', e.target.checked)} type="checkbox" />
                특정 아동 전용
              </label>
            </div>

            {form.childScoped ? (
              <input className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => updateField('childId', e.target.value)} placeholder="childId (UUID)" value={form.childId} />
            ) : null}

            <textarea className="mt-3 min-h-56 w-full rounded-xl border border-slate-200 px-3 py-2" onChange={(e) => updateField('content', e.target.value)} placeholder="여기에 RAG로 넣을 원문 텍스트를 붙여넣으세요. (필수)" value={form.content} />

            <div className="mt-4 flex justify-end">
              <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-white" disabled={loading} onClick={handleSubmit} type="button">
                {loading ? '등록 중...' : '등록하기'}
              </button>
            </div>
          </section>

          {result ? (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">등록 결과</p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(result, null, 2)}</pre>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  )
}
