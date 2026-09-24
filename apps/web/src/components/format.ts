/** "2026-06-10" → "10/06/2026". Ngày lịch không có giờ nên chỉ cần đảo chuỗi, không đụng múi giờ. */
export function formatDate(date?: string | null): string {
  if (!date) return '—'
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Mốc thời gian ISO → giờ Việt Nam, bất kể máy người xem đặt múi giờ nào. */
export function formatDateTime(iso: string): string {
  return DATE_TIME_FORMAT.format(new Date(iso))
}
