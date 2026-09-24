import type {
  TaskComment,
  UpdateProgress,
  TaskDetail,
  ChangeStatus,
  Task,
  TaskListQuery,
  HistoryEntry,
  ApiResponse,
  ApiListResponse,
  UpdateTaskInput,
  CreateTask,
  QuickFilterCounts,
} from '@longdo/contracts'
import { callApi } from './http'

export type CountFilter = Pick<TaskListQuery, 'duAnId' | 'trangThai' | 'uuTien' | 'q'>

export const taskApi = {
  list: (q: TaskListQuery) =>
    callApi<ApiListResponse<Task>>('/cong-viec', { query: q }),

  count: async (q: CountFilter) => (await callApi<ApiResponse<QuickFilterCounts>>('/cong-viec/dem', { query: q })).data,

  get: async (id: string) => (await callApi<ApiResponse<TaskDetail>>(`/cong-viec/${id}`)).data,

  history: async (id: string) => (await callApi<ApiResponse<HistoryEntry[]>>(`/cong-viec/${id}/lich-su`)).data,

  create: async (body: CreateTask) =>
    (await callApi<ApiResponse<TaskDetail>>('/cong-viec', { method: 'POST', body })).data,

  update: async (id: string, body: UpdateTaskInput) =>
    (await callApi<ApiResponse<TaskDetail>>(`/cong-viec/${id}`, { method: 'PATCH', body })).data,

  changeStatus: async (id: string, body: ChangeStatus) =>
    (await callApi<ApiResponse<TaskDetail>>(`/cong-viec/${id}/trang-thai`, { method: 'POST', body })).data,

  updateProgress: async (id: string, body: UpdateProgress) =>
    (await callApi<ApiResponse<TaskDetail>>(`/cong-viec/${id}/tien-do`, { method: 'POST', body })).data,

  remove: async (id: string) =>
    (await callApi<ApiResponse<{ id: string }>>(`/cong-viec/${id}`, { method: 'DELETE' })).data,

  addSubtask: async (id: string, name: string) =>
    (await callApi<ApiResponse<TaskDetail>>(`/cong-viec/${id}/viec-con`, { method: 'POST', body: { ten: name } })).data,

  markSubtask: async (id: string, subtaskId: string, done: boolean) =>
    (
      await callApi<ApiResponse<TaskDetail>>(`/cong-viec/${id}/viec-con/${subtaskId}/danh-dau`, {
        method: 'POST',
        body: { xong: done },
      })
    ).data,

  removeSubtask: async (id: string, subtaskId: string) =>
    (await callApi<ApiResponse<TaskDetail>>(`/cong-viec/${id}/viec-con/${subtaskId}`, { method: 'DELETE' })).data,

  comments: async (id: string) => (await callApi<ApiResponse<TaskComment[]>>(`/cong-viec/${id}/binh-luan`)).data,

  addComment: async (id: string, content: string) =>
    (await callApi<ApiResponse<TaskComment>>(`/cong-viec/${id}/binh-luan`, { method: 'POST', body: { noiDung: content } })).data,
}
