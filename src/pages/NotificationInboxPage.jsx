import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ParentShell } from '../components/ParentShell'
import { TherapistStatsShell } from '../components/TherapistStatsShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload, resolveApiUrl } from '../lib/api'

const typeMeta = {
  COMMENT_ADDED: { label: '메모 발행', tone: 'info', icon: 'i' },
  WEEKLY_SUMMARY: { label: '주간 요약', tone: 'success', icon: '✓' },
  CHILD_INACTIVE: { label: '미접속', tone: 'warn', icon: '!' },
  NOTE_COMMENT_ADDED: { label: '노트 댓글', tone: 'info', icon: 'i' },
  NOTE_REPLY_ADDED: { label: '노트 답글', tone: 'info', icon: 'i' },
  NOTE_ASSET_UPLOADED: { label: '노트 첨부', tone: 'info', icon: 'i' },
  MISSION_COMPLETED: { label: '미션 완료', tone: 'success', icon: '✓' },
  MISSION_PHOTO_UPLOADED: { label: '사진 업로드', tone: 'info', icon: 'i' },
  REPORT_GENERATED: { label: '리포트 생성', tone: 'info', icon: 'i' },
  HOMEWORK_SUBMITTED: { label: '미션 제출', tone: 'warn', icon: '!', route: '/app/offline' },
  HOMEWORK_REVIEWED: { label: '검토 완료', tone: 'success', icon: '✓', route: '/app/offline' },
  HOMEWORK_EXPIRED: { label: '기한 만료', tone: 'warn', icon: '!', route: '/app/offline' },
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
  const navigate = useNavigate()
  const meta = typeMeta[item.notificationType] || { label: item.notificationType, tone: 'info', icon: 'i' }
  const isRead = Boolean(item.isRead ?? item.read)
  const hasRoute = Boolean(meta.route)

  function handleRowClick() {
    if (!hasRoute) return
    navigate(meta.route)
  }

  return (
    <article
      className={`notif ${meta.tone} ${isRead ? 'read' : 'unread'} ${hasRoute ? 'cursor-pointer' : ''}`}
      onClick={hasRoute ? handleRowClick : undefined}
    >
      <span className="n-ico">{meta.icon}</span>
      <div className="n-body">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="n-title"><span className="dot-unread" />{item.title || meta.label}</p>
            <p className="n-text">{item.message || '-'}</p>
            <p className="n-time">{formatCreatedAt(item.createdAt)}</p>
          </div>
          {!isRead ? <span className="badge badge-info">NEW</span> : null}
        </div>
        {!isRead ? (
          <button
            className="btn btn-ghost btn-sm mt-3"
            disabled={updating}
            onClick={(event) => {
              event.stopPropagation()
              onMarkRead(item.notificationId)
            }}
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
      <div className="toolbar">
        <span className="status"><span className="live-dot" />{getRealtimeLabel(realtimeStatus)}</span>
        <span className="unread-stat">읽지 않음 <b>{unreadCount}</b></span>
        <div className="spacer flex-1" />
        <button className="btn btn-ghost btn-sm" onClick={onRefresh} type="button">새로고침</button>
        <button className="btn btn-primary btn-sm" disabled={batchUpdating || unreadCount === 0} onClick={onMarkAllRead} type="button">{batchUpdating ? '처리 중...' : '전체 읽음'}</button>
      </div>

      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      {loading ? (
        <div className="stats-loading">알림을 불러오는 중입니다...</div>
      ) : (
        <section className="card card-pad">
          {notifications.length ? notifications.map((item) => <NotificationRow item={item} key={item.notificationId} onMarkRead={onMarkRead} updating={updatingId === item.notificationId} />) : (
            <div className="empty-state">
              <div className="es-title">표시할 알림이 없습니다.</div>
              <div className="es-sub">새로운 알림이 오면 여기에 표시됩니다.</div>
            </div>
          )}
        </section>
      )}

      <div className="pager">
        <button className="pg-btn" disabled={pageIndex <= 0} onClick={onPrevPage} type="button">이전</button>
        <span className="pg-now">{`${pageIndex + 1} / ${Math.max(1, totalPages)}`}</span>
        <button className="pg-btn" disabled={isLast} onClick={onNextPage} type="button">다음</button>
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
