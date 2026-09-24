import jwt from '@fastify/jwt'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyServerOptions } from 'fastify'
import { batBuocDangNhap } from './plugins/auth.ts'
import { dangKyXuLyLoi } from './plugins/error-handler.ts'
import type { KhoDuLieu } from './repositories/interfaces.ts'
import { congViecRoutes } from './routes/task.routes.ts'
import { danhMucRoutes } from './routes/catalog.routes.ts'
import { xacThucRoutes } from './routes/auth.routes.ts'
import { CongViecService } from './services/task.service.ts'
import { DanhMucService } from './services/catalog.service.ts'

export type TuyChonApp = {
  kho: KhoDuLieu
  jwtSecret: string
  logger?: FastifyServerOptions['logger']
  /** Cho phép test cố định "bây giờ" để kiểm tra Quá hạn. */
  dongHo?: () => Date
}

/** Dựng app mà không listen — index.ts listen, test dùng app.inject(). */
export async function taoApp(tuyChon: TuyChonApp): Promise<FastifyInstance> {
  const app = Fastify({
    logger: tuyChon.logger ?? false,
    // Lỗi Fastify tự trả trước khi tới route (URL mã hóa sai, tham số quá dài) cũng theo dạng { error }.
    frameworkErrors: (err, _req, res) => {
      const quaDai = err.code === 'FST_ERR_MAX_PARAM_LENGTH'
      const reply = res as unknown as FastifyReply
      void reply.status(quaDai ? 404 : 400).send({
        error: { code: quaDai ? 'KHONG_TIM_THAY' : 'VALIDATION', message: 'Đường dẫn không hợp lệ' },
      })
    },
  })
  dangKyXuLyLoi(app)
  // Token bắt buộc có hạn dùng (exp) và đúng thuật toán, tránh token "sống mãi" hoặc đổi thuật toán.
  await app.register(jwt, {
    secret: tuyChon.jwtSecret,
    sign: { algorithm: 'HS256', expiresIn: '12h' },
    verify: { algorithms: ['HS256'], requiredClaims: ['exp'] },
  })

  const congViec = new CongViecService(tuyChon.kho, tuyChon.dongHo)
  const danhMuc = new DanhMucService(tuyChon.kho)

  app.get('/api/suc-khoe', async () => ({ data: { ok: true } }))

  // Công khai: chỉ phục vụ màn chọn "Đang đăng nhập là ai".
  await app.register(xacThucRoutes(danhMuc), { prefix: '/api' })

  // Mọi route còn lại bắt buộc có token.
  await app.register(
    async (api) => {
      api.addHook('onRequest', batBuocDangNhap)
      await api.register(danhMucRoutes(danhMuc))
      await api.register(congViecRoutes(congViec))
    },
    { prefix: '/api' },
  )

  return app
}
