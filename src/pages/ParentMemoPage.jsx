import { useEffect, useMemo, useState } from 'react'
import { ParentShell } from '../components/ParentShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { calculateAgeLabel, getGenderLabel, resolveUploadUrl } from '../lib/childUtils'
import { parseHomePracticeTips } from '../lib/memoUtils'

function ChildBadge({ child }) {
  const imageUrl = resolveUploadUrl(child?.profileImageUrl)

  return (
    <div className="flex items-center gap-3">
      {imageUrl ? (
        <img alt={child?.name || 'child'} className="h-11 w-11 rounded-full object-cover" src={imageUrl} />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-500)] text-sm font-bold text-white">
          {child?.name?.[0] || '아'}
        </div>
      )}
      <div>
        <p className="text-sm font-bold text-slate-900">{child?.name}</p>
        <p className="text-xs text-slate-400">
          {calculateAgeLabel(child?.birthDate)} · {getGenderLabel(child?.gender)}
        </p>
      </div>
    </div>
  )
}

function formatDateTime(value) {
  if (!value) {
    return '발행일 미정'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatWeekLabel(value) {
  if (!value) {
    return '주차 미정'
  }

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${date.getMonth() + 1}월 ${date.getDate()}일 주차`
}

function summarizeMemo(value) {
  const text = (value || '').trim()
  if (!text) {
    return '내용 없음'
  }

  return text.length > 10 ? `${text.slice(0, 10)}...` : text
}

function getMemoSourceLabel(value) {
  if (value === 'LLM_DRAFT') {
    return 'LLM'
  }

  if (value === 'MANUAL') {
    return 'MANUAL'
  }

  return 'MEMO'
}

function MemoDetailModal({ memo, onClose }) {
  const practiceTips = parseHomePracticeTips(memo?.homePracticeTip || '').filter(Boolean)

  if (!memo) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6" onClick={onClose} role="presentation">
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[1.8rem] bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Student Memo</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{formatWeekLabel(memo.weekOf)}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {formatDateTime(memo.publishedAt || memo.createdAt)} · {getMemoSourceLabel(memo.source)}
            </p>
          </div>
          <button
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            onClick={onClose}
            type="button"
          >
            닫기
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-500)]">Guardian Memo</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {memo.parentContent || '보호자 공개 메모가 아직 없습니다.'}
            </p>
          </section>

          <section className="rounded-2xl border border-[rgba(79,70,229,0.16)] bg-[linear-gradient(180deg,#eef2ff_0%,#ffffff_100%)] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-500)]">Daily Practice Tip</p>
            {practiceTips.length ? (
              <div className="mt-3 space-y-2">
                {practiceTips.map((tip, index) => (
                  <div className="flex items-start gap-3 rounded-xl bg-white/80 px-4 py-3" key={`${memo.id}-detail-tip-${index + 1}`}>
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-500)] text-[11px] font-bold text-white">
                      {index + 1}
                    </div>
                    <p className="flex-1 text-sm leading-6 text-slate-700">{tip}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm font-medium text-slate-600">가정 연습 팁이 아직 없어요.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export function ParentMemoPage() {
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [memos, setMemos] = useState([])
  const [selectedWeek, setSelectedWeek] = useState('ALL')
  const [selectedMemo, setSelectedMemo] = useState(null)
  const [observation, setObservation] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const selectedChild = useMemo(
    () => children.find((child) => child.childId === selectedChildId) || children[0] || null,
    [children, selectedChildId],
  )
  const latestMemo = memos[0] || null
  const latestPracticeTips = parseHomePracticeTips(latestMemo?.homePracticeTip || '').filter(Boolean)
  const weekOptions = useMemo(() => {
    const weeks = Array.from(new Set(memos.map((memo) => memo.weekOf).filter(Boolean)))
    return ['ALL', ...weeks]
  }, [memos])
  const filteredMemos = useMemo(() => {
    if (selectedWeek === 'ALL') {
      return memos
    }

    return memos.filter((memo) => memo.weekOf === selectedWeek)
  }, [memos, selectedWeek])

  async function loadMemos(childId) {
    if (!childId) {
      setMemos([])
      setSelectedWeek('ALL')
      return
    }

    const response = await apiFetch(`/parent/child/therapist-memo?childId=${childId}&page=0&size=50`, {
      method: 'GET',
      token: accessToken,
    })
    const payload = extractApiPayload(response)
    const nextMemos = payload?.content || []
    setMemos(nextMemos)
    setSelectedWeek('ALL')
  }

  useEffect(() => {
    let ignore = false

    async function bootstrap() {
      if (!accessToken) {
        setLoading(false)
        return
      }

      try {
        const response = await apiFetch('/children/my', { method: 'GET', token: accessToken })
        const payload = extractApiPayload(response) || []

        if (!ignore) {
          setChildren(payload)
          setSelectedChildId(payload[0]?.childId || null)

          if (payload[0]?.childId) {
            await loadMemos(payload[0].childId)
          }
        }
      } catch (error) {
        if (!ignore) {
          setFeedback(extractApiErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      ignore = true
    }
  }, [accessToken])

  async function handleChildChange(childId) {
    setSelectedChildId(childId)
    setLoading(true)
    setFeedback('')
    setSelectedMemo(null)

    try {
      await loadMemos(childId)
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitObservation(event) {
    event.preventDefault()
    if (!selectedChild?.childId || !observation.trim()) {
      return
    }

    setSubmitting(true)
    setFeedback('')

    try {
      await apiFetch('/parent/child/observation', {
        method: 'POST',
        token: accessToken,
        body: {
          childId: selectedChild.childId,
          content: observation.trim(),
        },
      })
      setObservation('')
      setFeedback('선생님께 전달됐어요.')
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ParentShell
      childCount={children.length}
      heading="치료사 메모"
      selectedChild={selectedChild}
      subheading={selectedChild ? `${selectedChild.name}의 메모와 관찰 기록을 확인해 보세요.` : '학생을 선택해 메모를 확인해 보세요.'}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Memo</p>
          <h1 className="mt-2 text-[28px] font-black tracking-tight text-slate-950">보호자 메모</h1>
          <p className="mt-1 text-sm text-slate-400">관찰 기록을 먼저 전달하고, 주차별 메모는 목록에서 골라 자세히 확인해 보세요.</p>
        </div>
        {children.length > 0 ? (
          <div className="min-w-[240px] md:ml-auto">
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              onChange={(event) => handleChildChange(event.target.value)}
              value={selectedChild?.childId || ''}
            >
              {children.map((child) => (
                <option key={child.childId} value={child.childId}>
                  {child.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {feedback ? (
        <div className="mt-5 rounded-2xl border border-[rgba(79,70,229,0.14)] bg-[var(--brand-50)] px-4 py-3 text-sm font-medium text-[var(--brand-700)]">
          {feedback}
        </div>
      ) : null}

      {selectedChild ? (
        <div className="mt-5">
          <ChildBadge child={selectedChild} />
        </div>
      ) : null}

      <section className="mt-6 rounded-[1.6rem] border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">관찰 기록 전달</p>
        <p className="mt-1 text-sm text-slate-400">집에서 본 반응이나 어려웠던 지점을 먼저 적어 보내 주세요.</p>
        <form className="mt-5 space-y-4" onSubmit={handleSubmitObservation}>
          <textarea
            className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 outline-none focus:border-[var(--brand-500)]"
            onChange={(event) => setObservation(event.target.value)}
            placeholder="예: 오늘은 꽃 향기를 맡을 때 처음엔 좋아했지만, 냄새가 강해지자 얼굴을 찡그렸어요."
            value={observation}
          />
          <div className="flex justify-end">
            <button className="rounded-xl bg-[var(--brand-500)] px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-400" disabled={submitting} type="submit">
              {submitting ? '전달 중...' : '관찰 기록 제출'}
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <div className="mt-6 grid gap-4">
          <div className="h-56 animate-pulse rounded-[1.6rem] bg-white" />
          <div className="h-48 animate-pulse rounded-[1.6rem] bg-white" />
        </div>
      ) : null}

      {!loading && latestMemo ? (
        <>
          <section className="mt-4 rounded-[1.6rem] border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Latest Memo</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">최신 메모</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {formatWeekLabel(latestMemo.weekOf)} · {formatDateTime(latestMemo.publishedAt || latestMemo.createdAt)}
                </p>
              </div>
              <button
                className="rounded-xl border border-[rgba(79,70,229,0.16)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-700)]"
                onClick={() => setSelectedMemo(latestMemo)}
                type="button"
              >
                상세 보기
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-700">
              {latestMemo.parentContent || '보호자 공개 메모가 아직 준비되지 않았어요.'}
            </div>

            <div className="mt-5 rounded-2xl border border-[rgba(79,70,229,0.16)] bg-[linear-gradient(180deg,#eef2ff_0%,#ffffff_100%)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-500)]">Home Practice Tip</p>
              {latestPracticeTips.length ? (
                <div className="mt-3 space-y-2">
                  {latestPracticeTips.map((tip, index) => (
                    <div className="flex items-start gap-3 rounded-xl bg-white/70 px-4 py-3" key={`${latestMemo.id}-tip-${index + 1}`}>
                      <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-500)] text-[11px] font-bold text-white">
                        {index + 1}
                      </div>
                      <p className="flex-1 text-sm font-medium leading-6 text-slate-700">{tip}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm font-semibold text-slate-900">이번 주 가정 연습 팁이 아직 없어요.</p>
              )}
            </div>
          </section>

          <section className="mt-4 rounded-[1.6rem] border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">이전 메모 목록</p>
                <p className="mt-1 text-xs text-slate-400">주차를 고르면 해당 주차의 메모만 모아서 볼 수 있어요.</p>
              </div>
              <div className="w-full md:w-[220px]">
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  onChange={(event) => setSelectedWeek(event.target.value)}
                  value={selectedWeek}
                >
                  {weekOptions.map((week) => (
                    <option key={week} value={week}>
                      {week === 'ALL' ? '전체 주차' : formatWeekLabel(week)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {filteredMemos.length ? (
                filteredMemos.map((memo) => (
                  <button
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-[rgba(79,70,229,0.18)] hover:bg-white"
                    key={memo.id}
                    onClick={() => setSelectedMemo(memo)}
                    type="button"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{formatWeekLabel(memo.weekOf)}</p>
                        <p className="mt-1 text-xs text-slate-400">{formatDateTime(memo.publishedAt || memo.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold text-[var(--brand-700)]">
                          {getMemoSourceLabel(memo.source)}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">
                          {summarizeMemo(memo.parentContent)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                  선택한 주차에는 메모가 아직 없어요.
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {!loading && !latestMemo ? (
        <section className="mt-4 rounded-[1.6rem] border border-dashed border-[var(--brand-200)] bg-[linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)] p-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Empty Memo</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">선생님이 아직 메모를 작성 중이에요</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">메모가 발행되면 여기에서 주차별 목록과 가정 연습 팁을 바로 확인할 수 있어요.</p>
        </section>
      ) : null}

      <MemoDetailModal memo={selectedMemo} onClose={() => setSelectedMemo(null)} />
    </ParentShell>
  )
}
