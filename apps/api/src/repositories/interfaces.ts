import type { QuickFilter, StatusFilter, SortOrder, QuickFilterCounts, TaskStatus, Priority } from '@longdo/contracts'
import type {
  CommentRecord,
  NewCommentRecord,
  TaskRecord,
  NewTask,
  ProjectRecord,
  HistoryRecord,
  NewHistoryRecord,
  EmployeeRecord,
  TaskChanges,
} from '../types.ts'

/**
 * Hợp đồng giữa service và repository. Service chỉ biết các giao diện này, không biết Mongo,
 * nên test nghiệp vụ có thể thay bằng bản cài đặt trong bộ nhớ.
 * Mọi hàm đều nhận congTyId: không có truy vấn nào chạy mà không lọc theo công ty.
 */

export type TaskFilter = {
  congTyId: string
  userId: string
  /** Ngày hôm nay theo giờ VN (YYYY-MM-DD), để lọc Quá hạn. */
  today: string
  /** undefined = mọi dự án; null = chỉ việc chung; chuỗi = một dự án. */
  duAnId?: string | null
  trangThai?: StatusFilter
  uuTien?: Priority
  /** Từ khóa người dùng gõ; repository tự chuẩn hóa (bỏ dấu, chữ thường). Tìm theo tên hoặc mã. */
  q?: string
}

export type UpdateCondition = {
  /** Chỉ cập nhật nếu trạng thái hiện tại đúng bằng giá trị này. */
  trangThai?: TaskStatus
  /** Chỉ cập nhật nếu phiên bản vẫn là giá trị đã đọc (khóa lạc quan). Mỗi lần ghi tăng phiên bản 1. */
  phienBan?: number
}

export interface TaskRepository {
  /** Tìm theo id trong công ty, bỏ qua bản ghi đã xóa mềm. */
  findById(congTyId: string, id: string): Promise<TaskRecord | null>
  create(data: NewTask): Promise<TaskRecord>
  /** Cập nhật có điều kiện; trả null nếu không còn khớp điều kiện (đã bị người khác đổi). */
  update(
    congTyId: string,
    id: string,
    condition: UpdateCondition,
    changes: TaskChanges,
    now: Date,
  ): Promise<TaskRecord | null>
  list(
    filter: TaskFilter & { nhanh: QuickFilter },
    paging: { page: number; limit: number },
    sortOrder: SortOrder,
  ): Promise<{ items: TaskRecord[]; total: number }>
  countByQuickFilter(filter: TaskFilter): Promise<QuickFilterCounts>
}

export interface CounterRepository {
  /** Lấy số thứ tự tiếp theo cho mã công việc của một công ty (nguyên tử). */
  nextSequence(congTyId: string): Promise<number>
}

export interface HistoryRepository {
  add(record: NewHistoryRecord): Promise<void>
  list(congTyId: string, congViecId: string): Promise<HistoryRecord[]>
}

export interface CommentRepository {
  add(record: NewCommentRecord): Promise<CommentRecord>
  /** Bình luận của một công việc, cũ trước mới sau. */
  list(congTyId: string, congViecId: string): Promise<CommentRecord[]>
}

export interface EmployeeRepository {
  list(congTyId: string): Promise<EmployeeRecord[]>
  /** Tất cả nhân viên mọi công ty, chỉ dùng cho màn chọn "Đang đăng nhập là ai". */
  listForMockLogin(): Promise<EmployeeRecord[]>
  findById(id: string): Promise<EmployeeRecord | null>
  findMany(congTyId: string, ids: readonly string[]): Promise<EmployeeRecord[]>
}

export interface ProjectRepository {
  list(congTyId: string): Promise<ProjectRecord[]>
  findById(congTyId: string, id: string): Promise<ProjectRecord | null>
}

export type DataStore = {
  tasks: TaskRepository
  counters: CounterRepository
  history: HistoryRepository
  comments: CommentRepository
  employees: EmployeeRepository
  projects: ProjectRepository
  /**
   * Chạy nhiều thao tác ghi như một khối: hoặc tất cả được lưu, hoặc không gì cả
   * (ghi công việc + ghi lịch sử + tăng bộ đếm mã). fn nhận một kho gắn với giao dịch đó.
   */
  transaction<T>(fn: (store: DataStore) => Promise<T>): Promise<T>
}
