import { z } from 'zod'

export const ProjectSchema = z.object({
  id: z.string(),
  ma: z.string(),
  ten: z.string(),
  congTyId: z.string(),
})
export type Project = z.infer<typeof ProjectSchema>
