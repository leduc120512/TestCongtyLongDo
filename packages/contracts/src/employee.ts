import { z } from 'zod'

export const EmployeeSchema = z.object({
  id: z.string(),
  ten: z.string(),
  chucVu: z.string(),
  congTyId: z.string(),
})
export type Employee = z.infer<typeof EmployeeSchema>
