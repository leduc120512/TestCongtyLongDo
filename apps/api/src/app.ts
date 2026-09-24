import jwt from '@fastify/jwt'
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import { batBuocDangNhap } from './plugins/xac-thuc'
import { dangKyXuLyLoi } from './plugins/xu-ly-loi'
import type { KhoDuLieu } from './repositories/giao-dien'
import { congViecRoutes } from './routes/cong-viec.routes'
import { danhMucRoutes } from './routes/danh-muc.routes'
import { xacThucRoutes } from './routes/xac-thuc.routes'
import { CongViecService } from './services/cong-viec.service'
import { DanhMucService } from './services/danh-muc.service'

export type TuyChonApp = {
  kho: KhoDuLieu
  jwtSecret: string
  logger?: FastifyServerOptions['logger']
  /** Cho phép test cố định "bây giờ" để kiểm tra Quá hạn. */
  dongHo?: () => Date
}

/** Dựng app mà không listen — index.ts listen, test dùng app.inject(). */
export async function taoApp(tuyChon: TuyChonApp): Promise<FastifyInstance> {
  const app = Fastify({ logger: tuyChon.logger ?? false })
  dangKyXuLyLoi(app)
  await app.register(jwt, { secret: tuyChon.jwtSecret })

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
