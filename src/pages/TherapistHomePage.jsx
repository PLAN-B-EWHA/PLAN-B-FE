import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  accessibleChildrenRequest,
  assignMissionRequest,
  childMissionsRequest,
  missionDetailRequest,
  missionPhotosRequest,
  missionTemplatesRequest,
} from '../api'
import { useAuth } from '../contexts/AuthContext'
import FeedbackBanner from '../components/FeedbackBanner'
import ChildProfileEditor from '../components/ChildProfileEditor'
import PaginationBar from '../components/PaginationBar'
import { KO } from '../constants/messages.ko'
import { resolveErrorMessage } from '../utils/errorMessage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

function TherapistHomePage() {
  const { user, logout, withAuthRetry } = useAuth()
  const navigate = useNavigate()
  const t = KO.therapistHome

  const tabs = [
    { key: 'assign', label: t.tabs.assign },
    { key: 'missions', label: t.tabs.missions },
    { key: 'profile', label: t.tabs.profile },
  ]

  const [activeTab, setActiveTab] = useState('assign')

  const [children, setChildren] = useState([])
  const [templates, setTemplates] = useState([])
  const [missions, setMissions] = useState([])

  const [selectedChildId, setSelectedChildId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [dueDate, setDueDate] = useState('')

  const [missionPage, setMissionPage] = useState(0)
  const [missionSize, setMissionSize] = useState(10)
  const [missionTotalPages, setMissionTotalPages] = useState(0)
  const [missionTotalElements, setMissionTotalElements] = useState(0)

  const [photosByMission, setPhotosByMission] = useState({})

  const [loadingBase, setLoadingBase] = useState(false)
  const [loadingMissions, setLoadingMissions] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [missionStatusFilter, setMissionStatusFilter] = useState('ALL')
  const [missionSortKey, setMissionSortKey] = useState('DUE_ASC')
  const [showRejectedOnly, setShowRejectedOnly] = useState(false)

  const selectedChild = useMemo(
    () => children.find((child) => child.childId === selectedChildId),
    [children, selectedChildId],
  )

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.templateId === selectedTemplateId),
    [templates, selectedTemplateId],
  )

  const visibleMissions = useMemo(() => {
    let list = [...missions]

    if (missionStatusFilter !== 'ALL') {
      list = list.filter((mission) => String(mission?.status || '').toUpperCase() === missionStatusFilter)
    }

    if (showRejectedOnly) {
      list = list.filter((mission) => String(mission?.status || '').toUpperCase() === 'IN_PROGRESS'
        && String(mission?.therapistFeedback || '').trim().length > 0)
    }

    const timeOf = (value) => {
      if (!value) return Number.MAX_SAFE_INTEGER
      const parsed = Date.parse(value)
      return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
    }

    list.sort((a, b) => {
      if (missionSortKey === 'DUE_DESC') return timeOf(b?.dueDate) - timeOf(a?.dueDate)
      if (missionSortKey === 'COMPLETED_DESC') return timeOf(b?.completedAt) - timeOf(a?.completedAt)
      if (missionSortKey === 'STATUS_ASC') return String(a?.status || '').localeCompare(String(b?.status || ''))
      return timeOf(a?.dueDate) - timeOf(b?.dueDate)
    })

    return list
  }, [missions, missionStatusFilter, missionSortKey, showRejectedOnly])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const loadBaseData = async () => {
    setLoadingBase(true)
    setError('')
    try {
      const [childrenResponse, templatesResponse] = await Promise.all([
        withAuthRetry((token) => accessibleChildrenRequest(token)),
        withAuthRetry((token) => missionTemplatesRequest(token)),
      ])

      const childrenData = childrenResponse?.data || []
      const templateData = templatesResponse?.data?.content || []

      setChildren(childrenData)
      setTemplates(templateData)

      if (!selectedChildId && childrenData.length > 0) setSelectedChildId(childrenData[0].childId)
      if (!selectedTemplateId && templateData.length > 0) setSelectedTemplateId(templateData[0].templateId)
    } catch (e) {
      setError(resolveErrorMessage(e, t.baseLoadError))
    } finally {
      setLoadingBase(false)
    }
  }

  const loadMissions = async (childId, page = missionPage, size = missionSize) => {
    if (!childId) return
    setLoadingMissions(true)
    setError('')
    try {
      const response = await withAuthRetry((token) => childMissionsRequest(token, childId, page, size))
      const pageData = response?.data || {}
      const list = pageData?.content || []

      const enriched = await Promise.all(
        list.map(async (mission) => {
          try {
            const detailResponse = await withAuthRetry((token) => missionDetailRequest(token, mission.missionId))
            const detail = detailResponse?.data
            return {
              ...mission,
              parentNote: detail?.parentNote || null,
              therapistFeedback: detail?.therapistFeedback || mission?.therapistFeedback || null,
            }
          } catch {
            return mission
          }
        }),
      )

      setMissions(enriched)
      setMissionTotalPages(pageData?.totalPages || 0)
      setMissionTotalElements(pageData?.totalElements || 0)
    } catch (e) {
      setError(resolveErrorMessage(e, t.missionLoadError))
    } finally {
      setLoadingMissions(false)
    }
  }

  useEffect(() => {
    loadBaseData()
  }, [])

  useEffect(() => {
    setMissionPage(0)
  }, [selectedChildId, missionSize])

  useEffect(() => {
    if (selectedChildId) loadMissions(selectedChildId, missionPage, missionSize)
  }, [selectedChildId, missionPage, missionSize])

  const assignMission = async () => {
    if (!selectedChildId || !selectedTemplateId) {
      setError(t.selectRequired)
      return
    }

    setError('')
    setSuccess('')
    try {
      await withAuthRetry((token) => assignMissionRequest(token, selectedChildId, selectedTemplateId, dueDate || null))
      setSuccess(t.missionAssignSuccess)
      setMissionPage(0)
      await loadMissions(selectedChildId, 0, missionSize)
    } catch (e) {
      setError(resolveErrorMessage(e, t.missionAssignError))
    }
  }

  const loadPhotos = async (missionId) => {
    setError('')
    try {
      const response = await withAuthRetry((token) => missionPhotosRequest(token, missionId))
      const photos = response?.data || []
      setPhotosByMission((prev) => ({ ...prev, [missionId]: photos }))
    } catch (e) {
      setError(resolveErrorMessage(e, t.photoLoadError))
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <section className="rounded-2xl border border-amber-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">THERAPIST/TEACHER HOME</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.title}</h1>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            {t.links.logout}
          </button>
        </div>

        <div className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p><span className="font-semibold">{t.user.name}:</span> {user?.name}</p>
          <p><span className="font-semibold">{t.user.email}:</span> {user?.email}</p>
          <p><span className="font-semibold">{t.user.roles}:</span> {(user?.roles || []).join(', ') || KO.common.none}</p>
        </div>

        <FeedbackBanner error={error} success={success} />

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadBaseData}
              disabled={loadingBase}
              className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loadingBase ? t.loadingBase : t.refreshBase}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">{t.child}</label>
              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {children.length === 0 && <option value="">{t.childNone}</option>}
                {children.map((child) => (
                  <option key={child.childId} value={child.childId}>{child.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end text-xs text-slate-500">
              {t.selected}: {selectedChild?.name || KO.common.none}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === tab.key ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'assign' && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">{t.template}</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {templates.length === 0 && <option value="">{t.templateNone}</option>}
                  {templates.map((template) => (
                    <option key={template.templateId} value={template.templateId}>{template.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">{t.dueDate}</label>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={assignMission}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                {t.assign}
              </button>
              <span className="text-xs text-slate-500">
                {t.selectedTemplate}: {selectedTemplate?.title || KO.common.none}
              </span>
            </div>
          </div>
        )}

        {activeTab === 'missions' && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{t.missionSection}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadMissions(selectedChildId, missionPage, missionSize)}
                  disabled={!selectedChildId || loadingMissions}
                  className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {loadingMissions ? KO.common.loading : t.refreshMission}
                </button>
                <select
                  value={missionStatusFilter}
                  onChange={(e) => setMissionStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700"
                >
                  <option value="ALL">ALL</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
                <select
                  value={missionSortKey}
                  onChange={(e) => setMissionSortKey(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700"
                >
                  <option value="DUE_ASC">{t.sort.dueAsc}</option>
                  <option value="DUE_DESC">{t.sort.dueDesc}</option>
                  <option value="COMPLETED_DESC">{t.sort.completedDesc}</option>
                  <option value="STATUS_ASC">{t.sort.statusAsc}</option>
                </select>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showRejectedOnly}
                    onChange={(e) => setShowRejectedOnly(e.target.checked)}
                  />
                  {t.onlyRejected}
                </label>
              </div>
            </div>

            <div className="space-y-4">
              {visibleMissions.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                  {t.noMission}
                </p>
              )}

              {visibleMissions.map((mission) => (
                <article key={mission.missionId} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{mission.template?.title || t.templateNone}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {t.status}: {mission.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{t.missionId}: {mission.missionId}</p>
                  <p className="mt-1 text-xs text-slate-500">{t.dueDate}: {mission.dueDate || KO.common.none}</p>
                  <p className="mt-1 text-xs text-slate-500">{t.completedAt}: {mission.completedAt || KO.common.none}</p>
                  <p className="mt-1 text-xs text-slate-500">{t.verifiedAt}: {mission.verifiedAt || KO.common.none}</p>
                  <p className="mt-1 text-xs text-slate-500">{t.parentNote}: {mission.parentNote ? String(mission.parentNote).slice(0, 80) : KO.common.none}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => loadPhotos(mission.missionId)}
                      className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                    >
                      {t.photoList}
                    </button>
                    <Link
                      to={`/therapist/missions/${mission.missionId}/review`}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      {t.reviewDetail}
                    </Link>
                  </div>

                  <div className="mt-3 space-y-2">
                    {(photosByMission[mission.missionId] || []).length === 0 && (
                      <p className="text-xs text-slate-500">{t.noPhoto}</p>
                    )}
                    {(photosByMission[mission.missionId] || []).map((photo) => (
                      <div key={photo.photoId} className="rounded-lg border border-slate-200 p-2 text-xs text-slate-700">
                        {photo.fileUrl && (
                          <img
                            src={`${API_BASE_URL}${photo.fileUrl}`}
                            alt={photo.originalFileName || 'mission evidence'}
                            className="mb-2 h-20 w-20 rounded border border-slate-300 object-cover"
                          />
                        )}
                        <p>{t.fileName}: {photo.originalFileName || KO.common.none}</p>
                        <p>{t.contentType}: {photo.contentType || KO.common.none}</p>
                        <p>{t.fileSize}: {photo.fileSize ?? KO.common.none} bytes</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <PaginationBar
              page={missionPage}
              totalPages={missionTotalPages}
              totalElements={missionTotalElements}
              size={missionSize}
              labels={t.pagination}
              disabled={loadingMissions}
              onPageChange={setMissionPage}
              onSizeChange={(nextSize) => {
                setMissionPage(0)
                setMissionSize(nextSize)
              }}
            />
          </div>
        )}

        {activeTab === 'profile' && (
          <ChildProfileEditor childId={selectedChildId} onSaved={loadBaseData} />
        )}

        <div className="mt-6">
          <div className="flex flex-wrap gap-2">
            <Link to="/notifications" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">{t.links.notifications}</Link>
            <Link to="/reports" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">{t.links.reports}</Link>
            <Link to="/notes" className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">{t.links.notes}</Link>
            <Link to="/missions/calendar" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">{t.links.calendar}</Link>
            <Link to="/therapist/review-queue" className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">리뷰 대기 큐</Link>
            <Link to="/therapist/templates" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">{t.links.templates}</Link>
            <Link to="/home" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">{t.links.roleHome}</Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default TherapistHomePage
