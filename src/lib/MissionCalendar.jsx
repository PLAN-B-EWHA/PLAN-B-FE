import { useMemo, useState } from 'react'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

const STATUS_DOT = {
  PENDING:   '#3b82f6',
  SUBMITTED: '#f59e0b',
  REVIEWED:  '#10b981',
  CANCELED:  '#94a3b8',
  EXPIRED:   '#ef4444',
}

const STATUS_LABEL = {
  PENDING:   '진행 중',
  SUBMITTED: '확인 대기',
  REVIEWED:  '검토 완료',
  CANCELED:  '취소됨',
  EXPIRED:   '기한 만료',
}

export function MissionCalendar({ missions = [], onSelectMission, labelOf }) {
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const missionsByDate = useMemo(() => {
    const map = {}
    for (const mission of missions) {
      if (!mission?.dueDate) continue
      const key = String(mission.dueDate).slice(0, 10)
      map[key] = map[key] || []
      map[key].push(mission)
    }
    return map
  }, [missions])

  const year = calMonth.getFullYear()
  const month = calMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const startOffset = (firstDay + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = new Date().toISOString().slice(0, 10)

  const cells = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const remainder = cells.length % 7
  if (remainder !== 0) cells.push(...Array(7 - remainder).fill(null))

  return (
    <section className="mcal">
      {/* 헤더 */}
      <div className="mcal-head">
        <button aria-label="이전 달" className="mcal-nav" onClick={() => setCalMonth(new Date(year, month - 1, 1))} type="button">‹</button>
        <div className="mcal-title">
          <strong>{year}년 {month + 1}월</strong>
          <span>{missions.length}개 미션</span>
        </div>
        <button aria-label="다음 달" className="mcal-nav" onClick={() => setCalMonth(new Date(year, month + 1, 1))} type="button">›</button>
      </div>

      {/* 요일 헤더 */}
      <div className="mcal-dow">
        {DAY_LABELS.map((day, i) => (
          <span className={i >= 5 ? 'weekend' : ''} key={day}>{day}</span>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="mcal-grid">
        {cells.map((day, index) => {
          if (!day) return <div className="mcal-cell empty" key={`e-${index}`} />

          const col = index % 7
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayMissions = missionsByDate[dateStr] || []
          const isToday = dateStr === todayStr
          const isWeekend = col >= 5

          return (
            <div className={`mcal-cell ${isWeekend ? 'weekend' : ''}`} key={dateStr}>
              <span className={`mcal-day-num ${isToday ? 'today' : ''}`}>{day}</span>
              {dayMissions.length > 0 ? (
                <div className="mcal-dots">
                  {dayMissions.slice(0, 3).map((m) => (
                    <button
                      aria-label={labelOf ? labelOf(m) : ''}
                      className="mcal-dot"
                      key={m.homeworkId || m.id}
                      onClick={() => onSelectMission?.(m)}
                      style={{ background: STATUS_DOT[m.status] || STATUS_DOT.PENDING }}
                      title={labelOf ? labelOf(m) : ''}
                      type="button"
                    />
                  ))}
                  {dayMissions.length > 3 ? (
                    <span className="mcal-more">+{dayMissions.length - 3}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* 범례 */}
      <div className="mcal-legend">
        {Object.entries(STATUS_LABEL).map(([status, label]) => (
          <span className="mcal-legend-item" key={status}>
            <i style={{ background: STATUS_DOT[status] }} />
            {label}
          </span>
        ))}
      </div>
    </section>
  )
}
