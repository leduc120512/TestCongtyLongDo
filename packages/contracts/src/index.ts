import { z } from 'zod'

// Mọi thông báo lỗi mặc định của Zod (sai kiểu, thiếu trường...) bằng tiếng Việt, dùng chung API và web.
z.config(z.locales.vi())

export * from './chung.ts'
export * from './nhan-vien.ts'
export * from './du-an.ts'
export * from './xac-thuc.ts'
export * from './cong-viec.ts'
