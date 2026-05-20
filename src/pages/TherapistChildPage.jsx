import { useEffect, useMemo, useState } from 'react'
import { TherapistStatsShell } from '../components/TherapistStatsShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { calculateAgeLabel, getGenderLabel, resolveUploadUrl } from '../lib/childUtils'

function TherapistAvatar({ child, large = false }) {
  const imageUrl = resolveUploadUrl(child?.profileImageUrl)
  const sizeClass = large ? 'h-16 w-16 rounded-[1.4rem]' : 'h-12 w-12 rounded-full'

  if (imageUrl) {
    return <img alt={child?.name || 'child'} className={`${sizeClass} object-cover`} src={imageUrl} />
  }

  return (
    <div className={`flex items-center justify-center bg-[var(--brand-50)] font-bold text-[var(--brand-700)] ${sizeClass}`}>
      {child?.name?.[0] || '?'}
    </div>
  )
}

export function TherapistChildPage() {
  const { accessToken } = useAuth()

  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [selectedChildDetail, setSelectedChildDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

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
        const response = await apiFetch('/children/accessible', { method: 'GET', token: accessToken })
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

    async function loadDetail() {
      if (!accessToken || !selectedChildId) {
        setSelectedChildDetail(null)
        return
      }

      setDetailLoading(true)
      try {
        const response = await apiFetch(`/children/${selectedChildId}`, { method: 'GET', token: accessToken })
        if (!ignore) setSelectedChildDetail(extractApiPayload(response))
      } catch (error) {
        if (!ignore) setFeedback(extractApiErrorMessage(error))
      } finally {
        if (!ignore) setDetailLoading(false)
      }
    }

    loadDetail()
    return () => {
      ignore = true
    }
  }, [accessToken, selectedChildId])

  return (
    <TherapistStatsShell activeId="children" subtitle="담당 아동 목록과 기본 프로필, 특이사항을 확인합니다." title="아동관리">
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      {loading ? <div className="stats-loading">아동 목록을 불러오는 중입니다...</div> : null}

      {!loading && children.length === 0 ? <div className="stats-panel" style={{ marginTop: 16 }}>접근 가능한 아동이 없습니다.</div> : null}

      {!loading && children.length > 0 ? (
        <section className="stats-grid" style={{ marginTop: 16 }}>
          <article className="stats-panel">
            <div className="panel-head">
              <p>담당 아동 목록</p>
              <span>{children.length}명</span>
            </div>

            <div className="mt-4 space-y-3">
              {children.map((child) => (
                <button
                  key={child.childId}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                    selectedChild?.childId === child.childId ? 'border-[var(--brand-200)] bg-[var(--brand-50)]' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                  onClick={() => setSelectedChildId(child.childId)}
                  type="button"
                >
                  <TherapistAvatar child={child} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{child.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{calculateAgeLabel(child.birthDate)} · {getGenderLabel(child.gender)}</p>
                  </div>
                </button>
              ))}
            </div>
          </article>

          <article className="stats-panel">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <TherapistAvatar child={selectedChild} large />
              <div>
                <h2 className="text-3xl font-black tracking-tight text-slate-950">{selectedChild?.name || '선택된 아동 없음'}</h2>
                <p className="mt-1 text-sm text-slate-400">{calculateAgeLabel(selectedChild?.birthDate)} · {getGenderLabel(selectedChild?.gender)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs text-slate-400">관심사</p>
                <p className="mt-2 text-sm font-bold text-slate-900">{selectedChild?.interests || '미입력'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs text-slate-400">PIN</p>
                <p className="mt-2 text-sm font-bold text-slate-900">{selectedChild?.pinEnabled ? '설정됨' : '미설정'}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-xs text-slate-400">진단/상태 메모</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{selectedChildDetail?.diagnosisInfo || '등록된 메모가 없습니다.'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-xs text-slate-400">특이사항</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{selectedChildDetail?.specialNotes || '등록된 특이사항이 없습니다.'}</p>
              </div>
            </div>

            {detailLoading ? <p className="mt-4 text-xs text-slate-400">상세 정보를 불러오는 중입니다...</p> : null}
          </article>
        </section>
      ) : null}
    </TherapistStatsShell>
  )
}
