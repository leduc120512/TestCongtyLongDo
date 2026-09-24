import { STATUS_LABELS, type ErrorCode, type TaskStatus } from '@longdo/contracts'
import { getRoles, type Roles } from './permissions.ts'
import { countUnfinished, computeProgress } from './subtasks.ts'

type TaskLike = {
  nguoiGiaoId: string
  nguoiThucHienIds: string[]
  nguoiTheoDoiIds: string[]
  trangThai: TaskStatus
  tienDo: number
  viecCon?: ReadonlyArray<{ xong: boolean }>
}

type Transition = {
  from: TaskStatus
  to: TaskStatus
  allowed: (roles: Roles) => boolean
  deniedMessage: string
  requiresReason?: boolean
}

/**
 * Luồng: CHUA_BAT_DAU → DANG_LAM → CHO_DUYET → HOAN_THANH, và CHO_DUYET → DANG_LAM (trả lại, kèm lý do).
 * HOAN_THANH là trạng thái cuối. Người giao đồng thời là người thực hiện vẫn tự duyệt được.
 */
export const TRANSITIONS: readonly Transition[] = [
  {
    from: 'CHUA_BAT_DAU',
    to: 'DANG_LAM',
    allowed: (roles) => roles.isAssignee,
    deniedMessage: 'Chỉ người thực hiện mới được bắt đầu công việc',
  },
  {
    from: 'DANG_LAM',
    to: 'CHO_DUYET',
    allowed: (roles) => roles.isAssignee,
    deniedMessage: 'Chỉ người thực hiện mới được gửi duyệt',
  },
  {
    from: 'CHO_DUYET',
    to: 'HOAN_THANH',
    allowed: (roles) => roles.isAssigner,
    deniedMessage: 'Chỉ người giao việc mới được duyệt',
  },
  {
    from: 'CHO_DUYET',
    to: 'DANG_LAM',
    allowed: (roles) => roles.isAssigner,
    deniedMessage: 'Chỉ người giao việc mới được trả lại',
    requiresReason: true,
  },
]

export type TransitionResult =
  | { ok: true; update: { trangThai: TaskStatus; tienDo?: number } }
  | { ok: false; code: ErrorCode; message: string }

/** Hàm thuần: quyết định một lần chuyển trạng thái có hợp lệ không và cần cập nhật gì. */
export function checkStatusTransition(
  task: TaskLike,
  userId: string,
  target: TaskStatus,
  lyDo?: string | null,
): TransitionResult {
  if (task.trangThai === 'HOAN_THANH') {
    return { ok: false, code: 'TRANG_THAI_KHONG_HOP_LE', message: 'Công việc đã hoàn thành, không thay đổi được nữa' }
  }
  const transition = TRANSITIONS.find((b) => b.from === task.trangThai && b.to === target)
  if (!transition) {
    return {
      ok: false,
      code: 'TRANG_THAI_KHONG_HOP_LE',
      message: `Không thể chuyển từ "${STATUS_LABELS[task.trangThai]}" sang "${STATUS_LABELS[target]}"`,
    }
  }
  const roles = getRoles(task, userId)
  if (!transition.allowed(roles)) {
    return { ok: false, code: 'KHONG_CO_QUYEN', message: transition.deniedMessage }
  }
  if (transition.requiresReason && !lyDo?.trim()) {
    return { ok: false, code: 'VALIDATION', message: 'Trả lại công việc phải ghi lý do' }
  }
  const subtasks = task.viecCon ?? []
  const remaining = countUnfinished(subtasks)
  if (target === 'CHO_DUYET' && remaining > 0) {
    return {
      ok: false,
      code: 'TRANG_THAI_KHONG_HOP_LE',
      message: `Còn ${remaining} việc con chưa xong, chưa gửi duyệt được`,
    }
  }
  const update: { trangThai: TaskStatus; tienDo?: number } = { trangThai: target }
  if (target === 'CHO_DUYET') update.tienDo = 100
  else {
    // Trả lại / bắt đầu: nếu có việc con thì tiến độ tính lại theo việc con.
    const newProgress = computeProgress(subtasks, target, task.tienDo)
    if (newProgress !== task.tienDo) update.tienDo = newProgress
  }
  return { ok: true, update }
}
