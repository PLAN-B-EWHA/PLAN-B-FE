import { useEffect, useMemo, useState } from 'react'
import { ParentShell } from '../components/ParentShell'
import { TherapistStatsShell } from '../components/TherapistStatsShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { calculateAgeLabel, canPlayGame } from '../lib/childUtils'

// ─── 설정 가능한 알림 (GET /notifications/preferences 반환 타입) ───
// 백엔드 NotificationPreferenceType: COMMENT_ADDED | WEEKLY_SUMMARY | CHILD_INACTIVE
// COMMENT_ADDED는 치료사 메모 발행 기능이 미구현이므로 UI에서 노출하지 않음
const typeMeta = {
  WEEKLY_SUMMARY: {
    title: '주간 성장 요약 알림',
    description: '매주 월요일 오전 9시, 주보호자에게 아이의 주간 성장 요약이 발송됩니다.',
    roles: ['PARENT'],
  },
  CHILD_INACTIVE: {
    title: '아동 미접속 알림',
    description: '설정한 일수 이상 아동의 게임 기록이 없으면 알림을 받습니다. (기본 7일)',
    roles: ['THERAPIST'],
    hasExtraValue: true,
    extraLabel: '미접속 기준 일수',
  },
}

// ─── 자동 발송 알림 (설정 불가 / 조건 충족 시 자동 발송) ───
// PARENT: REPORT_GENERATED, HOMEWORK_REVIEWED, HOMEWORK_EXPIRED
// THERAPIST: HOMEWORK_SUBMITTED
const autoNotifyMeta = {
  PARENT: [
    {
      type: 'REPORT_GENERATED',
      title: '리포트 발행 알림',
      description: '치료사가 리포트를 발행하면 리포트 조회 권한이 있는 보호자에게 자동 발송됩니다.',
    },
    {
      type: 'HOMEWORK_REVIEWED',
      title: '숙제 검토 완료 알림',
      description: '제출한 오프라인 숙제를 치료사가 검토 완료하면 제출한 보호자에게 자동 발송됩니다.',
    },
    {
      type: 'HOMEWORK_EXPIRED',
      title: '숙제 기한 만료 알림',
      description: '기한 내 미제출 숙제가 매일 자정 만료 처리될 때 리포트 조회 권한 보호자에게 자동 발송됩니다.',
    },
  ],
  THERAPIST: [
    {
      type: 'HOMEWORK_SUBMITTED',
      title: '숙제 제출 알림',
      description: '보호자가 오프라인 숙제를 제출하면 해당 아동의 숙제 할당 권한이 있는 치료사에게 자동 발송됩니다.',
    },
  ],
}

function getVisiblePreferences(preferences, roles) {
  return (preferences || []).filter((item) => {
    const meta = typeMeta[item.type]
    if (!meta) return false  // typeMeta에 없는 타입은 표시 안 함
    if (!meta.roles?.length) return true
    return meta.roles.some((role) => roles.includes(role))
  })
}

function PreferenceCard({ item, meta, saving, onToggle, onExtraChange, onSave }) {
  return (
    <article className="card card-pad">
      <div className="set-head">
        <div>
          <h3>{meta?.title || item.type}</h3>
          <p className="set-desc">{meta?.description || '알림 설정을 관리합니다.'}</p>
        </div>
        <button className={`switch ${item.enabled ? '' : 'off'}`} onClick={() => onToggle(item.type)} type="button">
          <span className="track" />
          <span className="sw-label">{item.enabled ? '활성화' : '비활성화'}</span>
        </button>
      </div>

      {meta?.hasExtraValue ? (
        <div className="num-row">
          <label className="num-field" htmlFor={`extra-${item.type}`}>
            <span className="fl2">{meta.extraLabel}</span>
            <input className="input" id={`extra-${item.type}`} min="1" onChange={(event) => onExtraChange(item.type, event.target.value)} type="number" value={item.extraValue ?? ''} />
          </label>
          <span className="num-suffix">일</span>
        </div>
      ) : null}

      <div className="card-foot-right">
        <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => onSave(item)} type="button">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </article>
  )
}

function fmtDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function GameChildSelector({ isTherapist, accessToken }) {
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [selectedChildName, setSelectedChildName] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    if (!accessToken) return
    let ignore = false

    async function load() {
      setLoading(true)
      try {
        const [childrenRes, selectionRes] = await Promise.allSettled([
          apiFetch('/children/accessible', { method: 'GET', token: accessToken }),
          apiFetch('/unity/selected-child', { method: 'GET', token: accessToken }),
        ])

        if (ignore) return

        if (childrenRes.status === 'fulfilled') {
          const raw = extractApiPayload(childrenRes.value) || []
          setChildren((Array.isArray(raw) ? raw : (raw?.content || [])).filter(canPlayGame))
        }
        if (selectionRes.status === 'fulfilled') {
          const sel = extractApiPayload(selectionRes.value)
          setSelectedChildId(sel?.childId || null)
          setSelectedChildName(sel?.childName || null)
          setUpdatedAt(sel?.updatedAt || null)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => { ignore = true }
  }, [accessToken, isTherapist])

  async function handleSelect(child) {
    if (saving) return
    setSaving(true)
    setFeedback('')
    try {
      const res = await apiFetch('/unity/selected-child', {
        method: 'PUT',
        token: accessToken,
        body: { childId: child.childId },
      })
      const sel = extractApiPayload(res)
      setSelectedChildId(sel?.childId || child.childId)
      setSelectedChildName(sel?.childName || child.name)
      setUpdatedAt(sel?.updatedAt || null)
      setFeedback(`${child.name} 아이로 게임 플레이 대상이 변경되었습니다.`)
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="card card-pad">
      <div className="set-head">
        <div>
          <h3>게임 플레이 아동 선택</h3>
          <p className="set-desc">
            Unity 게임에서 플레이할 아동을 선택합니다. 선택한 아동으로 게임 세션이 기록됩니다.
          </p>
        </div>
        {selectedChildName ? (
          <span className="chip chip-accent">
            {selectedChildName}
          </span>
        ) : (
          <span className="chip chip-neutral">미선택</span>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-xs text-slate-400">아동 정보를 불러오는 중...</p>
      ) : children.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">접근 가능한 아동이 없습니다.</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {children.map((child) => {
            const isActive = child.childId === selectedChildId
            return (
              <button
                className={`child-opt ${isActive ? '' : 'bg-white'}`}
                disabled={saving}
                key={child.childId}
                onClick={() => handleSelect(child)}
                type="button"
              >
                <span className="cdot" />
                <span className="cn">{child.name}</span>
                {child.birthDate ? <span className="ca">{calculateAgeLabel(child.birthDate)}</span> : null}
              </button>
            )
          })}
        </div>
      )}

      {updatedAt ? (
        <p className="mt-3 text-[11px] text-slate-400">마지막 변경: {fmtDateTime(updatedAt)}</p>
      ) : null}

      {feedback ? (
        <p className={`mt-3 text-xs font-semibold ${feedback.includes('변경') ? 'text-emerald-600' : 'text-rose-500'}`}>
          {feedback}
        </p>
      ) : null}
    </article>
  )
}

function AutoNotifyCard({ meta }) {
  return (
    <article className="card card-pad" style={{ opacity: 0.88 }}>
      <div className="set-head">
        <div>
          <h3>{meta.title}</h3>
          <p className="set-desc">{meta.description}</p>
        </div>
        <span className="chip chip-neutral" style={{ flexShrink: 0 }}>자동 발송</span>
      </div>
    </article>
  )
}

function SettingsContent({ preferences, savingType, feedback, loading, onToggle, onExtraChange, onSave, isTherapist, accessToken }) {
  const roleKey = isTherapist ? 'THERAPIST' : 'PARENT'
  const autoItems = autoNotifyMeta[roleKey] || []

  return (
    <>
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      <section className="set-wrap">
        <GameChildSelector accessToken={accessToken} isTherapist={isTherapist} />
      </section>

      <div className="section-head set-wrap" style={{ marginTop: 34 }}>
        <div>
          <div className="s-title">알림 설정</div>
          <p className="sub">알림 종류와 기준을 직접 설정할 수 있습니다.</p>
        </div>
      </div>

      {loading ? (
        <div className="stats-loading">설정 정보를 불러오는 중입니다...</div>
      ) : (
        <section className="set-wrap grid gap-4">
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

      {autoItems.length > 0 ? (
        <>
          <div className="section-head set-wrap" style={{ marginTop: 28 }}>
            <div>
              <div className="s-title">자동 발송 알림</div>
              <p className="sub">아래 알림은 조건 충족 시 자동으로 발송되며 별도 설정이 필요 없습니다.</p>
            </div>
          </div>
          <section className="set-wrap grid gap-4">
            {autoItems.map((meta) => (
              <AutoNotifyCard key={meta.type} meta={meta} />
            ))}
          </section>
        </>
      ) : null}
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
      accessToken={accessToken}
      feedback={feedback}
      isTherapist={isTherapist}
      loading={loading}
      onExtraChange={handleExtraChange}
      onSave={handleSave}
      onToggle={handleToggle}
      preferences={visiblePreferences}
      savingType={savingType}
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
