import { useEffect, useMemo, useState } from 'react'
import { ParentShell } from '../components/ParentShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { calculateAgeLabel, defaultChildForm, getGenderLabel, normalizeChildForm, resolveUploadUrl } from '../lib/childUtils'
import { parseHomePracticeTips } from '../lib/memoUtils'

const weeklyDays = [
  { day: '월', mark: '완료', type: 'done' },
  { day: '화', mark: '완료', type: 'done' },
  { day: '수', mark: '완료', type: 'done' },
  { day: '목', mark: '완료', type: 'done' },
  { day: '금', mark: '오늘', type: 'today' },
  { day: '토', mark: '-', type: 'empty' },
  { day: '일', mark: '-', type: 'empty' },
]

const practiceItems = [
  { icon: '표', title: '하루 한 번 감정 체크인', body: '"오늘 가장 편했던 순간이 있었어?"처럼 짧게 물으며 학생이 스스로 말문을 열 수 있게 도와주세요.', caution: null },
  { icon: '문', title: '장면 속 감정 읽기', body: '드라마나 영상 속 장면을 함께 보며 인물의 표정과 상황을 연결해서 이야기해 보세요.', caution: '정답을 바로 알려주기보다 학생이 이유를 먼저 말해보게 하면 더 좋아요.' },
  { icon: '대', title: '대화 확장 연습', body: '학생이 짧게 답했을 때 보호자가 한 문장만 덧붙여 대화를 자연스럽게 확장해 주세요.', caution: null },
]

const emotionCards = [
  { title: '기쁨', grade: '안정 단계', body: '일상 대화 안에서 자연스럽게 찾을 수 있어요.', tone: 'good' },
  { title: '슬픔', grade: '안정 단계', body: '사진과 장면 안에서도 비교적 잘 구분하고 있어요.', tone: 'good' },
  { title: '놀람', grade: '확장 중', body: '표정만이 아니라 상황 설명과 함께 연결하는 연습이 필요해요.', tone: 'brand' },
  { title: '분노', grade: '연습 중', body: '감정의 이유를 구체적으로 말로 표현하는 훈련을 이어가고 있어요.', tone: 'warn' },
]

function fieldClass() {
  return 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-4 focus:ring-[rgba(79,70,229,0.12)]'
}

function ChildAvatar({ child, large = false }) {
  const imageUrl = resolveUploadUrl(child?.profileImageUrl)
  const sizeClass = large ? 'h-14 w-14 rounded-2xl' : 'h-11 w-11 rounded-full'

  if (imageUrl) {
    return <img alt={child?.name || 'child'} className={`${sizeClass} object-cover`} src={imageUrl} />
  }

  return (
    <div className={`flex items-center justify-center bg-[var(--brand-50)] font-bold text-[var(--brand-700)] ${sizeClass}`}>
      {child?.name?.[0] || '아'}
    </div>
  )
}

function ParentStatCard({ label, value, sub, tone = 'default' }) {
  const toneClass = tone === 'good' ? 'text-[var(--brand-600)]' : tone === 'warn' ? 'text-amber-600' : 'text-slate-950'
  return (
    <article className="rounded-[1.2rem] border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`mt-3 text-[28px] font-black leading-none tracking-tight ${toneClass}`}>{value}</p>
      <p className="mt-2 text-xs text-slate-400">{sub}</p>
    </article>
  )
}

function EmotionCard({ item }) {
  const toneClass = { good: 'border-emerald-200 bg-emerald-50', brand: 'border-[var(--brand-200)] bg-[var(--brand-50)]', warn: 'border-amber-200 bg-amber-50' }
  return (
    <article className={`rounded-2xl border p-4 ${toneClass[item.tone]}`}>
      <p className="text-sm font-bold text-slate-900">{item.title}</p>
      <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-700">{item.grade}</span>
      <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
    </article>
  )
}

function ChildProfileCard({ child }) {
  return (
    <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--brand-500)]">Student Profile</p>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{child.name}</h3>
        </div>
        <ChildAvatar child={child} large />
      </div>
      <dl className="mt-5 grid gap-3">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><dt className="text-sm text-slate-500">나이</dt><dd className="text-sm font-semibold text-slate-900">{calculateAgeLabel(child.birthDate)}</dd></div>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><dt className="text-sm text-slate-500">성별</dt><dd className="text-sm font-semibold text-slate-900">{getGenderLabel(child.gender)}</dd></div>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><dt className="text-sm text-slate-500">관심사</dt><dd className="text-sm font-semibold text-slate-900">{child.interests || '아직 없음'}</dd></div>
      </dl>
    </article>
  )
}

function EmptyParentState({ loading, errorMessage }) {
  return (
    <div className="rounded-[1.6rem] border border-dashed border-[var(--brand-200)] bg-[linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)] p-10">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-[var(--brand-500)] text-3xl font-light text-white shadow-[0_18px_40px_rgba(79,70,229,0.28)]">+</div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Parent Start</p>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950">첫 학생을 등록해 주세요</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-600">처음 가입한 보호자라면 여기에서 첫 학생 정보를 등록해 주세요. 등록이 끝나면 홈 대시보드와 학생 페이지가 실제 정보로 채워집니다.</p>
        {errorMessage ? <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{errorMessage}</div> : null}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-500">첫 학생 등록 이후의 추가 등록은 학생 페이지에서 이어서 할 수 있어요.</div>
          {loading ? <span className="text-sm text-slate-400">학생 목록 확인 중...</span> : null}
        </div>
      </div>
    </div>
  )
}

function InlineChildCreatePanel({ form, onChange, onSubmit, saving, feedback }) {
  return (
    <div className="mt-8 rounded-[1.6rem] border border-slate-200 bg-white p-6 text-left shadow-[0_24px_60px_rgba(79,70,229,0.10)]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Create Student</p>
        <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">첫 학생 등록</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">기본 정보만 먼저 입력해도 바로 시작할 수 있어요.</p>
      </div>
      {feedback ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{feedback}</div> : null}
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <input className={fieldClass()} name="name" onChange={onChange} placeholder="이름" value={form.name} />
          <input className={fieldClass()} name="birthDate" onChange={onChange} type="date" value={form.birthDate} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <select className={fieldClass()} name="gender" onChange={onChange} value={form.gender}><option value="MALE">남학생</option><option value="FEMALE">여학생</option><option value="OTHER">기타</option></select>
          <input className={fieldClass()} inputMode="numeric" maxLength={4} name="pin" onChange={onChange} placeholder="PIN 4자리" value={form.pin} />
        </div>
        <input className={fieldClass()} name="interests" onChange={onChange} placeholder="관심사" value={form.interests} />
        <textarea className={`${fieldClass()} min-h-24 resize-none`} name="diagnosisInfo" onChange={onChange} placeholder="진단 및 상태 메모" value={form.diagnosisInfo} />
        <textarea className={`${fieldClass()} min-h-24 resize-none`} name="specialNotes" onChange={onChange} placeholder="특이사항" value={form.specialNotes} />
        <div className="flex justify-end pt-2">
          <button className="rounded-xl bg-[var(--brand-500)] px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-400" disabled={saving} type="submit">
            {saving ? '등록 중...' : '첫 학생 등록'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function ParentDashboardPage() {
  const { accessToken } = useAuth()
  const [checkedItems, setCheckedItems] = useState({})
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [createForm, setCreateForm] = useState(defaultChildForm)
  const [latestMemo, setLatestMemo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  const selectedChild = useMemo(() => children.find((child) => child.childId === selectedChildId) || children[0] || null, [children, selectedChildId])
  const parsedPracticeTips = useMemo(() => parseHomePracticeTips(latestMemo?.homePracticeTip || '').filter(Boolean), [latestMemo?.homePracticeTip])
  const displayedPracticeItems = parsedPracticeTips.length
    ? parsedPracticeTips.map((tip, index) => ({
        icon: `${index + 1}`,
        title: `일상 연계 ${index + 1}`,
        body: tip,
        caution: null,
      }))
    : practiceItems

  useEffect(() => {
    let ignore = false
    async function loadChildren() {
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
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    loadChildren()
    return () => {
      ignore = true
    }
  }, [accessToken])

  useEffect(() => {
    let ignore = false

    async function loadLatestMemo() {
      if (!accessToken || !selectedChildId) {
        setLatestMemo(null)
        return
      }

      try {
        const response = await apiFetch(`/parent/child/therapist-memo?childId=${selectedChildId}&page=0&size=1`, {
          method: 'GET',
          token: accessToken,
        })
        const payload = extractApiPayload(response)
        if (!ignore) {
          setLatestMemo(payload?.content?.[0] || null)
        }
      } catch {
        if (!ignore) {
          setLatestMemo(null)
        }
      }
    }

    loadLatestMemo()

    return () => {
      ignore = true
    }
  }, [accessToken, selectedChildId])

  function togglePractice(title) {
    setCheckedItems((current) => ({ ...current, [title]: !current[title] }))
  }

  function handleCreateChange(event) {
    const { name, value } = event.target
    if (name === 'pin') {
      setCreateForm((current) => ({ ...current, pin: value.replace(/\D/g, '').slice(0, 4) }))
      return
    }
    setCreateForm((current) => ({ ...current, [name]: value }))
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    if (!createForm.name.trim()) {
      setFeedback('이름은 필수입니다.')
      return
    }
    setSaving(true)
    setFeedback('')
    try {
      const response = await apiFetch('/children', { method: 'POST', token: accessToken, body: normalizeChildForm(createForm) })
      const payload = extractApiPayload(response)
      setChildren([...children, payload])
      setSelectedChildId(payload.childId)
      setCreateForm({ ...defaultChildForm })
    } catch (error) {
      setFeedback(extractApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ParentShell childCount={children.length} heading="오늘의 보호자 대시보드" selectedChild={selectedChild} subheading={selectedChild ? `${selectedChild.name}의 오늘 학습 흐름과 감정 연습 포인트를 확인하세요` : '첫 학생 등록 후 홈이 채워집니다'}>
      {children.length === 0 ? (
        <>
          <EmptyParentState errorMessage={feedback} loading={loading} />
          <InlineChildCreatePanel feedback={feedback} form={createForm} onChange={handleCreateChange} onSubmit={handleCreateSubmit} saving={saving} />
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Home</p>
              <h1 className="mt-2 text-[28px] font-black tracking-tight text-slate-950">오늘의 보호자 대시보드</h1>
              <p className="mt-1 text-sm text-slate-400">{selectedChild?.name}의 세션 흐름과 일상 속 표현 연습 포인트를 확인해 보세요.</p>
            </div>
          </div>

          <section className="mt-5 grid gap-3 xl:grid-cols-4">
            <ParentStatCard label="등록된 학생" sub="현재 보호자 계정 기준" tone="good" value={`${children.length}명`} />
            <ParentStatCard label="이번 주 출석" sub="세션 참여 완료" tone="good" value="5 / 5" />
            <ParentStatCard label="배운 표현" sub="이번 달 기준" tone="good" value="24개" />
            <ParentStatCard label="일상 연계" sub="오늘 남은 체크" tone="warn" value="3개" />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
            <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">학생 목록</div>
              </div>
              <div className="space-y-3">
                {children.map((child) => (
                  <button
                    key={child.childId}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-4 text-left transition ${
                      selectedChild?.childId === child.childId ? 'border-[var(--brand-200)] bg-[var(--brand-50)]' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedChildId(child.childId)}
                    type="button"
                  >
                    <ChildAvatar child={child} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{child.name}</p>
                      <p className="text-xs text-slate-400">{calculateAgeLabel(child.birthDate)}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">{getGenderLabel(child.gender)}</span>
                  </button>
                ))}
              </div>
            </article>
            {selectedChild ? <ChildProfileCard child={selectedChild} /> : null}
          </section>

          <div className="mt-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <span>At Home</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
            <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">이번 주 세션 흐름</div>
                <button className="text-xs font-semibold text-[var(--brand-600)]" type="button">전체 기록 보기</button>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-end gap-4">
                  {weeklyDays.map((item) => (
                    <div key={item.day} className="flex flex-col items-center gap-2 text-[11px] text-slate-400">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl text-[11px] font-semibold ${item.type === 'done' ? 'bg-[var(--brand-500)] text-white' : item.type === 'today' ? 'border-2 border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]' : 'border border-dashed border-slate-300 bg-slate-50 text-slate-400'}`}>{item.mark}</div>
                      <span>{item.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
              <div className="mb-4 text-sm font-semibold text-slate-900">일상 연계 체크</div>
              <div className="space-y-3">
                {displayedPracticeItems.map((item) => (
                  <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-xs font-bold text-[var(--brand-600)]">{item.icon}</div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
                        {item.caution ? <p className="mt-2 text-xs font-medium text-rose-600">{item.caution}</p> : null}
                      </div>
                      <button className={`mt-1 flex h-6 w-6 items-center justify-center rounded-lg border text-xs font-bold ${checkedItems[item.title] ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-transparent'}`} onClick={() => togglePractice(item.title)} type="button">✓</button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
            <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">이번 주 표현 흐름</div>
                <span className="rounded-full bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold text-[var(--brand-700)]">{selectedChild?.name}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {emotionCards.map((item) => <EmotionCard item={item} key={item.title} />)}
              </div>
            </article>

            <article className="rounded-[1.2rem] border border-slate-200 bg-[linear-gradient(180deg,#eef2ff_0%,#ffffff_100%)] p-5">
              <p className="text-sm font-semibold text-slate-900">이번 주 보호자 메모</p>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                <p>기쁨과 슬픔은 비교적 안정적으로 구분하고 있어요. 이번 주는 놀람과 분노를 상황의 맥락과 함께 연결하는 연습이 좋아요.</p>
                <p>집에서는 짧고 자연스럽게 질문하고, 정답을 맞히는 것보다 스스로 이유를 말해보는 경험을 격려해 주세요.</p>
                <p className="font-semibold text-[var(--brand-700)]">학생 상세 관리는 왼쪽 `학생` 메뉴에서 이어서 볼 수 있어요.</p>
              </div>
            </article>
          </section>
        </>
      )}
    </ParentShell>
  )
}
