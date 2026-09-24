export function Pagination({
  page,
  limit,
  total,
  onPageChange,
}: {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  return (
    <nav className="pagination" aria-label="Phân trang">
      <span className="muted">
        {from}–{to} / {total} công việc
      </span>
      <button type="button" className="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        ‹ Trước
      </button>
      <span>
        Trang {page}/{pageCount}
      </span>
      <button type="button" className="secondary" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        Sau ›
      </button>
    </nav>
  )
}
