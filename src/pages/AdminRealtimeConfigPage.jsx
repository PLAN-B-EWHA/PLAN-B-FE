import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminSidebarNav } from '../components/AdminSidebarNav'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

const emptyForm = {
  enabled: false,
  baseUrl: '',
  model: '',
  voice: '',
  modalities: ['text'],
  instructions: '',
}

const modalityOptions = [
  { value: 'text', label: 'Text' },
  { value: 'audio', label: 'Audio' },
]

function normalizeConfig(config) {
  return {
    enabled: Boolean(config?.enabled),
    baseUrl: config?.baseUrl || '',
    model: config?.model || '',
    voice: config?.voice || '',
    modalities: Array.isArray(config?.modalities) && config.modalities.length ? config.modalities : ['text'],
    instructions: config?.instructions || '',
  }
}

export function AdminRealtimeConfigPage() {
  const navigate = useNavigate()
  const { accessToken, logout } = useAuth()
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [lastSaved, setLastSaved] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let alive = true

    async function loadConfig() {
      setLoading(true)
      setFeedback('')
      try {
        const res = await apiFetch('/admin/realtime/config', { method: 'GET', token: accessToken })
        const config = normalizeConfig(extractApiPayload(res))
        if (!alive) return
        setForm(config)
        setLastSaved(config)
        setFeedback('Realtime 설정을 조회했습니다.')
      } catch (error) {
        if (!alive) return
        setFeedback(extractApiErrorMessage(error))
      } finally {
        if (alive) setLoading(false)
      }
    }

    loadConfig()

    return () => {
      alive = false
    }
  }, [accessToken, reloadTick])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleModality(value) {
    setForm((prev) => {
      const exists = prev.modalities.includes(value)
      const next = exists
        ? prev.modalities.filter((item) => item !== value)
        : [...prev.modalities, value]

      return { ...prev, modalities: next.length ? next : prev.modalities }
    })
  }

  async function handleSave() {
    const payload = {
      enabled: form.enabled,
      baseUrl: form.baseUrl.trim(),
      model: form.model.trim(),
      voice: form.voice.trim(),
      modalities: form.modalities,
      instructions: form.instructions.trim(),
    }

    if (!payload.baseUrl || !payload.model || !payload.voice || !payload.instructions) {
      setFeedback('Base URL, model, voice, instructions는 필수입니다.')
      return
    }

    if (!payload.modalities.length) {
      setFeedback('Modalities는 text 또는 audio 중 하나 이상 선택해야 합니다.')
      return
    }

    setSaving(true)
    setFeedback('')
    try {
      const res = await apiFetch('/admin/realtime/config', {
        method: 'PATCH',
        token: accessToken,
        body: payload,
      })
      const config = normalizeConfig(extractApiPayload(res))
      setForm(config)
      setLastSaved(config)
      setFeedback('Realtime 설정이 저장되었습니다.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSaving(false)
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

        <AdminSidebarNav activeId="realtime-config" />

        <main className="p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950">Realtime 설정</h1>
              <p className="mt-2 text-sm text-slate-500">OpenAI Realtime 연결 설정을 운영자 권한으로 조회하고 변경합니다.</p>
            </div>
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              disabled={loading}
              onClick={() => setReloadTick((value) => value + 1)}
              type="button"
            >
              설정 조회
            </button>
          </div>

          {feedback ? <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{feedback}</div> : null}

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            {loading ? (
              <p className="text-sm text-slate-500">설정을 불러오는 중입니다...</p>
            ) : (
              <div className="grid gap-4">
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Realtime 사용</span>
                    <span className="block text-xs text-slate-500">Unity Realtime client secret 생성 기능을 켜거나 끕니다.</span>
                  </span>
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      className={`rounded-lg px-4 py-2 text-sm font-semibold ${form.enabled ? 'bg-[var(--brand-500)] text-white shadow-sm' : 'text-slate-600'}`}
                      onClick={() => updateField('enabled', true)}
                      type="button"
                    >
                      사용
                    </button>
                    <button
                      className={`rounded-lg px-4 py-2 text-sm font-semibold ${!form.enabled ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600'}`}
                      onClick={() => updateField('enabled', false)}
                      type="button"
                    >
                      중지
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Base URL
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 font-normal text-slate-900"
                      onChange={(e) => updateField('baseUrl', e.target.value)}
                      placeholder="https://api.openai.com"
                      value={form.baseUrl}
                    />
                  </label>

                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Model
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 font-normal text-slate-900"
                      onChange={(e) => updateField('model', e.target.value)}
                      placeholder="gpt-realtime"
                      value={form.model}
                    />
                  </label>

                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Voice
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 font-normal text-slate-900"
                      onChange={(e) => updateField('voice', e.target.value)}
                      placeholder="marin"
                      value={form.voice}
                    />
                  </label>

                  <fieldset className="rounded-xl border border-slate-200 px-3 py-2">
                    <legend className="px-1 text-sm font-semibold text-slate-700">Modalities</legend>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {modalityOptions.map((option) => (
                        <label key={option.value} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                          <input checked={form.modalities.includes(option.value)} onChange={() => toggleModality(option.value)} type="checkbox" />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Instructions
                  <textarea
                    className="min-h-56 rounded-xl border border-slate-200 px-3 py-2 font-normal text-slate-900"
                    maxLength={4000}
                    onChange={(e) => updateField('instructions', e.target.value)}
                    placeholder="Realtime session instructions"
                    value={form.instructions}
                  />
                </label>

                <div className="flex justify-end">
                  <button
                    className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={saving}
                    onClick={handleSave}
                    type="button"
                  >
                    {saving ? '저장 중...' : '저장하기'}
                  </button>
                </div>
              </div>
            )}
          </section>

          {lastSaved ? (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">현재 적용 설정</p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(lastSaved, null, 2)}</pre>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  )
}
