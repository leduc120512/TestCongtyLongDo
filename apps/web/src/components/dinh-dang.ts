/** "2026-06-10" → "10/06/2026". Ngày lịch không có giờ nên chỉ cần đảo chuỗi, không đụng múi giờ. */
export function dinhDangNgay(ngay?: string | null): string {
  if (!ngay) return '—'
  const [y, m, d] = ngay.split('-')
  return `${d}/${m}/${y}`
}

const DINH_DANG_LUC = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Mốc thời gian ISO → giờ Việt Nam, bất kể máy người xem đặt múi giờ nào. */
export function dinhDangLuc(iso: string): string {
  return DINH_DANG_LUC.format(new Date(iso))
}
