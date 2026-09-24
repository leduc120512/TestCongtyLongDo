import { z } from 'zod'

/** Ngày lịch (không có giờ), theo giờ Việt Nam, dạng YYYY-MM-DD. */
export const CalendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s)
  }, 'Ngày không hợp lệ')

/** Id dạng ObjectId (24 ký tự hex), chuẩn hóa chữ thường để so sánh chuỗi luôn đúng. */
export const IdSchema = z
  .string({ error: 'Thiếu id' })
  .trim()
  .toLowerCase()
  .regex(/^[0-9a-f]{24}$/, 'Id không hợp lệ')

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int('Trang phải là số nguyên').min(1, 'Trang nhỏ nhất là 1').default(1),
  limit: z.coerce
    .number()
    .int('Số dòng phải là số nguyên')
    .min(1, 'Số dòng nhỏ nhất là 1')
    .max(100, 'Số dòng tối đa là 100')
    .default(20),
})
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>

/** Mã lỗi thống nhất trả về trong { error: { code, message } }. */
export const ERROR_CODES = [
  'VALIDATION',
  'KHONG_DANG_NHAP',
  'KHONG_CO_QUYEN',
  'KHONG_TIM_THAY',
  'TRANG_THAI_KHONG_HOP_LE',
  'TRUNG_MA',
  'XUNG_DOT',
  'LOI_HE_THONG',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export type ApiResponse<T> = { data: T }
export type ApiListResponse<T> = {
  data: T[]
  meta: { page: number; limit: number; total: number }
}
export type ApiErrorResponse = { error: { code: ErrorCode; message: string } }
