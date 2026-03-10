import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import FeedbackBanner from '../components/FeedbackBanner'
import PaginationBar from '../components/PaginationBar'
import {
  accessibleChildrenRequest,
  createNoteCommentRequest,
  createChildNoteRequest,
  deleteChildNoteRequest,
  deleteNoteAssetRequest,
  deleteNoteCommentRequest,
  noteAssetBlobRequest,
  noteCommentDetailRequest,
  noteCommentsRequest,
  noteDetailRequest,
  noteFeedRequest,
  updateChildNoteRequest,
  updateNoteCommentRequest,
  uploadNoteAssetRequest,
} from '../api'
import { useAuth } from '../contexts/AuthContext'
import { KO } from '../constants/messages.ko'
import { resolveErrorMessage } from '../utils/errorMessage'

function NotesPage() {
  const { user, withAuthRetry } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const t = KO.notes

  const [children, setChildren] = useState([])
  const [notes, setNotes] = useState([])
  const [selectedNote, setSelectedNote] = useState(null)
  const [comments, setComments] = useState([])
  const [assetPreviewUrls, setAssetPreviewUrls] = useState({})
  const [zoomImageIndex, setZoomImageIndex] = useState(-1)

  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  const [typeFilter, setTypeFilter] = useState('ALL')
  const [keyword, setKeyword] = useState('')

  const [childId, setChildId] = useState('')
  const [noteType, setNoteType] = useState('PARENT_NOTE')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [uploadItems, setUploadItems] = useState([])
  const [pendingUploadNoteId, setPendingUploadNoteId] = useState('')

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [deletingNote, setDeletingNote] = useState(false)
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState('')
  const [editingCommentContent, setEditingCommentContent] = useState('')
  const [replyingCommentId, setReplyingCommentId] = useState('')
  const [replyContentMap, setReplyContentMap] = useState({})
  const [assetDeletingIds, setAssetDeletingIds] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [newCommentContent, setNewCommentContent] = useState('')

  const MAX_UPLOAD_FILES = 5
  const MAX_FILE_SIZE_MB = 10

  const isImageAsset = (asset) => {
    if (!asset) return false
    return asset.isImage === true || asset.image === true
  }

  const isParent = useMemo(() => (user?.roles || []).includes('PARENT'), [user?.roles])
  const isTherapistOrTeacher = useMemo(
    () => (user?.roles || []).includes('THERAPIST') || (user?.roles || []).includes('TEACHER'),
    [user?.roles],
  )
  const zoomImages = useMemo(
    () => (selectedNote?.assets || [])
      .filter((asset) => isImageAsset(asset) && asset?.assetId && assetPreviewUrls[asset.assetId])
      .map((asset) => ({
        assetId: asset.assetId,
        src: assetPreviewUrls[asset.assetId],
        name: asset.originalFileName || 'note image',
      })),
    [selectedNote, assetPreviewUrls],
  )
  const currentUserId = user?.userId || ''
  const canModifySelectedNote = selectedNote?.authorId && currentUserId && selectedNote.authorId === currentUserId

  const pickFiles = (files) => {
    const selected = Array.from(files || [])
    if (selected.length === 0) return

    const maxSize = MAX_FILE_SIZE_MB * 1024 * 1024
    const validFiles = selected.filter((file) => file.size <= maxSize)
    const oversizedCount = selected.length - validFiles.length
    if (oversizedCount > 0) {
      setError(`파일당 최대 ${MAX_FILE_SIZE_MB}MB까지 업로드할 수 있습니다.`)
    }

    if (validFiles.length === 0) return

    setUploadItems((prev) => {
      const existingKeys = new Set(prev.map((item) => `${item.name}:${item.size}:${item.file?.lastModified || 0}`))
      const appended = []

      for (const file of validFiles) {
        const key = `${file.name}:${file.size}:${file.lastModified || 0}`
        if (existingKeys.has(key)) continue
        existingKeys.add(key)

        appended.push({
          localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          name: file.name,
          size: file.size,
          status: 'pending',
          progress: 0,
          error: '',
        })
      }

      return [...prev, ...appended].slice(0, MAX_UPLOAD_FILES)
    })
  }

  const updateUploadItem = (localId, patch) => {
    setUploadItems((prev) => prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item)))
  }

  const removeUploadItem = (localId) => {
    setUploadItems((prev) => prev.filter((item) => item.localId !== localId))
  }

  const uploadItemsToNote = async (noteId, items) => {
    for (const item of items) {
      updateUploadItem(item.localId, { status: 'uploading', progress: 0, error: '' })
      try {
        await withAuthRetry((token) => uploadNoteAssetRequest(token, noteId, item.file))
        updateUploadItem(item.localId, { status: 'success', progress: 100 })
      } catch (e) {
        updateUploadItem(item.localId, {
          status: 'failed',
          error: resolveErrorMessage(e, '업로드 실패'),
        })
      }
    }
  }

  const loadChildren = async () => {
    const response = await withAuthRetry((token) => accessibleChildrenRequest(token))
    const list = response?.data || []
    setChildren(list)
    if (!childId && list.length > 0) setChildId(list[0].childId)
  }

  const loadFeed = async (nextPage = page, nextSize = size) => {
    setLoading(true)
    setError('')
    try {
      const response = await withAuthRetry((token) => noteFeedRequest(token, {
        page: nextPage,
        size: nextSize,
        type: typeFilter === 'ALL' ? null : typeFilter,
        keyword: keyword.trim() || null,
      }))

      const data = response?.data || {}
      setNotes(data?.content || [])
      setTotalPages(data?.totalPages || 0)
      setTotalElements(data?.totalElements || 0)
    } catch (e) {
      setError(resolveErrorMessage(e, t.loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setNoteType(isParent ? 'PARENT_NOTE' : 'THERAPIST_NOTE')
  }, [isParent])

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true)
      setError('')
      try {
        await Promise.all([loadChildren(), loadFeed(0, size)])
      } catch (e) {
        setError(resolveErrorMessage(e, t.loadError))
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [])

  useEffect(() => {
    loadFeed(page, size)
  }, [page, size])

  const handleSearch = async (event) => {
    event.preventDefault()
    setPage(0)
    await loadFeed(0, size)
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!childId || !noteType || !content.trim()) {
      setError(t.createValidate)
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      if (noteType === 'PARENT_NOTE' && !isParent) {
        setError(t.roleTypeError)
        return
      }
      if (noteType === 'THERAPIST_NOTE' && !isTherapistOrTeacher) {
        setError(t.roleTypeError)
        return
      }

      const created = await withAuthRetry((token) => createChildNoteRequest(token, childId, {
        childId,
        type: noteType,
        title: title.trim() || null,
        content: content.trim(),
      }))

      const noteId = created?.data?.noteId
      setPendingUploadNoteId(noteId || '')
      if (noteId && uploadItems.length > 0) {
        await uploadItemsToNote(noteId, uploadItems)
      }

      setSuccess(t.createSuccess)
      setTitle('')
      setContent('')
      setPage(0)
      await loadFeed(0, size)
    } catch (e) {
      setError(resolveErrorMessage(e, t.createError))
    } finally {
      setSubmitting(false)
    }
  }

  const clearAssetPreviewUrls = () => {
    Object.values(assetPreviewUrls).forEach((url) => URL.revokeObjectURL(url))
    setAssetPreviewUrls({})
  }

  useEffect(() => () => {
    Object.values(assetPreviewUrls).forEach((url) => URL.revokeObjectURL(url))
  }, [assetPreviewUrls])

  const closeDetail = () => {
    clearAssetPreviewUrls()
    setSelectedNote(null)
    setComments([])
    setZoomImageIndex(-1)
    setIsEditingNote(false)
    setEditTitle('')
    setEditContent('')
    setNewCommentContent('')
    setEditingCommentId('')
    setEditingCommentContent('')
    setReplyingCommentId('')
    setReplyContentMap({})
  }

  const loadAssetPreviews = async (note) => {
    clearAssetPreviewUrls()
    const imageAssets = (note?.assets || []).filter((asset) => isImageAsset(asset) && asset?.assetId)
    if (imageAssets.length === 0) return

    try {
      const pairs = await Promise.all(
        imageAssets.map(async (asset) => {
          const blob = await withAuthRetry((token) => noteAssetBlobRequest(token, asset.assetId))
          return [asset.assetId, URL.createObjectURL(blob)]
        }),
      )

      const map = {}
      pairs.forEach(([assetId, url]) => { map[assetId] = url })
      setAssetPreviewUrls(map)
    } catch (e) {
      setError(resolveErrorMessage(e, t.detailError))
    }
  }

  const loadComments = async (noteId) => {
    const response = await withAuthRetry((token) => noteCommentsRequest(token, noteId))
    setComments(response?.data || [])
  }

  const openDetail = async (noteId) => {
    setError('')
    try {
      const response = await withAuthRetry((token) => noteDetailRequest(token, noteId))
      const note = response?.data || null
      setSelectedNote(note)
      setIsEditingNote(false)
      setEditTitle(note?.title || '')
      setEditContent(note?.content || '')
      setComments(note?.comments || [])
      await loadComments(noteId)
      await loadAssetPreviews(note)
    } catch (e) {
      setError(resolveErrorMessage(e, t.detailError))
    }
  }

  const handleSaveNote = async () => {
    if (!selectedNote?.noteId) return
    setSavingNote(true)
    setError('')
    try {
      await withAuthRetry((token) => updateChildNoteRequest(token, selectedNote.noteId, {
        title: editTitle.trim() || null,
        content: editContent.trim(),
      }))
      setSuccess('노트를 수정했습니다.')
      await openDetail(selectedNote.noteId)
      await loadFeed(page, size)
    } catch (e) {
      setError(resolveErrorMessage(e, '노트 수정에 실패했습니다.'))
    } finally {
      setSavingNote(false)
    }
  }

  const handleDeleteNote = async () => {
    if (!selectedNote?.noteId) return
    const ok = window.confirm('이 노트를 삭제하시겠습니까?')
    if (!ok) return
    setDeletingNote(true)
    setError('')
    try {
      await withAuthRetry((token) => deleteChildNoteRequest(token, selectedNote.noteId))
      setSuccess('노트를 삭제했습니다.')
      closeDetail()
      await loadFeed(page, size)
    } catch (e) {
      setError(resolveErrorMessage(e, '노트 삭제에 실패했습니다.'))
    } finally {
      setDeletingNote(false)
    }
  }

  const handleDeleteAsset = async (assetId) => {
    if (!assetId || !selectedNote?.noteId) return
    const ok = window.confirm('이 첨부파일을 삭제하시겠습니까?')
    if (!ok) return
    setAssetDeletingIds((prev) => [...prev, assetId])
    setError('')
    try {
      await withAuthRetry((token) => deleteNoteAssetRequest(token, assetId))
      setSuccess('첨부파일을 삭제했습니다.')
      await openDetail(selectedNote.noteId)
      await loadFeed(page, size)
    } catch (e) {
      setError(resolveErrorMessage(e, '첨부파일 삭제에 실패했습니다.'))
    } finally {
      setAssetDeletingIds((prev) => prev.filter((id) => id !== assetId))
    }
  }

  const handleCreateComment = async () => {
    if (!selectedNote?.noteId || !newCommentContent.trim()) return
    setCommentSubmitting(true)
    setError('')
    try {
      await withAuthRetry((token) => createNoteCommentRequest(token, selectedNote.noteId, {
        noteId: selectedNote.noteId,
        content: newCommentContent.trim(),
      }))
      setSuccess('댓글을 등록했습니다.')
      setNewCommentContent('')
      await loadComments(selectedNote.noteId)
      await loadFeed(page, size)
    } catch (e) {
      setError(resolveErrorMessage(e, '댓글 등록에 실패했습니다.'))
    } finally {
      setCommentSubmitting(false)
    }
  }

  const handleUpdateComment = async (commentId) => {
    if (!commentId || !editingCommentContent.trim() || !selectedNote?.noteId) return
    setCommentSubmitting(true)
    setError('')
    try {
      await withAuthRetry((token) => updateNoteCommentRequest(token, commentId, {
        content: editingCommentContent.trim(),
      }))
      setSuccess('댓글을 수정했습니다.')
      setEditingCommentId('')
      setEditingCommentContent('')
      await loadComments(selectedNote.noteId)
    } catch (e) {
      setError(resolveErrorMessage(e, '댓글 수정에 실패했습니다.'))
    } finally {
      setCommentSubmitting(false)
    }
  }

  const handleCreateReply = async (parentCommentId) => {
    const replyContent = (replyContentMap[parentCommentId] || '').trim()
    if (!selectedNote?.noteId || !parentCommentId || !replyContent) return
    setCommentSubmitting(true)
    setError('')
    try {
      await withAuthRetry((token) => createNoteCommentRequest(token, selectedNote.noteId, {
        noteId: selectedNote.noteId,
        parentCommentId,
        content: replyContent,
      }))
      setSuccess('답글을 등록했습니다.')
      setReplyContentMap((prev) => ({ ...prev, [parentCommentId]: '' }))
      setReplyingCommentId('')
      await loadComments(selectedNote.noteId)
      await loadFeed(page, size)
    } catch (e) {
      setError(resolveErrorMessage(e, '답글 등록에 실패했습니다.'))
    } finally {
      setCommentSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!commentId || !selectedNote?.noteId) return
    const ok = window.confirm('이 댓글을 삭제하시겠습니까?')
    if (!ok) return
    setCommentSubmitting(true)
    setError('')
    try {
      await withAuthRetry((token) => deleteNoteCommentRequest(token, commentId))
      setSuccess('댓글을 삭제했습니다.')
      await loadComments(selectedNote.noteId)
      await loadFeed(page, size)
    } catch (e) {
      setError(resolveErrorMessage(e, '댓글 삭제에 실패했습니다.'))
    } finally {
      setCommentSubmitting(false)
    }
  }

  const retryFailedUploads = async () => {
    if (!pendingUploadNoteId) return
    const failedItems = uploadItems.filter((item) => item.status === 'failed')
    if (failedItems.length === 0) return
    setError('')
    await uploadItemsToNote(pendingUploadNoteId, failedItems)
    await loadFeed(page, size)
  }

  const openZoomByAssetId = (assetId) => {
    const idx = zoomImages.findIndex((img) => img.assetId === assetId)
    if (idx >= 0) setZoomImageIndex(idx)
  }

  const closeZoom = () => setZoomImageIndex(-1)
  const showPrevZoom = () => {
    if (zoomImages.length === 0) return
    setZoomImageIndex((prev) => (prev <= 0 ? zoomImages.length - 1 : prev - 1))
  }
  const showNextZoom = () => {
    if (zoomImages.length === 0) return
    setZoomImageIndex((prev) => (prev >= zoomImages.length - 1 ? 0 : prev + 1))
  }

  useEffect(() => {
    if (zoomImageIndex < 0) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeZoom()
      if (event.key === 'ArrowLeft') showPrevZoom()
      if (event.key === 'ArrowRight') showNextZoom()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [zoomImageIndex, zoomImages.length])

  const scrollToComment = (commentId) => {
    if (!commentId) return
    const element = document.getElementById(`comment-${commentId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element.classList.add('ring-2', 'ring-cyan-400')
      window.setTimeout(() => element.classList.remove('ring-2', 'ring-cyan-400'), 2000)
    }
  }

  const openByCommentId = async (commentId) => {
    const commentResponse = await withAuthRetry((token) => noteCommentDetailRequest(token, commentId))
    const noteId = commentResponse?.data?.noteId
    if (!noteId) return
    await openDetail(noteId)
    window.setTimeout(() => scrollToComment(commentId), 120)
  }

  useEffect(() => {
    const noteIdParam = searchParams.get('noteId')
    const commentIdParam = searchParams.get('commentId')
    if (!noteIdParam && !commentIdParam) return

    const run = async () => {
      try {
        if (commentIdParam) {
          await openByCommentId(commentIdParam)
        } else if (noteIdParam) {
          await openDetail(noteIdParam)
        }
      } catch (e) {
        setError(resolveErrorMessage(e, t.detailError))
      } finally {
        setSearchParams({}, { replace: true })
      }
    }
    run()
  }, [searchParams])

  const renderComment = (comment, depth = 0) => {
    const mine = currentUserId && comment?.authorId === currentUserId
    const isEditing = editingCommentId === comment?.commentId
    const isReplying = replyingCommentId === comment?.commentId
    const replyContent = replyContentMap[comment?.commentId] || ''
    return (
      <div
        key={comment.commentId}
        id={`comment-${comment.commentId}`}
        className={`rounded-lg border border-slate-200 p-3 transition ${depth > 0 ? 'ml-4 mt-2 bg-slate-50' : 'mt-3'}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-700">
            {comment.authorName || KO.common.none}
            <span className="ml-2 font-normal text-slate-500">{comment.createdAt || KO.common.none}</span>
          </p>
          {mine && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingCommentId(comment.commentId)
                  setEditingCommentContent(comment.content || '')
                }}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => handleDeleteComment(comment.commentId)}
                className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="mt-2 space-y-2">
            <textarea
              rows={3}
              value={editingCommentContent}
              onChange={(event) => setEditingCommentContent(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={commentSubmitting || !editingCommentContent.trim()}
                onClick={() => handleUpdateComment(comment.commentId)}
                className="rounded bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                저장
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCommentId('')
                  setEditingCommentContent('')
                }}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700 [overflow-wrap:anywhere]">{comment.content || KO.common.none}</p>
        )}

        {!isEditing && depth === 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                setReplyingCommentId(isReplying ? '' : comment.commentId)
              }}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
            >
              {isReplying ? '답글 취소' : '답글'}
            </button>
          </div>
        )}

        {isReplying && depth === 0 && (
          <div className="mt-2 space-y-2">
            <textarea
              rows={3}
              value={replyContent}
              onChange={(event) => {
                const value = event.target.value
                setReplyContentMap((prev) => ({ ...prev, [comment.commentId]: value }))
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="답글을 입력하세요"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={commentSubmitting || !replyContent.trim()}
                onClick={() => handleCreateReply(comment.commentId)}
                className="rounded bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {commentSubmitting ? KO.common.loading : '답글 등록'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplyingCommentId('')
                  setReplyContentMap((prev) => ({ ...prev, [comment.commentId]: '' }))
                }}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {(comment.replies || []).length > 0 && (
          <div className="mt-2">
            {(comment.replies || []).map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <section className="rounded-2xl border border-cyan-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Notes Feed</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadFeed(page, size)}
              disabled={loading}
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
          <h2 className="text-sm font-semibold text-slate-900">{t.createTitle}</h2>
          <form className="mt-3 grid gap-3" onSubmit={handleCreate}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">
                {t.child}
                <select
                  value={childId}
                  onChange={(event) => setChildId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {children.length === 0 && <option value="">{t.noChild}</option>}
                  {children.map((child) => (
                    <option key={child.childId} value={child.childId}>{child.name} ({child.childId})</option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700">
                {t.type}
                <select
                  value={noteType}
                  onChange={(event) => setNoteType(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {isParent && <option value="PARENT_NOTE">PARENT_NOTE</option>}
                  {isTherapistOrTeacher && <option value="THERAPIST_NOTE">THERAPIST_NOTE</option>}
                </select>
              </label>
            </div>

            <label className="text-xs font-semibold text-slate-700">
              {t.titleLabel}
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={t.titlePlaceholder}
              />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              {t.content}
              <textarea
                rows={4}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={t.contentPlaceholder}
              />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              {t.attachments}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  pickFiles(event.target.files)
                  event.target.value = ''
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <p className="text-[11px] text-slate-500">최대 {MAX_UPLOAD_FILES}개, 파일당 {MAX_FILE_SIZE_MB}MB</p>
            {uploadItems.length > 0 && (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                {uploadItems.map((item) => (
                  <div key={item.localId} className="rounded border border-slate-200 bg-white px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-slate-700">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{Math.round(item.size / 1024)} KB</span>
                        {item.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => removeUploadItem(item.localId)}
                            className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                            aria-label="첨부 취소"
                            title="첨부 취소"
                          >
                            X
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded bg-slate-100">
                      <div
                        className={`h-1.5 rounded ${item.status === 'failed' ? 'bg-red-400' : 'bg-cyan-500'}`}
                        style={{ width: `${item.progress || 0}%` }}
                      />
                    </div>
                    {item.status === 'failed' && (
                      <p className="mt-1 text-[11px] text-red-600">{item.error || '업로드 실패'}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {uploadItems.some((item) => item.status === 'failed') && (
              <button
                type="button"
                onClick={retryFailedUploads}
                className="w-fit rounded border border-cyan-300 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
              >
                실패 파일 재시도
              </button>
            )}

            <div>
              <button
                type="submit"
                disabled={submitting || !childId || !content.trim()}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitting ? KO.common.loading : t.create}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t.feedTitle}</h2>

          <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={handleSearch}>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700"
            >
              <option value="ALL">{t.filterAll}</option>
              <option value="PARENT_NOTE">PARENT_NOTE</option>
              <option value="THERAPIST_NOTE">THERAPIST_NOTE</option>
              <option value="SYSTEM">SYSTEM</option>
            </select>
            <input
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className="min-w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={t.keywordPlaceholder}
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              {t.search}
            </button>
          </form>

          <div className="mt-4 space-y-3">
            {notes.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{t.noData}</p>
            )}

            {notes.map((note) => (
              <article key={note.noteId} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{note.title || t.untitled}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{note.type}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{t.child}: {note.childName || KO.common.none}</p>
                <p className="mt-1 text-xs text-slate-500">{t.author}: {note.authorName || KO.common.none}</p>
                <p className="mt-1 text-xs text-slate-500">{t.createdAt}: {note.createdAt || KO.common.none}</p>
                <p className="mt-2 break-words text-sm text-slate-700 [overflow-wrap:anywhere]">{note.contentPreview || KO.common.none}</p>
                <button
                  type="button"
                  onClick={() => openDetail(note.noteId)}
                  className="mt-3 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700"
                >
                  {t.openDetail}
                </button>
              </article>
            ))}
          </div>

          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalElements={totalElements}
            size={size}
            labels={t.pagination}
            disabled={loading}
            onPageChange={setPage}
            onSizeChange={(nextSize) => {
              setPage(0)
              setSize(nextSize)
            }}
          />
        </section>
      </section>

      {selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" onClick={closeDetail}>
          <section
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">{t.detailTitle}</h2>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                {t.closeDetail}
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500">{t.id}: {selectedNote.noteId}</p>
            <p className="mt-1 text-xs text-slate-500">{t.child}: {selectedNote.childName || KO.common.none}</p>
            <p className="mt-1 text-xs text-slate-500">{t.author}: {selectedNote.authorName || KO.common.none}</p>
            <p className="mt-1 text-xs text-slate-500">{t.type}: {selectedNote.type || KO.common.none}</p>

            <p className="mt-3 text-sm font-semibold text-slate-900">{selectedNote.title || t.untitled}</p>
            {canModifySelectedNote && (
              <div className="mt-3 flex flex-wrap gap-2">
                {!isEditingNote ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingNote(true)
                      setEditTitle(selectedNote.title || '')
                      setEditContent(selectedNote.content || '')
                    }}
                    className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    노트 수정
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveNote}
                      disabled={savingNote || !editContent.trim()}
                      className="rounded bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {savingNote ? KO.common.loading : '수정 저장'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingNote(false)
                        setEditTitle(selectedNote.title || '')
                        setEditContent(selectedNote.content || '')
                      }}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      취소
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleDeleteNote}
                  disabled={deletingNote}
                  className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingNote ? KO.common.loading : '노트 삭제'}
                </button>
              </div>
            )}

            {isEditingNote ? (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="제목"
                />
                <textarea
                  rows={6}
                  value={editContent}
                  onChange={(event) => setEditContent(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="내용"
                />
              </div>
            ) : (
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">{selectedNote.content || KO.common.none}</p>
            )}

            {(selectedNote.assets || []).length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-slate-700">{t.attachments}</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedNote.assets || [])
                    .filter((asset) => isImageAsset(asset) && asset?.assetId && assetPreviewUrls[asset.assetId])
                    .map((asset) => (
                      <div key={asset.assetId} className="relative">
                        <img
                          src={assetPreviewUrls[asset.assetId]}
                          alt={asset.originalFileName || 'note image'}
                          className="h-24 w-24 cursor-zoom-in rounded border border-slate-300 object-cover"
                          onClick={() => openZoomByAssetId(asset.assetId)}
                        />
                        {canModifySelectedNote && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAsset(asset.assetId)}
                            disabled={assetDeletingIds.includes(asset.assetId)}
                            className="absolute right-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 shadow hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {assetDeletingIds.includes(asset.assetId) ? '...' : '삭제'}
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="text-sm font-semibold text-slate-900">댓글</p>
              <div className="mt-2 space-y-2">
                <textarea
                  rows={3}
                  value={newCommentContent}
                  onChange={(event) => setNewCommentContent(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="댓글을 입력하세요"
                />
                <button
                  type="button"
                  onClick={handleCreateComment}
                  disabled={commentSubmitting || !newCommentContent.trim()}
                  className="rounded bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {commentSubmitting ? KO.common.loading : '댓글 등록'}
                </button>
              </div>

              <div className="mt-3">
                {comments.length === 0 && (
                  <p className="rounded border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">
                    댓글이 없습니다.
                  </p>
                )}
                {comments.map((comment) => renderComment(comment))}
              </div>
            </div>
          </section>
        </div>
      )}

      {zoomImageIndex >= 0 && zoomImages[zoomImageIndex] && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={closeZoom}
        >
          <div className="relative max-h-[92vh] max-w-[96vw]" onClick={(event) => event.stopPropagation()}>
            {zoomImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={showPrevZoom}
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white hover:bg-black/75"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={showNextZoom}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white hover:bg-black/75"
                >
                  ▶
                </button>
              </>
            )}
            <img
              src={zoomImages[zoomImageIndex].src}
              alt={zoomImages[zoomImageIndex].name}
              className="max-h-[92vh] max-w-[96vw] rounded-lg object-contain shadow-2xl"
            />
            <div className="mt-2 text-center text-xs text-slate-200">
              <p>{zoomImages[zoomImageIndex].name}</p>
              {zoomImages.length > 1 && <p className="mt-1">{zoomImageIndex + 1} / {zoomImages.length}</p>}
              <p className="mt-1 text-[11px] text-slate-300">ESC 닫기 · ←/→ 이동</p>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default NotesPage
