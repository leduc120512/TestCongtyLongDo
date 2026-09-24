import type { Task, HistoryAction, FieldChange } from '@longdo/contracts'

/** Bản ghi công việc như đang lưu (trước khi tính quaHan, ngày giờ là Date). */
export type TaskRecord = Omit<Task, 'quaHan' | 'taoLuc' | 'capNhatLuc'> & {
  /** Tăng 1 sau mỗi lần ghi; khóa lạc quan nội bộ, không trả ra API. */
  phienBan: number
  taoLuc: Date
  capNhatLuc: Date
  deletedAt?: Date
}

export type NewTask = Omit<TaskRecord, 'id'>

/** Các trường người giao được sửa qua PATCH. */
export const EDITABLE_FIELDS = [
  'ten',
  'moTa',
  'duAnId',
  'nguoiThucHienIds',
  'nguoiTheoDoiIds',
  'uuTien',
  'batDau',
  'hetHan',
] as const
export type EditableField = (typeof EDITABLE_FIELDS)[number]

/** Thay đổi gửi xuống repository: undefined = không đụng, null = xóa trường. */
export type TaskChanges = Partial<{
  [K in EditableField]: TaskRecord[K] | null
}> &
  Partial<Pick<TaskRecord, 'trangThai' | 'tienDo' | 'viecCon' | 'deletedAt'>>

export type HistoryRecord = {
  id: string
  congViecId: string
  congTyId: string
  nguoiDoiId: string
  luc: Date
  hanhDong: HistoryAction
  thayDoi: FieldChange[]
  lyDo?: string
}
export type NewHistoryRecord = Omit<HistoryRecord, 'id'>

export type CommentRecord = {
  id: string
  congTyId: string
  congViecId: string
  nguoiVietId: string
  noiDung: string
  taoLuc: Date
}
export type NewCommentRecord = Omit<CommentRecord, 'id'>

export type EmployeeRecord = { id: string; ten: string; chucVu: string; congTyId: string }
export type ProjectRecord = { id: string; ma: string; ten: string; congTyId: string }
