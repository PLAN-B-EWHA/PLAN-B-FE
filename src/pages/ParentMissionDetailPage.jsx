import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import FeedbackBanner from '../components/FeedbackBanner'
import {
  missionDetailRequest,
  missionPhotosRequest,
  updateMissionStatusRequest,
  uploadMissionPhotoRequest,
} from '../api'
import { useAuth } from '../contexts/AuthContext'
import { KO } from '../constants/messages.ko'
import { resolveErrorMessage } from '../utils/errorMessage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

function getParentActionsByStatus(status) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'ASSIGNED') return [{ label: KO.parentMissionDetail.start, status: 'IN_PROGRESS' }]
  if (normalized === 'IN_PROGRESS') return [{ label: KO.parentMissionDetail.complete, status: 'COMPLETED' }]
  return []
}

function ParentMissionDetailPage() {
  const { missionId } = useParams()
  const navigate = useNavigate()
  const { withAuthRetry } = useAuth()

  const [mission, setMission] = useState(null)
  const [photos, setPhotos] = useState([])
  const [parentNote, setParentNote] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const actions = useMemo(() => getParentActionsByStatus(mission?.status), [mission?.status])
  const isRejectedForResubmit = useMemo(() => {
    const status = String(mission?.status || '').toUpperCase()
    return status === 'IN_PROGRESS' && String(mission?.therapistFeedback || '').trim().length > 0
  }, [mission?.status, mission?.therapistFeedback])

  const renderMetaRow = (label, value) => (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start">
      <span className="shrink-0 font-semibold text-slate-800 sm:w-32">{label}</span>
      <span className="min-w-0 break-all text-slate-700">{value || KO.common.none}</span>
    </div>
  )

  const loadMission = async (syncParentNote = true) => {
    if (!missionId) return
    setLoading(true)
    setError('')
    try {
      const response = await withAuthRetry((token) => missionDetailRequest(token, missionId))
      const data = response?.data
      setMission(data)
      if (syncParentNote) {
        setParentNote(data?.parentNote || '')
      }
    } catch (e) {
      setError(resolveErrorMessage(e, KO.parentMissionDetail.loadError))
    } finally {
      setLoading(false)
    }
  }

  const loadPhotos = async () => {
    if (!missionId) return
    try {
      const response = await withAuthRetry((token) => missionPhotosRequest(token, missionId))
      setPhotos(response?.data || [])
    } catch (e) {
      setError(resolveErrorMessage(e, KO.parentMissionDetail.photoLoadError))
    }
  }

  useEffect(() => {
    loadMission()
    loadPhotos()
  }, [missionId])

  const updateStatus = async (status) => {
    setError('')
    setSuccess('')
    try {
      await withAuthRetry((token) => updateMissionStatusRequest(token, missionId, status, parentNote))
      setSuccess(KO.parentMissionDetail.statusUpdateSuccess)
      await loadMission()
      await loadPhotos()
    } catch (e) {
      setError(resolveErrorMessage(e, KO.parentMissionDetail.updateError))
    }
  }

  const uploadPhoto = async () => {
    if (!photoFile) {
      setError(KO.parentMissionDetail.choosePhoto)
      return
    }
    setError('')
    setSuccess('')
    try {
      await withAuthRetry((token) => uploadMissionPhotoRequest(token, missionId, photoFile))
      setPhotoFile(null)
      setSuccess(KO.parentMissionDetail.uploadSuccess)
      await loadMission(false)
      await loadPhotos()
    } catch (e) {
      setError(resolveErrorMessage(e, KO.parentMissionDetail.uploadError))
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-4 sm:p-6 md:p-10">
      <section className="rounded-2xl border border-emerald-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Parent Mission</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{KO.parentMissionDetail.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              {KO.common.back}
            </button>
            <Link to="/parent" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              {KO.parentMissionDetail.home}
            </Link>
          </div>
        </div>

        <FeedbackBanner error={error} success={success} />

        {loading && <p className="mt-4 text-sm text-slate-500">{KO.parentMissionDetail.loading}</p>}

        {!loading && mission && (
          <div className="mt-5 grid gap-4">
            {isRejectedForResubmit && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
                <p className="font-semibold">{KO.parentMissionDetail.rejectedTitle}</p>
                <p className="mt-1">{KO.parentMissionDetail.rejectedGuide}</p>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="space-y-2">
                {renderMetaRow('미션 ID:', mission.missionId)}
                {renderMetaRow('상태:', mission.status)}
                {renderMetaRow('템플릿:', mission.template?.title || mission.templateName)}
                {renderMetaRow('마감일:', mission.dueDate)}
                {renderMetaRow('완료일:', mission.completedAt)}
                {renderMetaRow('치료사 피드백:', mission.therapistFeedback)}
              </div>
            </div>

            <label className="text-xs font-semibold text-slate-700">
              {KO.parentMissionDetail.parentNote}
              <textarea
                rows={4}
                value={parentNote}
                onChange={(e) => setParentNote(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="미션 진행/완료 상황을 적어 주세요."
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {actions.length === 0 && <span className="text-xs text-slate-500">{KO.parentMissionDetail.noStatusAction}</span>}
              {actions.map((action) => (
                <button
                  key={action.status}
                  type="button"
                  onClick={() => updateStatus(action.status)}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  {action.label}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">증빙 사진</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  className="max-w-full text-xs"
                />
                <button
                  type="button"
                  onClick={uploadPhoto}
                  className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  {KO.parentMissionDetail.uploadPhoto}
                </button>
                <button
                  type="button"
                  onClick={loadPhotos}
                  className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  {KO.parentMissionDetail.reloadPhotos}
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {photos.length === 0 && <p className="text-xs text-slate-500">{KO.parentMissionDetail.noPhoto}</p>}
                {photos.map((photo) => (
                  <div key={photo.photoId} className="rounded-lg border border-slate-200 p-2 text-xs text-slate-700">
                    {photo.fileUrl && (
                      <img
                        src={`${API_BASE_URL}${photo.fileUrl}`}
                        alt={photo.originalFileName || 'mission evidence'}
                        className="mb-2 h-20 w-20 rounded border border-slate-300 object-cover"
                      />
                    )}
                    <p className="break-all">파일명: {photo.originalFileName || KO.common.none}</p>
                    <p className="break-all">타입: {photo.contentType || KO.common.none}</p>
                    <p className="break-all">크기: {photo.fileSize ?? KO.common.none} bytes</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default ParentMissionDetailPage