import type {
  UpdateProgress,
  TaskDetail,
  ChangeStatus,
  TaskListQuery,
  UpdateTaskInput,
  CreateTask,
} from '@longdo/contracts'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { taskApi, type CountFilter } from '../api/task.api'
import { useSession } from '../auth/session'

/**
 * Khóa cache luôn có userId: dữ liệu của người này không bao giờ hiện cho người khác,
 * kể cả khi một yêu cầu của người trước trả về sau khi đã đổi người đăng nhập.
 */
export const taskKeys = {
  all: (uid: string) => ['tasks', uid] as const,
  list: (uid: string, q: TaskListQuery) => ['tasks', uid, 'list', q] as const,
  count: (uid: string, q: CountFilter) => ['tasks', uid, 'count', q] as const,
  detail: (uid: string, id: string) => ['tasks', uid, 'detail', id] as const,
  history: (uid: string, id: string) => ['tasks', uid, 'history', id] as const,
  comments: (uid: string, id: string) => ['tasks', uid, 'comments', id] as const,
}

function useUid(): string {
  return useSession()?.nhanVien.id ?? ''
}

export function useTaskList(q: TaskListQuery) {
  const uid = useUid()
  return useQuery({
    queryKey: taskKeys.list(uid, q),
    queryFn: () => taskApi.list(q),
    // Giữ trang cũ khi đổi bộ lọc/trang để bảng không nháy trắng (chỉ trong cùng một người dùng,
    // vì trang được dựng lại khi đổi người — xem Layout).
    placeholderData: keepPreviousData,
  })
}

export function useQuickFilterCounts(q: CountFilter) {
  const uid = useUid()
  return useQuery({
    queryKey: taskKeys.count(uid, q),
    queryFn: () => taskApi.count(q),
    placeholderData: keepPreviousData,
  })
}

export function useTaskDetail(id: string) {
  const uid = useUid()
  return useQuery({ queryKey: taskKeys.detail(uid, id), queryFn: () => taskApi.get(id) })
}

export function useTaskHistory(id: string) {
  const uid = useUid()
  return useQuery({ queryKey: taskKeys.history(uid, id), queryFn: () => taskApi.history(id) })
}

/** Sau mỗi thay đổi: đặt ngay chi tiết mới vào cache, làm mới danh sách/số đếm/lịch sử (không chờ). */
function useAfterChange() {
  const qc = useQueryClient()
  const uid = useUid()
  return (task: TaskDetail) => {
    qc.setQueryData(taskKeys.detail(uid, task.id), task)
    void qc.invalidateQueries({
      queryKey: taskKeys.all(uid),
      // Bình luận không đổi khi công việc đổi nên không cần tải lại.
      predicate: (q) => !(q.queryKey[3] === task.id && (q.queryKey[2] === 'detail' || q.queryKey[2] === 'comments')),
    })
  }
}

export function useCreateTask() {
  const afterChange = useAfterChange()
  return useMutation({ mutationFn: (body: CreateTask) => taskApi.create(body), onSuccess: afterChange })
}

export function useUpdateTask(id: string) {
  const afterChange = useAfterChange()
  return useMutation({ mutationFn: (body: UpdateTaskInput) => taskApi.update(id, body), onSuccess: afterChange })
}

export function useChangeStatus(id: string) {
  const afterChange = useAfterChange()
  return useMutation({
    mutationFn: (body: ChangeStatus) => taskApi.changeStatus(id, body),
    onSuccess: afterChange,
  })
}

export function useUpdateProgress(id: string) {
  const afterChange = useAfterChange()
  return useMutation({
    mutationFn: (body: UpdateProgress) => taskApi.updateProgress(id, body),
    onSuccess: afterChange,
  })
}

export function useDeleteTask(id: string) {
  const qc = useQueryClient()
  const uid = useUid()
  return useMutation({
    mutationFn: () => taskApi.remove(id),
    onSuccess: () => {
      // Bỏ hẳn chi tiết và lịch sử của việc đã xóa (tải lại chỉ nhận 404), làm mới danh sách và số đếm.
      qc.removeQueries({ queryKey: taskKeys.detail(uid, id) })
      qc.removeQueries({ queryKey: taskKeys.history(uid, id) })
      qc.removeQueries({ queryKey: taskKeys.comments(uid, id) })
      void qc.invalidateQueries({ queryKey: [...taskKeys.all(uid), 'list'] })
      void qc.invalidateQueries({ queryKey: [...taskKeys.all(uid), 'count'] })
    },
  })
}

// ---------- Việc con ----------

export function useAddSubtask(id: string) {
  const afterChange = useAfterChange()
  return useMutation({ mutationFn: (name: string) => taskApi.addSubtask(id, name), onSuccess: afterChange })
}

export function useMarkSubtask(id: string) {
  const afterChange = useAfterChange()
  return useMutation({
    mutationFn: (v: { subtaskId: string; done: boolean }) => taskApi.markSubtask(id, v.subtaskId, v.done),
    onSuccess: afterChange,
  })
}

export function useRemoveSubtask(id: string) {
  const afterChange = useAfterChange()
  return useMutation({ mutationFn: (subtaskId: string) => taskApi.removeSubtask(id, subtaskId), onSuccess: afterChange })
}

// ---------- Bình luận ----------

export function useComments(id: string) {
  const uid = useUid()
  return useQuery({ queryKey: taskKeys.comments(uid, id), queryFn: () => taskApi.comments(id) })
}

export function useAddComment(id: string) {
  const qc = useQueryClient()
  const uid = useUid()
  return useMutation({
    mutationFn: (content: string) => taskApi.addComment(id, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.comments(uid, id) }),
  })
}
