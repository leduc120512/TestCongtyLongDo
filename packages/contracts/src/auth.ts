import { z } from 'zod'
import { IdSchema } from './common.ts'
import { EmployeeSchema } from './employee.ts'

/** Payload của JWT giả lập. userId và congTyId luôn lấy từ token, không tin client. */
export const AuthUserSchema = z.object({
  userId: IdSchema,
  congTyId: IdSchema,
})
export type AuthUser = z.infer<typeof AuthUserSchema>

export const MockLoginSchema = z.object({
  userId: IdSchema,
})
export type MockLoginBody = z.infer<typeof MockLoginSchema>

export const LoginResultSchema = z.object({
  token: z.string(),
  nhanVien: EmployeeSchema,
})
export type LoginResult = z.infer<typeof LoginResultSchema>
