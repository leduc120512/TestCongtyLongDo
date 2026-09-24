import { z } from 'zod'

export const DuAnSchema = z.object({
  id: z.string(),
  ma: z.string(),
  ten: z.string(),
  congTyId: z.string(),
})
export type DuAn = z.infer<typeof DuAnSchema>
