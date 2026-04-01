import { useEffect, useMemo, useState } from 'react'
import { ParentShell } from '../components/ParentShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import {
  buildChildFormFromDetail,
  calculateAgeLabel,
  defaultChildForm,
  expressionTagOptions,
  getExpressionTagLabel,
  getGenderLabel,
  getLanguageSkillLabel,
  getSensoryProcessingLabel,
  languageSkillOptions,
  normalizeChildForm,
  resolveUploadUrl,
  sensoryProcessingOptions,
} from '../lib/childUtils'

const childPermissionOptions = [
  { value: 'PLAY_GAME', label: '게임 플레이' },
  { value: 'VIEW_REPORT', label: '리포트 조회' },
  { value: 'WRITE_NOTE', label: '노트 작성' },
  { value: 'ASSIGN_MISSION', label: '미션 할당' },
  { value: 'MANAGE', label: '학생 관리' },
]

const defaultAuthorizationForm = {
  userId: '',
  permissions: [],
}

function fieldClass() {
  return 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-4 focus:ring-[rgba(79,70,229,0.12)]'
}

function Avatar({ child, previewUrl, large = false }) {
  const imageUrl = previewUrl || resolveUploadUrl(child?.profileImageUrl)
  const sizeClass = large ? 'h-16 w-16 rounded-[1.4rem]' : 'h-12 w-12 rounded-full'
  if (imageUrl) {
    return <img alt={child?.name || 'child'} className={`${sizeClass} object-cover`} src={imageUrl} />
  }
  return <div className={`${sizeClass} flex items-center justify-center bg-[var(--brand-500)] font-bold text-white`}>{child?.name?.[0] || '아'}</div>
}

function TagList({ items }) {
  if (!items?.length) {
    return <p className="text-sm text-slate-400">등록된 태그가 없습니다.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-full border border-[rgba(79,70,229,0.12)] bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold text-[var(--brand-700)]">
          {getExpressionTagLabel(item)}
        </span>
      ))}
    </div>
  )
}

function TagToggleGroup({ label, selectedValues, onToggle }) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="flex flex-wrap gap-2">
        {expressionTagOptions.map((option) => {
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

function ImageField({ form, fileInputId, previewUrl, onChange, onFileChange, onClearFile }) {
  return (
    <div className="space-y-3">
      <span className="text-sm font-semibold text-slate-700">프로필 이미지</span>
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center">
        <Avatar child={{ name: form.name, profileImageUrl: form.profileImageUrl }} large previewUrl={previewUrl} />
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-700">이미지 첨부 또는 URL 입력</p>
          <p className="mt-1 text-xs text-slate-400">파일을 선택하면 저장 시 업로드 API로 전송됩니다.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-white" htmlFor={fileInputId}>
              이미지 선택
            </label>
            <input accept="image/*" className="hidden" id={fileInputId} onChange={onFileChange} type="file" />
            {previewUrl ? (
              <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600" onClick={onClearFile} type="button">
                선택 파일 제거
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <input className={fieldClass()} name="profileImageUrl" onChange={onChange} placeholder="https://... 또는 /uploads/..." value={form.profileImageUrl} />
    </div>
  )
}

function ChildForm(props) {
  const { form, onChange, onSubmit, onToggleTag, saving, feedback, submitLabel, fileInputId, previewUrl, onFileChange, onClearFile } = props
  return (
    <form className="mt-6 space-y-4" onSubmit={onSubmit}>
      {feedback ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{feedback}</div> : null}
      <ImageField fileInputId={fileInputId} form={form} onChange={onChange} onClearFile={onClearFile} onFileChange={onFileChange} previewUrl={previewUrl} />
      <div className="grid gap-4 md:grid-cols-2">
        <input className={fieldClass()} name="name" onChange={onChange} placeholder="이름" value={form.name} />
        <input className={fieldClass()} name="birthDate" onChange={onChange} type="date" value={form.birthDate} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <select className={fieldClass()} name="gender" onChange={onChange} value={form.gender}>
          <option value="MALE">남학생</option>
          <option value="FEMALE">여학생</option>
          <option value="OTHER">기타</option>
        </select>
        <input className={fieldClass()} inputMode="numeric" maxLength={4} name="pin" onChange={onChange} placeholder="PIN 4자리" value={form.pin} />
      </div>
      <input className={fieldClass()} name="interests" onChange={onChange} placeholder="관심사" value={form.interests} />
      <input className={fieldClass()} name="diagnosisDate" onChange={onChange} type="date" value={form.diagnosisDate} />
      <div className="grid gap-4 md:grid-cols-2">
        <select className={fieldClass()} name="languageSkill" onChange={onChange} value={form.languageSkill}>
          <option value="">언어 발달 선택</option>
          {languageSkillOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select className={fieldClass()} name="sensoryProcessing" onChange={onChange} value={form.sensoryProcessing}>
          <option value="">감각 처리 선택</option>
          {sensoryProcessingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <textarea className={`${fieldClass()} min-h-24 resize-none`} name="diagnosisInfo" onChange={onChange} placeholder="진단 및 상태 메모" value={form.diagnosisInfo} />
      <textarea className={`${fieldClass()} min-h-24 resize-none`} name="specialNotes" onChange={onChange} placeholder="특이사항" value={form.specialNotes} />
      <TagToggleGroup label="선호하는 감정 표현" onToggle={(value) => onToggleTag('preferredExpressions', value)} selectedValues={form.preferredExpressions} />
      <TagToggleGroup label="어려워하는 감정 표현" onToggle={(value) => onToggleTag('difficultExpressions', value)} selectedValues={form.difficultExpressions} />
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

async function uploadProfileImage(childId, file, accessToken) {
  if (!childId || !file) return null
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiFetch(`/children/${childId}/profile/image`, { method: 'POST', token: accessToken, body: formData })
  return extractApiPayload(response)
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
  const [createImageFile, setCreateImageFile] = useState(null)
  const [editImageFile, setEditImageFile] = useState(null)
  const [createImagePreview, setCreateImagePreview] = useState('')
  const [editImagePreview, setEditImagePreview] = useState('')
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
      const response = await apiFetch(`/children/${childId}/authorizations`, {
        method: 'GET',
        token: accessToken,
      })
      const payload = extractApiPayload(response) || []
      setAuthorizations(payload)
      setAuthorizationDrafts(
        payload.reduce((accumulator, item) => {
          const targetUserId = item?.user?.userId
          if (targetUserId) {
            accumulator[targetUserId] = Array.isArray(item.permissions) ? item.permissions : []
          }
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

  function handleToggleTag(formKey, value, setForm) {
    setForm((current) => {
      const currentValues = Array.isArray(current[formKey]) ? current[formKey] : []
      return {
        ...current,
        [formKey]: currentValues.includes(value) ? currentValues.filter((item) => item !== value) : [...currentValues, value],
      }
    })
  }

  function clearFile(setFile, setPreview) {
    setFile(null)
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current)
      return ''
    })
  }

  function selectFile(file, setFile, setPreview) {
    if (!file) return
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(file)
    })
    setFile(file)
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
      let nextChild = created
      if (createImageFile) {
        nextChild = (await uploadProfileImage(created.childId, createImageFile, accessToken)) || created
      }
      await refreshChildren(nextChild.childId)
      await refreshChildDetail(nextChild.childId)
      setCreateForm({ ...defaultChildForm })
      clearFile(setCreateImageFile, setCreateImagePreview)
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
      if (editImageFile) {
        await uploadProfileImage(selectedChild.childId, editImageFile, accessToken)
      }
      await refreshChildren(selectedChild.childId)
      const detail = await refreshChildDetail(selectedChild.childId)
      setEditForm(buildChildFormFromDetail(detail))
      clearFile(setEditImageFile, setEditImagePreview)
      setShowEditModal(false)
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteChild() {
    if (!selectedChild?.childId) {
      return
    }

    const confirmed = window.confirm(`${selectedChild.name} 학생 정보를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)
    if (!confirmed) {
      return
    }

    setSaving(true)
    setFeedback('')

    try {
      await apiFetch(`/children/${selectedChild.childId}`, {
        method: 'DELETE',
        token: accessToken,
      })

      const remainingChildren = await refreshChildren()
      const nextChildId = remainingChildren[0]?.childId || null

      if (nextChildId) {
        await refreshChildDetail(nextChildId)
      } else {
        setSelectedChildDetail(null)
        setAuthorizations([])
        setAuthorizationDrafts({})
      }

      setFeedback('학생 정보가 삭제되었습니다.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleGrantAuthorization(event) {
    event.preventDefault()

    if (!selectedChild?.childId) {
      return
    }

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
        body: {
          userId: authorizationForm.userId.trim(),
          permissions: authorizationForm.permissions,
        },
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
    if (!selectedChild?.childId || !targetUserId) {
      return
    }

    setAuthorizationSaving(true)
    setAuthorizationFeedback('')

    try {
      await apiFetch(`/children/${selectedChild.childId}/authorizations/${targetUserId}`, {
        method: 'PUT',
        token: accessToken,
        body: {
          permissions: authorizationDrafts[targetUserId] || [],
          isActive: true,
        },
      })
      await refreshAuthorizations(selectedChild.childId)
    } catch (error) {
      setAuthorizationFeedback(extractApiErrorMessage(error))
    } finally {
      setAuthorizationSaving(false)
    }
  }

  async function handleRevokeAuthorization(targetUserId) {
    if (!selectedChild?.childId || !targetUserId) {
      return
    }

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
      subheading={selectedChild ? `${selectedChild.name}의 프로필과 상세 정보를 확인하세요` : '등록한 학생 목록과 상세 정보를 관리하세요'}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Student</p>
          <h1 className="mt-2 text-[28px] font-black tracking-tight text-slate-950">학생 페이지</h1>
          <p className="mt-1 text-sm text-slate-400">학생 프로필, 특성 정보, 권한 설정을 한 화면에서 관리할 수 있습니다.</p>
        </div>
        {children.length > 0 ? (
          <div className="md:ml-auto flex gap-2">
            <button
              className="rounded-xl border border-[rgba(79,70,229,0.18)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-700)]"
              onClick={() => {
                setFeedback('')
                setEditForm(buildChildFormFromDetail(selectedChildDetail || selectedChild))
                clearFile(setEditImageFile, setEditImagePreview)
                setShowEditModal(true)
              }}
              type="button"
            >
              학생 수정
            </button>
            <button
              className="rounded-xl border border-rose-200 bg-[var(--danger-50)] px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60"
              disabled={saving}
              onClick={handleDeleteChild}
              type="button"
            >
              학생 삭제
            </button>
            <button
              className="rounded-xl bg-[var(--brand-500)] px-4 py-2.5 text-sm font-semibold text-white"
              onClick={() => {
                setFeedback('')
                setCreateForm({ ...defaultChildForm })
                clearFile(setCreateImageFile, setCreateImagePreview)
                setShowCreateModal(true)
              }}
              type="button"
            >
              + 학생 추가
            </button>
          </div>
        ) : null}
      </div>

      {feedback ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{feedback}</div> : null}

      {loading ? <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">학생 목록을 불러오는 중입니다...</div> : null}

      {!loading && children.length === 0 ? (
        <div className="mt-6 rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(79,70,229,0.08)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Create Student</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">첫 학생 등록</h2>
          <ChildForm
            feedback=""
            fileInputId="create-child-image"
            form={createForm}
            onChange={(event) => handleFormChange(setCreateForm, event)}
            onClearFile={() => clearFile(setCreateImageFile, setCreateImagePreview)}
            onFileChange={(event) => selectFile(event.target.files?.[0], setCreateImageFile, setCreateImagePreview)}
            onSubmit={handleCreateSubmit}
            onToggleTag={(formKey, value) => handleToggleTag(formKey, value, setCreateForm)}
            previewUrl={createImagePreview}
            saving={saving}
            submitLabel="첫 학생 등록"
          />
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
                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                      selectedChild?.childId === child.childId ? 'border-[var(--brand-200)] bg-[var(--brand-50)]' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
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
              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p className="text-xs text-slate-400">관심사</p><p className="mt-2 text-sm font-bold text-slate-900">{selectedChild?.interests || '미입력'}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p className="text-xs text-slate-400">PIN</p><p className="mt-2 text-sm font-bold text-slate-900">{selectedChild?.pinEnabled ? '설정됨' : '미설정'}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p className="text-xs text-slate-400">언어 발달</p><p className="mt-2 text-sm font-bold text-slate-900">{getLanguageSkillLabel(selectedChildDetail?.languageSkill)}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p className="text-xs text-slate-400">감각 처리</p><p className="mt-2 text-sm font-bold text-slate-900">{getSensoryProcessingLabel(selectedChildDetail?.sensoryProcessing)}</p></div>
              </div>
              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-xs text-slate-400">진단 및 상태 메모</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{selectedChildDetail?.diagnosisInfo || '등록된 메모가 없습니다.'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-xs text-slate-400">특이사항</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{selectedChildDetail?.specialNotes || '등록된 특이사항이 없습니다.'}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4"><p className="text-xs text-slate-400">선호 표현</p><div className="mt-3"><TagList items={selectedChildDetail?.preferredExpressions || []} /></div></div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4"><p className="text-xs text-slate-400">어려운 표현</p><div className="mt-3"><TagList items={selectedChildDetail?.difficultExpressions || []} /></div></div>
              </div>
              {detailLoading ? <p className="mt-4 text-xs text-slate-400">상세 정보를 불러오는 중입니다...</p> : null}
            </article>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-[1.35rem] border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">권한 부여</p>
                  <p className="mt-1 text-xs text-slate-400">학생 권한 연동 API 기준으로 사용자 ID에 접근 권한을 연결합니다.</p>
                </div>
                {authorizationLoading ? <span className="text-xs text-slate-400">불러오는 중...</span> : null}
              </div>

              {authorizationFeedback ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {authorizationFeedback}
                </div>
              ) : null}

              <form className="mt-5 space-y-4" onSubmit={handleGrantAuthorization}>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">대상 사용자 ID</span>
                  <input
                    className={fieldClass()}
                    onChange={(event) =>
                      setAuthorizationForm((current) => ({
                        ...current,
                        userId: event.target.value,
                      }))
                    }
                    placeholder="UUID 형식 사용자 ID"
                    value={authorizationForm.userId}
                  />
                </label>

                <PermissionToggleGroup
                  label="부여할 권한"
                  onToggle={toggleAuthorizationFormPermission}
                  selectedValues={authorizationForm.permissions}
                />

                <div className="flex justify-end">
                  <button
                    className="rounded-xl bg-[var(--brand-500)] px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-400"
                    disabled={authorizationSaving}
                    type="submit"
                  >
                    {authorizationSaving ? '처리 중...' : '권한 부여'}
                  </button>
                </div>
              </form>
            </article>

            <article className="rounded-[1.35rem] border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">연결된 사용자 권한</p>
                  <p className="mt-1 text-xs text-slate-400">기존 권한을 수정하거나 회수할 수 있습니다.</p>
                </div>
                <div className="rounded-full bg-[var(--brand-50)] px-3 py-1 text-xs font-bold text-[var(--brand-700)]">
                  {authorizations.length}명
                </div>
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
                            <p className="mt-2 text-xs font-semibold text-[var(--brand-600)]">
                              {item?.isPrimary ? '주 보호자 권한' : '일반 권한 사용자'}
                            </p>
                          </div>

                          {!item?.isPrimary ? (
                            <div className="flex gap-2">
                              <button
                                className="rounded-xl border border-[rgba(79,70,229,0.18)] bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-700)]"
                                disabled={authorizationSaving}
                                onClick={() => handleUpdateAuthorization(targetUserId)}
                                type="button"
                              >
                                저장
                              </button>
                              <button
                                className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600"
                                disabled={authorizationSaving}
                                onClick={() => handleRevokeAuthorization(targetUserId)}
                                type="button"
                              >
                                회수
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4">
                          {item?.isPrimary ? (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                              주 보호자는 모든 권한을 기본 보유합니다.
                            </div>
                          ) : (
                            <PermissionToggleGroup
                              label="권한 수정"
                              onToggle={(permission) => toggleAuthorizationDraft(targetUserId, permission)}
                              selectedValues={permissions}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                    아직 연결된 권한 사용자가 없습니다.
                  </div>
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}

      {showCreateModal ? (
        <Modal body="프로필 이미지 파일도 함께 업로드할 수 있습니다." onClose={() => setShowCreateModal(false)} title="새 학생을 등록해 주세요">
          <ChildForm
            feedback={feedback}
            fileInputId="create-child-image-modal"
            form={createForm}
            onChange={(event) => handleFormChange(setCreateForm, event)}
            onClearFile={() => clearFile(setCreateImageFile, setCreateImagePreview)}
            onFileChange={(event) => selectFile(event.target.files?.[0], setCreateImageFile, setCreateImagePreview)}
            onSubmit={handleCreateSubmit}
            onToggleTag={(formKey, value) => handleToggleTag(formKey, value, setCreateForm)}
            previewUrl={createImagePreview}
            saving={saving}
            submitLabel="학생 등록"
          />
        </Modal>
      ) : null}

      {showEditModal ? (
        <Modal body="수정 저장 시 선택한 이미지 파일도 함께 업로드됩니다." onClose={() => setShowEditModal(false)} title="학생 정보를 수정해 주세요">
          <ChildForm
            feedback={feedback}
            fileInputId="edit-child-image-modal"
            form={editForm}
            onChange={(event) => handleFormChange(setEditForm, event)}
            onClearFile={() => clearFile(setEditImageFile, setEditImagePreview)}
            onFileChange={(event) => selectFile(event.target.files?.[0], setEditImageFile, setEditImagePreview)}
            onSubmit={handleEditSubmit}
            onToggleTag={(formKey, value) => handleToggleTag(formKey, value, setEditForm)}
            previewUrl={editImagePreview}
            saving={saving}
            submitLabel="수정 저장"
          />
        </Modal>
      ) : null}
    </ParentShell>
  )
}
