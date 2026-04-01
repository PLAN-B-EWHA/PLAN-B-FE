import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { parseHomePracticeTips, stringifyHomePracticeTips } from '../lib/memoUtils'

function getWeekStart(date = new Date()) {
  const next = new Date(date)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  next.setHours(0, 0, 0, 0)
  return next.toISOString().slice(0, 10)
}

function buildWeekTabs(memos) {
  const weeks = Array.from(new Set(memos.map((memo) => memo.weekOf).filter(Boolean)))
  const currentWeek = getWeekStart()

  if (!weeks.includes(currentWeek)) {
    weeks.unshift(currentWeek)
  }

  return weeks.sort((a, b) => (a < b ? 1 : -1))
}

function sortMemosByNewest(left, right) {
  const leftTime = new Date(left?.createdAt || left?.updatedAt || left?.publishedAt || 0).getTime()
  const rightTime = new Date(right?.createdAt || right?.updatedAt || right?.publishedAt || 0).getTime()

  if (leftTime === rightTime) {
    return (right?.id || 0) - (left?.id || 0)
  }

  return rightTime - leftTime
}

function formatWeekLabel(weekOf, index) {
  if (!weekOf) {
    return `${index + 1}주차`
  }

  const date = new Date(`${weekOf}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return `${index + 1}주차`
  }

  return `${date.getMonth() + 1}월 ${date.getDate()}일 주차`
}

function formatDateTime(value) {
  if (!value) {
    return '방금'
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

const emptyForm = {
  content: '',
  parentContent: '',
  homePracticeTips: parseHomePracticeTips(''),
  isVisibleToParent: false,
}

export function TherapistMemoPage() {
  const navigate = useNavigate()
  const { childId } = useParams()
  const { accessToken, jwtPayload, logout, user } = useAuth()

  const [memoList, setMemoList] = useState([])
  const [selectedWeek, setSelectedWeek] = useState(getWeekStart())
  const [selectedMemoId, setSelectedMemoId] = useState(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [currentMemo, setCurrentMemo] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [feedback, setFeedback] = useState('')

  const displayName = user?.name || jwtPayload?.name || '치료사'

  const weekTabs = useMemo(() => buildWeekTabs(memoList), [memoList])
  const selectedWeekMemos = useMemo(
    () => memoList.filter((memo) => memo.weekOf === selectedWeek).sort(sortMemosByNewest),
    [memoList, selectedWeek],
  )
  const selectedWeekMemo = useMemo(() => {
    if (!selectedWeekMemos.length) {
      return null
    }

    if (!selectedMemoId) {
      return null
    }

    return selectedWeekMemos.find((memo) => memo.id === selectedMemoId) || null
  }, [selectedMemoId, selectedWeekMemos])

  async function loadMemoList() {
    const response = await apiFetch(`/therapist/patients/${childId}/memo?page=0&size=50`, {
      method: 'GET',
      token: accessToken,
    })
    const payload = extractApiPayload(response)
    const content = (payload?.content || []).slice().sort(sortMemosByNewest)
    setMemoList(content)
    return content
  }

  async function loadMemoDetail(memoId) {
    if (!memoId) {
      setCurrentMemo(null)
      setForm(emptyForm)
      return null
    }

    const response = await apiFetch(`/therapist/patients/${childId}/memo/${memoId}`, {
      method: 'GET',
      token: accessToken,
    })
    const payload = extractApiPayload(response)
    setCurrentMemo(payload)
    setForm({
      content: payload?.content || '',
      parentContent: payload?.parentContent || '',
      homePracticeTips: parseHomePracticeTips(payload?.homePracticeTip || ''),
      isVisibleToParent: Boolean(payload?.isVisibleToParent),
    })
    return payload
  }

  function buildDraftSignature(detail) {
    return JSON.stringify({
      parentContent: detail?.parentContent || '',
      homePracticeTip: detail?.homePracticeTip || '',
      updatedAt: detail?.updatedAt || '',
      source: detail?.source || '',
    })
  }

  async function pollDraft(memoId, baselineDetail = null) {
    if (!memoId) {
      return
    }

    setGenerating(true)
    const initialSignature = buildDraftSignature(baselineDetail)

    try {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2500))
        const detail = await loadMemoDetail(memoId)
        const nextSignature = buildDraftSignature(detail)
        const hasGeneratedContent = Boolean(detail?.parentContent || detail?.homePracticeTip)

        if (hasGeneratedContent && nextSignature !== initialSignature) {
          await loadMemoList()
          return
        }
      }
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    let ignore = false

    async function bootstrap() {
      if (!accessToken) {
        setLoading(false)
        return
      }

      try {
        const content = await loadMemoList()
        const initialWeek = content[0]?.weekOf || getWeekStart()

        if (!ignore) {
          setSelectedWeek(initialWeek)
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
  }, [accessToken, childId])

  useEffect(() => {
    if (!selectedWeekMemos.length) {
      setSelectedMemoId(null)
      setIsCreatingNew(true)
      setCurrentMemo(null)
      setForm(emptyForm)
      return
    }

    if (isCreatingNew) {
      return
    }

    const hasSelectedMemo = selectedWeekMemos.some((memo) => memo.id === selectedMemoId)
    if (!hasSelectedMemo) {
      setSelectedMemoId(selectedWeekMemos[0].id)
    }
  }, [isCreatingNew, selectedMemoId, selectedWeekMemos])

  useEffect(() => {
    let ignore = false

    async function syncMemoDetail() {
      if (!selectedMemoId) {
        setCurrentMemo(null)
        setForm(emptyForm)
        return
      }

      try {
        const detail = await loadMemoDetail(selectedMemoId)
        if (ignore && detail) {
          return
        }
      } catch (error) {
        if (!ignore) {
          setFeedback(extractApiErrorMessage(error))
        }
      }
    }

    syncMemoDetail()

    return () => {
      ignore = true
    }
  }, [selectedMemoId])

  function handleCreateNewMemo() {
    setIsCreatingNew(true)
    setSelectedMemoId(null)
    setCurrentMemo(null)
    setForm(emptyForm)
    setFeedback('')
  }

  async function createMemoFromForm() {
    const response = await apiFetch(`/therapist/patients/${childId}/memo`, {
      method: 'POST',
      token: accessToken,
      body: {
        weekOf: selectedWeek,
        content: form.content,
        isVisibleToParent: form.isVisibleToParent,
      },
    })
    const payload = extractApiPayload(response)
    const nextMemoId = payload?.id || null

    await loadMemoList()
    setIsCreatingNew(false)
    setSelectedMemoId(nextMemoId)

    return nextMemoId
  }

  async function handleSave() {
    setSaving(true)
    setFeedback('')

    try {
      if (currentMemo?.id) {
        const response = await apiFetch(`/therapist/patients/${childId}/memo/${currentMemo.id}`, {
          method: 'PATCH',
          token: accessToken,
          body: {
            ...form,
            homePracticeTip: stringifyHomePracticeTips(form.homePracticeTips),
          },
        })
        const payload = extractApiPayload(response)
        setCurrentMemo(payload)
        setIsCreatingNew(false)
        setSelectedMemoId(payload?.id || currentMemo.id)
        await loadMemoList()
      } else {
        const memoId = await createMemoFromForm()
        await loadMemoDetail(memoId)
      }
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerate() {
    setFeedback('')

    try {
      let memoId = currentMemo?.id

      if (!memoId) {
        memoId = await createMemoFromForm()
      } else {
        setGenerating(true)
        await apiFetch(`/therapist/patients/${childId}/memo/${memoId}/regenerate`, {
          method: 'POST',
          token: accessToken,
          body: {
            therapistFeedback: form.content,
          },
        })
      }

      if (memoId) {
        const detail = await loadMemoDetail(memoId)
        pollDraft(memoId, detail)
      }
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
      setGenerating(false)
    }
  }

  async function handlePublish() {
    setSaving(true)
    setFeedback('')

    try {
      let memoId = currentMemo?.id

      if (!memoId) {
        memoId = await createMemoFromForm()
      }

      await apiFetch(`/therapist/patients/${childId}/memo/${memoId}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          ...form,
          homePracticeTip: stringifyHomePracticeTips(form.homePracticeTips),
        },
      })

      await apiFetch(`/therapist/patients/${childId}/memo/${memoId}/publish`, {
        method: 'PATCH',
        token: accessToken,
      })

      await loadMemoList()
      await loadMemoDetail(memoId)
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  const isPublished = currentMemo?.status === 'PUBLISHED'
  const isDraftMode = isCreatingNew || !currentMemo?.id
  const hasDraftContent = Boolean(
    form.content.trim() ||
      form.parentContent.trim() ||
      form.homePracticeTips.some((item) => item.trim()),
  )

  return (
    <div className="min-h-screen bg-[var(--app-canvas)] text-slate-900">
      <div className="grid min-h-screen grid-cols-1 grid-rows-[56px_1fr] lg:grid-cols-[220px_1fr] lg:grid-rows-[56px_1fr]">
        <header className="col-span-full flex items-center gap-5 border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-500)] text-xs font-black text-white">ME</div>
            <span className="text-[15px] font-bold tracking-tight text-slate-950">My Expression Friend</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-slate-400">Signed in as</p>
              <p className="text-sm font-semibold text-slate-700">{displayName}</p>
            </div>
            <button className="rounded-xl bg-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-white" onClick={handleLogout} type="button">
              로그아웃
            </button>
          </div>
        </header>

        <aside className="hidden border-r border-slate-200 bg-white px-3 py-5 lg:flex lg:flex-col">
          <button
            className="rounded-xl bg-[var(--brand-50)] px-4 py-3 text-left text-sm font-semibold text-[var(--brand-700)]"
            onClick={() => navigate('/app')}
            type="button"
          >
            치료사 홈으로
          </button>
          <button
            className="mt-2 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-600"
            onClick={() => navigate('/app/children')}
            type="button"
          >
            학생 목록으로
          </button>
          <div className="mt-auto pt-6">
            <ThemeToggleButton />
          </div>
        </aside>

        <main className="overflow-y-auto px-5 py-6 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Therapist Memo</p>
              <h1 className="mt-2 text-[28px] font-black tracking-tight text-slate-950">주차별 메모 관리</h1>
              <p className="mt-1 text-sm text-slate-500">
                같은 주차에도 여러 개의 메모를 작성할 수 있습니다. 메모를 선택해 수정하거나 새 초안을 따로 만들 수 있어요.
              </p>
            </div>
            <button
              className="rounded-xl border border-[rgba(79,70,229,0.16)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-700)]"
              onClick={handleCreateNewMemo}
              type="button"
            >
              + 현재 주차 새 메모
            </button>
          </div>

          {feedback ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{feedback}</div> : null}

          {loading ? (
            <div className="mt-6 grid gap-4">
              <div className="h-14 animate-pulse rounded-2xl bg-white" />
              <div className="h-80 animate-pulse rounded-2xl bg-white" />
            </div>
          ) : (
            <>
              <section className="mt-6 rounded-[1.6rem] border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap gap-2">
                  {weekTabs.map((week, index) => (
                    <button
                      key={week}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        selectedWeek === week ? 'bg-[var(--brand-500)] text-white' : 'border border-slate-200 bg-white text-slate-600'
                      }`}
                      onClick={() => {
                        setIsCreatingNew(false)
                        setSelectedWeek(week)
                        setSelectedMemoId(null)
                        setFeedback('')
                      }}
                      type="button"
                    >
                      {formatWeekLabel(week, index)}
                    </button>
                  ))}
                </div>
              </section>

              <section className="mt-4 grid gap-4 xl:grid-cols-[360px_1fr]">
                <article className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">선택된 주차 메모</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {selectedWeekMemos.length ? `${selectedWeekMemos.length}개의 메모가 있습니다.` : '아직 작성된 메모가 없습니다.'}
                      </p>
                    </div>
                    <button
                      className="rounded-xl bg-[var(--brand-500)] px-3 py-2 text-xs font-semibold text-white"
                      onClick={handleCreateNewMemo}
                      type="button"
                    >
                      새 메모
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <button
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        isDraftMode
                          ? 'border-[var(--brand-500)] bg-[var(--brand-50)] shadow-[0_10px_30px_rgba(79,70,229,0.08)]'
                          : 'border-dashed border-slate-200 bg-slate-50'
                      }`}
                      onClick={handleCreateNewMemo}
                      type="button"
                    >
                      <p className="text-sm font-semibold text-slate-900">새 메모 작성</p>
                      <p className="mt-1 text-xs text-slate-500">같은 주차에 메모를 하나 더 남길 수 있어요.</p>
                    </button>

                    {selectedWeekMemos.map((memo, index) => {
                      const active = memo.id === selectedMemoId
                      const statusLabel = memo.status === 'PUBLISHED' ? '발행됨' : memo.source === 'LLM_DRAFT' ? 'LLM 초안' : '임시저장'

                      return (
                        <button
                          key={memo.id}
                          className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                            active
                              ? 'border-[var(--brand-500)] bg-[var(--brand-50)] shadow-[0_10px_30px_rgba(79,70,229,0.08)]'
                              : 'border-slate-200 bg-white hover:border-[rgba(79,70,229,0.2)]'
                          }`}
                          onClick={() => {
                            setIsCreatingNew(false)
                            setSelectedMemoId(memo.id)
                            setFeedback('')
                          }}
                          type="button"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">메모 {selectedWeekMemos.length - index}</p>
                              <p className="mt-1 text-xs text-slate-500">{formatDateTime(memo.createdAt || memo.updatedAt || memo.publishedAt)}</p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                memo.status === 'PUBLISHED'
                                  ? 'bg-amber-50 text-amber-700'
                                  : memo.source === 'LLM_DRAFT'
                                    ? 'bg-indigo-50 text-[var(--brand-700)]'
                                    : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                            {memo.parentContent || memo.content || '아직 내용이 없는 메모입니다.'}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </article>

                <div className="space-y-4">
                  {generating ? (
                    <section className="rounded-[1.6rem] border border-[rgba(79,70,229,0.14)] bg-[linear-gradient(180deg,#eef2ff_0%,#ffffff_100%)] p-6">
                      <p className="text-sm font-semibold text-[var(--brand-700)]">LLM 초안 생성 중</p>
                      <p className="mt-1 text-sm text-slate-500">초안이 완성되기까지 몇 초 정도 걸릴 수 있어요. 지금도 저장이나 발행은 별도로 진행할 수 있습니다.</p>
                      <div className="mt-4 space-y-3">
                        <div className="h-4 animate-pulse rounded-full bg-[rgba(79,70,229,0.14)]" />
                        <div className="h-4 animate-pulse rounded-full bg-[rgba(79,70,229,0.10)]" />
                        <div className="h-24 animate-pulse rounded-2xl bg-[rgba(79,70,229,0.08)]" />
                      </div>
                    </section>
                  ) : null}

                  <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <article className="rounded-[1.6rem] border border-slate-200 bg-white p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{isDraftMode ? '새 메모 초안' : '선택한 메모 편집'}</p>
                          <p className="mt-1 text-xs text-slate-400">{currentMemo?.status || '저장 전 메모'}</p>
                        </div>
                        {isPublished ? (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">발행됨</span>
                        ) : null}
                      </div>

                      <div className="mt-5 space-y-4">
                        <textarea
                          className="min-h-36 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 outline-none focus:border-[var(--brand-500)]"
                          disabled={isPublished}
                          onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                          placeholder="[내부 메모] 보호자 비공개 내용"
                          value={form.content}
                        />
                        <textarea
                          className="min-h-36 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 outline-none focus:border-[var(--brand-500)]"
                          disabled={isPublished}
                          onChange={(event) => setForm((current) => ({ ...current, parentContent: event.target.value }))}
                          placeholder="[보호자 공개 내용]"
                          value={form.parentContent}
                        />
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">가정 연습 팁</p>
                              <p className="mt-1 text-xs text-slate-500">항목별로 입력하면 저장 시 하나의 문자열로 정리됩니다.</p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[var(--brand-700)]">`A | B | C | D`</span>
                          </div>
                          <div className="mt-4 space-y-3">
                            {form.homePracticeTips.map((tip, index) => (
                              <div className="flex items-start gap-3" key={`tip-${index + 1}`}>
                                <div className="mt-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[var(--brand-600)]">
                                  {index + 1}
                                </div>
                                <input
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--brand-500)]"
                                  disabled={isPublished}
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      homePracticeTips: current.homePracticeTips.map((item, itemIndex) =>
                                        itemIndex === index ? event.target.value : item,
                                      ),
                                    }))
                                  }
                                  placeholder={`가정 연습 팁 ${index + 1}`}
                                  value={tip}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700">
                          <input
                            checked={form.isVisibleToParent}
                            disabled={isPublished}
                            onChange={(event) => setForm((current) => ({ ...current, isVisibleToParent: event.target.checked }))}
                            type="checkbox"
                          />
                          <span>보호자에게 공개</span>
                        </label>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-2">
                        <button
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
                          disabled={saving || isPublished}
                          onClick={handleSave}
                          type="button"
                        >
                          임시저장
                        </button>
                        <button
                          className="rounded-xl bg-[var(--brand-500)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                          disabled={saving || generating || isPublished}
                          onClick={handleGenerate}
                          type="button"
                        >
                          {currentMemo?.id ? '초안 재생성' : 'LLM 초안 생성'}
                        </button>
                        <button
                          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 disabled:opacity-50"
                          disabled={saving || !hasDraftContent || isPublished}
                          onClick={handlePublish}
                          type="button"
                        >
                          발행하기
                        </button>
                      </div>

                      {isPublished ? (
                        <p className="mt-4 text-sm text-amber-700">발행된 메모는 기본적으로 수정할 수 없습니다. 수정이 필요하면 치료 관리자에게 문의해 주세요.</p>
                      ) : null}
                    </article>

                    <article className="rounded-[1.6rem] border border-slate-200 bg-white p-6">
                      <p className="text-sm font-semibold text-slate-900">보호자 관찰 기록</p>
                      <p className="mt-1 text-sm text-slate-400">이번 주 관찰 기록은 LLM 초안 생성 시 참고 컨텍스트로 사용됩니다.</p>
                      <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                        현재 연결된 HOMEWORK_REPORTS 조회 API가 확인되지 않아, 이 영역은 연동 준비 상태로 두었습니다.
                      </div>
                    </article>
                  </section>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
