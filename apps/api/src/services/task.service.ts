import { randomBytes } from 'node:crypto'
import {
  NO_PROJECT,
  MAX_SUBTASKS,
  isValidDateRange,
  type TaskComment,
  type UpdateProgress,
  type TaskDetail,
  type ChangeStatus,
  type Task,
  type MarkSubtask,
  type TaskListQuery,
  type TaskCountQuery,
  type HistoryAction,
  type HistoryEntry,
  type AuthUser,
  type UpdateTask,
  type CreateTask,
  type FieldChange,
  type AddSubtask,
  type QuickFilterCounts,
  type Subtask,
  type AddComment,
} from '@longdo/contracts'
import { stripUndefined } from '../db/strip-undefined.ts'
import { EDITABLE_FIELDS, type CommentRecord, type TaskRecord, type TaskChanges } from '../types.ts'
import { DomainError } from '../errors.ts'
import type { TaskFilter, DataStore } from '../repositories/interfaces.ts'
import { getPermissions, getRoles } from './domain/permissions.ts'
import { diffFields } from './domain/diff.ts'
import { todayInVietnam, isOverdue } from './domain/time.ts'
import { checkStatusTransition } from './domain/status.ts'
import { canManageSubtasks, computeProgress } from './domain/subtasks.ts'

const NOT_FOUND_MESSAGE = 'Không tìm thấy công việc'
const CONFLICT_MESSAGE = 'Công việc vừa được người khác cập nhật, vui lòng tải lại rồi thử lại'

/** Bỏ trùng, giữ thứ tự. */
const unique = (ids: readonly string[]) => [...new Set(ids)]

export function formatTaskCode(seq: number): string {
  return `CV-${String(seq).padStart(4, '0')}`
}

/**
 * Nghiệp vụ và phân quyền của phân hệ Công việc. userId/congTyId luôn lấy từ token (tham số user),
 * không bao giờ lấy từ body. Service không biết Mongo, chỉ làm việc qua DataStore.
 */
export class TaskService {
  private readonly store: DataStore
  /** Đồng hồ tiêm vào được, để test cố định "bây giờ" khi kiểm tra Quá hạn. */
  private readonly clock: () => Date

  constructor(store: DataStore, clock: () => Date = () => new Date()) {
    this.store = store
    this.clock = clock
  }

  // ---------- Đọc ----------

  /** Một trang công việc và tổng số khớp bộ lọc; route tự dựng { data, meta }. */
  async list(user: AuthUser, q: TaskListQuery): Promise<{ items: Task[]; total: number }> {
    const now = this.clock()
    const { items, total } = await this.store.tasks.list(
      { ...this.buildFilter(user, q, now), nhanh: q.nhanh },
      { page: q.page, limit: q.limit },
      q.sapXep,
    )
    return { items: items.map((task) => toTask(task, now)), total }
  }

  /** Số việc ở mỗi lọc nhanh, áp cùng các bộ lọc phụ (dự án, trạng thái, ưu tiên, từ khóa). */
  async countByQuickFilter(user: AuthUser, q: TaskCountQuery): Promise<QuickFilterCounts> {
    return this.store.tasks.countByQuickFilter(this.buildFilter(user, q, this.clock()))
  }

  async get(user: AuthUser, id: string): Promise<TaskDetail> {
    const task = await this.getVisibleTask(user, id)
    return toTaskDetail(task, user.userId, this.clock())
  }

  async history(user: AuthUser, id: string): Promise<HistoryEntry[]> {
    await this.getVisibleTask(user, id)
    const entries = await this.store.history.list(user.congTyId, id)
    return entries.map((entry) =>
      stripUndefined({
        id: entry.id,
        congViecId: entry.congViecId,
        nguoiDoiId: entry.nguoiDoiId,
        luc: entry.luc.toISOString(),
        hanhDong: entry.hanhDong,
        thayDoi: entry.thayDoi,
        lyDo: entry.lyDo,
      }),
    )
  }

  // ---------- Ghi ----------

  async create(user: AuthUser, body: CreateTask): Promise<TaskDetail> {
    const nguoiThucHienIds = unique(body.nguoiThucHienIds)
    // Ai đã là người thực hiện thì không cần theo dõi nữa.
    const nguoiTheoDoiIds = unique(body.nguoiTheoDoiIds).filter((x) => !nguoiThucHienIds.includes(x))
    await this.assertEmployeesInCompany(user.congTyId, nguoiThucHienIds, nguoiTheoDoiIds)
    if (body.duAnId) await this.assertProjectInCompany(user.congTyId, body.duAnId)

    // Mọi kiểm tra xong mới lấy số. Tăng bộ đếm + tạo việc + ghi lịch sử nằm trong một giao dịch:
    // lỗi ở bất kỳ bước nào thì cả khối được hoàn tác, số thứ tự không bị "mất" → không nhảy số.
    const now = this.clock()
    const task = await this.store.transaction(async (tx) => {
      const seq = await tx.counters.nextSequence(user.congTyId)
      const created = await tx.tasks.create(
        stripUndefined({
          congTyId: user.congTyId,
          ma: formatTaskCode(seq),
          ten: body.ten,
          moTa: body.moTa || undefined,
          duAnId: body.duAnId || undefined,
          nguoiGiaoId: user.userId,
          nguoiThucHienIds,
          nguoiTheoDoiIds,
          uuTien: body.uuTien,
          batDau: body.batDau || undefined,
          hetHan: body.hetHan || undefined,
          trangThai: 'CHUA_BAT_DAU' as const,
          tienDo: 0,
          viecCon: [],
          phienBan: 0,
          taoLuc: now,
          capNhatLuc: now,
        }),
      )
      await this.addHistory(tx, user, created.id, 'TAO', [], now)
      return created
    })
    return toTaskDetail(task, user.userId, now)
  }

  /** Chỉ người giao được sửa thông tin; không sửa được việc đã hoàn thành. */
  async update(user: AuthUser, id: string, body: UpdateTask): Promise<TaskDetail> {
    const task = await this.getVisibleTask(user, id)
    if (!getRoles(task, user.userId).isAssigner) {
      throw new DomainError('KHONG_CO_QUYEN', 'Chỉ người giao việc mới được sửa thông tin công việc')
    }
    if (task.trangThai === 'HOAN_THANH') {
      throw new DomainError('TRANG_THAI_KHONG_HOP_LE', 'Công việc đã hoàn thành, không sửa được nữa')
    }

    // Gộp thay đổi vào bản hiện tại: undefined = giữ nguyên, null/"" = xóa giá trị.
    const changes: TaskChanges = {}
    if (body.ten !== undefined) changes.ten = body.ten
    if (body.moTa !== undefined) changes.moTa = body.moTa || null
    if (body.duAnId !== undefined) changes.duAnId = body.duAnId || null
    if (body.uuTien !== undefined) changes.uuTien = body.uuTien
    if (body.batDau !== undefined) changes.batDau = body.batDau || null
    if (body.hetHan !== undefined) changes.hetHan = body.hetHan || null
    if (body.nguoiThucHienIds !== undefined) changes.nguoiThucHienIds = unique(body.nguoiThucHienIds)
    if (body.nguoiTheoDoiIds !== undefined) changes.nguoiTheoDoiIds = unique(body.nguoiTheoDoiIds)

    const after = { ...task, ...changes } as Record<string, unknown> & TaskRecord
    const assigneesAfter = (after.nguoiThucHienIds ?? []) as string[]
    if (changes.nguoiThucHienIds || changes.nguoiTheoDoiIds) {
      after.nguoiTheoDoiIds = (after.nguoiTheoDoiIds as string[]).filter((x) => !assigneesAfter.includes(x))
      changes.nguoiTheoDoiIds = after.nguoiTheoDoiIds
    }

    if (!isValidDateRange({ batDau: after.batDau ?? null, hetHan: after.hetHan ?? null })) {
      throw new DomainError('VALIDATION', 'hetHan: Hạn không được trước ngày bắt đầu')
    }
    if (changes.nguoiThucHienIds || changes.nguoiTheoDoiIds) {
      await this.assertEmployeesInCompany(user.congTyId, assigneesAfter, after.nguoiTheoDoiIds as string[])
    }
    if (changes.duAnId) await this.assertProjectInCompany(user.congTyId, changes.duAnId)

    const diff = diffFields(
      task as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
      EDITABLE_FIELDS,
    )
    if (diff.length === 0) return toTaskDetail(task, user.userId, this.clock())

    // Chỉ gửi xuống các trường thực sự đổi.
    const changedFields: TaskChanges = {}
    for (const { truong } of diff) {
      ;(changedFields as Record<string, unknown>)[truong] = (changes as Record<string, unknown>)[truong]
    }

    const now = this.clock()
    const updated = await this.writeWithLock(task, changedFields, now, (tx) =>
      // Một lần lưu = một bản ghi lịch sử, dù đổi bao nhiêu trường.
      this.addHistory(tx, user, id, 'SUA', diff, now),
    )
    return toTaskDetail(updated, user.userId, now)
  }

  async changeStatus(user: AuthUser, id: string, body: ChangeStatus): Promise<TaskDetail> {
    const task = await this.getVisibleTask(user, id)
    const result = checkStatusTransition(task, user.userId, body.trangThai, body.lyDo)
    if (!result.ok) throw new DomainError(result.code, result.message)

    const now = this.clock()
    const diff: FieldChange[] = [{ truong: 'trangThai', tu: task.trangThai, den: result.update.trangThai }]
    if (result.update.tienDo !== undefined && result.update.tienDo !== task.tienDo) {
      diff.push({ truong: 'tienDo', tu: task.tienDo, den: result.update.tienDo })
    }
    const isReturned = task.trangThai === 'CHO_DUYET' && result.update.trangThai === 'DANG_LAM'
    // Khóa theo phiên bản: hai người bấm cùng lúc (vd. duyệt và trả lại) thì chỉ một người thắng,
    // và người vừa bị gỡ vai trò không còn thao tác được trên bản cũ.
    const updated = await this.writeWithLock(task, result.update, now, (tx) =>
      this.addHistory(tx, user, id, 'CHUYEN_TRANG_THAI', diff, now, isReturned ? body.lyDo?.trim() : undefined),
    )
    return toTaskDetail(updated, user.userId, now)
  }

  /** Người thực hiện cập nhật tiến độ khi việc đang làm. */
  async updateProgress(user: AuthUser, id: string, body: UpdateProgress): Promise<TaskDetail> {
    const task = await this.getVisibleTask(user, id)
    if (!getRoles(task, user.userId).isAssignee) {
      throw new DomainError('KHONG_CO_QUYEN', 'Chỉ người thực hiện mới được cập nhật tiến độ')
    }
    if (task.trangThai !== 'DANG_LAM') {
      throw new DomainError('TRANG_THAI_KHONG_HOP_LE', 'Chỉ cập nhật được tiến độ khi công việc đang làm')
    }
    if (task.viecCon.length > 0) {
      throw new DomainError('TRANG_THAI_KHONG_HOP_LE', 'Công việc có việc con: tiến độ được tính tự động theo việc con')
    }
    if (body.tienDo === task.tienDo) return toTaskDetail(task, user.userId, this.clock())

    const now = this.clock()
    // Khóa theo phiên bản để giá trị "từ" trong lịch sử luôn đúng khi hai người cùng cập nhật.
    const updated = await this.writeWithLock(task, { tienDo: body.tienDo }, now, (tx) =>
      this.addHistory(tx, user, id, 'CAP_NHAT_TIEN_DO', [{ truong: 'tienDo', tu: task.tienDo, den: body.tienDo }], now),
    )
    return toTaskDetail(updated, user.userId, now)
  }

  /** Xóa mềm: chỉ người giao, không xóa được việc đã hoàn thành. */
  async remove(user: AuthUser, id: string): Promise<{ id: string }> {
    const task = await this.getVisibleTask(user, id)
    if (!getRoles(task, user.userId).isAssigner) {
      throw new DomainError('KHONG_CO_QUYEN', 'Chỉ người giao việc mới được xóa công việc')
    }
    if (task.trangThai === 'HOAN_THANH') {
      throw new DomainError('TRANG_THAI_KHONG_HOP_LE', 'Không xóa được công việc đã hoàn thành')
    }
    const now = this.clock()
    await this.writeWithLock(task, { deletedAt: now }, now, (tx) =>
      this.addHistory(tx, user, id, 'XOA', [{ truong: 'deletedAt', tu: null, den: now.toISOString() }], now),
    )
    return { id }
  }

  // ---------- Việc con ----------

  /** Người giao thêm việc con khi việc chưa bắt đầu hoặc đang làm. Tiến độ tính lại ngay. */
  async addSubtask(user: AuthUser, id: string, body: AddSubtask): Promise<TaskDetail> {
    const task = await this.getVisibleTask(user, id)
    this.assertCanManageSubtasks(task, user.userId)
    if (task.viecCon.length >= MAX_SUBTASKS) {
      throw new DomainError('VALIDATION', `Tối đa ${MAX_SUBTASKS} việc con cho một công việc`)
    }
    const newSubtask: Subtask = { id: randomBytes(12).toString('hex'), ten: body.ten, xong: false }
    return this.saveSubtasks(user, task, [...task.viecCon, newSubtask], {
      truong: 'viecCon',
      tu: null,
      den: { ten: newSubtask.ten, xong: false },
    })
  }

  /** Người thực hiện đánh dấu xong/chưa xong khi việc đang làm. */
  async markSubtask(user: AuthUser, id: string, subtaskId: string, body: MarkSubtask): Promise<TaskDetail> {
    const task = await this.getVisibleTask(user, id)
    if (!getRoles(task, user.userId).isAssignee) {
      throw new DomainError('KHONG_CO_QUYEN', 'Chỉ người thực hiện mới được đánh dấu việc con')
    }
    if (task.trangThai !== 'DANG_LAM') {
      throw new DomainError('TRANG_THAI_KHONG_HOP_LE', 'Chỉ đánh dấu được việc con khi công việc đang làm')
    }
    const subtask = this.findSubtask(task, subtaskId)
    if (subtask.xong === body.xong) return toTaskDetail(task, user.userId, this.clock())
    const subtasks = task.viecCon.map((x) => (x.id === subtask.id ? { ...x, xong: body.xong } : x))
    return this.saveSubtasks(user, task, subtasks, {
      truong: 'viecCon',
      tu: { ten: subtask.ten, xong: subtask.xong },
      den: { ten: subtask.ten, xong: body.xong },
    })
  }

  /** Người giao xóa việc con khi việc chưa bắt đầu hoặc đang làm. */
  async removeSubtask(user: AuthUser, id: string, subtaskId: string): Promise<TaskDetail> {
    const task = await this.getVisibleTask(user, id)
    this.assertCanManageSubtasks(task, user.userId)
    const subtask = this.findSubtask(task, subtaskId)
    return this.saveSubtasks(
      user,
      task,
      task.viecCon.filter((x) => x.id !== subtask.id),
      { truong: 'viecCon', tu: { ten: subtask.ten, xong: subtask.xong }, den: null },
    )
  }

  // ---------- Bình luận ----------

  /** Ai liên quan tới công việc (giao, thực hiện, theo dõi) đều đọc và viết bình luận được. */
  async listComments(user: AuthUser, id: string): Promise<TaskComment[]> {
    await this.getVisibleTask(user, id)
    return (await this.store.comments.list(user.congTyId, id)).map(toComment)
  }

  async addComment(user: AuthUser, id: string, body: AddComment): Promise<TaskComment> {
    await this.getVisibleTask(user, id)
    const comment = await this.store.comments.add({
      congTyId: user.congTyId,
      congViecId: id,
      nguoiVietId: user.userId,
      noiDung: body.noiDung,
      taoLuc: this.clock(),
    })
    return toComment(comment)
  }

  // ---------- Hỗ trợ ----------

  private assertCanManageSubtasks(task: TaskRecord, userId: string): void {
    if (!getRoles(task, userId).isAssigner) {
      throw new DomainError('KHONG_CO_QUYEN', 'Chỉ người giao việc mới được thêm hoặc xóa việc con')
    }
    if (!canManageSubtasks(task.trangThai)) {
      throw new DomainError(
        'TRANG_THAI_KHONG_HOP_LE',
        'Chỉ thêm hoặc xóa việc con khi công việc chưa bắt đầu hoặc đang làm',
      )
    }
  }

  private findSubtask(task: TaskRecord, subtaskId: string): Subtask {
    const subtask = task.viecCon.find((x) => x.id === subtaskId)
    if (!subtask) throw new DomainError('KHONG_TIM_THAY', 'Không tìm thấy việc con')
    return subtask
  }

  /** Ghi danh sách việc con mới, tính lại tiến độ, ghi một dòng lịch sử — trong một giao dịch có khóa. */
  private async saveSubtasks(
    user: AuthUser,
    task: TaskRecord,
    subtasks: Subtask[],
    subtaskChange: FieldChange,
  ): Promise<TaskDetail> {
    const progress = computeProgress(subtasks, task.trangThai, task.tienDo)
    const changes: TaskChanges = { viecCon: subtasks }
    const diff: FieldChange[] = [subtaskChange]
    if (progress !== task.tienDo) {
      changes.tienDo = progress
      diff.push({ truong: 'tienDo', tu: task.tienDo, den: progress })
    }
    const now = this.clock()
    const updated = await this.writeWithLock(task, changes, now, (tx) =>
      this.addHistory(tx, user, task.id, 'VIEC_CON', diff, now),
    )
    return toTaskDetail(updated, user.userId, now)
  }

  /**
   * Ghi thay đổi với điều kiện trạng thái và phiên bản vẫn như lúc đọc, rồi ghi lịch sử, tất cả trong
   * một giao dịch. Có người ghi chen vào giữa thì trả XUNG_DOT và không ghi gì cả.
   */
  private async writeWithLock(
    task: TaskRecord,
    changes: TaskChanges,
    now: Date,
    alsoWrite: (tx: DataStore) => Promise<void>,
  ): Promise<TaskRecord> {
    return this.store.transaction(async (tx) => {
      const updated = await tx.tasks.update(
        task.congTyId,
        task.id,
        { trangThai: task.trangThai, phienBan: task.phienBan },
        changes,
        now,
      )
      if (!updated) throw new DomainError('XUNG_DOT', CONFLICT_MESSAGE)
      await alsoWrite(tx)
      return updated
    })
  }

  /**
   * Lấy công việc mà người này có liên quan. Không tồn tại, khác công ty, đã xóa, hoặc không
   * liên quan đều trả 404 như nhau để không lộ sự tồn tại của công việc.
   */
  private async getVisibleTask(user: AuthUser, id: string): Promise<TaskRecord> {
    const task = await this.store.tasks.findById(user.congTyId, id)
    if (!task || !getRoles(task, user.userId).isInvolved) {
      throw new DomainError('KHONG_TIM_THAY', NOT_FOUND_MESSAGE)
    }
    return task
  }

  private buildFilter(
    user: AuthUser,
    q: Pick<TaskListQuery, 'duAnId' | 'trangThai' | 'uuTien' | 'q'>,
    now: Date,
  ): TaskFilter {
    return stripUndefined({
      congTyId: user.congTyId,
      userId: user.userId,
      today: todayInVietnam(now),
      duAnId: q.duAnId === undefined ? undefined : q.duAnId === NO_PROJECT ? null : q.duAnId,
      trangThai: q.trangThai,
      uuTien: q.uuTien,
      q: q.q || undefined,
    })
  }

  private async assertEmployeesInCompany(congTyId: string, assigneeIds: string[], followerIds: string[]): Promise<void> {
    if (assigneeIds.length === 0) {
      throw new DomainError('VALIDATION', 'nguoiThucHienIds: Cần ít nhất một người thực hiện')
    }
    const all = unique([...assigneeIds, ...followerIds])
    const found = await this.store.employees.findMany(congTyId, all)
    if (found.length !== all.length) {
      throw new DomainError('VALIDATION', 'Có người thực hiện hoặc người theo dõi không thuộc công ty')
    }
  }

  private async assertProjectInCompany(congTyId: string, duAnId: string): Promise<void> {
    if (!(await this.store.projects.findById(congTyId, duAnId))) {
      throw new DomainError('VALIDATION', 'duAnId: Dự án không tồn tại trong công ty')
    }
  }

  private addHistory(
    store: DataStore,
    user: AuthUser,
    congViecId: string,
    action: HistoryAction,
    changes: FieldChange[],
    now: Date,
    lyDo?: string,
  ): Promise<void> {
    return store.history.add(
      stripUndefined({ congTyId: user.congTyId, congViecId, nguoiDoiId: user.userId, luc: now, hanhDong: action, thayDoi: changes, lyDo }),
    )
  }
}

export function toTask(task: TaskRecord, now: Date): Task {
  return stripUndefined({
    id: task.id,
    ma: task.ma,
    ten: task.ten,
    moTa: task.moTa,
    duAnId: task.duAnId,
    nguoiGiaoId: task.nguoiGiaoId,
    nguoiThucHienIds: task.nguoiThucHienIds,
    nguoiTheoDoiIds: task.nguoiTheoDoiIds,
    uuTien: task.uuTien,
    batDau: task.batDau,
    hetHan: task.hetHan,
    trangThai: task.trangThai,
    tienDo: task.tienDo,
    viecCon: task.viecCon.map((v) => ({ id: v.id, ten: v.ten, xong: v.xong })),
    quaHan: isOverdue(task, now),
    congTyId: task.congTyId,
    taoLuc: task.taoLuc.toISOString(),
    capNhatLuc: task.capNhatLuc.toISOString(),
  })
}

function toTaskDetail(task: TaskRecord, userId: string, now: Date): TaskDetail {
  return { ...toTask(task, now), quyen: getPermissions(task, userId) }
}

function toComment(comment: CommentRecord): TaskComment {
  return {
    id: comment.id,
    congViecId: comment.congViecId,
    nguoiVietId: comment.nguoiVietId,
    noiDung: comment.noiDung,
    taoLuc: comment.taoLuc.toISOString(),
  }
}
