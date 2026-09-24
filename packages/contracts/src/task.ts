import { z } from 'zod'
import { IdSchema, CalendarDateSchema, PaginationQuerySchema } from './common.ts'

// ---------- Enum ----------

export const PRIORITIES = ['THAP', 'BINH_THUONG', 'CAO'] as const
export const PrioritySchema = z.enum(PRIORITIES, { error: 'Ưu tiên không hợp lệ' })
export type Priority = z.infer<typeof PrioritySchema>
export const PRIORITY_LABELS: Record<Priority, string> = {
  THAP: 'Thấp',
  BINH_THUONG: 'Bình thường',
  CAO: 'Cao',
}

export const TASK_STATUSES = ['CHUA_BAT_DAU', 'DANG_LAM', 'CHO_DUYET', 'HOAN_THANH'] as const
export const TaskStatusSchema = z.enum(TASK_STATUSES, { error: 'Trạng thái không hợp lệ' })
export type TaskStatus = z.infer<typeof TaskStatusSchema>
export const STATUS_LABELS: Record<TaskStatus, string> = {
  CHUA_BAT_DAU: 'Chưa bắt đầu',
  DANG_LAM: 'Đang làm',
  CHO_DUYET: 'Chờ duyệt',
  HOAN_THANH: 'Hoàn thành',
}

/** Lọc nhanh trên màn danh sách. */
export const QUICK_FILTERS = ['CUA_TOI', 'TOI_GIAO', 'THEO_DOI', 'TAT_CA'] as const
export const QuickFilterSchema = z.enum(QUICK_FILTERS, { error: 'Lọc nhanh không hợp lệ' })
export type QuickFilter = z.infer<typeof QuickFilterSchema>
export const QUICK_FILTER_LABELS: Record<QuickFilter, string> = {
  CUA_TOI: 'Việc của tôi',
  TOI_GIAO: 'Việc tôi giao',
  THEO_DOI: 'Đang theo dõi',
  TAT_CA: 'Tất cả',
}

/** Lọc theo trạng thái có thêm "Quá hạn" (tính ra khi đọc, không lưu trong DB). */
export const StatusFilterSchema = z.enum([...TASK_STATUSES, 'QUA_HAN'], {
  error: 'Trạng thái lọc không hợp lệ',
})
export type StatusFilter = z.infer<typeof StatusFilterSchema>

/** Giá trị đặc biệt cho lọc dự án: chỉ lấy việc chung (không thuộc dự án nào). */
export const NO_PROJECT = 'CHUNG'

export const SORT_ORDERS = ['hetHan_asc', 'hetHan_desc'] as const
export const SortOrderSchema = z.enum(SORT_ORDERS, { error: 'Sắp xếp không hợp lệ' })
export type SortOrder = z.infer<typeof SortOrderSchema>

// ---------- Body tạo / sửa ----------

/**
 * Trường gốc KHÔNG có .default(): Zod 4 vẫn áp default bên trong .partial(), nên nếu schema sửa
 * dựng từ schema có default thì PATCH thiếu trường sẽ bị điền mặc định và ghi đè dữ liệu thật.
 */
const BaseTaskFields = z.object({
  ten: z
    .string({ error: 'Tên công việc không được để trống' })
    .trim()
    .min(1, 'Tên công việc không được để trống')
    .max(200, 'Tên công việc tối đa 200 ký tự'),
  moTa: z.string().trim().max(5000, 'Mô tả tối đa 5000 ký tự').nullish(),
  duAnId: IdSchema.nullish(),
  nguoiThucHienIds: z
    .array(IdSchema, { error: 'Cần ít nhất một người thực hiện' })
    .min(1, 'Cần ít nhất một người thực hiện'),
  nguoiTheoDoiIds: z.array(IdSchema, { error: 'Danh sách người theo dõi không hợp lệ' }),
  uuTien: PrioritySchema,
  batDau: CalendarDateSchema.nullish(),
  hetHan: CalendarDateSchema.nullish(),
})

type DateRange = { batDau?: string | null; hetHan?: string | null }

/** Hạn không được trước ngày bắt đầu (khi có cả hai). So sánh chuỗi YYYY-MM-DD là đủ. */
export function isValidDateRange(d: DateRange): boolean {
  return !(d.batDau && d.hetHan && d.hetHan < d.batDau)
}

function refineDateRange(d: DateRange, ctx: z.RefinementCtx) {
  if (!isValidDateRange(d)) {
    ctx.addIssue({ code: 'custom', path: ['hetHan'], message: 'Hạn không được trước ngày bắt đầu' })
  }
}

export const CreateTaskSchema = BaseTaskFields.extend({
  nguoiTheoDoiIds: BaseTaskFields.shape.nguoiTheoDoiIds.default([]),
  uuTien: PrioritySchema.default('BINH_THUONG'),
}).superRefine(refineDateRange)
export type CreateTask = z.output<typeof CreateTaskSchema>
export type CreateTaskInput = z.input<typeof CreateTaskSchema>

/**
 * PATCH: trường không gửi = giữ nguyên; gửi null = xóa giá trị (bỏ hạn, bỏ dự án...).
 * Kiểm tra hạn so với giá trị đang lưu (khi chỉ gửi một trong hai) do service làm.
 */
export const UpdateTaskSchema = BaseTaskFields.partial().superRefine(refineDateRange)
export type UpdateTask = z.output<typeof UpdateTaskSchema>
export type UpdateTaskInput = z.input<typeof UpdateTaskSchema>

export const ChangeStatusSchema = z.object({
  trangThai: TaskStatusSchema,
  lyDo: z.string().trim().max(1000, 'Lý do tối đa 1000 ký tự').nullish(),
})
export type ChangeStatus = z.infer<typeof ChangeStatusSchema>

// Body JSON đã mang kiểu số: không dùng coerce (coerce biến null, "", true thành 0/1 và lọt validate).
export const UpdateProgressSchema = z.object({
  tienDo: z
    .number({ error: 'Tiến độ phải là số' })
    .int('Tiến độ phải là số nguyên')
    .min(0, 'Tiến độ từ 0 đến 100')
    .max(100, 'Tiến độ từ 0 đến 100'),
})
export type UpdateProgress = z.infer<typeof UpdateProgressSchema>

// ---------- Query danh sách ----------

export const TaskListQuerySchema = PaginationQuerySchema.extend({
  nhanh: QuickFilterSchema.default('TAT_CA'),
  /** Id dự án, hoặc "CHUNG" = chỉ việc chung. */
  duAnId: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === NO_PROJECT.toLowerCase() || /^[0-9a-f]{24}$/.test(v), 'Dự án không hợp lệ')
    .transform((v) => (v === NO_PROJECT.toLowerCase() ? NO_PROJECT : v))
    .optional(),
  trangThai: StatusFilterSchema.optional(),
  uuTien: PrioritySchema.optional(),
  q: z.string().trim().max(100, 'Từ khóa tối đa 100 ký tự').optional(),
  sapXep: SortOrderSchema.default('hetHan_asc'),
})
export type TaskListQuery = z.output<typeof TaskListQuerySchema>
export type TaskListQueryInput = z.input<typeof TaskListQuerySchema>

// ---------- Việc con (tùy chọn 1) ----------

/** Tối đa số việc con trong một công việc. */
export const MAX_SUBTASKS = 50

export const SubtaskSchema = z.object({
  id: z.string(),
  ten: z.string(),
  xong: z.boolean(),
})
export type Subtask = z.infer<typeof SubtaskSchema>

export const AddSubtaskSchema = z.object({
  ten: z
    .string({ error: 'Tên việc con không được để trống' })
    .trim()
    .min(1, 'Tên việc con không được để trống')
    .max(200, 'Tên việc con tối đa 200 ký tự'),
})
export type AddSubtask = z.infer<typeof AddSubtaskSchema>

export const MarkSubtaskSchema = z.object({
  xong: z.boolean({ error: 'Trạng thái việc con phải là đúng/sai' }),
})
export type MarkSubtask = z.infer<typeof MarkSubtaskSchema>

// ---------- Bình luận (tùy chọn 2) ----------

export const TaskCommentSchema = z.object({
  id: z.string(),
  congViecId: z.string(),
  nguoiVietId: z.string(),
  noiDung: z.string(),
  taoLuc: z.string(),
})
export type TaskComment = z.infer<typeof TaskCommentSchema>

export const AddCommentSchema = z.object({
  noiDung: z
    .string({ error: 'Nội dung bình luận không được để trống' })
    .trim()
    .min(1, 'Nội dung bình luận không được để trống')
    .max(2000, 'Bình luận tối đa 2000 ký tự'),
})
export type AddComment = z.infer<typeof AddCommentSchema>

// ---------- Tham số đường dẫn và query đếm ----------

export const IdParamsSchema = z.object({ id: IdSchema })
export const SubtaskParamsSchema = z.object({ id: IdSchema, viecConId: IdSchema })

/** Query của /cong-viec/dem: các bộ lọc phụ của danh sách (không có lọc nhanh, trang, sắp xếp). */
export const TaskCountQuerySchema = TaskListQuerySchema.pick({
  duAnId: true,
  trangThai: true,
  uuTien: true,
  q: true,
})
export type TaskCountQuery = z.output<typeof TaskCountQuerySchema>

// ---------- Dữ liệu trả về ----------

export const TaskSchema = z.object({
  id: z.string(),
  ma: z.string(),
  ten: z.string(),
  moTa: z.string().optional(),
  duAnId: z.string().optional(),
  nguoiGiaoId: z.string(),
  nguoiThucHienIds: z.array(z.string()),
  nguoiTheoDoiIds: z.array(z.string()),
  uuTien: PrioritySchema,
  batDau: CalendarDateSchema.optional(),
  hetHan: CalendarDateSchema.optional(),
  trangThai: TaskStatusSchema,
  tienDo: z.number().int().min(0).max(100),
  /** Danh sách đầu việc; khi có ít nhất một việc con thì tiến độ tự tính theo tỉ lệ việc con đã xong. */
  viecCon: z.array(SubtaskSchema),
  /** Tính lúc đọc: chưa hoàn thành và đã qua hết ngày hetHan theo giờ Việt Nam. */
  quaHan: z.boolean(),
  congTyId: z.string(),
  taoLuc: z.string(),
  capNhatLuc: z.string(),
})
export type Task = z.infer<typeof TaskSchema>

/** Các nút mà người đang xem được phép dùng. API vẫn tự chặn, đây chỉ để web ẩn/hiện. */
export const TaskPermissionsSchema = z.object({
  sua: z.boolean(),
  xoa: z.boolean(),
  batDau: z.boolean(),
  guiDuyet: z.boolean(),
  duyet: z.boolean(),
  traLai: z.boolean(),
  capNhatTienDo: z.boolean(),
  /** Thêm/xóa việc con (người giao, khi chưa bắt đầu hoặc đang làm). */
  quanLyViecCon: z.boolean(),
  /** Đánh dấu việc con xong/chưa xong (người thực hiện, khi đang làm). */
  danhDauViecCon: z.boolean(),
})
export type TaskPermissions = z.infer<typeof TaskPermissionsSchema>

export const TaskDetailSchema = TaskSchema.extend({
  quyen: TaskPermissionsSchema,
})
export type TaskDetail = z.infer<typeof TaskDetailSchema>

export const QuickFilterCountsSchema = z.object({
  CUA_TOI: z.number().int(),
  TOI_GIAO: z.number().int(),
  THEO_DOI: z.number().int(),
  TAT_CA: z.number().int(),
})
export type QuickFilterCounts = z.infer<typeof QuickFilterCountsSchema>

// ---------- Lịch sử thay đổi ----------

export const HISTORY_ACTIONS = ['TAO', 'SUA', 'CHUYEN_TRANG_THAI', 'CAP_NHAT_TIEN_DO', 'VIEC_CON', 'XOA'] as const
export const HistoryActionSchema = z.enum(HISTORY_ACTIONS)
export type HistoryAction = z.infer<typeof HistoryActionSchema>
export const HISTORY_ACTION_LABELS: Record<HistoryAction, string> = {
  TAO: 'Tạo công việc',
  SUA: 'Sửa thông tin',
  CHUYEN_TRANG_THAI: 'Chuyển trạng thái',
  CAP_NHAT_TIEN_DO: 'Cập nhật tiến độ',
  VIEC_CON: 'Việc con',
  XOA: 'Xóa công việc',
}

export const FieldChangeSchema = z.object({
  truong: z.string(),
  tu: z.unknown(),
  den: z.unknown(),
})
export type FieldChange = z.infer<typeof FieldChangeSchema>

/** Một dòng lịch sử = một lần lưu; các trường đổi trong lần đó nằm trong mảng thayDoi. */
export const HistoryEntrySchema = z.object({
  id: z.string(),
  congViecId: z.string(),
  nguoiDoiId: z.string(),
  luc: z.string(),
  hanhDong: HistoryActionSchema,
  thayDoi: z.array(FieldChangeSchema),
  lyDo: z.string().optional(),
})
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>

export const FIELD_LABELS: Record<string, string> = {
  ten: 'Tên',
  moTa: 'Mô tả',
  duAnId: 'Dự án',
  nguoiThucHienIds: 'Người thực hiện',
  nguoiTheoDoiIds: 'Người theo dõi',
  uuTien: 'Ưu tiên',
  batDau: 'Bắt đầu',
  hetHan: 'Hạn',
  trangThai: 'Trạng thái',
  tienDo: 'Tiến độ',
  viecCon: 'Việc con',
  deletedAt: 'Đã xóa',
}
