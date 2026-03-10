import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FeedbackBanner from '../components/FeedbackBanner'
import ChildProfileEditor from '../components/ChildProfileEditor'
import PaginationBar from '../components/PaginationBar'
import {
  childMissionsRequest,
  childAuthorizationsRequest,
  createChildRequest,
  deleteChildRequest,
  grantChildAuthorizationRequest,
  issueTemporaryChildPinRequest,
  myChildrenRequest,
  removeChildPinRequest,
  revokeChildAuthorizationRequest,
  updateChildAuthorizationRequest,
  updateChildPinRequest,
} from '../api'
import { useAuth } from '../contexts/AuthContext'
import { KO } from '../constants/messages.ko'
import { resolveErrorMessage } from '../utils/errorMessage'

function isRejectedMission(mission) {
  return String(mission?.status || '').toUpperCase() === 'IN_PROGRESS'
    && String(mission?.therapistFeedback || '').trim().length > 0
}

const CHILD_PERMISSION_OPTIONS = ['VIEW_REPORT', 'WRITE_NOTE', 'PLAY_GAME', 'MANAGE']
const TEMP_PIN_VISIBLE_SECONDS = 60
const TEMP_PIN_COOLDOWN_SECONDS = 30

function ParentHomePage() {
  const { user, logout, withAuthRetry } = useAuth()
  const navigate = useNavigate()
  const t = KO.parentHome

  const tabs = [
    { key: 'child', label: t.tabs.child },
    { key: 'pin', label: t.tabs.pin },
    { key: 'auth', label: t.tabs.auth },
    { key: 'mission', label: t.tabs.mission },
  ]

  const [activeTab, setActiveTab] = useState('child')
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState('')
  const [missions, setMissions] = useState([])
  const [missionPage, setMissionPage] = useState(0)
  const [missionSize, setMissionSize] = useState(10)
  const [missionTotalPages, setMissionTotalPages] = useState(0)
  const [missionTotalElements, setMissionTotalElements] = useState(0)
  const [missionStatusFilter, setMissionStatusFilter] = useState('ALL')
  const [missionSortKey, setMissionSortKey] = useState('DUE_ASC')
  const [showRejectedOnly, setShowRejectedOnly] = useState(false)
  const [loadingChildren, setLoadingChildren] = useState(false)
  const [loadingMissions, setLoadingMissions] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [creatingChild, setCreatingChild] = useState(false)
  const [deletingChild, setDeletingChild] = useState(false)
  const [childName, setChildName] = useState('')
  const [childBirthDate, setChildBirthDate] = useState('')
  const [childGender, setChildGender] = useState('')
  const [childPin, setChildPin] = useState('')

  const [pinCurrentPin, setPinCurrentPin] = useState('')
  const [pinNewPin, setPinNewPin] = useState('')
  const [pinRemoveCurrentPin, setPinRemoveCurrentPin] = useState('')
  const [pinBusy, setPinBusy] = useState(false)
  const [issuedTemporaryPin, setIssuedTemporaryPin] = useState('')
  const [tempPinVisibleUntil, setTempPinVisibleUntil] = useState(null)
  const [tempPinCooldownUntil, setTempPinCooldownUntil] = useState(null)
  const [nowMs, setNowMs] = useState(Date.now())

  const [authorizations, setAuthorizations] = useState([])
  const [loadingAuthorizations, setLoadingAuthorizations] = useState(false)
  const [authorizing, setAuthorizing] = useState(false)
  const [grantTargetUserId, setGrantTargetUserId] = useState('')
  const [grantPermissions, setGrantPermissions] = useState(['VIEW_REPORT'])
  const [authorizationSearch, setAuthorizationSearch] = useState('')
  const [editablePermissionsByUserId, setEditablePermissionsByUserId] = useState({})

  const selectedChild = useMemo(() => children.find((c) => c.childId === selectedChildId), [children, selectedChildId])
  const tempPinVisibleRemaining = Math.max(0, Math.ceil(((tempPinVisibleUntil || 0) - nowMs) / 1000))
  const tempPinCooldownRemaining = Math.max(0, Math.ceil(((tempPinCooldownUntil || 0) - nowMs) / 1000))

  const filteredAuthorizations = useMemo(() => {
    const keyword = authorizationSearch.trim().toLowerCase()
    const sorted = [...authorizations].sort((a, b) => {
      if (a?.isPrimary && !b?.isPrimary) return -1
      if (!a?.isPrimary && b?.isPrimary) return 1
      return String(a?.user?.name || '').localeCompare(String(b?.user?.name || ''))
    })
    if (!keyword) return sorted
    return sorted.filter((auth) => {
      const name = String(auth?.user?.name || '').toLowerCase()
      const email = String(auth?.user?.email || '').toLowerCase()
      const userId = String(auth?.user?.userId || '').toLowerCase()
      return name.includes(keyword) || email.includes(keyword) || userId.includes(keyword)
    })
  }, [authorizations, authorizationSearch])

  const visibleMissions = useMemo(() => {
    let list = [...missions]
    if (missionStatusFilter !== 'ALL') {
      list = list.filter((m) => String(m?.status || '').toUpperCase() === missionStatusFilter)
    }
    if (showRejectedOnly) list = list.filter((m) => isRejectedMission(m))

    const timeOf = (v) => {
      if (!v) return Number.MAX_SAFE_INTEGER
      const t = Date.parse(v)
      return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t
    }

    list.sort((a, b) => {
      if (missionSortKey === 'DUE_DESC') return timeOf(b?.dueDate) - timeOf(a?.dueDate)
      if (missionSortKey === 'CREATED_DESC') return timeOf(b?.createdAt) - timeOf(a?.createdAt)
      if (missionSortKey === 'STATUS_ASC') return String(a?.status || '').localeCompare(String(b?.status || ''))
      return timeOf(a?.dueDate) - timeOf(b?.dueDate)
    })

    return list
  }, [missions, missionStatusFilter, missionSortKey, showRejectedOnly])

  const isValidUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim())

  const loadChildren = async () => {
    setLoadingChildren(true)
    setError('')
    try {
      const response = await withAuthRetry((token) => myChildrenRequest(token))
      const list = response?.data || []
      setChildren(list)
      if (!selectedChildId && list.length > 0) setSelectedChildId(list[0].childId)
    } catch (e) {
      setError(resolveErrorMessage(e, t.child.loadError))
    } finally {
      setLoadingChildren(false)
    }
  }

  const loadMissions = async (childId, page = missionPage, size = missionSize) => {
    if (!childId) return
    setLoadingMissions(true)
    setError('')
    try {
      const response = await withAuthRetry((token) => childMissionsRequest(token, childId, page, size))
      const data = response?.data || {}
      setMissions(data?.content || [])
      setMissionTotalPages(data?.totalPages || 0)
      setMissionTotalElements(data?.totalElements || 0)
    } catch (e) {
      setError(resolveErrorMessage(e, t.mission.loadError))
    } finally {
      setLoadingMissions(false)
    }
  }

  const loadAuthorizations = async (childId) => {
    if (!childId) return
    setLoadingAuthorizations(true)
    setError('')
    try {
      const response = await withAuthRetry((token) => childAuthorizationsRequest(token, childId))
      const list = response?.data || []
      setAuthorizations(list)
      const editable = {}
      list.forEach((item) => {
        const uid = item?.user?.userId
        if (uid) editable[uid] = Array.from(item?.permissions || [])
      })
      setEditablePermissionsByUserId(editable)
    } catch (e) {
      setError(resolveErrorMessage(e, t.auth.loadError))
    } finally {
      setLoadingAuthorizations(false)
    }
  }

  useEffect(() => {
    loadChildren()
  }, [])

  useEffect(() => {
    if (selectedChildId) {
      loadAuthorizations(selectedChildId)
    }
    setPinCurrentPin('')
    setPinNewPin('')
    setPinRemoveCurrentPin('')
    setIssuedTemporaryPin('')
    setTempPinVisibleUntil(null)
    setTempPinCooldownUntil(null)
  }, [selectedChildId])

  useEffect(() => {
    if (selectedChildId) {
      loadMissions(selectedChildId, missionPage, missionSize)
    }
  }, [selectedChildId, missionPage, missionSize])

  useEffect(() => {
    setMissionPage(0)
  }, [selectedChildId, missionSize])

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (issuedTemporaryPin && tempPinVisibleUntil && nowMs >= tempPinVisibleUntil) {
      setIssuedTemporaryPin('')
      setTempPinVisibleUntil(null)
    }
  }, [issuedTemporaryPin, tempPinVisibleUntil, nowMs])

  const toggleGrantPermission = (permission) => {
    if (grantPermissions.includes(permission)) {
      setGrantPermissions(grantPermissions.filter((p) => p !== permission))
      return
    }
    setGrantPermissions([...grantPermissions, permission])
  }

  const toggleEditablePermission = (userId, permission) => {
    setEditablePermissionsByUserId((prev) => {
      const current = Array.from(prev[userId] || [])
      const next = current.includes(permission) ? current.filter((p) => p !== permission) : [...current, permission]
      return { ...prev, [userId]: next }
    })
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const handleCreateChild = async (event) => {
    event.preventDefault()
    setCreatingChild(true)
    setError('')
    setSuccess('')
    try {
      const payload = { name: childName.trim(), birthDate: childBirthDate || null, gender: childGender || null }
      if (childPin.trim()) payload.pin = childPin.trim()
      const response = await withAuthRetry((token) => createChildRequest(token, payload))
      const createdChild = response?.data
      setSuccess(t.child.createSuccess)
      setChildName('')
      setChildBirthDate('')
      setChildGender('')
      setChildPin('')
      await loadChildren()
      if (createdChild?.childId) setSelectedChildId(createdChild.childId)
    } catch (e) {
      setError(resolveErrorMessage(e, t.child.createError))
    } finally {
      setCreatingChild(false)
    }
  }

  const handleDeleteChild = async () => {
    if (!selectedChildId || !selectedChild) return
    const typedName = window.prompt(`${t.child.deleteConfirmPrompt}\n대상: ${selectedChild.name}`)
    if (typedName === null) return
    if (typedName.trim() !== selectedChild.name) {
      setError(t.child.deleteNameMismatch)
      setSuccess('')
      return
    }
    const confirmed = window.confirm(`${selectedChild.name} - ${t.child.deleteConfirmFinal}`)
    if (!confirmed) return

    setDeletingChild(true)
    setError('')
    setSuccess('')
    try {
      await withAuthRetry((token) => deleteChildRequest(token, selectedChildId))
      setSuccess(t.child.deleteSuccess)
      setSelectedChildId('')
      setMissions([])
      setAuthorizations([])
      await loadChildren()
    } catch (e) {
      setError(resolveErrorMessage(e, t.child.deleteError))
    } finally {
      setDeletingChild(false)
    }
  }

  const handleUpdatePin = async (event) => {
    event.preventDefault()
    if (!selectedChildId) return

    setPinBusy(true)
    setError('')
    setSuccess('')
    try {
      const payload = { newPin: pinNewPin.trim() }
      if (selectedChild?.pinEnabled) payload.currentPin = pinCurrentPin.trim()
      await withAuthRetry((token) => updateChildPinRequest(token, selectedChildId, payload))
      setSuccess(selectedChild?.pinEnabled ? t.pin.updateSuccess : t.pin.setSuccess)
      setPinCurrentPin('')
      setPinNewPin('')
      setIssuedTemporaryPin('')
      setTempPinVisibleUntil(null)
      await loadChildren()
    } catch (e) {
      setError(resolveErrorMessage(e, t.pin.updateError))
    } finally {
      setPinBusy(false)
    }
  }

  const handleRemovePin = async (event) => {
    event.preventDefault()
    if (!selectedChildId) return

    setPinBusy(true)
    setError('')
    setSuccess('')
    try {
      await withAuthRetry((token) => removeChildPinRequest(token, selectedChildId, pinRemoveCurrentPin.trim()))
      setSuccess(t.pin.removeSuccess)
      setPinCurrentPin('')
      setPinNewPin('')
      setPinRemoveCurrentPin('')
      setIssuedTemporaryPin('')
      setTempPinVisibleUntil(null)
      await loadChildren()
    } catch (e) {
      setError(resolveErrorMessage(e, t.pin.removeError))
    } finally {
      setPinBusy(false)
    }
  }

  const handleIssueTemporaryPin = async () => {
    if (!selectedChildId) return
    if (tempPinCooldownRemaining > 0) {
      setError(`${t.pin.cooldownError} (${tempPinCooldownRemaining}s)`)
      setSuccess('')
      return
    }

    setPinBusy(true)
    setError('')
    setSuccess('')
    try {
      const response = await withAuthRetry((token) => issueTemporaryChildPinRequest(token, selectedChildId))
      const pin = response?.data?.pin || ''
      const now = Date.now()
      setIssuedTemporaryPin(pin)
      setTempPinVisibleUntil(now + TEMP_PIN_VISIBLE_SECONDS * 1000)
      setTempPinCooldownUntil(now + TEMP_PIN_COOLDOWN_SECONDS * 1000)
      setSuccess(t.pin.issueSuccess)
      await loadChildren()
    } catch (e) {
      setError(resolveErrorMessage(e, t.pin.issueError))
    } finally {
      setPinBusy(false)
    }
  }

  const handleGrantAuthorization = async (event) => {
    event.preventDefault()
    if (!selectedChildId) return

    setAuthorizing(true)
    setError('')
    setSuccess('')
    try {
      await withAuthRetry((token) =>
        grantChildAuthorizationRequest(token, selectedChildId, {
          userId: grantTargetUserId.trim(),
          permissions: grantPermissions,
          isPrimary: false,
        }),
      )
      setSuccess(t.auth.grantSuccess)
      setGrantTargetUserId('')
      setGrantPermissions(['VIEW_REPORT'])
      await loadAuthorizations(selectedChildId)
    } catch (e) {
      setError(resolveErrorMessage(e, t.auth.grantError))
    } finally {
      setAuthorizing(false)
    }
  }

  const handleUpdateAuthorization = async (targetUserId) => {
    if (!selectedChildId) return
    setAuthorizing(true)
    setError('')
    setSuccess('')
    try {
      const permissions = Array.from(editablePermissionsByUserId[targetUserId] || [])
      await withAuthRetry((token) =>
        updateChildAuthorizationRequest(token, selectedChildId, targetUserId, {
          userId: targetUserId,
          permissions,
          isPrimary: false,
        }),
      )
      setSuccess(t.auth.updateSuccess)
      await loadAuthorizations(selectedChildId)
    } catch (e) {
      setError(resolveErrorMessage(e, t.auth.updateError))
    } finally {
      setAuthorizing(false)
    }
  }

  const handleRevokeAuthorization = async (targetUserId) => {
    if (!selectedChildId) return
    setAuthorizing(true)
    setError('')
    setSuccess('')
    try {
      await withAuthRetry((token) => revokeChildAuthorizationRequest(token, selectedChildId, targetUserId))
      setSuccess(t.auth.revokeSuccess)
      await loadAuthorizations(selectedChildId)
    } catch (e) {
      setError(resolveErrorMessage(e, t.auth.revokeError))
    } finally {
      setAuthorizing(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <section className="rounded-2xl border border-emerald-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">PARENT HOME</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.title}</h1>
          </div>
          <button type="button" onClick={handleLogout} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            {t.links.logout}
          </button>
        </div>

        <div className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p><span className="font-semibold">{t.user.name}:</span> {user?.name}</p>
          <p><span className="font-semibold">{t.user.email}:</span> {user?.email}</p>
          <p><span className="font-semibold">{t.user.roles}:</span> {(user?.roles || []).join(', ') || KO.common.none}</p>
        </div>

        <FeedbackBanner error={error} success={success} />

        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === tab.key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'child' && (
          <>
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">{t.child.createTitle}</p>
              <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateChild}>
                <label className="text-xs font-semibold text-slate-700">{t.child.name} *
                  <input type="text" value={childName} onChange={(e) => setChildName(e.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder={t.child.name} />
                </label>
                <label className="text-xs font-semibold text-slate-700">{t.child.birthDate}
                  <input type="date" value={childBirthDate} onChange={(e) => setChildBirthDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-700">{t.child.gender}
                  <select value={childGender} onChange={(e) => setChildGender(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">{t.child.genderSelect}</option>
                    <option value="MALE">MALE</option>
                    <option value="FEMALE">FEMALE</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700">{t.child.pin}
                  <input type="text" value={childPin} onChange={(e) => setChildPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="1234" />
                </label>
                <div className="md:col-span-2">
                  <button type="submit" disabled={creatingChild} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400">{creatingChild ? t.child.creating : t.child.create}</button>
                </div>
              </form>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="childSelect">{t.child.select}</label>
                <select id="childSelect" value={selectedChildId} onChange={(e) => setSelectedChildId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" disabled={loadingChildren || children.length === 0}>
                  {children.length === 0 && <option value="">{t.child.none}</option>}
                  {children.map((child) => <option key={child.childId} value={child.childId}>{child.name}</option>)}
                </select>
                <button type="button" onClick={loadChildren} disabled={loadingChildren} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400">{loadingChildren ? KO.common.loading : t.child.refresh}</button>
              </div>

              {selectedChild && (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <p>{t.child.selected}: <span className="font-semibold">{selectedChild.name}</span></p>
                  <button type="button" onClick={handleDeleteChild} disabled={deletingChild} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-400">{deletingChild ? KO.common.loading : t.child.delete}</button>
                </div>
              )}
            </div>

            <ChildProfileEditor childId={selectedChildId} onSaved={loadChildren} />
          </>
        )}

        {activeTab === 'pin' && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            {!selectedChildId ? <p className="text-sm text-slate-600">{t.pin.selectChildFirst}</p> : (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{t.pin.title}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${selectedChild?.pinEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{selectedChild?.pinEnabled ? t.pin.enabled : t.pin.disabled}</span>
                </div>

                <form className="grid gap-3 md:grid-cols-3" onSubmit={handleUpdatePin}>
                  {selectedChild?.pinEnabled ? (
                    <label className="text-xs font-semibold text-slate-700">{t.pin.currentPin}
                      <input type="text" value={pinCurrentPin} onChange={(e) => setPinCurrentPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="1234" />
                    </label>
                  ) : null}
                  <label className="text-xs font-semibold text-slate-700">{t.pin.newPin}
                    <input type="text" value={pinNewPin} onChange={(e) => setPinNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="1234" />
                  </label>
                  <div className="flex items-end">
                    <button type="submit" disabled={pinBusy || pinNewPin.length !== 4 || (selectedChild?.pinEnabled && pinCurrentPin.length !== 4)} className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400">{pinBusy ? KO.common.loading : selectedChild?.pinEnabled ? t.pin.updatePin : t.pin.setPin}</button>
                  </div>
                </form>

                {selectedChild?.pinEnabled ? (
                  <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={handleRemovePin}>
                    <label className="text-xs font-semibold text-slate-700 md:col-span-2">{t.pin.removePinCheck}
                      <input type="text" value={pinRemoveCurrentPin} onChange={(e) => setPinRemoveCurrentPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="1234" />
                    </label>
                    <div className="flex items-end">
                      <button type="submit" disabled={pinBusy || pinRemoveCurrentPin.length !== 4} className="w-full rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-400">{pinBusy ? KO.common.loading : t.pin.removePin}</button>
                    </div>
                  </form>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={handleIssueTemporaryPin} disabled={pinBusy || tempPinCooldownRemaining > 0} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400">
                    {pinBusy ? t.pin.issuingTempPin : tempPinCooldownRemaining > 0 ? `${t.pin.cooldown} (${tempPinCooldownRemaining}s)` : t.pin.issueTempPin}
                  </button>
                  {issuedTemporaryPin ? <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">임시 PIN: {issuedTemporaryPin} ({tempPinVisibleRemaining}s)</p> : <p className="text-xs text-slate-500">{t.pin.tempPinNotice}</p>}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'auth' && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            {!selectedChildId ? <p className="text-sm text-slate-600">{t.auth.selectChildFirst}</p> : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{t.auth.title}</p>
                  <button type="button" onClick={() => loadAuthorizations(selectedChildId)} disabled={!selectedChildId || loadingAuthorizations} className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">{loadingAuthorizations ? KO.common.loading : KO.common.refresh}</button>
                </div>

                <form className="rounded-lg border border-slate-200 p-3" onSubmit={handleGrantAuthorization}>
                  <p className="mb-2 text-xs font-semibold text-slate-700">{t.auth.grantTitle}</p>
                  <label className="block text-xs font-semibold text-slate-700">{t.auth.targetUserId}
                    <input type="text" value={grantTargetUserId} onChange={(e) => setGrantTargetUserId(e.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="예: 123e4567-e89b-12d3-a456-426614174000" />
                  </label>

                  <div className="mt-3">
                    <p className="mb-2 text-xs font-semibold text-slate-700">{t.auth.permissionSelect}</p>
                    <div className="flex flex-wrap gap-2">
                      {CHILD_PERMISSION_OPTIONS.map((permission) => (
                        <button key={`grant-${permission}`} type="button" onClick={() => toggleGrantPermission(permission)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${grantPermissions.includes(permission) ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>
                          {permission}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3">
                    <button type="submit" disabled={!selectedChildId || authorizing || grantPermissions.length === 0 || !isValidUuid(grantTargetUserId)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400">{authorizing ? KO.common.loading : t.auth.grant}</button>
                  </div>
                </form>

                <div className="mt-4 space-y-3">
                  <input type="text" value={authorizationSearch} onChange={(e) => setAuthorizationSearch(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder={t.auth.searchPlaceholder} />

                  {filteredAuthorizations.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{t.auth.noData}</p>
                  ) : (
                    filteredAuthorizations.map((auth) => {
                      const targetUserId = auth?.user?.userId
                      const currentPermissions = Array.from(editablePermissionsByUserId[targetUserId] || [])
                      return (
                        <article key={auth.authorizationId || targetUserId} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">{auth?.user?.name || KO.common.none} ({auth?.user?.email || KO.common.none})</p>
                            {auth?.isPrimary ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">PRIMARY</span> : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">userId: {targetUserId || KO.common.none}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {CHILD_PERMISSION_OPTIONS.map((permission) => {
                              const hasPermission = currentPermissions.includes(permission)
                              return (
                                <button key={`${targetUserId}-${permission}`} type="button" disabled={auth?.isPrimary || !targetUserId} onClick={() => toggleEditablePermission(targetUserId, permission)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${hasPermission ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 bg-white text-slate-700'} disabled:cursor-not-allowed disabled:opacity-60`}>
                                  {permission}
                                </button>
                              )
                            })}
                          </div>
                          <div className="mt-3">
                            <button type="button" disabled={auth?.isPrimary || authorizing || !targetUserId} onClick={() => handleUpdateAuthorization(targetUserId)} className="mr-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400">{t.auth.update}</button>
                            <button type="button" disabled={auth?.isPrimary || authorizing || !targetUserId} onClick={() => { const ok = window.confirm(t.auth.revokeConfirm); if (ok) handleRevokeAuthorization(targetUserId) }} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-400">{t.auth.revoke}</button>
                          </div>
                        </article>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'mission' && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            {!selectedChildId ? <p className="text-sm text-slate-600">{t.mission.selectChildFirst}</p> : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{t.mission.title}</p>
                  <button type="button" onClick={() => loadMissions(selectedChildId, missionPage, missionSize)} disabled={!selectedChildId || loadingMissions} className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">{loadingMissions ? KO.common.loading : KO.common.refresh}</button>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <select value={missionStatusFilter} onChange={(e) => setMissionStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700">
                    <option value="ALL">{t.mission.statusAll}</option>
                    <option value="ASSIGNED">ASSIGNED</option><option value="IN_PROGRESS">IN_PROGRESS</option><option value="COMPLETED">COMPLETED</option><option value="VERIFIED">VERIFIED</option><option value="CANCELLED">CANCELLED</option>
                  </select>
                  <select value={missionSortKey} onChange={(e) => setMissionSortKey(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700">
                    <option value="DUE_ASC">{t.mission.sortDueAsc}</option><option value="DUE_DESC">{t.mission.sortDueDesc}</option><option value="CREATED_DESC">{t.mission.sortCreatedDesc}</option><option value="STATUS_ASC">{t.mission.sortStatusAsc}</option>
                  </select>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={showRejectedOnly} onChange={(e) => setShowRejectedOnly(e.target.checked)} />{t.mission.onlyRejected}</label>
                </div>

                <div className="space-y-4">
                  {visibleMissions.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{t.mission.noData}</p> : visibleMissions.map((mission) => (
                    <article key={mission.missionId} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">미션 ID: {mission.missionId}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{t.mission.status}: {mission.status}</span>
                          {isRejectedMission(mission) && <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">{t.mission.rejectedBadge}</span>}
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{t.mission.templateName}: {mission.templateName || KO.common.none}</p>
                      <p className="mt-1 text-sm text-slate-500">{t.mission.dueDate}: {mission.dueDate || KO.common.none}</p>
                      {isRejectedMission(mission) && <p className="mt-1 text-xs text-rose-700">{t.mission.rejectedFeedback}: {mission.therapistFeedback}</p>}
                      <div className="mt-3">
                        <Link to={`/parent/missions/${mission.missionId}`} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">{t.mission.detail}</Link>
                      </div>
                    </article>
                  ))}
                </div>
                <PaginationBar
                  page={missionPage}
                  totalPages={missionTotalPages}
                  totalElements={missionTotalElements}
                  size={missionSize}
                  labels={t.mission.pagination}
                  disabled={loadingMissions}
                  onPageChange={setMissionPage}
                  onSizeChange={(nextSize) => {
                    setMissionPage(0)
                    setMissionSize(nextSize)
                  }}
                />
              </>
            )}
          </div>
        )}

        <div className="mt-6">
          <div className="flex flex-wrap gap-2">
            <Link to="/notifications" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">{t.links.notifications}</Link>
            <Link to="/reports" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">{t.links.reports}</Link>
            <Link to="/notes" className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">{t.links.notes}</Link>
            <Link to="/missions/calendar" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">{t.links.calendar}</Link>
            <Link to="/home" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{t.links.roleHome}</Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default ParentHomePage
