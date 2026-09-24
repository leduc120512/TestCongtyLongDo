import { DangNhapGiaLapSchema, type KetQuaDangNhap, type NhanVien, type PhanHoi } from '@longdo/contracts'
import type { FastifyInstance } from 'fastify'
import { kiemTra } from '../errors.ts'
import type { DanhMucService } from '../services/catalog.service.ts'

/** Route công khai: đăng nhập giả lập (chọn "Đang đăng nhập là ai"). */
export function xacThucRoutes(danhMuc: DanhMucService) {
  return async (app: FastifyInstance) => {
    app.get('/xac-thuc/nguoi-dung-gia-lap', async (): Promise<PhanHoi<NhanVien[]>> => {
      return { data: await danhMuc.nguoiDungGiaLap() }
    })

    app.post('/xac-thuc/dang-nhap-gia-lap', async (req): Promise<PhanHoi<KetQuaDangNhap>> => {
      const body = kiemTra(DangNhapGiaLapSchema, req.body)
      const { nhanVien, payload } = await danhMuc.dangNhapGiaLap(body.userId)
      const token = app.jwt.sign(payload)
      return { data: { token, nhanVien } }
    })
  }
}
