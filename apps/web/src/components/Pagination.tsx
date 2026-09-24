export function PhanTrang({
  page,
  limit,
  total,
  doiTrang,
}: {
  page: number
  limit: number
  total: number
  doiTrang: (page: number) => void
}) {
  const soTrang = Math.max(1, Math.ceil(total / limit))
  const tu = total === 0 ? 0 : (page - 1) * limit + 1
  const den = Math.min(page * limit, total)
  return (
    <nav className="phan-trang" aria-label="Phân trang">
      <span className="nho">
        {tu}–{den} / {total} công việc
      </span>
      <button type="button" className="phu" disabled={page <= 1} onClick={() => doiTrang(page - 1)}>
        ‹ Trước
      </button>
      <span>
        Trang {page}/{soTrang}
      </span>
      <button type="button" className="phu" disabled={page >= soTrang} onClick={() => doiTrang(page + 1)}>
        Sau ›
      </button>
    </nav>
  )
}
