import jwt from '@fastify/jwt'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyServerOptions } from 'fastify'
import { requireAuth } from './plugins/auth.ts'
import { registerErrorHandler } from './plugins/error-handler.ts'
import type { DataStore } from './repositories/interfaces.ts'
import { taskRoutes } from './routes/task.routes.ts'
import { catalogRoutes } from './routes/catalog.routes.ts'
import { authRoutes } from './routes/auth.routes.ts'
import { TaskService } from './services/task.service.ts'
import { CatalogService } from './services/catalog.service.ts'

export type AppOptions = {
  store: DataStore
  jwtSecret: string
  /**
   * Bật route đăng nhập giả lập (ô chọn "Đang đăng nhập là ai"). Route này cấp token cho bất kỳ
   * nhân viên nào và liệt kê nhân viên mọi công ty, nên chỉ dùng cho dev/demo, không bật ở production.
   */
  mockLogin: boolean
  logger?: FastifyServerOptions['logger']
  /** Cho phép test cố định "bây giờ" để kiểm tra Quá hạn. */
  clock?: () => Date
}

/** Dựng app mà không listen — index.ts listen, test dùng app.inject(). */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    // Lỗi Fastify tự trả trước khi tới route (URL mã hóa sai, tham số quá dài) cũng theo dạng { error }.
    frameworkErrors: (err, _req, res) => {
      const tooLong = err.code === 'FST_ERR_MAX_PARAM_LENGTH'
      const reply = res as unknown as FastifyReply
      void reply.status(tooLong ? 404 : 400).send({
        error: { code: tooLong ? 'KHONG_TIM_THAY' : 'VALIDATION', message: 'Đường dẫn không hợp lệ' },
      })
    },
  })
  registerErrorHandler(app)
  // Token bắt buộc có hạn dùng (exp) và đúng thuật toán, tránh token "sống mãi" hoặc đổi thuật toán.
  await app.register(jwt, {
    secret: options.jwtSecret,
    sign: { algorithm: 'HS256', expiresIn: '12h' },
    verify: { algorithms: ['HS256'], requiredClaims: ['exp'] },
  })

  const taskService = new TaskService(options.store, options.clock)
  const catalogService = new CatalogService(options.store)

  app.get('/api/suc-khoe', async () => ({ data: { ok: true } }))

  // Công khai: chỉ phục vụ màn chọn "Đang đăng nhập là ai". Tắt thì các route này trả 404.
  if (options.mockLogin) await app.register(authRoutes(catalogService), { prefix: '/api' })

  // Mọi route còn lại bắt buộc có token.
  await app.register(
    async (api) => {
      api.addHook('onRequest', requireAuth)
      await api.register(catalogRoutes(catalogService))
      await api.register(taskRoutes(taskService))
    },
    { prefix: '/api' },
  )

  return app
}
