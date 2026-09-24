import { z } from 'zod'
import { IdSchema } from './common.ts'
import { NhanVienSchema } from './employee.ts'

/** Payload của JWT giả lập. userId và congTyId luôn lấy từ token, không tin client. */
export const NguoiDungSchema = z.object({
  userId: IdSchema,
  congTyId: IdSchema,
})
export type NguoiDung = z.infer<typeof NguoiDungSchema>

export const DangNhapGiaLapSchema = z.object({
  userId: IdSchema,
})
export type DangNhapGiaLap = z.infer<typeof DangNhapGiaLapSchema>

export const KetQuaDangNhapSchema = z.object({
  token: z.string(),
  nhanVien: NhanVienSchema,
})
export type KetQuaDangNhap = z.infer<typeof KetQuaDangNhapSchema>
