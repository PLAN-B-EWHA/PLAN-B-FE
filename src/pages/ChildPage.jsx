import { useEffect, useMemo, useState } from 'react'
import { ParentShell } from '../components/ParentShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { buildChildFormFromDetail, calculateAgeLabel, defaultChildForm, getGenderLabel, normalizeChildForm, resolveUploadUrl } from '../lib/childUtils'

const childPermissionOptions = [
  { value: 'PLAY_GAME', label: '게임 플레이' },
  { value: 'VIEW_REPORT', label: '리포트 조회' },
  { value: 'WRITE_NOTE', label: '기록 작성' },
  { value: 'ASSIGN_MISSION', label: '숙제 할당' },
  { value: 'MANAGE', label: '학생 관리' },
]

const defaultAuthorizationForm = {
  userId: '',
  permissions: [],
}

function fieldClass() {
  return 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-500)]'
}

function PermissionToggleGroup({ label, selectedValues, onToggle }) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="flex flex-wrap gap-2">
        {childPermissionOptions.map((option) => {
          const isSelected = selectedValues.includes(option.value)
          return (
            <button
              key={option.value}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                isSelected ? 'border-[var(--brand-500)] bg-[var(--brand-500)] text-white' : 'border-slate-200 bg-white text-slate-600'
              }`}
              onClick={() => onToggle(option.value)}
              type="button"
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Avatar({ child, previewUrl, large = false }) {
  const imageUrl = previewUrl || resolveUploadUrl(child?.profileImageUrl)
  const sizeClass = large ? 'h-16 w-16 rounded-[1.4rem]' : 'h-12 w-12 rounded-full'
  if (imageUrl) {
    return <img alt={child?.name || 'child'} className={`${sizeClass} object-cover`} src={imageUrl} />
  }
  return <div className={`${sizeClass} flex items-center justify-center bg-[var(--brand-500)] font-bold text-white`}>{child?.name?.[0] || '?'}</div>
}

function FieldHelp({ title, desc }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-600">{title}</p>
      <p className="text-[11px] text-slate-400">{desc}</p>
    </div>
  )
}

function ChildForm({ form, onChange, onSubmit, saving, feedback, submitLabel }) {
  return (
    <form className="mt-6 space-y-4" onSubmit={onSubmit}>
      {feedback ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{feedback}</div> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldHelp desc="학생 식별용 이름입니다." title="이름" />
          <input className={fieldClass()} name="name" onChange={onChange} placeholder="학생 이름" value={form.name} />
        </div>
        <div>
          <FieldHelp desc="만 나이 계산에 사용됩니다." title="생년월일" />
          <input className={fieldClass()} name="birthDate" onChange={onChange} type="date" value={form.birthDate} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldHelp desc="기본 인적 정보로 저장됩니다." title="성별" />
          <select className={fieldClass()} name="gender" onChange={onChange} value={form.gender}>
            <option value="MALE">남학생</option>
            <option value="FEMALE">여학생</option>
            <option value="OTHER">기타</option>
          </select>
        </div>
        <div>
          <FieldHelp desc="선택 입력, 4자리 숫자입니다." title="PIN" />
          <input className={fieldClass()} inputMode="numeric" maxLength={4} name="pin" onChange={onChange} placeholder="PIN 4자리" value={form.pin} />
        </div>
      </div>

      <div>
        <FieldHelp desc="학생이 좋아하는 활동/주제입니다." title="관심사" />
        <input className={fieldClass()} name="interests" onChange={onChange} placeholder="예: 공룡, 퍼즐, 자동차" value={form.interests} />
      </div>

      <div>
        <FieldHelp desc="진단 기준일(선택)" title="진단일" />
        <input className={fieldClass()} name="diagnosisDate" onChange={onChange} type="date" value={form.diagnosisDate} />
      </div>

      <div>
        <FieldHelp desc="치료사가 내부적으로 참고하는 메모" title="진단/상태 메모" />
        <textarea className={`${fieldClass()} min-h-24 resize-none`} name="diagnosisInfo" onChange={onChange} placeholder="현재 상태, 반응 특성 등" value={form.diagnosisInfo} />
      </div>

      <div>
        <FieldHelp desc="주의사항, 환경 정보 등" title="특이사항" />
        <textarea className={`${fieldClass()} min-h-24 resize-none`} name="specialNotes" onChange={onChange} placeholder="예: 큰 소리에 민감함" value={form.specialNotes} />
      </div>

      <div className="flex justify-end">
        <button className="rounded-xl bg-[var(--brand-500)] px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-400" disabled={saving} type="submit">
          {saving ? '저장 중...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function Modal({ title, body, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 px-4 py-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col rounded-[1.75rem] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
            </div>
            <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-500" onClick={onClose} type="button">닫기</button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function ChildPage() {
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [selectedChildDetail, setSelectedChildDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [createForm, setCreateForm] = useState({ ...defaultChildForm })
  const [editForm, setEditForm] = useState({ ...defaultChildForm })
  const [authorizations, setAuthorizations] = useState([])
  const [authorizationDrafts, setAuthorizationDrafts] = useState({})
  const [authorizationForm, setAuthorizationForm] = useState(defaultAuthorizationForm)
  const [authorizationLoading, setAuthorizationLoading] = useState(false)
  const [authorizationSaving, setAuthorizationSaving] = useState(false)
  const [authorizationFeedback, setAuthorizationFeedback] = useState('')

  const selectedChild = useMemo(() => children.find((child) => child.childId === selectedChildId) || children[0] || null, [children, selectedChildId])

  async function refreshChildren(targetChildId = null) {
    const response = await apiFetch('/children/my', { method: 'GET', token: accessToken })
    const payload = extractApiPayload(response) || []
    setChildren(payload)
    setSelectedChildId(targetChildId || payload[0]?.childId || null)
    return payload
  }

  async function refreshChildDetail(childId) {
    if (!childId) {
      setSelectedChildDetail(null)
      return null
    }
    const response = await apiFetch(`/children/${childId}`, { method: 'GET', token: accessToken })
    const payload = extractApiPayload(response)
    setSelectedChildDetail(payload)
    return payload
  }

  async function refreshAuthorizations(childId) {
    if (!childId) {
      setAuthorizations([])
      setAuthorizationDrafts({})
      return []
    }

    setAuthorizationLoading(true)
    try {
      const response = await apiFetch(`/children/${childId}/authorizations`, { method: 'GET', token: accessToken })
      const payload = extractApiPayload(response) || []
      setAuthorizations(payload)
      setAuthorizationDrafts(
        payload.reduce((accumulator, item) => {
          const targetUserId = item?.user?.userId
          if (targetUserId) accumulator[targetUserId] = Array.isArray(item.permissions) ? item.permissions : []
          return accumulator
        }, {}),
      )
      return payload
    } catch (error) {
      setAuthorizationFeedback(extractApiErrorMessage(error))
      return []
    } finally {
      setAuthorizationLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    async function load() {
      if (!accessToken) {
        setLoading(false)
        return
      }
      try {
        const response = await apiFetch('/children/my', { method: 'GET', token: accessToken })
        const payload = extractApiPayload(response) || []
        if (!ignore) {
          setChildren(payload)
          setSelectedChildId(payload[0]?.childId || null)
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [accessToken])

  useEffect(() => {
    let ignore = false
    async function loadDetail() {
      if (!accessToken || !selectedChildId) {
        setSelectedChildDetail(null)
        return
      }
      setDetailLoading(true)
      try {
        const response = await apiFetch(`/children/${selectedChildId}`, { method: 'GET', token: accessToken })
        const payload = extractApiPayload(response)
        if (!ignore) setSelectedChildDetail(payload)
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      } finally {
        if (!ignore) setDetailLoading(false)
      }
    }
    loadDetail()
    return () => {
      ignore = true
    }
  }, [accessToken, selectedChildId])

  useEffect(() => {
    if (!selectedChildId || !accessToken) {
      setAuthorizations([])
      setAuthorizationDrafts({})
      return
    }
    refreshAuthorizations(selectedChildId)
  }, [accessToken, selectedChildId])

  function handleFormChange(setForm, event) {
    const { name, value } = event.target
    if (name === 'pin') {
      setForm((current) => ({ ...current, pin: value.replace(/\D/g, '').slice(0, 4) }))
      return
    }
    setForm((current) => ({ ...current, [name]: value }))
  }

  function toggleAuthorizationFormPermission(permission) {
    setAuthorizationForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }))
  }

  function toggleAuthorizationDraft(targetUserId, permission) {
    setAuthorizationDrafts((current) => {
      const currentPermissions = current[targetUserId] || []
      return {
        ...current,
        [targetUserId]: currentPermissions.includes(permission)
          ? currentPermissions.filter((item) => item !== permission)
          : [...currentPermissions, permission],
      }
    })
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    if (!createForm.name.trim()) {
      setFeedback('이름은 필수입니다.')
      return
    }

    setSaving(true)
    setFeedback('')
    try {
      const created = extractApiPayload(await apiFetch('/children', { method: 'POST', token: accessToken, body: normalizeChildForm(createForm) }))
      await refreshChildren(created.childId)
      await refreshChildDetail(created.childId)
      setCreateForm({ ...defaultChildForm })
      setShowCreateModal(false)
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleEditSubmit(event) {
    event.preventDefault()
    if (!selectedChild?.childId) return

    if (!editForm.name.trim()) {
      setFeedback('이름은 필수입니다.')
      return
    }

    setSaving(true)
    setFeedback('')
    try {
      await apiFetch(`/children/${selectedChild.childId}`, { method: 'PUT', token: accessToken, body: normalizeChildForm(editForm) })
      await refreshChildren(selectedChild.childId)
      const detail = await refreshChildDetail(selectedChild.childId)
      setEditForm(buildChildFormFromDetail(detail))
      setShowEditModal(false)
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteChild() {
    if (!selectedChild?.childId) return
    const confirmed = window.confirm(`${selectedChild.name} 학생 정보를 삭제할까요?`) 
    if (!confirmed) return

    setSaving(true)
    setFeedback('')
    try {
      await apiFetch(`/children/${selectedChild.childId}`, { method: 'DELETE', token: accessToken })
      const remaining = await refreshChildren()
      const nextChildId = remaining[0]?.childId || null
      if (nextChildId) await refreshChildDetail(nextChildId)
      else setSelectedChildDetail(null)
      setFeedback('학생 정보가 삭제되었습니다.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleGrantAuthorization(event) {
    event.preventDefault()
    if (!selectedChild?.childId) return
    if (!authorizationForm.userId.trim()) {
      setAuthorizationFeedback('권한을 부여할 사용자 ID를 입력해 주세요.')
      return
    }

    setAuthorizationSaving(true)
    setAuthorizationFeedback('')
    try {
      await apiFetch(`/children/${selectedChild.childId}/authorizations`, {
        method: 'POST',
        token: accessToken,
        body: { userId: authorizationForm.userId.trim(), permissions: authorizationForm.permissions },
      })
      await refreshAuthorizations(selectedChild.childId)
      setAuthorizationForm(defaultAuthorizationForm)
    } catch (error) {
      setAuthorizationFeedback(extractApiErrorMessage(error))
    } finally {
      setAuthorizationSaving(false)
    }
  }

  async function handleUpdateAuthorization(targetUserId) {
    if (!selectedChild?.childId || !targetUserId) return
    setAuthorizationSaving(true)
    setAuthorizationFeedback('')
    try {
      await apiFetch(`/children/${selectedChild.childId}/authorizations/${targetUserId}`, {
        method: 'PUT',
        token: accessToken,
        body: { permissions: authorizationDrafts[targetUserId] || [], isActive: true },
      })
      await refreshAuthorizations(selectedChild.childId)
    } catch (error) {
      setAuthorizationFeedback(extractApiErrorMessage(error))
    } finally {
      setAuthorizationSaving(false)
    }
  }

  async function handleRevokeAuthorization(targetUserId) {
    if (!selectedChild?.childId || !targetUserId) return
    setAuthorizationSaving(true)
    setAuthorizationFeedback('')
    try {
      await apiFetch(`/children/${selectedChild.childId}/authorizations/${targetUserId}`, {
        method: 'DELETE',
        token: accessToken,
      })
      await refreshAuthorizations(selectedChild.childId)
    } catch (error) {
      setAuthorizationFeedback(extractApiErrorMessage(error))
    } finally {
      setAuthorizationSaving(false)
    }
  }

  return (
    <ParentShell
      childCount={children.length}
      heading="학생 관리"
      selectedChild={selectedChild}
      subheading={selectedChild ? `${selectedChild.name}의 기본 정보를 확인하세요` : '학생 목록과 상세 정보를 관리합니다'}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Student</p>
          <h1 className="mt-2 text-[28px] font-black tracking-tight text-slate-950">학생 페이지</h1>
          <p className="mt-1 text-sm text-slate-400">학생 프로필과 치료 참고 메모를 관리합니다.</p>
        </div>
        {children.length > 0 ? (
          <div className="md:ml-auto flex gap-2">
            <button className="rounded-xl border border-[rgba(79,70,229,0.18)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-700)]" onClick={() => { setFeedback(''); setEditForm(buildChildFormFromDetail(selectedChildDetail || selectedChild)); setShowEditModal(true) }} type="button">학생 수정</button>
            <button className="rounded-xl border border-rose-200 bg-[var(--danger-50)] px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60" disabled={saving} onClick={handleDeleteChild} type="button">학생 삭제</button>
            <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2.5 text-sm font-semibold text-white" onClick={() => { setFeedback(''); setCreateForm({ ...defaultChildForm }); setShowCreateModal(true) }} type="button">+ 학생 추가</button>
          </div>
        ) : null}
      </div>

      {feedback ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{feedback}</div> : null}

      {loading ? <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">학생 목록을 불러오는 중입니다...</div> : null}

      {!loading && children.length === 0 ? (
        <div className="mt-6 rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(79,70,229,0.08)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Create Student</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">첫 학생을 등록해 주세요</h2>
          <ChildForm feedback="" form={createForm} onChange={(event) => handleFormChange(setCreateForm, event)} onSubmit={handleCreateSubmit} saving={saving} submitLabel="첫 학생 등록" />
        </div>
      ) : null}

      {!loading && children.length > 0 ? (
        <>
          <section className="mt-6 grid gap-4 xl:grid-cols-[340px_1fr]">
            <article className="rounded-[1.35rem] border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">학생 목록</p>
              <div className="rounded-full bg-[var(--brand-50)] px-3 py-1 text-xs font-bold text-[var(--brand-700)]">{children.length}명</div>
            </div>
            <div className="mt-4 space-y-3">
              {children.map((child) => (
                <button
                  key={child.childId}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${selectedChild?.childId === child.childId ? 'border-[var(--brand-200)] bg-[var(--brand-50)]' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  onClick={() => setSelectedChildId(child.childId)}
                  type="button"
                >
                  <Avatar child={child} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{child.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{calculateAgeLabel(child.birthDate)} · {getGenderLabel(child.gender)}</p>
                  </div>
                </button>
              ))}
            </div>
            </article>

            <article className="rounded-[1.35rem] border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <Avatar child={selectedChild} large />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Selected Student</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">{selectedChild?.name}</h2>
                <p className="mt-1 text-sm text-slate-400">{calculateAgeLabel(selectedChild?.birthDate)} · {getGenderLabel(selectedChild?.gender)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p className="text-xs text-slate-400">관심사</p><p className="mt-2 text-sm font-bold text-slate-900">{selectedChild?.interests || '미입력'}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p className="text-xs text-slate-400">PIN</p><p className="mt-2 text-sm font-bold text-slate-900">{selectedChild?.pinEnabled ? '설정됨' : '미설정'}</p></div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-xs text-slate-400">진단/상태 메모</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{selectedChildDetail?.diagnosisInfo || '등록된 메모가 없습니다.'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-xs text-slate-400">특이사항</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{selectedChildDetail?.specialNotes || '등록된 특이사항이 없습니다.'}</p>
              </div>
            </div>
            {detailLoading ? <p className="mt-4 text-xs text-slate-400">상세 정보를 불러오는 중입니다...</p> : null}
            </article>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-[1.35rem] border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">권한 부여</p>
                  <p className="mt-1 text-xs text-slate-400">사용자 ID를 입력해 학생 접근 권한을 연결합니다.</p>
                </div>
                {authorizationLoading ? <span className="text-xs text-slate-400">불러오는 중...</span> : null}
              </div>

              {authorizationFeedback ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{authorizationFeedback}</div> : null}

              <form className="mt-5 space-y-4" onSubmit={handleGrantAuthorization}>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">대상 사용자 ID</span>
                  <input
                    className={fieldClass()}
                    onChange={(event) => setAuthorizationForm((current) => ({ ...current, userId: event.target.value }))}
                    placeholder="UUID 형식 사용자 ID"
                    value={authorizationForm.userId}
                  />
                </label>

                <PermissionToggleGroup label="부여할 권한" onToggle={toggleAuthorizationFormPermission} selectedValues={authorizationForm.permissions} />

                <div className="flex justify-end">
                  <button className="rounded-xl bg-[var(--brand-500)] px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-400" disabled={authorizationSaving} type="submit">
                    {authorizationSaving ? '처리 중...' : '권한 부여'}
                  </button>
                </div>
              </form>
            </article>

            <article className="rounded-[1.35rem] border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">권한 관리</p>
                  <p className="mt-1 text-xs text-slate-400">기존 권한을 수정하거나 회수할 수 있습니다.</p>
                </div>
                <div className="rounded-full bg-[var(--brand-50)] px-3 py-1 text-xs font-bold text-[var(--brand-700)]">{authorizations.length}명</div>
              </div>

              <div className="mt-5 space-y-4">
                {authorizations.length ? (
                  authorizations.map((item) => {
                    const targetUserId = item?.user?.userId
                    const permissions = authorizationDrafts[targetUserId] || []

                    return (
                      <div key={targetUserId || item.authorizationId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{item?.user?.name || item?.user?.email || '연결 사용자'}</p>
                            <p className="mt-1 text-xs text-slate-400">{item?.user?.email || targetUserId}</p>
                            <p className="mt-2 text-xs font-semibold text-[var(--brand-600)]">{item?.isPrimary ? '주보호자' : '일반 권한 사용자'}</p>
                          </div>

                          {!item?.isPrimary ? (
                            <div className="flex gap-2">
                              <button className="rounded-xl border border-[rgba(79,70,229,0.18)] bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-700)]" disabled={authorizationSaving} onClick={() => handleUpdateAuthorization(targetUserId)} type="button">저장</button>
                              <button className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600" disabled={authorizationSaving} onClick={() => handleRevokeAuthorization(targetUserId)} type="button">회수</button>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4">
                          {item?.isPrimary ? (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">주보호자는 기본 권한이 유지됩니다.</div>
                          ) : (
                            <PermissionToggleGroup label="권한 수정" onToggle={(permission) => toggleAuthorizationDraft(targetUserId, permission)} selectedValues={permissions} />
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">아직 연결된 사용자가 없습니다.</div>
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}

      {showCreateModal ? (
        <Modal body="학생 기본 정보만 입력해도 등록할 수 있습니다." onClose={() => setShowCreateModal(false)} title="학생 등록">
          <ChildForm feedback={feedback} form={createForm} onChange={(event) => handleFormChange(setCreateForm, event)} onSubmit={handleCreateSubmit} saving={saving} submitLabel="학생 등록" />
        </Modal>
      ) : null}

      {showEditModal ? (
        <Modal body="필요한 기본 정보만 수정해 주세요." onClose={() => setShowEditModal(false)} title="학생 정보 수정">
          <ChildForm feedback={feedback} form={editForm} onChange={(event) => handleFormChange(setEditForm, event)} onSubmit={handleEditSubmit} saving={saving} submitLabel="수정 저장" />
        </Modal>
      ) : null}
    </ParentShell>
  )
}
