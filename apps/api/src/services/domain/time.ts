/**
 * Giờ Việt Nam cố định UTC+7, không có giờ mùa hè, nên cộng 7 giờ rồi lấy phần ngày ISO là đủ
 * và không phụ thuộc múi giờ của máy chạy API.
 */
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function todayInVietnam(now: Date = new Date()): string {
  return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10)
}

/** Một công việc quá hạn khi chưa hoàn thành và ngày hôm nay (giờ VN) đã qua ngày hetHan. */
export function isOverdue(
  task: { trangThai: string; hetHan?: string | null },
  now: Date = new Date(),
): boolean {
  if (task.trangThai === 'HOAN_THANH' || !task.hetHan) return false
  return task.hetHan < todayInVietnam(now)
}
