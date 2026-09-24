import type { TaskPermissions, TaskStatus } from '@longdo/contracts'
import { canManageSubtasks, countUnfinished } from './subtasks.ts'

type TaskLike = {
  nguoiGiaoId: string
  nguoiThucHienIds: string[]
  nguoiTheoDoiIds: string[]
  trangThai: TaskStatus
  viecCon?: ReadonlyArray<{ xong: boolean }>
}

export type Roles = {
  isAssigner: boolean
  isAssignee: boolean
  isFollower: boolean
  /** Có ít nhất một vai trò trên công việc. Không liên quan thì không thấy công việc. */
  isInvolved: boolean
}

export function getRoles(task: Omit<TaskLike, 'trangThai'>, userId: string): Roles {
  const isAssigner = task.nguoiGiaoId === userId
  const isAssignee = task.nguoiThucHienIds.includes(userId)
  const isFollower = task.nguoiTheoDoiIds.includes(userId)
  return {
    isAssigner,
    isAssignee,
    isFollower,
    isInvolved: isAssigner || isAssignee || isFollower,
  }
}

/**
 * Quyền theo vai trò VÀ trạng thái hiện tại. Web dùng để ẩn/hiện nút,
 * service dùng để chặn. Một người có thể vừa giao vừa thực hiện (việc cá nhân).
 */
export function getPermissions(task: TaskLike, userId: string): TaskPermissions {
  const roles = getRoles(task, userId)
  const notDone = task.trangThai !== 'HOAN_THANH'
  const inProgress = task.trangThai === 'DANG_LAM'
  const subtasks = task.viecCon ?? []
  return {
    sua: roles.isAssigner && notDone,
    xoa: roles.isAssigner && notDone,
    batDau: roles.isAssignee && task.trangThai === 'CHUA_BAT_DAU',
    // Có việc con chưa xong thì chưa gửi duyệt được.
    guiDuyet: roles.isAssignee && inProgress && countUnfinished(subtasks) === 0,
    duyet: roles.isAssigner && task.trangThai === 'CHO_DUYET',
    traLai: roles.isAssigner && task.trangThai === 'CHO_DUYET',
    // Có việc con thì tiến độ tự tính, không nhập tay.
    capNhatTienDo: roles.isAssignee && inProgress && subtasks.length === 0,
    quanLyViecCon: roles.isAssigner && canManageSubtasks(task.trangThai),
    danhDauViecCon: roles.isAssignee && inProgress,
  }
}
