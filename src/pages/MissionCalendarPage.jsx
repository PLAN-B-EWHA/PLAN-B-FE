import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import FeedbackBanner from '../components/FeedbackBanner'
import {
  accessibleChildrenRequest,
  searchChildMissionsRequest,
} from '../api'
import { useAuth } from '../contexts/AuthContext'
import { KO } from '../constants/messages.ko'
import { resolveErrorMessage } from '../utils/errorMessage'

const STATUS_OPTIONS = ['ALL', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED']

const formatDateInput = (date) => {
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10)
}

const toLocalDateTime = (dateStr, endOfDay = false) => {
  if (!dateStr) return null
  const time = endOfDay ? '23:59:59' : '00:00:00'
  return `${dateStr}T${time}`
}

const parseDateSafe = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const dateKey = (value) => {
  const date = parseDateSafe(value)
  if (!date) return ''
  return formatDateInput(date)
}

const monthKeyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

function MissionCalendarPage() {
  const { user, withAuthRetry } = useAuth()
  const t = KO.missionCalendar

  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState('')
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const today = useMemo(() => new Date(), [])
  const [startDate, setStartDate] = useState(formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [endDate, setEndDate] = useState(formatDateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0)))
  const [status, setStatus] = useState('ALL')
  const [viewMode, setViewMode] = useState('calendar')

  const [pageSize] = useState(100)
  const [totalElements, setTotalElements] = useState(0)
  const latestLoadRequestId = useRef(0)

  const isTherapist = useMemo(
    () => (user?.roles || []).includes('THERAPIST') || (user?.roles || []).includes('TEACHER'),
    [user?.roles],
  )

  const detailLinkFor = (missionId) => (isTherapist
    ? `/therapist/missions/${missionId}/review`
    : `/parent/missions/${missionId}`)

  const calendarMonths = useMemo(() => {
    if (startDate && endDate && startDate <= endDate) {
      const start = new Date(`${startDate}T00:00:00`)
      const end = new Date(`${endDate}T00:00:00`)
      start.setDate(1)
      end.setDate(1)
      const months = []
      const cursor = new Date(start)
      while (cursor <= end) {
        months.push(monthKeyOf(cursor))
        cursor.setMonth(cursor.getMonth() + 1)
        if (months.length > 24) break
      }
      return months
    }
    return [startDate ? startDate.slice(0, 7) : formatDateInput(new Date()).slice(0, 7)]
  }, [startDate, endDate])

  const loadChildren = async () => {
    const response = await withAuthRetry((token) => accessibleChildrenRequest(token))
    const list = response?.data || []
    setChildren(list)
    if (!selectedChildId && list.length > 0) setSelectedChildId(list[0].childId)
  }

  const loadMissions = async () => {
    const requestId = ++latestLoadRequestId.current
    if (!selectedChildId) return
    if (startDate && endDate && startDate > endDate) {
      setError(t.rangeError)
      return
    }
    setLoading(true)
    setError('')
    try {
      const firstResponse = await withAuthRetry((token) =>
        searchChildMissionsRequest(token, selectedChildId, {
          status: status === 'ALL' ? null : status,
          startDate: toLocalDateTime(startDate, false),
          endDate: toLocalDateTime(endDate, true),
          page: 0,
          size: pageSize,
          sortBy: 'dueDate',
          sortDirection: 'ASC',
        }),
      )
      const firstData = firstResponse?.data || {}
      const firstContent = firstData?.content || []
      const total = Number(firstData?.totalElements || 0)
      const totalPages = Number(firstData?.totalPages || 0)

      if (totalPages <= 1) {
        if (requestId !== latestLoadRequestId.current) return
        setMissions(firstContent)
        setTotalElements(total)
      } else {
        const pageRequests = []
        for (let page = 1; page < totalPages; page += 1) {
          pageRequests.push(
            withAuthRetry((token) =>
              searchChildMissionsRequest(token, selectedChildId, {
                status: status === 'ALL' ? null : status,
                startDate: toLocalDateTime(startDate, false),
                endDate: toLocalDateTime(endDate, true),
                page,
                size: pageSize,
                sortBy: 'dueDate',
                sortDirection: 'ASC',
              }),
            ),
          )
        }
        const pageResponses = await Promise.all(pageRequests)
        const rest = pageResponses.flatMap((res) => res?.data?.content || [])
        if (requestId !== latestLoadRequestId.current) return
        setMissions([...firstContent, ...rest])
        setTotalElements(total)
      }
      if (requestId !== latestLoadRequestId.current) return
      if (total > 0) setSuccess('')
    } catch (e) {
      if (requestId !== latestLoadRequestId.current) return
      setError(resolveErrorMessage(e, t.loadError))
    } finally {
      if (requestId !== latestLoadRequestId.current) return
      setLoading(false)
    }
  }

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true)
      try {
        await Promise.all([loadChildren()])
      } catch (e) {
        setError(resolveErrorMessage(e, t.loadError))
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [])

  useEffect(() => {
    loadMissions()
  }, [selectedChildId, startDate, endDate, status])

  const handleRangePreset = (days) => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - days + 1)
    setStartDate(formatDateInput(start))
    setEndDate(formatDateInput(now))
  }

  const handleMonthPreset = (offset) => {
    const base = new Date(today.getFullYear(), today.getMonth() + offset, 1)
    const start = new Date(base.getFullYear(), base.getMonth(), 1)
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0)
    setStartDate(formatDateInput(start))
    setEndDate(formatDateInput(end))
  }

  const groupedByDate = useMemo(() => {
    const map = {}
    missions.forEach((mission) => {
      const key = dateKey(mission.dueDate || mission.assignedAt || mission.createdAt)
      if (!key) return
      if (!map[key]) map[key] = []
      map[key].push(mission)
    })
    Object.values(map).forEach((list) => {
      list.sort((a, b) => {
        const aTime = Date.parse(a.dueDate || a.assignedAt || a.createdAt || '') || 0
        const bTime = Date.parse(b.dueDate || b.assignedAt || b.createdAt || '') || 0
        return aTime - bTime
      })
    })
    return map
  }, [missions])

  const timelineKeys = useMemo(() => {
    const keys = Object.keys(groupedByDate)
    keys.sort()
    return keys
  }, [groupedByDate])

  const calendarCellsByMonth = useMemo(() => {
    const result = {}
    calendarMonths.forEach((monthKey) => {
      const [year, month] = monthKey.split('-').map((value) => Number(value))
      if (!year || !month) {
        result[monthKey] = []
        return
      }
      const firstDay = new Date(year, month - 1, 1)
      const startWeekday = firstDay.getDay()
      const daysInMonth = new Date(year, month, 0).getDate()
      const cells = []
      for (let i = 0; i < startWeekday; i += 1) {
        cells.push({ date: null })
      }
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month - 1, day)
        const key = formatDateInput(date)
        cells.push({ date, key, missions: groupedByDate[key] || [] })
      }
      while (cells.length % 7 !== 0) cells.push({ date: null })
      result[monthKey] = cells
    })
    return result
  }, [calendarMonths, groupedByDate])

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <section className="rounded-2xl border border-cyan-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Mission Calendar</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadMissions}
              disabled={loading || !selectedChildId}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? KO.common.loading : KO.common.refresh}
            </button>
            <Link to="/home" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              {t.home}
            </Link>
          </div>
        </div>

        <FeedbackBanner error={error} success={success} />

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-700">
              {t.child}
              <select
                value={selectedChildId}
                onChange={(event) => setSelectedChildId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {children.length === 0 && <option value="">{t.noChild}</option>}
                {children.map((child) => (
                  <option key={child.childId} value={child.childId}>{child.name}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700">
              {t.status}
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700">
              {t.viewMode}
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${viewMode === 'calendar' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {t.calendar}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('timeline')}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${viewMode === 'timeline' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {t.timeline}
                </button>
              </div>
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-700">
              {t.startDate}
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              {t.endDate}
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-col justify-end gap-2 text-xs font-semibold text-slate-700">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleMonthPreset(-1)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                >
                  {t.lastMonth}
                </button>
                <button
                  type="button"
                  onClick={() => handleMonthPreset(0)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                >
                  {t.thisMonth}
                </button>
                <button
                  type="button"
                  onClick={() => handleMonthPreset(1)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                >
                  {t.nextMonth}
                </button>
                <button
                  type="button"
                  onClick={() => handleRangePreset(30)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                >
                  {t.last30}
                </button>
              </div>
            </div>
          </div>

          {totalElements > pageSize && (
            <p className="mt-3 text-xs text-amber-600">
              {t.limitNotice} {pageSize}
            </p>
          )}
        </section>

        {viewMode === 'calendar' ? (
          <div className="mt-6 space-y-4">
            {calendarMonths.map((monthKey) => (
              <section key={monthKey} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">{t.calendarTitle} {monthKey}</h2>
                  <p className="text-xs text-slate-500">{t.total}: {totalElements}</p>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
                  {t.weekdays.map((day) => (
                    <div key={`${monthKey}-${day}`}>{day}</div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-2">
                  {(calendarCellsByMonth[monthKey] || []).map((cell, idx) => (
                    <div key={`${monthKey}-${cell.key || 'empty'}-${idx}`} className="min-h-[80px] rounded-lg border border-slate-200 bg-slate-50 p-2">
                      {cell.date ? (
                        <>
                          <p className="text-xs font-semibold text-slate-700">{cell.date.getDate()}</p>
                          {cell.missions.length > 0 && (
                            <div className="mt-1 space-y-1">
                              <span className="inline-flex rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                                {t.missionCount}: {cell.missions.length}
                              </span>
                              {cell.missions.slice(0, 2).map((mission) => (
                                <p key={mission.missionId} className="truncate text-[11px] text-slate-600">
                                  {mission.template?.title || t.untitled}
                                </p>
                              ))}
                              {cell.missions.length > 2 && (
                                <p className="text-[10px] text-slate-400">+{cell.missions.length - 2}</p>
                              )}
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{t.timelineTitle}</h2>
              <p className="text-xs text-slate-500">{t.total}: {totalElements}</p>
            </div>
            {timelineKeys.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                {t.noData}
              </p>
            )}
            <div className="space-y-4">
              {timelineKeys.map((key) => (
                <div key={key} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold text-slate-700">{key}</p>
                  <div className="mt-2 space-y-2">
                    {(groupedByDate[key] || []).map((mission) => (
                      <article key={mission.missionId} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {mission.template?.title || t.untitled}
                          </p>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                            {mission.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{t.child}: {mission.childName || KO.common.none}</p>
                        <p className="mt-1 text-xs text-slate-500">{t.dueDate}: {mission.dueDate || mission.assignedAt || KO.common.none}</p>
                        <div className="mt-3">
                          <Link
                            to={detailLinkFor(mission.missionId)}
                            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700"
                          >
                            {t.openDetail}
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

export default MissionCalendarPage
