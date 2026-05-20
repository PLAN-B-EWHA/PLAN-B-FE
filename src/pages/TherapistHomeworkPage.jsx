import { useMemo, useState } from 'react'
import { TherapistStatsShell } from '../components/TherapistStatsShell'

const defaultRows = [
  { id: 1, title: '감정 카드 하루 10분 연습', due: '이번 주 금요일', status: '진행중' },
  { id: 2, title: '기쁨/슬픔 구분 게임 3회', due: '이번 주 토요일', status: '진행중' },
]

export function TherapistHomeworkPage() {
  const [rows, setRows] = useState(defaultRows)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')

  const openCount = useMemo(() => rows.filter((r) => r.status !== '완료').length, [rows])

  function addRow() {
    if (!title.trim()) return
    setRows((current) => [
      {
        id: Date.now(),
        title: title.trim(),
        due: due || '기한 미지정',
        status: '진행중',
      },
      ...current,
    ])
    setTitle('')
    setDue('')
  }

  function markDone(id) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, status: '완료' } : row)))
  }

  return (
    <TherapistStatsShell activeId="homework" subtitle="치료사 숙제 지시와 진행 상태를 관리합니다." title="숙제">
      <section className="stats-grid bottom-grid" style={{ marginTop: 16 }}>
        <article className="stats-panel">
          <p className="stats-chip-label">진행 중 숙제</p>
          <p className="stats-chip-value">{openCount}건</p>
          <p className="stats-chip-sub">완료 처리 전 항목</p>
        </article>
        <article className="stats-panel">
          <p className="stats-chip-label">총 숙제</p>
          <p className="stats-chip-value">{rows.length}건</p>
          <p className="stats-chip-sub">현재 화면 기준</p>
        </article>
      </section>

      <section className="stats-panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <p>숙제 추가</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_200px_120px]">
          <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" onChange={(e) => setTitle(e.target.value)} placeholder="숙제 내용을 입력하세요" value={title} />
          <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" onChange={(e) => setDue(e.target.value)} placeholder="기한(예: 다음 화요일)" value={due} />
          <button className="rounded-xl bg-[var(--brand-500)] px-4 py-3 text-sm font-semibold text-white" onClick={addRow} type="button">추가</button>
        </div>
      </section>

      <section className="stats-panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <p>숙제 목록</p>
        </div>
        <div className="space-y-3">
          {rows.map((row) => (
            <div className="rounded-xl border border-slate-200 p-4" key={row.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                  <p className="mt-1 text-xs text-slate-500">기한: {row.due}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.status === '완료' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{row.status}</span>
                  {row.status !== '완료' ? <button className="rounded-lg border border-slate-200 px-3 py-1 text-xs" onClick={() => markDone(row.id)} type="button">완료</button> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </TherapistStatsShell>
  )
}
