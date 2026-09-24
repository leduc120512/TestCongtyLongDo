import {
  CapNhatTienDoSchema,
  ChuyenTrangThaiSchema,
  DanhDauViecConSchema,
  ThemViecConSchema,
  VietBinhLuanSchema,
  type BinhLuan,
  DanhSachCongViecQuerySchema,
  DemCongViecQuerySchema,
  ThamSoIdSchema,
  ThamSoViecConSchema,
  SuaCongViecSchema,
  TaoCongViecSchema,
  type ChiTietCongViec,
  type CongViec,
  type LichSu,
  type PhanHoi,
  type PhanHoiDanhSach,
  type ThongKeNhanh,
} from '@longdo/contracts'
import type { FastifyInstance } from 'fastify'
import { kiemTra } from '../errors.ts'
import type { CongViecService } from '../services/task.service.ts'


/**
 * Route chỉ làm 3 việc: validate đầu vào bằng schema trong contracts, gọi service với req.user
 * (lấy từ token), bọc kết quả vào { data }. Không có nghiệp vụ hay truy vấn ở đây.
 */
export function congViecRoutes(congViec: CongViecService) {
  return async (app: FastifyInstance) => {
    app.get('/cong-viec', async (req): Promise<PhanHoiDanhSach<CongViec>> => {
      const q = kiemTra(DanhSachCongViecQuerySchema, req.query, { boRong: true })
      return congViec.danhSach(req.user, q)
    })

    app.get('/cong-viec/dem', async (req): Promise<PhanHoi<ThongKeNhanh>> => {
      const q = kiemTra(DemCongViecQuerySchema, req.query, { boRong: true })
      return { data: await congViec.demLocNhanh(req.user, q) }
    })

    app.post('/cong-viec', async (req, reply): Promise<PhanHoi<ChiTietCongViec>> => {
      const body = kiemTra(TaoCongViecSchema, req.body)
      reply.status(201)
      return { data: await congViec.tao(req.user, body) }
    })

    app.get('/cong-viec/:id', async (req): Promise<PhanHoi<ChiTietCongViec>> => {
      const { id } = kiemTra(ThamSoIdSchema, req.params)
      return { data: await congViec.chiTiet(req.user, id) }
    })

    app.patch('/cong-viec/:id', async (req): Promise<PhanHoi<ChiTietCongViec>> => {
      const { id } = kiemTra(ThamSoIdSchema, req.params)
      const body = kiemTra(SuaCongViecSchema, req.body)
      return { data: await congViec.sua(req.user, id, body) }
    })

    app.post('/cong-viec/:id/trang-thai', async (req): Promise<PhanHoi<ChiTietCongViec>> => {
      const { id } = kiemTra(ThamSoIdSchema, req.params)
      const body = kiemTra(ChuyenTrangThaiSchema, req.body)
      return { data: await congViec.chuyenTrangThai(req.user, id, body) }
    })

    app.post('/cong-viec/:id/tien-do', async (req): Promise<PhanHoi<ChiTietCongViec>> => {
      const { id } = kiemTra(ThamSoIdSchema, req.params)
      const body = kiemTra(CapNhatTienDoSchema, req.body)
      return { data: await congViec.capNhatTienDo(req.user, id, body) }
    })

    app.delete('/cong-viec/:id', async (req): Promise<PhanHoi<{ id: string }>> => {
      const { id } = kiemTra(ThamSoIdSchema, req.params)
      return { data: await congViec.xoa(req.user, id) }
    })

    app.get('/cong-viec/:id/lich-su', async (req): Promise<PhanHoi<LichSu[]>> => {
      const { id } = kiemTra(ThamSoIdSchema, req.params)
      return { data: await congViec.lichSu(req.user, id) }
    })

    // Việc con
    app.post('/cong-viec/:id/viec-con', async (req, reply): Promise<PhanHoi<ChiTietCongViec>> => {
      const { id } = kiemTra(ThamSoIdSchema, req.params)
      const body = kiemTra(ThemViecConSchema, req.body)
      reply.status(201)
      return { data: await congViec.themViecCon(req.user, id, body) }
    })

    app.post('/cong-viec/:id/viec-con/:viecConId/danh-dau', async (req): Promise<PhanHoi<ChiTietCongViec>> => {
      const { id, viecConId } = kiemTra(ThamSoViecConSchema, req.params)
      const body = kiemTra(DanhDauViecConSchema, req.body)
      return { data: await congViec.danhDauViecCon(req.user, id, viecConId, body) }
    })

    app.delete('/cong-viec/:id/viec-con/:viecConId', async (req): Promise<PhanHoi<ChiTietCongViec>> => {
      const { id, viecConId } = kiemTra(ThamSoViecConSchema, req.params)
      return { data: await congViec.xoaViecCon(req.user, id, viecConId) }
    })

    // Bình luận
    app.get('/cong-viec/:id/binh-luan', async (req): Promise<PhanHoi<BinhLuan[]>> => {
      const { id } = kiemTra(ThamSoIdSchema, req.params)
      return { data: await congViec.danhSachBinhLuan(req.user, id) }
    })

    app.post('/cong-viec/:id/binh-luan', async (req, reply): Promise<PhanHoi<BinhLuan>> => {
      const { id } = kiemTra(ThamSoIdSchema, req.params)
      const body = kiemTra(VietBinhLuanSchema, req.body)
      reply.status(201)
      return { data: await congViec.vietBinhLuan(req.user, id, body) }
    })
  }
}
