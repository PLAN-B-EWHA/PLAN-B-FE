import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import FeedbackBanner from '../components/FeedbackBanner'
import PaginationBar from '../components/PaginationBar'
import { accessibleChildrenRequest, batchVerifyMissionsRequest, therapistReviewQueueRequest } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { KO } from '../constants/messages.ko'
import { resolveErrorMessage } from '../utils/errorMessage'

const TEXT = {
  title: '리뷰 대기 큐',
  home: '치료사 홈',
  loadError: '리뷰 대기 목록을 불러오지 못했습니다.',
  childLoadError: '아동 목록을 불러오지 못했습니다.',
  selectRequired: '일괄 처리할 미션을 선택해 주세요.',
  rejectReasonRequired: '반려 시 피드백을 입력해 주세요.',
  batchDone: '일괄 처리 완료',
  batchError: '일괄 검증 처리에 실패했습니다.',
  childFilter: '아동 필터',
  allChildren: '전체 아동',
  feedback: '피드백 (반려 시 필수)',
  feedbackPlaceholder: '예: 표정 증빙이 부족합니다.',
  batchApprove: '선택 승인',
  batchReject: '선택 반려',
  total: '총',
  selected: '선택',
  selectPage: '현재 페이지 전체 선택',
  noData: '리뷰 대기 미션이 없습니다.',
  untitled: '(제목 없음)',
  openDetail: '상세 검토',
  child: '아동',
  completedAt: '완료 시각',
  dueDate: '마감일',
  parentNote: '부모 코멘트',
  pagination: {
    page: '페이지',
    prev: '이전',
    next: '다음',
    perPage: '개씩',
    total: '총',
  },
}

function TherapistReviewQueuePage() {
  const { withAuthRetry } = useAuth()

  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState('')
  const [items, setItems] = useState([])
  const [selectedMissionIds, setSelectedMissionIds] = useState([])
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  const selectedSet = useMemo(() => new Set(selectedMissionIds), [selectedMissionIds])
  const allChecked = items.length > 0 && items.every((item) => selectedSet.has(item.missionId))

  const loadChildren = async () => {
    const response = await withAuthRetry((token) => accessibleChildrenRequest(token))
    setChildren(response?.data || [])
  }

  const loadQueue = async (nextPage = page, nextSize = size) => {
    setLoading(true)
    setError('')
    try {
      const response = await withAuthRetry((token) =>
        therapistReviewQueueRequest(token, {
          childId: selectedChildId || null,
          page: nextPage,
          size: nextSize,
        }),
      )
      const data = response?.data || {}
      const content = data?.content || []
      setItems(content)
      setTotalPages(data?.totalPages || 0)
      setTotalElements(data?.totalElements || 0)
      setSelectedMissionIds((prev) => prev.filter((id) => content.some((item) => item.missionId === id)))
    } catch (e) {
      setError(resolveErrorMessage(e, TEXT.loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true)
      try {
        await loadChildren()
      } catch (e) {
        setError(resolveErrorMessage(e, TEXT.childLoadError))
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [])

  useEffect(() => {
    setPage(0)
  }, [selectedChildId, size])

  useEffect(() => {
    loadQueue(page, size)
  }, [page, size, selectedChildId])

  const toggleSelect = (missionId) => {
    setSelectedMissionIds((prev) => (prev.includes(missionId)
      ? prev.filter((id) => id !== missionId)
      : [...prev, missionId]))
  }

  const toggleSelectAll = () => {
    if (allChecked) {
      setSelectedMissionIds([])
      return
    }
    setSelectedMissionIds(items.map((item) => item.missionId))
  }

  const runBatch = async (decision) => {
    setError('')
    setSuccess('')

    if (selectedMissionIds.length === 0) {
      setError(TEXT.selectRequired)
      return
    }
    if (decision === 'REJECT' && !String(feedback || '').trim()) {
      setError(TEXT.rejectReasonRequired)
      return
    }

    setSubmitting(true)
    try {
      const response = await withAuthRetry((token) =>
        batchVerifyMissionsRequest(token, {
          missionIds: selectedMissionIds,
          reviewDecision: decision,
          therapistFeedback: feedback || '',
        }),
      )
      const result = response?.data
      const successCount = result?.successCount || 0
      const failureCount = result?.failureCount || 0
      setSuccess(`${TEXT.batchDone}: 성공 ${successCount}건 / 실패 ${failureCount}건`)
      setSelectedMissionIds([])
      await loadQueue(page, size)
    } catch (e) {
      setError(resolveErrorMessage(e, TEXT.batchError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <section className="rounded-2xl border border-rose-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">REVIEW QUEUE</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{TEXT.title}</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadQueue(page, size)}
              disabled={loading}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? KO.common.loading : KO.common.refresh}
            </button>
            <Link to="/therapist" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              {TEXT.home}
            </Link>
          </div>
        </div>

        <FeedbackBanner error={error} success={success} />

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              {TEXT.childFilter}
              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">{TEXT.allChildren}</option>
                {children.map((child) => (
                  <option key={child.childId} value={child.childId}>{child.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              {TEXT.feedback}
              <input
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={TEXT.feedbackPlaceholder}
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => runBatch('APPROVE')}
              disabled={submitting || selectedMissionIds.length === 0}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {TEXT.batchApprove}
            </button>
            <button
              type="button"
              onClick={() => runBatch('REJECT')}
              disabled={submitting || selectedMissionIds.length === 0}
              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {TEXT.batchReject}
            </button>
            <span className="text-xs text-slate-500">{TEXT.total}: {totalElements} / {TEXT.selected}: {selectedMissionIds.length}</span>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <input type="checkbox" checked={allChecked} onChange={toggleSelectAll} />
            <span className="text-xs font-semibold text-slate-700">{TEXT.selectPage}</span>
          </div>

          <div className="space-y-3">
            {items.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                {TEXT.noData}
              </p>
            )}

            {items.map((item) => (
              <article key={item.missionId} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(item.missionId)}
                      onChange={() => toggleSelect(item.missionId)}
                    />
                    <span className="text-sm font-semibold text-slate-900">{item.templateTitle || TEXT.untitled}</span>
                  </label>
                  <Link
                    to={`/therapist/missions/${item.missionId}/review`}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                  >
                    {TEXT.openDetail}
                  </Link>
                </div>
                <p className="mt-1 text-xs text-slate-500">{TEXT.child}: {item.childName || KO.common.none}</p>
                <p className="mt-1 text-xs text-slate-500">{TEXT.completedAt}: {item.completedAt || KO.common.none}</p>
                <p className="mt-1 text-xs text-slate-500">{TEXT.dueDate}: {item.dueDate || KO.common.none}</p>
                <p className="mt-1 text-xs text-slate-500">{TEXT.parentNote}: {item.parentNote || KO.common.none}</p>
              </article>
            ))}
          </div>

          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalElements={totalElements}
            size={size}
            labels={TEXT.pagination}
            disabled={loading || submitting}
            onPageChange={setPage}
            onSizeChange={(nextSize) => {
              setPage(0)
              setSize(nextSize)
            }}
          />
        </section>
      </section>
    </main>
  )
}

export default TherapistReviewQueuePage