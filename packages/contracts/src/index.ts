import { z } from 'zod'

// Mọi thông báo lỗi mặc định của Zod (sai kiểu, thiếu trường...) bằng tiếng Việt, dùng chung API và web.
z.config(z.locales.vi())

export * from './common.ts'
export * from './employee.ts'
export * from './project.ts'
export * from './auth.ts'
export * from './task.ts'
