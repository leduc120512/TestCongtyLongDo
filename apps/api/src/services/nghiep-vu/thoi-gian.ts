/**
 * Giờ Việt Nam cố định UTC+7, không có giờ mùa hè, nên cộng 7 giờ rồi lấy phần ngày ISO là đủ
 * và không phụ thuộc múi giờ của máy chạy API.
 */
const MS_VIET_NAM = 7 * 60 * 60 * 1000

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function homNayVN(luc: Date = new Date()): string {
  return new Date(luc.getTime() + MS_VIET_NAM).toISOString().slice(0, 10)
}

/** Một công việc quá hạn khi chưa hoàn thành và ngày hôm nay (giờ VN) đã qua ngày hetHan. */
export function laQuaHan(
  cv: { trangThai: string; hetHan?: string | null },
  luc: Date = new Date(),
): boolean {
  if (cv.trangThai === 'HOAN_THANH' || !cv.hetHan) return false
  return cv.hetHan < homNayVN(luc)
}
