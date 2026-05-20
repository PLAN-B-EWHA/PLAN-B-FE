import { useEffect, useMemo, useState } from 'react'
import { ParentShell } from '../components/ParentShell'
import { TherapistStatsShell } from '../components/TherapistStatsShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

const typeMeta = {
  COMMENT_ADDED: {
    title: '치료사 메모 발행 알림',
    description: '치료사가 메모를 발행하면 즉시 알림을 받습니다.',
    roles: ['PARENT'],
  },
  WEEKLY_SUMMARY: {
    title: '주간 요약 알림',
    description: '매주 월요일 오전 9시에 주간 요약 알림을 받습니다.',
    roles: ['PARENT'],
  },
  CHILD_INACTIVE: {
    title: '아동 미접속 알림',
    description: '설정한 일수 이상 게임 기록이 없으면 알림을 받습니다.',
    roles: ['THERAPIST'],
    hasExtraValue: true,
    extraLabel: '미접속 기준 일수',
  },
}

function getVisiblePreferences(preferences, roles) {
  return (preferences || []).filter((item) => {
    const meta = typeMeta[item.type]
    if (!meta?.roles?.length) return true
    return meta.roles.some((role) => roles.includes(role))
  })
}

function PreferenceCard({ item, meta, saving, onToggle, onExtraChange, onSave }) {
  return (
    <article className="stats-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-900">{meta?.title || item.type}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">{meta?.description || '알림 설정을 관리합니다.'}</p>
        </div>
        <button className={`rounded-full px-3 py-1 text-xs font-semibold ${item.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => onToggle(item.type)} type="button">
          {item.enabled ? '활성화' : '비활성화'}
        </button>
      </div>

      {meta?.hasExtraValue ? (
        <div className="mt-4 flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500" htmlFor={`extra-${item.type}`}>{meta.extraLabel}</label>
          <input className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800" id={`extra-${item.type}`} min="1" onChange={(event) => onExtraChange(item.type, event.target.value)} type="number" value={item.extraValue ?? ''} />
          <span className="text-xs text-slate-400">일</span>
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40" disabled={saving} onClick={() => onSave(item)} type="button">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </article>
  )
}

function SettingsContent({ title, subtitle, preferences, savingType, feedback, loading, onToggle, onExtraChange, onSave }) {
  return (
    <>
      <div className="flex flex-col gap-2" style={{ marginTop: 16 }}>
        <h2 className="text-[24px] font-black tracking-tight text-slate-950">{title}</h2>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>

      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      {loading ? (
        <div className="stats-loading">설정 정보를 불러오는 중입니다...</div>
      ) : (
        <section className="mt-5 grid gap-4 xl:grid-cols-2">
          {preferences.map((item) => (
            <PreferenceCard
              item={item}
              key={item.type}
              meta={typeMeta[item.type]}
              onExtraChange={onExtraChange}
              onSave={onSave}
              onToggle={onToggle}
              saving={savingType === item.type}
            />
          ))}
        </section>
      )}
    </>
  )
}

export function NotificationSettingsPage() {
  const { accessToken, jwtPayload, user } = useAuth()
  const roles = user?.roles || jwtPayload?.roles || []

  const [preferences, setPreferences] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingType, setSavingType] = useState('')
  const [feedback, setFeedback] = useState('')

  const isTherapist = roles.includes('THERAPIST')
  const visiblePreferences = useMemo(() => getVisiblePreferences(preferences, roles), [preferences, roles])

  useEffect(() => {
    let ignore = false

    async function loadPreferences() {
      if (!accessToken) {
        setLoading(false)
        return
      }

      try {
        const response = await apiFetch('/notifications/preferences', { method: 'GET', token: accessToken })
        if (!ignore) {
          setPreferences(extractApiPayload(response) || [])
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadPreferences()

    return () => {
      ignore = true
    }
  }, [accessToken])

  function handleToggle(type) {
    setPreferences((current) => current.map((item) => (item.type === type ? { ...item, enabled: !item.enabled } : item)))
  }

  function handleExtraChange(type, value) {
    const next = value === '' ? null : Math.max(1, Number(value) || 1)
    setPreferences((current) => current.map((item) => (item.type === type ? { ...item, extraValue: next } : item)))
  }

  async function handleSave(item) {
    if (!accessToken) return

    setSavingType(item.type)
    try {
      const response = await apiFetch(`/notifications/preferences/${item.type}`, {
        method: 'PUT',
        token: accessToken,
        body: { enabled: item.enabled, extraValue: item.extraValue },
      })
      const payload = extractApiPayload(response)
      setPreferences((current) => current.map((pref) => (pref.type === payload.type ? payload : pref)))
      setFeedback('알림 설정이 저장되었습니다.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSavingType('')
    }
  }

  const content = (
    <SettingsContent
      feedback={feedback}
      loading={loading}
      onExtraChange={handleExtraChange}
      onSave={handleSave}
      onToggle={handleToggle}
      preferences={visiblePreferences}
      savingType={savingType}
      subtitle={isTherapist ? '치료사 알림을 원하는 방식으로 제어할 수 있습니다.' : '부모 알림을 원하는 방식으로 제어할 수 있습니다.'}
      title="알림 설정"
    />
  )

  if (isTherapist) {
    return (
      <TherapistStatsShell activeId="settings" subtitle="알림 조건과 활성화를 조정합니다." title="설정">
        {content}
      </TherapistStatsShell>
    )
  }

  return (
    <ParentShell childCount={0} heading="알림 설정" selectedChild={null} subheading="알림 종류와 기준을 직접 설정할 수 있습니다.">
      {content}
    </ParentShell>
  )
}
