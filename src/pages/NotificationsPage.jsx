import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FeedbackBanner from '../components/FeedbackBanner'
import {
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
  missionDetailRequest,
  noteCommentDetailRequest,
  noteDetailRequest,
  notificationsRequest,
  reportDetailRequest,
} from '../api'
import { useAuth } from '../contexts/AuthContext'
import { KO } from '../constants/messages.ko'
import { resolveErrorMessage } from '../utils/errorMessage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

function parseSseChunk(buffer, onEvent) {
  const blocks = buffer.split('\n\n')
  const rest = blocks.pop() || ''

  blocks.forEach((block) => {
    const lines = block.split('\n')
    let eventName = 'message'
    let data = ''

    lines.forEach((line) => {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      if (line.startsWith('data:')) data += line.slice(5).trim()
    })

    onEvent(eventName, data)
  })

  return rest
}

function NotificationsPage() {
  const { accessToken, withAuthRetry, tryRefresh, user } = useAuth()
  const navigate = useNavigate()
  const t = KO.notifications

  const [items, setItems] = useState([])
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [streamStatus, setStreamStatus] = useState('disconnected')
  const abortRef = useRef(null)

  const unreadCount = useMemo(() => items.filter((item) => item?.isRead === false).length, [items])
  const currentRoles = useMemo(() => (user?.roles || []).map((role) => String(role).toUpperCase()), [user?.roles])
  const filteredItems = useMemo(
    () => (typeFilter === 'ALL' ? items : items.filter((item) => item.type === typeFilter)),
    [items, typeFilter],
  )
  const typeOptions = useMemo(() => ['ALL', ...new Set(items.map((item) => item.type).filter(Boolean))], [items])

  const loadNotifications = async (targetPage = page, targetSize = size) => {
    setLoading(true)
    setError('')
    try {
      const response = await withAuthRetry((token) => notificationsRequest(token, targetPage, targetSize))
      const data = response?.data || {}
      setItems(data.content || [])
      setTotalPages(data.totalPages || 0)
      setTotalElements(data.totalElements || 0)
    } catch (e) {
      setError(resolveErrorMessage(e, t.loadError))
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId) => {
    setError('')
    setSuccess('')
    try {
      await withAuthRetry((token) => markNotificationReadRequest(token, notificationId))
      setItems((prev) => prev.map((item) => (item.notificationId === notificationId ? { ...item, isRead: true } : item)))
      setSuccess(t.markReadSuccess)
    } catch (e) {
      setError(resolveErrorMessage(e, t.markReadError))
    }
  }

  const markAllAsRead = async () => {
    const unreadTargets = filteredItems.filter((item) => item?.isRead === false)
    if (unreadTargets.length === 0) {
      setSuccess(t.noUnread)
      return
    }

    setError('')
    setSuccess('')
    try {
      const selectedType = typeFilter === 'ALL' ? null : typeFilter
      const response = await withAuthRetry((token) => markAllNotificationsReadRequest(token, selectedType))
      const updatedCount = Number(response?.data ?? unreadTargets.length)
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })))
      setSuccess(`${updatedCount}개 ${t.markAllSuccess}`)
    } catch (e) {
      setError(resolveErrorMessage(e, t.markAllError))
    }
  }

  const buildNotificationPath = (item) => {
    if (!item?.referenceId) return null
    if (item.type === 'REPORT_GENERATED') return `/reports?reportId=${item.referenceId}`
    if (item.type === 'NOTE_ASSET_UPLOADED') return `/notes?noteId=${item.referenceId}`
    if (item.type === 'NOTE_COMMENT_ADDED' || item.type === 'NOTE_REPLY_ADDED') {
      return `/notes?commentId=${item.referenceId}`
    }
    if (item.type === 'MISSION_COMPLETED' || item.type === 'MISSION_PHOTO_UPLOADED') {
      const isTherapist = currentRoles.includes('THERAPIST') || currentRoles.includes('TEACHER')
      if (isTherapist) return `/therapist/missions/${item.referenceId}/review`
      return `/parent/missions/${item.referenceId}`
    }
    return null
  }

  const validateNotificationLink = async (item) => {
    if (!item?.referenceId) throw new Error('referenceId missing')
    if (item.type === 'REPORT_GENERATED') {
      await withAuthRetry((token) => reportDetailRequest(token, item.referenceId))
      return
    }
    if (item.type === 'NOTE_ASSET_UPLOADED') {
      await withAuthRetry((token) => noteDetailRequest(token, item.referenceId))
      return
    }
    if (item.type === 'NOTE_COMMENT_ADDED' || item.type === 'NOTE_REPLY_ADDED') {
      await withAuthRetry((token) => noteCommentDetailRequest(token, item.referenceId))
      return
    }
    if (item.type === 'MISSION_COMPLETED' || item.type === 'MISSION_PHOTO_UPLOADED') {
      await withAuthRetry((token) => missionDetailRequest(token, item.referenceId))
    }
  }

  const openNotification = async (item) => {
    const path = buildNotificationPath(item)
    if (!path) {
      setError(t.noDetailTarget)
      return
    }

    setError('')
    setSuccess('')
    try {
      if (!item.isRead) {
        await withAuthRetry((token) => markNotificationReadRequest(token, item.notificationId))
        setItems((prev) => prev.map((cur) => (cur.notificationId === item.notificationId ? { ...cur, isRead: true } : cur)))
      }

      try {
        await validateNotificationLink(item)
      } catch {
        // 상세 검증 실패 시에도 이동 우선
      }

      navigate(path)
    } catch (e) {
      setError(resolveErrorMessage(e, t.moveError))
    }
  }

  const connectStream = async (token) => {
    if (!token) return
    if (abortRef.current) abortRef.current.abort()

    const abortController = new AbortController()
    abortRef.current = abortController

    setStreamStatus('connecting')
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/stream`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: abortController.signal,
      })

      if (!response.ok || !response.body) throw new Error(`SSE connect failed: ${response.status}`)

      setStreamStatus('connected')
      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        buffer = parseSseChunk(buffer, (eventName, data) => {
          if (eventName !== 'notification' || !data) return
          try {
            const payload = JSON.parse(data)
            setItems((prev) => {
              if (page !== 0) return prev
              if (prev.some((item) => item.notificationId === payload.notificationId)) return prev
              return [payload, ...prev].slice(0, size)
            })
            setTotalElements((prev) => prev + 1)
          } catch {
            // ignore malformed payload
          }
        })
      }
    } catch (e) {
      if (abortController.signal.aborted) {
        setStreamStatus('disconnected')
        return
      }

      if (e?.message?.includes('401') || e?.message?.includes('403')) {
        try {
          const refreshed = await tryRefresh()
          await connectStream(refreshed)
          return
        } catch {
          setError(t.sseAuthExpired)
        }
      } else {
        setError(resolveErrorMessage(e, t.sseConnectError))
      }

      setStreamStatus('disconnected')
    }
  }

  useEffect(() => {
    loadNotifications(page, size)
  }, [page, size])

  useEffect(() => {
    connectStream(accessToken)
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [accessToken, page, size])

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
      <section className="rounded-2xl border border-sky-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Notifications</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">{t.unread} {unreadCount}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{t.total} {totalElements}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">SSE: {streamStatus}</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700"
            >
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type === 'ALL' ? t.allTypes : type}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={loading}
              className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {t.markAll}
            </button>
            <button
              type="button"
              onClick={() => loadNotifications(page, size)}
              disabled={loading}
              className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? KO.common.loading : t.refreshList}
            </button>
          </div>
        </div>

        <FeedbackBanner error={error} success={success} />

        <div className="mt-6 space-y-3">
          {filteredItems.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{t.noData}</p>
          )}

          {filteredItems.map((item) => (
            <article key={item.notificationId} className={`rounded-xl border p-4 ${item.isRead ? 'border-slate-200 bg-white' : 'border-sky-200 bg-sky-50'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <span className="text-xs font-semibold text-slate-600">{item.type}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{item.message}</p>
              <p className="mt-1 text-xs text-slate-500">{t.createdAt}: {item.createdAt}</p>
              <p className="mt-1 text-xs text-slate-500">{t.referenceId}: {item.referenceId || KO.common.none}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!item.isRead && (
                  <button
                    type="button"
                    onClick={() => markAsRead(item.notificationId)}
                    className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                  >
                    {t.markRead}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openNotification(item)}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                >
                  {t.openDetail}
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            disabled={page === 0 || loading}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {t.prev}
          </button>
          <span className="text-xs font-semibold text-slate-600">
            {t.page} {totalPages === 0 ? 0 : page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => (prev + 1 < totalPages ? prev + 1 : prev))}
            disabled={loading || totalPages === 0 || page + 1 >= totalPages}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {t.next}
          </button>
          <select
            value={size}
            onChange={(e) => {
              setPage(0)
              setSize(Number(e.target.value))
            }}
            className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700"
          >
            <option value={10}>10개</option>
            <option value={20}>20개</option>
            <option value={50}>50개</option>
          </select>
        </div>

        <div className="mt-6">
          <Link to="/home" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            {t.home}
          </Link>
        </div>
      </section>
    </main>
  )
}

export default NotificationsPage
