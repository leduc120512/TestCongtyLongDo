import type { DuAn, NhanVien, PhanHoi } from '@longdo/contracts'
import type { FastifyInstance } from 'fastify'
import type { DanhMucService } from '../services/danh-muc.service.ts'

/** Danh mục trong công ty của người đang đăng nhập (congTyId lấy từ token). */
export function danhMucRoutes(danhMuc: DanhMucService) {
  return async (app: FastifyInstance) => {
    app.get('/nhan-vien', async (req): Promise<PhanHoi<NhanVien[]>> => {
      return { data: await danhMuc.nhanVien(req.user) }
    })

    app.get('/du-an', async (req): Promise<PhanHoi<DuAn[]>> => {
      return { data: await danhMuc.duAn(req.user) }
    })
  }
}
