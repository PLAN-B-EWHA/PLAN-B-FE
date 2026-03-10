function PaginationBar({
  page,
  totalPages,
  totalElements,
  size,
  sizeOptions = [10, 20, 50],
  labels,
  disabled = false,
  onPageChange,
  onSizeChange,
}) {
  const currentPage = totalPages === 0 ? 0 : page + 1
  const isPrevDisabled = disabled || page === 0
  const isNextDisabled = disabled || totalPages === 0 || page + 1 >= totalPages

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, page - 1))}
        disabled={isPrevDisabled}
        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        {labels.prev}
      </button>

      <span className="text-xs font-semibold text-slate-600">
        <span className="sm:hidden">{currentPage}/{totalPages}</span>
        <span className="hidden sm:inline">
          {labels.page} {currentPage} / {totalPages} | {labels.total} {totalElements}
        </span>
      </span>

      <button
        type="button"
        onClick={() => onPageChange(page + 1 < totalPages ? page + 1 : page)}
        disabled={isNextDisabled}
        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        {labels.next}
      </button>

      <select
        value={size}
        onChange={(event) => onSizeChange(Number(event.target.value))}
        disabled={disabled}
        className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        {sizeOptions.map((option) => (
          <option key={option} value={option}>{option}{labels.perPage}</option>
        ))}
      </select>
    </div>
  )
}

export default PaginationBar
