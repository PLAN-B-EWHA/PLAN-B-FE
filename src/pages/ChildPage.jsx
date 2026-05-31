import { useEffect, useMemo, useState } from 'react'
import { ParentShell } from '../components/ParentShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { buildChildFormFromDetail, calculateAgeLabel, defaultChildForm, getGenderLabel, normalizeChildForm, resolveUploadUrl } from '../lib/childUtils'
import { PinVerifyModal } from '../lib/PinVerifyModal'

const permissionOptions = [
  { value: 'PLAY_GAME', label: '게임 플레이' },
  { value: 'VIEW_REPORT', label: '리포트 조회' },
  { value: 'WRITE_NOTE', label: '기록 작성' },
  { value: 'ASSIGN_MISSION', label: '숙제 할당' },
  { value: 'MANAGE', label: '학생 관리' },
]

const defaultAuthorizationForm = { userId: '', permissions: [] }

function Field({ label, value, wide = false }) {
  return (
    <div className={`field ${wide ? 'full' : ''}`}>
      <p className="fl">{label}</p>
      <p className={`fv ${value ? '' : 'empty'}`}>{value || '미입력'}</p>
    </div>
  )
}

function PermissionChips({ selectedValues, onToggle, readOnly = false }) {
  return (
    <div className="permission-chips">
      {permissionOptions.map((option) => {
        const on = selectedValues.includes(option.value)
        return (
          <button
            className={`perm ${on ? 'on' : ''}`}
            disabled={readOnly}
            key={option.value}
            onClick={() => onToggle?.(option.value)}
            type="button"
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function ChildModal({ title, form, saving, feedback, onClose, onChange, onSubmit, submitLabel }) {
  return (
    <div className="overlay">
      <form className="modal child-modal" onSubmit={onSubmit}>
        <div className="modal-head">
          <button className="modal-close" onClick={onClose} type="button">×</button>
          <h2>{title}</h2>
          <p className="modal-meta">기본 정보와 선택 정보를 입력합니다.</p>
        </div>
        <div className="modal-body child-form">
          {feedback ? <div className="stats-feedback">{feedback}</div> : null}
          <label>
            <span>이름 *</span>
            <input className="input" name="name" onChange={onChange} value={form.name} />
          </label>
          <label>
            <span>생년월일</span>
            <input className="input" name="birthDate" onChange={onChange} type="date" value={form.birthDate} />
          </label>
          <label>
            <span>성별</span>
            <select className="input" name="gender" onChange={onChange} value={form.gender}>
              <option value="MALE">남아</option>
              <option value="FEMALE">여아</option>
              <option value="OTHER">기타</option>
            </select>
          </label>
          <label>
            <span>PIN</span>
            <input className="input" inputMode="numeric" maxLength={4} name="pin" onChange={onChange} placeholder="4자리 숫자" value={form.pin} />
          </label>
          <label>
            <span>관심사</span>
            <input className="input" name="interests" onChange={onChange} value={form.interests} />
          </label>
          <label>
            <span>진단일</span>
            <input className="input" name="diagnosisDate" onChange={onChange} type="date" value={form.diagnosisDate} />
          </label>
          <label className="wide">
            <span>진단/상태 메모</span>
            <textarea className="input" name="diagnosisInfo" onChange={onChange} value={form.diagnosisInfo} />
          </label>
          <label className="wide">
            <span>특이사항</span>
            <textarea className="input" name="specialNotes" onChange={onChange} value={form.specialNotes} />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} type="button">취소</button>
          <button className="btn btn-primary" disabled={saving} type="submit">{saving ? '저장 중...' : submitLabel}</button>
        </div>
      </form>
    </div>
  )
}

export function ChildPage() {
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [selectedChildDetail, setSelectedChildDetail] = useState(null)
  const [authorizations, setAuthorizations] = useState([])
  const [authorizationDrafts, setAuthorizationDrafts] = useState({})
  const [authorizationForm, setAuthorizationForm] = useState(defaultAuthorizationForm)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [authorizationLoading, setAuthorizationLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [authorizationSaving, setAuthorizationSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [authorizationFeedback, setAuthorizationFeedback] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [createForm, setCreateForm] = useState({ ...defaultChildForm })
  const [editForm, setEditForm] = useState({ ...defaultChildForm })
  const [pinGate, setPinGate] = useState(null)

  const selectedChild = useMemo(
    () => children.find((child) => child.childId === selectedChildId) || children[0] || null,
    [children, selectedChildId],
  )

  function withPin(child, action) {
    if (!child?.pinEnabled) { action(); return }
    setPinGate({ childId: child.childId, childName: child.name, onVerified: () => { setPinGate(null); action() } })
  }

  async function refreshChildren(targetChildId = null) {
    const response = await apiFetch('/children/my', { method: 'GET', token: accessToken })
    const payload = extractApiPayload(response) || []
    setChildren(payload)
    setSelectedChildId(targetChildId || payload[0]?.childId || null)
    return payload
  }

  async function refreshChildDetail(childId) {
    if (!childId) { setSelectedChildDetail(null); return null }
    const response = await apiFetch(`/children/${childId}`, { method: 'GET', token: accessToken })
    const payload = extractApiPayload(response)
    setSelectedChildDetail(payload)
    return payload
  }

  async function refreshAuthorizations(childId) {
    if (!childId) { setAuthorizations([]); setAuthorizationDrafts({}); return [] }
    setAuthorizationLoading(true)
    try {
      const response = await apiFetch(`/children/${childId}/authorizations`, { method: 'GET', token: accessToken })
      const payload = extractApiPayload(response) || []
      setAuthorizations(payload)
      setAuthorizationDrafts(payload.reduce((acc, item) => {
        const uid = item?.user?.userId
        if (uid) acc[uid] = Array.isArray(item.permissions) ? item.permissions : []
        return acc
      }, {}))
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
      if (!accessToken) { setLoading(false); return }
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
    return () => { ignore = true }
  }, [accessToken])

  useEffect(() => {
    let ignore = false
    async function loadDetail() {
      if (!accessToken || !selectedChildId) { setSelectedChildDetail(null); return }
      setDetailLoading(true)
      try {
        const response = await apiFetch(`/children/${selectedChildId}`, { method: 'GET', token: accessToken })
        if (!ignore) setSelectedChildDetail(extractApiPayload(response))
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      } finally {
        if (!ignore) setDetailLoading(false)
      }
    }
    loadDetail()
    return () => { ignore = true }
  }, [accessToken, selectedChildId])

  useEffect(() => {
    if (!accessToken || !selectedChildId) return
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

  async function handleCreateSubmit(event) {
    event.preventDefault()
    if (!createForm.name.trim()) { setFeedback('이름은 필수입니다.'); return }
    setSaving(true); setFeedback('')
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
    if (!editForm.name.trim()) { setFeedback('이름은 필수입니다.'); return }
    setSaving(true); setFeedback('')
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

  function handleDeleteChild() {
    if (!selectedChild?.childId) return
    async function doDelete() {
      setSaving(true); setFeedback('')
      try {
        await apiFetch(`/children/${selectedChild.childId}`, { method: 'DELETE', token: accessToken })
        const remaining = await refreshChildren()
        if (remaining[0]?.childId) await refreshChildDetail(remaining[0].childId)
        setFeedback('학생 정보가 삭제되었습니다.')
      } catch (error) {
        setFeedback(extractApiErrorMessage(error))
      } finally {
        setSaving(false)
      }
    }
    withPin(selectedChild, () => {
      if (window.confirm(`${selectedChild.name} 학생 정보를 삭제할까요?`)) doDelete()
    })
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
      const permissions = current[targetUserId] || []
      return {
        ...current,
        [targetUserId]: permissions.includes(permission)
          ? permissions.filter((item) => item !== permission)
          : [...permissions, permission],
      }
    })
  }

  function handleGrantAuthorization(event) {
    event.preventDefault()
    if (!selectedChild?.childId) return
    if (!authorizationForm.userId.trim()) { setAuthorizationFeedback('권한을 부여할 사용자 ID를 입력해 주세요.'); return }

    async function doGrant() {
      setAuthorizationSaving(true); setAuthorizationFeedback('')
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

    withPin(selectedChild, doGrant)
  }

  function handleUpdateAuthorization(targetUserId) {
    if (!selectedChild?.childId || !targetUserId) return
    async function doUpdate() {
      setAuthorizationSaving(true); setAuthorizationFeedback('')
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
    withPin(selectedChild, doUpdate)
  }

  function handleRevokeAuthorization(targetUserId) {
    if (!selectedChild?.childId || !targetUserId) return
    async function doRevoke() {
      setAuthorizationSaving(true); setAuthorizationFeedback('')
      try {
        await apiFetch(`/children/${selectedChild.childId}/authorizations/${targetUserId}`, { method: 'DELETE', token: accessToken })
        await refreshAuthorizations(selectedChild.childId)
      } catch (error) {
        setAuthorizationFeedback(extractApiErrorMessage(error))
      } finally {
        setAuthorizationSaving(false)
      }
    }
    withPin(selectedChild, doRevoke)
  }

  const detail = selectedChildDetail || selectedChild
  const imageUrl = resolveUploadUrl(detail?.profileImageUrl)

  return (
    <ParentShell
      actions={!loading && children.length > 0 ? (
        <>
          <button className="btn btn-ghost" onClick={() => withPin(selectedChild, () => { setEditForm(buildChildFormFromDetail(detail)); setShowEditModal(true) })} type="button">학생 수정</button>
          <button className="btn btn-danger" disabled={saving} onClick={handleDeleteChild} type="button">학생 삭제</button>
          <button className="btn btn-primary" onClick={() => { setCreateForm({ ...defaultChildForm }); setShowCreateModal(true) }} type="button">+ 학생 추가</button>
        </>
      ) : null}
      childCount={children.length}
      heading="학생 관리"
      selectedChild={selectedChild}
      subheading={selectedChild ? `${selectedChild.name}의 기본 정보를 확인하세요.` : '학생 목록과 상세 정보를 관리합니다.'}
    >
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}
      {loading ? <div className="stats-loading">학생 목록을 불러오는 중입니다...</div> : null}

      {!loading && children.length === 0 ? (
        <section className="stats-panel empty-state">
          <div className="es-title">등록된 학생이 없습니다.</div>
          <div className="es-sub">학생을 추가하면 상세 정보와 권한 관리가 표시됩니다.</div>
          <button className="btn btn-primary mt-6" onClick={() => setShowCreateModal(true)} type="button">학생 추가</button>
        </section>
      ) : null}

      {!loading && children.length > 0 ? (
        <>
          <section className="child-management-grid">
            <aside className="stats-panel child-list-panel">
              <div className="card-head">
                <p className="card-title">학생 목록</p>
                <span className="count">{children.length}명</span>
              </div>
              <div className="child-list">
                {children.map((child) => (
                  <button
                    className={`child-list-item ${selectedChild?.childId === child.childId ? 'active' : ''}`}
                    key={child.childId}
                    onClick={() => setSelectedChildId(child.childId)}
                    type="button"
                  >
                    <span className="student-avatar">{child.name?.[0] || '?'}</span>
                    <span>
                      <strong>{child.name}</strong>
                      <small>{calculateAgeLabel(child.birthDate)} · {getGenderLabel(child.gender)}</small>
                    </span>
                    {child.pinEnabled ? <b>⌘</b> : null}
                  </button>
                ))}
              </div>
            </aside>

            <article className="stats-panel child-detail-panel">
              {detailLoading ? <p className="empty-note">상세 정보를 불러오는 중입니다...</p> : (
                <>
                  <div className="child-profile-head">
                    <div className="portrait child-portrait">
                      {imageUrl ? <img alt={detail?.name || 'student'} src={imageUrl} /> : <span>♙</span>}
                    </div>
                    <div>
                      <p className="eyebrow">선택된 학생</p>
                      <h2>{detail?.name || '-'}</h2>
                      <p>{calculateAgeLabel(detail?.birthDate)} · {getGenderLabel(detail?.gender)}</p>
                      <span className={`badge ${detail?.pinEnabled ? 'badge-info' : 'badge-muted'}`}>{detail?.pinEnabled ? 'PIN 설정됨' : 'PIN 미설정'}</span>
                    </div>
                  </div>
                  <div className="fields child-fields">
                    <Field label="관심사" value={detail?.interests} />
                    <Field label="진단일" value={detail?.diagnosisDate} />
                    <Field label="진단 · 상태 메모" value={detail?.diagnosisInfo} wide />
                    <Field label="특이사항" value={detail?.specialNotes} wide />
                  </div>
                </>
              )}
            </article>
          </section>

          <section className="child-permission-grid">
            <form className="stats-panel permission-grant-panel" onSubmit={handleGrantAuthorization}>
              <div className="card-head">
                <div>
                  <p className="card-title">권한 부여</p>
                  <p className="sub">사용자 ID를 입력해 학생 접근 권한을 연결합니다.</p>
                </div>
              </div>
              {authorizationFeedback ? <div className="stats-feedback">{authorizationFeedback}</div> : null}
              <label className="child-form-field">
                <span>대상 사용자 ID</span>
                <input
                  className="input"
                  onChange={(event) => setAuthorizationForm((current) => ({ ...current, userId: event.target.value }))}
                  placeholder="UUID 형식 사용자 ID"
                  value={authorizationForm.userId}
                />
              </label>
              <div className="child-form-field">
                <span>부여할 권한</span>
                <PermissionChips onToggle={toggleAuthorizationFormPermission} selectedValues={authorizationForm.permissions} />
              </div>
              <div className="permission-actions">
                <button className="btn btn-danger" disabled={authorizationSaving} type="button">회수</button>
                <button className="btn btn-primary" disabled={authorizationSaving} type="submit">{authorizationSaving ? '처리 중...' : '권한 부여'}</button>
              </div>
            </form>

            <article className="stats-panel permission-manage-panel">
              <div className="card-head">
                <div>
                  <p className="card-title">권한 관리</p>
                  <p className="sub">기존 권한을 수정하거나 회수할 수 있습니다.</p>
                </div>
                <span className="count">{authorizations.length}명</span>
              </div>
              {authorizationLoading ? <p className="empty-note">권한 정보를 불러오는 중입니다...</p> : null}
              <div className="authorization-list">
                {authorizations.length ? authorizations.map((item) => {
                  const targetUserId = item?.user?.userId
                  const permissions = authorizationDrafts[targetUserId] || []
                  return (
                    <div className="authorization-card" key={targetUserId || item.authorizationId}>
                      <div className="authorization-head">
                        <div>
                          <strong>{item?.user?.name || item?.user?.email || '연결 사용자'}</strong>
                          <small>{item?.user?.email || targetUserId}</small>
                          <span className={`badge ${item?.isPrimary ? 'badge-violet' : 'badge-muted'}`}>{item?.isPrimary ? '주보호자' : '일반 사용자'}</span>
                        </div>
                        {!item?.isPrimary ? (
                          <div className="head-actions">
                            <button className="btn btn-ghost btn-sm" disabled={authorizationSaving} onClick={() => handleUpdateAuthorization(targetUserId)} type="button">저장</button>
                            <button className="btn btn-danger btn-sm" disabled={authorizationSaving} onClick={() => handleRevokeAuthorization(targetUserId)} type="button">회수</button>
                          </div>
                        ) : null}
                      </div>
                      {item?.isPrimary ? (
                        <div className="note-ok">✓ 주보호자는 모든 기본 권한이 유지됩니다.</div>
                      ) : (
                        <PermissionChips onToggle={(permission) => toggleAuthorizationDraft(targetUserId, permission)} selectedValues={permissions} />
                      )}
                    </div>
                  )
                }) : <div className="empty-state"><div className="es-title">연결된 사용자가 없습니다.</div></div>}
              </div>
            </article>
          </section>
        </>
      ) : null}

      {showCreateModal ? (
        <ChildModal
          feedback={feedback}
          form={createForm}
          onChange={(event) => handleFormChange(setCreateForm, event)}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSubmit}
          saving={saving}
          submitLabel="학생 등록"
          title="학생 등록"
        />
      ) : null}

      {showEditModal ? (
        <ChildModal
          feedback={feedback}
          form={editForm}
          onChange={(event) => handleFormChange(setEditForm, event)}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
          saving={saving}
          submitLabel="수정 저장"
          title="학생 정보 수정"
        />
      ) : null}

      {pinGate ? (
        <PinVerifyModal
          accessToken={accessToken}
          childId={pinGate.childId}
          childName={pinGate.childName}
          onClose={() => setPinGate(null)}
          onVerified={pinGate.onVerified}
        />
      ) : null}
    </ParentShell>
  )
}
