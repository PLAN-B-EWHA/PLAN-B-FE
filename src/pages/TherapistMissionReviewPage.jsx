import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import FeedbackBanner from '../components/FeedbackBanner'
import { missionDetailRequest, missionPhotosRequest, verifyMissionRequest } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { KO } from '../constants/messages.ko'
import { resolveErrorMessage } from '../utils/errorMessage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

function TherapistMissionReviewPage() {
  const { missionId } = useParams()
  const navigate = useNavigate()
  const { withAuthRetry, hasAnyRole } = useAuth()

  const [mission, setMission] = useState(null)
  const [photos, setPhotos] = useState([])
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadMission = async () => {
    if (!missionId) return
    setLoading(true)
    setError('')
    try {
      const response = await withAuthRetry((token) => missionDetailRequest(token, missionId))
      const data = response?.data
      setMission(data)
      setFeedback(data?.therapistFeedback || '')
    } catch (e) {
      setError(resolveErrorMessage(e, KO.therapistMissionReview.loadError))
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
      setError(resolveErrorMessage(e, KO.therapistMissionReview.photoLoadError))
    }
  }

  useEffect(() => {
    loadMission()
    loadPhotos()
  }, [missionId])

  const reviewMission = async (reviewDecision) => {
    setError('')
    setSuccess('')
    try {
      if (reviewDecision === 'REJECT' && !String(feedback || '').trim()) {
        setError(KO.therapistMissionReview.rejectReasonRequired)
        return
      }

      await withAuthRetry((token) => verifyMissionRequest(token, missionId, reviewDecision, feedback))
      setSuccess(reviewDecision === 'REJECT' ? KO.therapistMissionReview.rejectedSuccess : KO.therapistMissionReview.approvedSuccess)
      await loadMission()
      await loadPhotos()
    } catch (e) {
      setError(resolveErrorMessage(e, KO.therapistMissionReview.reviewError))
    }
  }

  const canReview = hasAnyRole(['THERAPIST']) && String(mission?.status || '').toUpperCase() === 'COMPLETED'

  const renderMetaRow = (label, value) => (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start">
      <span className="shrink-0 font-semibold text-slate-800 sm:w-28">{label}</span>
      <span className="min-w-0 break-all text-slate-700">{value || KO.common.none}</span>
    </div>
  )

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-4 sm:p-6 md:p-10">
      <section className="rounded-2xl border border-amber-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Therapist Review</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{KO.therapistMissionReview.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              {KO.common.back}
            </button>
            <Link to="/therapist" className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700">
              {KO.therapistMissionReview.home}
            </Link>
          </div>
        </div>

        <FeedbackBanner error={error} success={success} />

        {loading && <p className="mt-4 text-sm text-slate-500">{KO.therapistMissionReview.loading}</p>}

        {!loading && mission && (
          <div className="mt-5 grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="space-y-2">
                {renderMetaRow('미션 ID:', mission.missionId)}
                {renderMetaRow('상태:', mission.status)}
                {renderMetaRow('템플릿:', mission.template?.title || mission.templateName)}
                {renderMetaRow('마감일:', mission.dueDate)}
                {renderMetaRow('부모 코멘트:', mission.parentNote)}
              </div>
            </div>

            <label className="text-xs font-semibold text-slate-700">
              {KO.therapistMissionReview.feedback}
              <textarea
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={KO.therapistMissionReview.feedbackPlaceholder}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => reviewMission('APPROVE')}
                disabled={!canReview}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {KO.therapistMissionReview.approve}
              </button>
              <button
                type="button"
                onClick={() => reviewMission('REJECT')}
                disabled={!canReview}
                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {KO.therapistMissionReview.reject}
              </button>
              {!canReview && <span className="text-xs text-slate-500">{KO.therapistMissionReview.reviewOnlyCompleted}</span>}
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{KO.therapistMissionReview.photos}</p>
                <button
                  type="button"
                  onClick={loadPhotos}
                  className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  {KO.therapistMissionReview.refreshPhotos}
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {photos.length === 0 && <p className="text-xs text-slate-500">{KO.therapistMissionReview.noPhoto}</p>}
                {photos.map((photo) => (
                  <div key={photo.photoId} className="rounded-lg border border-slate-200 p-2 text-xs text-slate-700">
                    {photo.fileUrl && (
                      <img
                        src={`${API_BASE_URL}${photo.fileUrl}`}
                        alt={photo.originalFileName || 'mission evidence'}
                        className="mb-2 h-24 w-full rounded border border-slate-300 object-cover"
                      />
                    )}
                    <p className="break-all">파일명: {photo.originalFileName || KO.common.none}</p>
                    <p className="break-all">타입: {photo.contentType || KO.common.none}</p>
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

export default TherapistMissionReviewPage