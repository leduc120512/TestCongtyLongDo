import { z } from 'zod'

export const NhanVienSchema = z.object({
  id: z.string(),
  ten: z.string(),
  chucVu: z.string(),
  congTyId: z.string(),
})
export type NhanVien = z.infer<typeof NhanVienSchema>
