import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import FeedbackBanner from '../components/FeedbackBanner'
import PaginationBar from '../components/PaginationBar'
import {
  activateMissionTemplateRequest,
  createMissionTemplateRequest,
  deactivateMissionTemplateRequest,
  deleteMissionTemplateRequest,
  searchMissionTemplatesRequest,
  updateMissionTemplateRequest,
} from '../api'
import { useAuth } from '../contexts/AuthContext'
import { KO } from '../constants/messages.ko'
import { resolveErrorMessage } from '../utils/errorMessage'

const CATEGORY_OPTIONS = [
  { value: 'EXPRESSION', label: 'EXPRESSION' },
  { value: 'EMOTION_RECOGNITION', label: 'EMOTION_RECOGNITION' },
  { value: 'COMMUNICATION', label: 'COMMUNICATION' },
]

const DIFFICULTY_OPTIONS = [
  { value: 'BEGINNER', label: 'BEGINNER' },
  { value: 'INTERMEDIATE', label: 'INTERMEDIATE' },
  { value: 'ADVANCED', label: 'ADVANCED' },
]

function TemplateManagementPage() {
  const { withAuthRetry } = useAuth()
  const t = KO.templateManagement

  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [page, setPage] = useState(0)
  const [size, setSize] = useState(12)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [llmGenerated, setLlmGenerated] = useState('')

  const [isEditing, setIsEditing] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formDifficulty, setFormDifficulty] = useState('')
  const [expectedDuration, setExpectedDuration] = useState('')
  const [formLlmGenerated, setFormLlmGenerated] = useState(false)

  const canSubmit = useMemo(() => {
    if (!description.trim() || !instructions.trim() || !formCategory || !formDifficulty) return false
    if (expectedDuration && Number(expectedDuration) <= 0) return false
    return true
  }, [description, instructions, formCategory, formDifficulty, expectedDuration])

  const resetForm = () => {
    setIsEditing(false)
    setEditingTemplateId('')
    setTitle('')
    setDescription('')
    setInstructions('')
    setFormCategory('')
    setFormDifficulty('')
    setExpectedDuration('')
    setFormLlmGenerated(false)
  }

  const loadTemplates = async (nextPage = page, nextSize = size) => {
    setLoading(true)
    setError('')
    try {
      const response = await withAuthRetry((token) =>
        searchMissionTemplatesRequest(token, {
          page: nextPage,
          size: nextSize,
          keyword: keyword.trim() || null,
          category: category || null,
          difficulty: difficulty || null,
          llmGenerated: llmGenerated === '' ? null : llmGenerated === 'true',
        }),
      )
      const data = response?.data || {}
      setTemplates(data?.content || [])
      setTotalPages(data?.totalPages || 0)
      setTotalElements(data?.totalElements || 0)
    } catch (e) {
      setError(resolveErrorMessage(e, t.loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates(0, size)
  }, [])

  useEffect(() => {
    loadTemplates(page, size)
  }, [page, size])

  const handleSearch = async (event) => {
    event.preventDefault()
    setPage(0)
    await loadTemplates(0, size)
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!canSubmit) {
      setError(t.formInvalid)
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        title: title.trim() || null,
        description: description.trim(),
        category: formCategory,
        difficulty: formDifficulty,
        instructions: instructions.trim(),
        expectedDuration: expectedDuration ? Number(expectedDuration) : null,
        llmGenerated: formLlmGenerated,
      }
      await withAuthRetry((token) => createMissionTemplateRequest(token, payload))
      setSuccess(t.createSuccess)
      resetForm()
      setPage(0)
      await loadTemplates(0, size)
    } catch (e) {
      setError(resolveErrorMessage(e, t.createError))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (event) => {
    event.preventDefault()
    if (!editingTemplateId || !canSubmit) {
      setError(t.formInvalid)
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        title: title.trim() || null,
        description: description.trim(),
        category: formCategory,
        difficulty: formDifficulty,
        instructions: instructions.trim(),
        expectedDuration: expectedDuration ? Number(expectedDuration) : null,
      }
      await withAuthRetry((token) => updateMissionTemplateRequest(token, editingTemplateId, payload))
      setSuccess(t.updateSuccess)
      await loadTemplates(page, size)
    } catch (e) {
      setError(resolveErrorMessage(e, t.updateError))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (templateId) => {
    const ok = window.confirm(t.deactivateConfirm)
    if (!ok) return
    setError('')
    setSuccess('')
    try {
      await withAuthRetry((token) => deactivateMissionTemplateRequest(token, templateId))
      setSuccess(t.deactivateSuccess)
      await loadTemplates(page, size)
    } catch (e) {
      setError(resolveErrorMessage(e, t.deactivateError))
    }
  }

  const handleActivate = async (templateId) => {
    setError('')
    setSuccess('')
    try {
      await withAuthRetry((token) => activateMissionTemplateRequest(token, templateId))
      setSuccess(t.activateSuccess)
      await loadTemplates(page, size)
    } catch (e) {
      setError(resolveErrorMessage(e, t.activateError))
    }
  }

  const handleDelete = async (templateId) => {
    const ok = window.confirm(t.deleteConfirm)
    if (!ok) return
    setError('')
    setSuccess('')
    try {
      await withAuthRetry((token) => deleteMissionTemplateRequest(token, templateId))
      setSuccess(t.deleteSuccess)
      if (editingTemplateId === templateId) resetForm()
      await loadTemplates(page, size)
    } catch (e) {
      setError(resolveErrorMessage(e, t.deleteError))
    }
  }

  const selectForEdit = (template) => {
    setIsEditing(true)
    setEditingTemplateId(template.templateId)
    setTitle(template.title || '')
    setDescription(template.description || '')
    setInstructions(template.instructions || '')
    setFormCategory(template.category || '')
    setFormDifficulty(template.difficulty || '')
    setExpectedDuration(template.expectedDuration ? String(template.expectedDuration) : '')
    setFormLlmGenerated(Boolean(template.llmGenerated))
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <section className="rounded-2xl border border-amber-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Mission Templates</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadTemplates(page, size)}
              disabled={loading}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? KO.common.loading : KO.common.refresh}
            </button>
            <Link to="/therapist" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              {t.home}
            </Link>
          </div>
        </div>

        <FeedbackBanner error={error} success={success} />

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t.searchTitle}</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-5" onSubmit={handleSearch}>
            <input
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              placeholder={t.keywordPlaceholder}
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">{t.allCategory}</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">{t.allDifficulty}</option>
              {DIFFICULTY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              value={llmGenerated}
              onChange={(event) => setLlmGenerated(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">{t.allLlm}</option>
              <option value="true">{t.llmOnly}</option>
              <option value="false">{t.manualOnly}</option>
            </select>
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 md:col-span-1"
            >
              {t.search}
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{t.listTitle}</h2>
            <p className="text-xs text-slate-500">{t.total}: {totalElements}</p>
          </div>
          <div className="mt-4 space-y-3">
            {templates.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                {t.noData}
              </p>
            )}
            {templates.map((template) => (
              <article key={template.templateId} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{template.title || t.untitled}</p>
                    <p className="mt-1 text-xs text-slate-500">ID: {template.templateId}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{template.category}</span>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">{template.difficulty}</span>
                    {template.llmGenerated && <span className="rounded-full bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-700">LLM</span>}
                    {template.active === false && <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">{t.inactive}</span>}
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-700">{template.description}</p>
                <p className="mt-2 text-xs text-slate-500">{t.expectedDuration}: {template.expectedDuration ?? KO.common.none}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => selectForEdit(template)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {t.editLoad}
                  </button>
                  {template.active === false ? (
                    <button
                      type="button"
                      onClick={() => handleActivate(template.templateId)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      {t.activate}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDeactivate(template.templateId)}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      {t.deactivate}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(template.templateId)}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    {t.delete}
                  </button>
                </div>
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

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{isEditing ? t.editTitle : t.createTitle}</h2>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                {t.resetForm}
              </button>
            )}
          </div>

          <form className="mt-3 grid gap-3" onSubmit={isEditing ? handleUpdate : handleCreate}>
            <div className="grid gap-3 md:grid-cols-2">
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
                {t.expectedDuration}
                <input
                  type="number"
                  min="1"
                  value={expectedDuration}
                  onChange={(event) => setExpectedDuration(event.target.value.replace(/[^0-9]/g, ''))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder={t.expectedDurationPlaceholder}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">
                {t.category}
                <select
                  value={formCategory}
                  onChange={(event) => setFormCategory(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">{t.selectCategory}</option>
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                {t.difficulty}
                <select
                  value={formDifficulty}
                  onChange={(event) => setFormDifficulty(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">{t.selectDifficulty}</option>
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="text-xs font-semibold text-slate-700">
              {t.description}
              <textarea
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={t.descriptionPlaceholder}
              />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              {t.instructions}
              <textarea
                rows={5}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={t.instructionsPlaceholder}
              />
            </label>

            {!isEditing && (
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={formLlmGenerated}
                  onChange={(event) => setFormLlmGenerated(event.target.checked)}
                />
                {t.llmGenerated}
              </label>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitting ? KO.common.loading : isEditing ? t.update : t.create}
              </button>
              {isEditing && (
                <p className="text-xs text-slate-500">
                  {t.editingId}: {editingTemplateId}
                </p>
              )}
            </div>
          </form>
        </section>
      </section>
    </main>
  )
}

export default TemplateManagementPage
