import {
  UpdateProgressSchema,
  ChangeStatusSchema,
  MarkSubtaskSchema,
  TaskListQuerySchema,
  TaskCountQuerySchema,
  UpdateTaskSchema,
  CreateTaskSchema,
  IdParamsSchema,
  SubtaskParamsSchema,
  AddSubtaskSchema,
  AddCommentSchema,
  type TaskComment,
  type TaskDetail,
  type Task,
  type HistoryEntry,
  type ApiResponse,
  type ApiListResponse,
  type QuickFilterCounts,
} from '@longdo/contracts'
import type { FastifyInstance } from 'fastify'
import { validate } from '../errors.ts'
import type { TaskService } from '../services/task.service.ts'

/**
 * Route chỉ làm 3 việc: validate đầu vào bằng schema trong contracts, gọi service với req.user
 * (lấy từ token), bọc kết quả vào { data } (danh sách thì { data, meta }). Không có nghiệp vụ hay truy vấn ở đây.
 */
export function taskRoutes(taskService: TaskService) {
  return async (app: FastifyInstance) => {
    app.get('/cong-viec', async (req): Promise<ApiListResponse<Task>> => {
      const q = validate(TaskListQuerySchema, req.query, { dropEmpty: true })
      const { items, total } = await taskService.list(req.user, q)
      return { data: items, meta: { page: q.page, limit: q.limit, total } }
    })

    app.get('/cong-viec/dem', async (req): Promise<ApiResponse<QuickFilterCounts>> => {
      const q = validate(TaskCountQuerySchema, req.query, { dropEmpty: true })
      return { data: await taskService.countByQuickFilter(req.user, q) }
    })

    app.post('/cong-viec', async (req, reply): Promise<ApiResponse<TaskDetail>> => {
      const body = validate(CreateTaskSchema, req.body)
      reply.status(201)
      return { data: await taskService.create(req.user, body) }
    })

    app.get('/cong-viec/:id', async (req): Promise<ApiResponse<TaskDetail>> => {
      const { id } = validate(IdParamsSchema, req.params)
      return { data: await taskService.get(req.user, id) }
    })

    app.patch('/cong-viec/:id', async (req): Promise<ApiResponse<TaskDetail>> => {
      const { id } = validate(IdParamsSchema, req.params)
      const body = validate(UpdateTaskSchema, req.body)
      return { data: await taskService.update(req.user, id, body) }
    })

    app.post('/cong-viec/:id/trang-thai', async (req): Promise<ApiResponse<TaskDetail>> => {
      const { id } = validate(IdParamsSchema, req.params)
      const body = validate(ChangeStatusSchema, req.body)
      return { data: await taskService.changeStatus(req.user, id, body) }
    })

    app.post('/cong-viec/:id/tien-do', async (req): Promise<ApiResponse<TaskDetail>> => {
      const { id } = validate(IdParamsSchema, req.params)
      const body = validate(UpdateProgressSchema, req.body)
      return { data: await taskService.updateProgress(req.user, id, body) }
    })

    app.delete('/cong-viec/:id', async (req): Promise<ApiResponse<{ id: string }>> => {
      const { id } = validate(IdParamsSchema, req.params)
      return { data: await taskService.remove(req.user, id) }
    })

    app.get('/cong-viec/:id/lich-su', async (req): Promise<ApiResponse<HistoryEntry[]>> => {
      const { id } = validate(IdParamsSchema, req.params)
      return { data: await taskService.history(req.user, id) }
    })

    // Việc con
    app.post('/cong-viec/:id/viec-con', async (req, reply): Promise<ApiResponse<TaskDetail>> => {
      const { id } = validate(IdParamsSchema, req.params)
      const body = validate(AddSubtaskSchema, req.body)
      reply.status(201)
      return { data: await taskService.addSubtask(req.user, id, body) }
    })

    app.post('/cong-viec/:id/viec-con/:viecConId/danh-dau', async (req): Promise<ApiResponse<TaskDetail>> => {
      const { id, viecConId } = validate(SubtaskParamsSchema, req.params)
      const body = validate(MarkSubtaskSchema, req.body)
      return { data: await taskService.markSubtask(req.user, id, viecConId, body) }
    })

    app.delete('/cong-viec/:id/viec-con/:viecConId', async (req): Promise<ApiResponse<TaskDetail>> => {
      const { id, viecConId } = validate(SubtaskParamsSchema, req.params)
      return { data: await taskService.removeSubtask(req.user, id, viecConId) }
    })

    // Bình luận
    app.get('/cong-viec/:id/binh-luan', async (req): Promise<ApiResponse<TaskComment[]>> => {
      const { id } = validate(IdParamsSchema, req.params)
      return { data: await taskService.listComments(req.user, id) }
    })

    app.post('/cong-viec/:id/binh-luan', async (req, reply): Promise<ApiResponse<TaskComment>> => {
      const { id } = validate(IdParamsSchema, req.params)
      const body = validate(AddCommentSchema, req.body)
      reply.status(201)
      return { data: await taskService.addComment(req.user, id, body) }
    })
  }
}
