import { useEffect, useMemo, useRef, useState } from 'react'
import { ParentShell } from '../components/ParentShell'
import { TherapistStatsShell } from '../components/TherapistStatsShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload, resolveApiUrl } from '../lib/api'

const typeMeta = {
  COMMENT_ADDED: { label: '메모 발행', tone: 'bg-indigo-50 text-indigo-700' },
  WEEKLY_SUMMARY: { label: '주간 요약', tone: 'bg-emerald-50 text-emerald-700' },
  CHILD_INACTIVE: { label: '미접속', tone: 'bg-amber-50 text-amber-700' },
  NOTE_COMMENT_ADDED: { label: '노트 댓글', tone: 'bg-indigo-50 text-indigo-700' },
  NOTE_REPLY_ADDED: { label: '노트 답글', tone: 'bg-indigo-50 text-indigo-700' },
  NOTE_ASSET_UPLOADED: { label: '노트 첨부', tone: 'bg-indigo-50 text-indigo-700' },
  MISSION_COMPLETED: { label: '미션 완료', tone: 'bg-emerald-50 text-emerald-700' },
  MISSION_PHOTO_UPLOADED: { label: '사진 업로드', tone: 'bg-sky-50 text-sky-700' },
  REPORT_GENERATED: { label: '리포트 생성', tone: 'bg-violet-50 text-violet-700' },
}

function formatCreatedAt(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR')
}

function getRealtimeLabel(status) {
  if (status === 'connected') return '실시간 연결됨'
  if (status === 'retrying') return '재연결 중'
  if (status === 'connecting') return '연결 시도 중'
  return '실시간 대기'
}

function NotificationRow({ item, onMarkRead, updating }) {
  const meta = typeMeta[item.notificationType] || { label: item.notificationType, tone: 'bg-slate-100 text-slate-700' }
  const isRead = Boolean(item.isRead ?? item.read)
  return (
    <article className={`rounded-xl border p-4 ${isRead ? 'border-slate-200 bg-white' : 'border-[var(--brand-200)] bg-[var(--brand-50)]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.tone}`}>{meta.label}</span>
            {!isRead ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">NEW</span> : null}
          </div>
          <p className="mt-2 text-sm font-bold text-slate-900">{item.title || '알림'}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{item.message || '-'}</p>
          <p className="mt-2 text-xs text-slate-400">{formatCreatedAt(item.createdAt)}</p>
        </div>
        {!isRead ? (
          <button
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
            disabled={updating}
            onClick={() => onMarkRead(item.notificationId)}
            type="button"
          >
            읽음
          </button>
        ) : null}
      </div>
    </article>
  )
}

function NotificationInboxContent({
  notifications,
  loading,
  feedback,
  unreadCount,
  pageIndex,
  totalPages,
  isLast,
  realtimeStatus,
  updatingId,
  batchUpdating,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
  onPrevPage,
  onNextPage,
}) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3" style={{ marginTop: 16 }}>
        <div>
          <h2 className="text-[24px] font-black tracking-tight text-slate-950">알림</h2>
          <p className="mt-1 text-sm text-slate-400">최근 알림을 확인하고 읽음 처리할 수 있습니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{getRealtimeLabel(realtimeStatus)}</span>
          <span className="rounded-full bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold text-[var(--brand-700)]">읽지 않음 {unreadCount}</span>
          <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" onClick={onRefresh} type="button">새로고침</button>
          <button className="rounded-xl bg-[var(--brand-500)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" disabled={batchUpdating || unreadCount === 0} onClick={onMarkAllRead} type="button">{batchUpdating ? '처리 중...' : '전체 읽음'}</button>
        </div>
      </div>

      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      {loading ? (
        <div className="stats-loading">알림을 불러오는 중입니다...</div>
      ) : (
        <section className="mt-5 space-y-3">
          {notifications.length ? notifications.map((item) => <NotificationRow item={item} key={item.notificationId} onMarkRead={onMarkRead} updating={updatingId === item.notificationId} />) : <div className="stats-panel">표시할 알림이 없습니다.</div>}
        </section>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40" disabled={pageIndex <= 0} onClick={onPrevPage} type="button">이전</button>
        <span className="text-xs text-slate-500">{`${pageIndex + 1} / ${Math.max(1, totalPages)}`}</span>
        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40" disabled={isLast} onClick={onNextPage} type="button">다음</button>
      </div>
    </>
  )
}

export function NotificationInboxPage() {
  const { accessToken, jwtPayload, user } = useAuth()
  const roles = user?.roles || jwtPayload?.roles || []
  const [pageIndex, setPageIndex] = useState(0)
  const [notificationPage, setNotificationPage] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [realtimeStatus, setRealtimeStatus] = useState('idle')
  const [updatingId, setUpdatingId] = useState('')
  const [batchUpdating, setBatchUpdating] = useState(false)
  const [feedback, setFeedback] = useState('')
  const lastRealtimeRefreshRef = useRef(0)

  const notifications = useMemo(() => notificationPage?.content || [], [notificationPage])
  const totalPages = notificationPage?.totalPages || 1
  const currentPage = notificationPage?.page ?? pageIndex
  const isLast = Boolean(notificationPage?.last || totalPages <= currentPage + 1)
  const isTherapist = roles.includes('THERAPIST')

  async function fetchNotifications(nextPage = pageIndex, options = {}) {
    if (!accessToken) return
    const { silent = false } = options
    if (!silent) setLoading(true)

    try {
      const [listRes, unreadRes] = await Promise.all([
        apiFetch(`/notifications?page=${nextPage}&size=20`, { method: 'GET', token: accessToken }),
        apiFetch('/notifications/unread-count', { method: 'GET', token: accessToken }),
      ])

      setNotificationPage(extractApiPayload(listRes))
      setUnreadCount(Number(extractApiPayload(unreadRes)) || 0)
      if (!silent) setFeedback('')
    } catch (error) {
      if (!silent) setFeedback(extractApiErrorMessage(error))
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications(pageIndex)
  }, [accessToken, pageIndex])

  useEffect(() => {
    if (!accessToken) return undefined

    let cancelled = false
    let controller = null
    let retryTimer = null

    const triggerRealtimeRefresh = () => {
      const now = Date.now()
      if (now - lastRealtimeRefreshRef.current < 1500) return
      lastRealtimeRefreshRef.current = now
      fetchNotifications(pageIndex, { silent: true })
    }

    const consumeSse = async () => {
      if (cancelled) return
      controller = new AbortController()
      setRealtimeStatus('connecting')

      try {
        const response = await fetch(resolveApiUrl('/notifications/stream'), {
          method: 'GET',
          headers: { Accept: 'text/event-stream', Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok || !response.body) throw new Error('SSE stream open failed')

        setRealtimeStatus('connected')

        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        while (!cancelled) {
          const { value, done } = await reader.read()
          if (done) throw new Error('SSE stream closed')

          buffer += decoder.decode(value, { stream: true })
          let blockEnd = buffer.indexOf('\n\n')
          while (blockEnd >= 0) {
            const rawBlock = buffer.slice(0, blockEnd).trim()
            buffer = buffer.slice(blockEnd + 2)
            blockEnd = buffer.indexOf('\n\n')
            if (!rawBlock) continue

            const data = rawBlock
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim())
              .join('\n')

            if (!data || data === 'ping' || data === 'heartbeat') continue
            triggerRealtimeRefresh()
          }
        }
      } catch {
        if (cancelled) return
        setRealtimeStatus('retrying')
        retryTimer = setTimeout(consumeSse, 5000)
      }
    }

    consumeSse()

    return () => {
      cancelled = true
      setRealtimeStatus('idle')
      if (retryTimer) clearTimeout(retryTimer)
      if (controller) controller.abort()
    }
  }, [accessToken, pageIndex])

  async function handleMarkRead(notificationId) {
    if (!accessToken || !notificationId) return
    setUpdatingId(notificationId)
    try {
      await apiFetch(`/notifications/${notificationId}/read`, { method: 'PATCH', token: accessToken })
      setNotificationPage((current) => ({
        ...current,
        content: (current?.content || []).map((item) => (item.notificationId === notificationId ? { ...item, isRead: true } : item)),
      }))
      setUnreadCount((current) => Math.max(0, current - 1))
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setUpdatingId('')
    }
  }

  async function handleMarkAllRead() {
    if (!accessToken) return
    setBatchUpdating(true)
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH', token: accessToken })
      setNotificationPage((current) => ({ ...current, content: (current?.content || []).map((item) => ({ ...item, isRead: true })) }))
      setUnreadCount(0)
      setFeedback('전체 알림을 읽음 처리했습니다.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setBatchUpdating(false)
    }
  }

  const content = (
    <NotificationInboxContent
      batchUpdating={batchUpdating}
      feedback={feedback}
      isLast={isLast}
      loading={loading}
      notifications={notifications}
      onMarkAllRead={handleMarkAllRead}
      onMarkRead={handleMarkRead}
      onNextPage={() => setPageIndex((current) => current + 1)}
      onPrevPage={() => setPageIndex((current) => Math.max(0, current - 1))}
      onRefresh={() => fetchNotifications(pageIndex)}
      pageIndex={currentPage}
      realtimeStatus={realtimeStatus}
      totalPages={totalPages}
      unreadCount={unreadCount}
      updatingId={updatingId}
    />
  )

  if (isTherapist) {
    return (
      <TherapistStatsShell activeId="alerts" subtitle="실시간 알림과 읽음 상태를 관리합니다." title="알림">
        {content}
      </TherapistStatsShell>
    )
  }

  return (
    <ParentShell childCount={0} heading="알림" selectedChild={null} subheading="최신 알림을 확인하고 관리할 수 있습니다.">
      {content}
    </ParentShell>
  )
}
