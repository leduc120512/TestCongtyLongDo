import {
  CapNhatTienDoSchema,
  DanhSachCongViecQuerySchema,
  DU_AN_CHUNG,
  IdSchema,
  NgaySchema,
  SuaCongViecSchema,
  TaoCongViecSchema,
} from '@longdo/contracts'
import { describe, expect, it } from 'vitest'

const ID = '66e000000000000000000003'

describe('schema dùng chung (contracts)', () => {
  it('PATCH không tự điền giá trị mặc định cho trường không gửi (Zod 4 .partial() vẫn chạy .default)', () => {
    expect(SuaCongViecSchema.parse({})).toEqual({})
    expect(SuaCongViecSchema.parse({ ten: 'x' })).toEqual({ ten: 'x' })
    expect(SuaCongViecSchema.parse({ hetHan: null })).toEqual({ hetHan: null })
  })

  it('POST vẫn có mặc định: không theo dõi ai, ưu tiên bình thường', () => {
    expect(TaoCongViecSchema.parse({ ten: 'x', nguoiThucHienIds: [ID] })).toMatchObject({
      nguoiTheoDoiIds: [],
      uuTien: 'BINH_THUONG',
    })
  })

  it('tạo: bắt buộc tên và ít nhất một người thực hiện, lỗi tiếng Việt', () => {
    const kq = TaoCongViecSchema.safeParse({ ten: '   ', nguoiThucHienIds: [] })
    expect(kq.success).toBe(false)
    expect(kq.error!.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining(['Tên công việc không được để trống', 'Cần ít nhất một người thực hiện']),
    )
  })

  it('hạn không được trước ngày bắt đầu (cùng ngày thì được)', () => {
    const sai = TaoCongViecSchema.safeParse({ ten: 'x', nguoiThucHienIds: [ID], batDau: '2026-06-10', hetHan: '2026-06-09' })
    expect(sai.error!.issues[0]).toMatchObject({ path: ['hetHan'], message: 'Hạn không được trước ngày bắt đầu' })
    expect(TaoCongViecSchema.safeParse({ ten: 'x', nguoiThucHienIds: [ID], batDau: '2026-06-10', hetHan: '2026-06-10' }).success).toBe(true)
  })

  it('ngày phải là ngày có thật dạng YYYY-MM-DD', () => {
    for (const sai of ['2026-02-30', '2026-13-01', '10/06/2026', '2026-6-1', '']) {
      expect(NgaySchema.safeParse(sai).success, sai).toBe(false)
    }
    expect(NgaySchema.safeParse('2028-02-29').success).toBe(true)
  })

  it('tiến độ chỉ nhận số nguyên 0..100, không ép kiểu', () => {
    for (const sai of [null, '', '50', true, [50], 50.5, -1, 101]) {
      expect(CapNhatTienDoSchema.safeParse({ tienDo: sai }).success, JSON.stringify(sai)).toBe(false)
    }
    expect(CapNhatTienDoSchema.parse({ tienDo: 0 })).toEqual({ tienDo: 0 })
    expect(CapNhatTienDoSchema.parse({ tienDo: 100 })).toEqual({ tienDo: 100 })
  })

  it('id chuẩn hóa chữ thường và phải đúng dạng ObjectId', () => {
    expect(IdSchema.parse(` ${ID.toUpperCase()} `)).toBe(ID)
    expect(IdSchema.safeParse('abc').success).toBe(false)
    expect(IdSchema.safeParse({ $ne: null }).success).toBe(false)
  })

  it('query danh sách: mặc định hợp lý, lọc dự án nhận id hoặc "Việc chung"', () => {
    expect(DanhSachCongViecQuerySchema.parse({})).toEqual({ page: 1, limit: 20, nhanh: 'TAT_CA', sapXep: 'hetHan_asc' })
    expect(DanhSachCongViecQuerySchema.parse({ duAnId: 'chung' }).duAnId).toBe(DU_AN_CHUNG)
    expect(DanhSachCongViecQuerySchema.parse({ duAnId: ID.toUpperCase() }).duAnId).toBe(ID)
    expect(DanhSachCongViecQuerySchema.safeParse({ duAnId: 'xyz' }).success).toBe(false)
    expect(DanhSachCongViecQuerySchema.safeParse({ limit: 101 }).success).toBe(false)
    expect(DanhSachCongViecQuerySchema.safeParse({ q: 'a'.repeat(101) }).success).toBe(false)
  })

  it('thông báo mặc định của Zod đã là tiếng Việt', () => {
    const kq = SuaCongViecSchema.safeParse('không phải object')
    expect(kq.error!.issues[0]!.message).not.toMatch(/Invalid input|expected/)
  })
})
