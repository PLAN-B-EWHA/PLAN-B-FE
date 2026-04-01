import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import {
  calculateAgeLabel,
  getExpressionTagLabel,
  getGenderLabel,
  getLanguageSkillLabel,
  getSensoryProcessingLabel,
  resolveUploadUrl,
} from '../lib/childUtils'

const sidebarItems = [
  { id: 'dashboard', label: '대시보드', path: '/app' },
  { id: 'children', label: '담당 학생', path: '/app/children' },
  { id: 'analysis', label: '학습 분석' },
  { id: 'alerts', label: '알림' },
  { id: 'reports', label: '리포트' },
  { id: 'settings', label: '설정' },
]

function TherapistAvatar({ child, large = false }) {
  const imageUrl = resolveUploadUrl(child?.profileImageUrl)
  const sizeClass = large ? 'h-16 w-16 rounded-[1.4rem]' : 'h-12 w-12 rounded-full'

  if (imageUrl) {
    return <img alt={child?.name || 'child'} className={`${sizeClass} object-cover`} src={imageUrl} />
  }

  return (
    <div className={`flex items-center justify-center bg-[var(--brand-50)] font-bold text-[var(--brand-700)] ${sizeClass}`}>
      {child?.name?.[0] || '아'}
    </div>
  )
}

function TagList({ items }) {
  if (!items?.length) {
    return <p className="text-sm text-slate-400">등록된 태그가 없습니다.</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-[rgba(79,70,229,0.12)] bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold text-[var(--brand-700)]"
        >
          {getExpressionTagLabel(item)}
        </span>
      ))}
    </div>
  )
}

export function TherapistChildPage() {
  const navigate = useNavigate()
  const { accessToken, jwtPayload, logout, user } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [selectedChildDetail, setSelectedChildDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const displayName = user?.name || jwtPayload?.name || '치료사님'

  const selectedChild = useMemo(
    () => children.find((child) => child.childId === selectedChildId) || children[0] || null,
    [children, selectedChildId],
  )

  useEffect(() => {
    let ignore = false

    async function loadChildren() {
      if (!accessToken) {
        setLoading(false)
        return
      }

      try {
        const response = await apiFetch('/children/accessible', {
          method: 'GET',
          token: accessToken,
        })
        const payload = extractApiPayload(response) || []

        if (!ignore) {
          setChildren(payload)
          setSelectedChildId(payload[0]?.childId || null)
          setFeedback('')
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

    loadChildren()

    return () => {
      ignore = true
    }
  }, [accessToken])

  useEffect(() => {
    let ignore = false

    async function loadDetail() {
      if (!accessToken || !selectedChildId) {
        setSelectedChildDetail(null)
        return
      }

      setDetailLoading(true)

      try {
        const response = await apiFetch(`/children/${selectedChildId}`, {
          method: 'GET',
          token: accessToken,
        })
        const payload = extractApiPayload(response)

        if (!ignore) {
          setSelectedChildDetail(payload)
        }
      } catch (error) {
        if (!ignore) {
          setFeedback(extractApiErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setDetailLoading(false)
        }
      }
    }

    loadDetail()

    return () => {
      ignore = true
    }
  }, [accessToken, selectedChildId])

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[var(--app-canvas)] text-slate-900">
      <div className="grid min-h-screen grid-cols-1 grid-rows-[56px_1fr] lg:grid-cols-[220px_1fr] lg:grid-rows-[56px_1fr]">
        <header className="col-span-full flex items-center gap-5 border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-500)] text-xs font-black text-white">ME</div>
            <span className="text-[15px] font-bold tracking-tight text-slate-950">My Expression Friend</span>
          </div>
          <div className="hidden h-5 w-px bg-slate-200 sm:block" />
          <span className="hidden text-xs text-slate-400 sm:inline">치료사 대시보드</span>
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
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">메인</div>
          <div className="space-y-1">
            {sidebarItems.map((item) => {
              const isActive = item.id === 'children'

              return (
                <button
                  key={item.id}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                    isActive ? 'bg-[var(--brand-50)] text-[var(--brand-700)]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                  onClick={() => {
                    if (item.path) {
                      navigate(item.path)
                    }
                  }}
                  type="button"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold">{item.label[0]}</span>
                  <span>{item.label}</span>
                  {item.id === 'children' ? (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand-500)] px-1.5 text-[10px] font-bold text-white">
                      {children.length}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="mt-auto pt-6">
            <ThemeToggleButton />
          </div>
        </aside>

        <main className="overflow-y-auto px-5 py-6 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Students</p>
              <h1 className="mt-2 text-[28px] font-black tracking-tight text-slate-950">담당 학생</h1>
              <p className="mt-1 text-sm text-slate-400">치료사가 접근 가능한 학생 목록과 상세 정보를 확인할 수 있습니다.</p>
            </div>
          </div>

          {feedback ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {feedback}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
              학생 목록을 불러오는 중입니다...
            </div>
          ) : null}

          {!loading && children.length === 0 ? (
            <div className="mt-6 rounded-[1.6rem] border border-dashed border-[var(--brand-200)] bg-[linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)] p-10 text-center">
              <h2 className="text-3xl font-black tracking-tight text-slate-950">접근 가능한 학생이 아직 없습니다</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">보호자가 권한을 부여하면 이 화면에 담당 학생이 표시됩니다.</p>
            </div>
          ) : null}

          {!loading && children.length > 0 ? (
            <>
              <section className="mt-6 grid gap-4 xl:grid-cols-[340px_1fr]">
                <article className="rounded-[1.35rem] border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">담당 학생 목록</p>
                      <p className="mt-1 text-xs text-slate-400">접근 가능한 학생을 선택하세요.</p>
                    </div>
                    <div className="rounded-full bg-[var(--brand-50)] px-3 py-1 text-xs font-bold text-[var(--brand-700)]">
                      {children.length}명
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {children.map((child) => (
                      <button
                        key={child.childId}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                          selectedChild?.childId === child.childId
                            ? 'border-[var(--brand-200)] bg-[var(--brand-50)]'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedChildId(child.childId)}
                        type="button"
                      >
                        <TherapistAvatar child={child} />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900">{child.name}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {calculateAgeLabel(child.birthDate)} · {getGenderLabel(child.gender)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </article>

                <article className="rounded-[1.35rem] border border-slate-200 bg-white p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <TherapistAvatar child={selectedChild} large />
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-500)]">Selected Student</p>
                      <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">{selectedChild?.name}</h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {calculateAgeLabel(selectedChild?.birthDate)} · {getGenderLabel(selectedChild?.gender)}
                      </p>
                    </div>
                    {selectedChild?.childId ? (
                      <button
                        className="md:ml-auto rounded-xl bg-[var(--brand-500)] px-4 py-2.5 text-sm font-semibold text-white"
                        onClick={() => navigate(`/therapist/patients/${selectedChild.childId}/memo`)}
                        type="button"
                      >
                        메모 작성
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-xs text-slate-400">관심사</p>
                      <p className="mt-2 text-sm font-bold text-slate-900">{selectedChild?.interests || '미입력'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-xs text-slate-400">언어 발달</p>
                      <p className="mt-2 text-sm font-bold text-slate-900">{getLanguageSkillLabel(selectedChildDetail?.languageSkill)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-xs text-slate-400">감각 처리</p>
                      <p className="mt-2 text-sm font-bold text-slate-900">{getSensoryProcessingLabel(selectedChildDetail?.sensoryProcessing)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-xs text-slate-400">콘텐츠 접근</p>
                      <p className="mt-2 text-sm font-bold text-slate-900">{selectedChild?.canPlay ? '가능' : '제한됨'}</p>
                    </div>
                  </div>
                </article>
              </section>

              <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <article className="rounded-[1.35rem] border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">상세 프로필</p>
                      <p className="mt-1 text-xs text-slate-400">담당 학생의 상태와 메모를 확인합니다.</p>
                    </div>
                    {detailLoading ? <span className="text-xs text-slate-400">불러오는 중...</span> : null}
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-xs text-slate-400">진단일</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{selectedChildDetail?.diagnosisDate || '미입력'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-xs text-slate-400">주 보호자</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{selectedChildDetail?.primaryParent?.name || '정보 없음'}</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs text-slate-400">진단 및 상태 메모</p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{selectedChildDetail?.diagnosisInfo || '등록된 메모가 없습니다.'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs text-slate-400">특이사항</p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{selectedChildDetail?.specialNotes || '등록된 특이사항이 없습니다.'}</p>
                    </div>
                  </div>
                </article>

                <article className="rounded-[1.35rem] border border-slate-200 bg-white p-6">
                  <p className="text-sm font-semibold text-slate-900">표현 태그와 접근 사용자</p>

                  <div className="mt-5 space-y-5">
                    <div>
                      <p className="text-xs text-slate-400">선호 표현</p>
                      <div className="mt-3">
                        <TagList items={selectedChildDetail?.preferredExpressions || []} />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">어려운 표현</p>
                      <div className="mt-3">
                        <TagList items={selectedChildDetail?.difficultExpressions || []} />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">접근 사용자</p>
                      <div className="mt-3 space-y-3">
                        {selectedChildDetail?.authorizedUsers?.length ? (
                          selectedChildDetail.authorizedUsers.map((item, index) => (
                            <div key={`${item?.user?.userId || index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <p className="text-sm font-semibold text-slate-900">{item?.user?.name || item?.user?.email || '연결 사용자'}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {Array.isArray(item.permissions) && item.permissions.length ? item.permissions.join(', ') : '권한 정보 없음'}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400">연결된 사용자 정보가 없습니다.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}
