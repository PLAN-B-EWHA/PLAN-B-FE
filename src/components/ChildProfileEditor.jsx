import { useEffect, useMemo, useState } from 'react'
import FeedbackBanner from './FeedbackBanner'
import {
  childDetailRequest,
  deleteChildProfileImageRequest,
  updateChildRequest,
  uploadChildProfileImageRequest,
} from '../api'
import { KO } from '../constants/messages.ko'
import { useAuth } from '../contexts/AuthContext'
import { resolveErrorMessage } from '../utils/errorMessage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
const EXPRESSION_TAGS = ['JOY', 'SAD', 'ANGRY', 'SURPRISE', 'FEAR', 'DISGUST', 'NEUTRAL']

function toProfileImageUrl(profileImageUrl) {
  if (!profileImageUrl) return ''
  if (profileImageUrl.startsWith('http://') || profileImageUrl.startsWith('https://')) return profileImageUrl
  if (profileImageUrl.startsWith('/uploads/')) return `${API_BASE_URL}${profileImageUrl}`
  return `${API_BASE_URL}/uploads/${profileImageUrl}`
}

function ChildProfileEditor({ childId, onSaved }) {
  const { withAuthRetry } = useAuth()
  const t = KO.components.childProfile

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [detail, setDetail] = useState(null)
  const [birthDate, setBirthDate] = useState('')
  const [diagnosisInfo, setDiagnosisInfo] = useState('')
  const [specialNotes, setSpecialNotes] = useState('')
  const [preferredExpressions, setPreferredExpressions] = useState([])
  const [difficultExpressions, setDifficultExpressions] = useState([])
  const [profileImageFile, setProfileImageFile] = useState(null)

  const imageUrl = useMemo(() => toProfileImageUrl(detail?.profileImageUrl), [detail?.profileImageUrl])

  const loadDetail = async (syncForm = true) => {
    if (!childId) return
    setLoading(true)
    setError('')
    try {
      const response = await withAuthRetry((token) => childDetailRequest(token, childId))
      const data = response?.data
      setDetail(data)
      if (syncForm) {
        setBirthDate(data?.birthDate || '')
        setDiagnosisInfo(data?.diagnosisInfo || '')
        setSpecialNotes(data?.specialNotes || '')
        setPreferredExpressions(Array.from(data?.preferredExpressions || []))
        setDifficultExpressions(Array.from(data?.difficultExpressions || []))
      }
      setProfileImageFile(null)
    } catch (e) {
      setError(resolveErrorMessage(e, t.loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
  }, [childId])

  const toggleTag = (tags, setTags, tag) => {
    if (tags.includes(tag)) {
      setTags(tags.filter((value) => value !== tag))
    } else {
      setTags([...tags, tag])
    }
  }

  const saveProfile = async () => {
    if (!childId) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await withAuthRetry((token) =>
        updateChildRequest(token, childId, {
          birthDate: birthDate || null,
          diagnosisInfo,
          specialNotes,
          preferredExpressions,
          difficultExpressions,
        }),
      )
      setSuccess(t.saveSuccess)
      await loadDetail()
      if (onSaved) onSaved()
    } catch (e) {
      setError(resolveErrorMessage(e, t.saveError))
    } finally {
      setSaving(false)
    }
  }

  const uploadImage = async () => {
    if (!childId || !profileImageFile) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await withAuthRetry((token) => uploadChildProfileImageRequest(token, childId, profileImageFile))
      setSuccess(t.uploadSuccess)
      await loadDetail(false)
      if (onSaved) onSaved()
    } catch (e) {
      setError(resolveErrorMessage(e, t.uploadError))
    } finally {
      setSaving(false)
    }
  }

  const deleteImage = async () => {
    if (!childId) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await withAuthRetry((token) => deleteChildProfileImageRequest(token, childId))
      setSuccess(t.deleteSuccess)
      await loadDetail(false)
      if (onSaved) onSaved()
    } catch (e) {
      setError(resolveErrorMessage(e, t.deleteError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{t.title}</h2>
        <button
          type="button"
          onClick={loadDetail}
          disabled={!childId || loading}
          className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {loading ? KO.common.loading : t.refresh}
        </button>
      </div>

      <FeedbackBanner error={error} success={success} />

      {!childId && <p className="text-sm text-slate-500">{t.selectChildFirst}</p>}

      {childId && (
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              {t.birthDate}
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="text-xs font-semibold text-slate-700">
              {t.age}
              <p className="mt-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                {detail?.age ?? KO.common.none}
              </p>
            </div>
          </div>

          <label className="text-xs font-semibold text-slate-700">
            {t.diagnosis}
            <textarea
              rows={3}
              value={diagnosisInfo}
              onChange={(e) => setDiagnosisInfo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs font-semibold text-slate-700">
            {t.notes}
            <textarea
              rows={3}
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-slate-700">{t.preferredTags}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXPRESSION_TAGS.map((tag) => (
                  <button
                    key={`preferred-${tag}`}
                    type="button"
                    onClick={() => toggleTag(preferredExpressions, setPreferredExpressions, tag)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      preferredExpressions.includes(tag)
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700">{t.difficultTags}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXPRESSION_TAGS.map((tag) => (
                  <button
                    key={`difficult-${tag}`}
                    type="button"
                    onClick={() => toggleTag(difficultExpressions, setDifficultExpressions, tag)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      difficultExpressions.includes(tag)
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-slate-700">{t.profileImage}</p>
              {imageUrl ? (
                <img src={imageUrl} alt="child profile" className="mt-2 h-40 w-40 rounded-lg border border-slate-300 object-cover" />
              ) : (
                <p className="mt-2 text-xs text-slate-500">{t.noImage}</p>
              )}
            </div>
            <div className="self-end">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)}
                className="text-xs"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={uploadImage}
                  disabled={!profileImageFile || saving}
                  className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {t.uploadImage}
                </button>
                <button
                  type="button"
                  onClick={deleteImage}
                  disabled={!detail?.profileImageUrl || saving}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {t.deleteImage}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={saveProfile}
              disabled={!childId || saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? t.saving : t.saveProfile}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default ChildProfileEditor
