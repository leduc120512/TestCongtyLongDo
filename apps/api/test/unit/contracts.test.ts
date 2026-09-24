import {
  UpdateProgressSchema,
  TaskListQuerySchema,
  NO_PROJECT,
  IdSchema,
  CalendarDateSchema,
  UpdateTaskSchema,
  CreateTaskSchema,
} from '@longdo/contracts'
import { describe, expect, it } from 'vitest'

const ID = '66e000000000000000000003'

describe('schema dùng chung (contracts)', () => {
  it('PATCH không tự điền giá trị mặc định cho trường không gửi (Zod 4 .partial() vẫn chạy .default)', () => {
    expect(UpdateTaskSchema.parse({})).toEqual({})
    expect(UpdateTaskSchema.parse({ ten: 'x' })).toEqual({ ten: 'x' })
    expect(UpdateTaskSchema.parse({ hetHan: null })).toEqual({ hetHan: null })
  })

  it('POST vẫn có mặc định: không theo dõi ai, ưu tiên bình thường', () => {
    expect(CreateTaskSchema.parse({ ten: 'x', nguoiThucHienIds: [ID] })).toMatchObject({
      nguoiTheoDoiIds: [],
      uuTien: 'BINH_THUONG',
    })
  })

  it('tạo: bắt buộc tên và ít nhất một người thực hiện, lỗi tiếng Việt', () => {
    const result = CreateTaskSchema.safeParse({ ten: '   ', nguoiThucHienIds: [] })
    expect(result.success).toBe(false)
    expect(result.error!.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining(['Tên công việc không được để trống', 'Cần ít nhất một người thực hiện']),
    )
  })

  it('hạn không được trước ngày bắt đầu (cùng ngày thì được)', () => {
    const invalid = CreateTaskSchema.safeParse({ ten: 'x', nguoiThucHienIds: [ID], batDau: '2026-06-10', hetHan: '2026-06-09' })
    expect(invalid.error!.issues[0]).toMatchObject({ path: ['hetHan'], message: 'Hạn không được trước ngày bắt đầu' })
    expect(CreateTaskSchema.safeParse({ ten: 'x', nguoiThucHienIds: [ID], batDau: '2026-06-10', hetHan: '2026-06-10' }).success).toBe(true)
  })

  it('ngày phải là ngày có thật dạng YYYY-MM-DD', () => {
    for (const invalid of ['2026-02-30', '2026-13-01', '10/06/2026', '2026-6-1', '']) {
      expect(CalendarDateSchema.safeParse(invalid).success, invalid).toBe(false)
    }
    expect(CalendarDateSchema.safeParse('2028-02-29').success).toBe(true)
  })

  it('tiến độ chỉ nhận số nguyên 0..100, không ép kiểu', () => {
    for (const invalid of [null, '', '50', true, [50], 50.5, -1, 101]) {
      expect(UpdateProgressSchema.safeParse({ tienDo: invalid }).success, JSON.stringify(invalid)).toBe(false)
    }
    expect(UpdateProgressSchema.parse({ tienDo: 0 })).toEqual({ tienDo: 0 })
    expect(UpdateProgressSchema.parse({ tienDo: 100 })).toEqual({ tienDo: 100 })
  })

  it('id chuẩn hóa chữ thường và phải đúng dạng ObjectId', () => {
    expect(IdSchema.parse(` ${ID.toUpperCase()} `)).toBe(ID)
    expect(IdSchema.safeParse('abc').success).toBe(false)
    expect(IdSchema.safeParse({ $ne: null }).success).toBe(false)
  })

  it('query danh sách: mặc định hợp lý, lọc dự án nhận id hoặc "Việc chung"', () => {
    expect(TaskListQuerySchema.parse({})).toEqual({ page: 1, limit: 20, nhanh: 'TAT_CA', sapXep: 'hetHan_asc' })
    expect(TaskListQuerySchema.parse({ duAnId: 'chung' }).duAnId).toBe(NO_PROJECT)
    expect(TaskListQuerySchema.parse({ duAnId: ID.toUpperCase() }).duAnId).toBe(ID)
    expect(TaskListQuerySchema.safeParse({ duAnId: 'xyz' }).success).toBe(false)
    expect(TaskListQuerySchema.safeParse({ limit: 101 }).success).toBe(false)
    expect(TaskListQuerySchema.safeParse({ q: 'a'.repeat(101) }).success).toBe(false)
  })

  it('thông báo mặc định của Zod đã là tiếng Việt', () => {
    const result = UpdateTaskSchema.safeParse('không phải object')
    expect(result.error!.issues[0]!.message).not.toMatch(/Invalid input|expected/)
  })
})
