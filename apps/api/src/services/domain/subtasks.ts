import type { TaskStatus } from '@longdo/contracts'

type SubtaskLike = { xong: boolean }

/** Số việc con chưa xong. */
export function countUnfinished(subtasks: readonly SubtaskLike[]): number {
  return subtasks.filter((v) => !v.xong).length
}

/**
 * Tiến độ khi công việc có việc con = tỉ lệ việc con đã xong, làm tròn.
 * - Không có việc con: giữ tiến độ nhập tay.
 * - Chờ duyệt / Hoàn thành: giữ nguyên (đề bài: sang Chờ duyệt thì tiến độ là 100%).
 */
export function computeProgress(subtasks: readonly SubtaskLike[], trangThai: TaskStatus, currentProgress: number): number {
  if (subtasks.length === 0) return currentProgress
  if (trangThai === 'CHO_DUYET' || trangThai === 'HOAN_THANH') return currentProgress
  return Math.round(((subtasks.length - countUnfinished(subtasks)) * 100) / subtasks.length)
}

/** Người giao chỉ thêm/xóa việc con khi việc chưa bắt đầu hoặc đang làm (chờ duyệt thì phải trả lại trước). */
export function canManageSubtasks(trangThai: TaskStatus): boolean {
  return trangThai === 'CHUA_BAT_DAU' || trangThai === 'DANG_LAM'
}
