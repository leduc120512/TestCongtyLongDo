import { AuthUserSchema, type AuthUser } from '@longdo/contracts'
import type { FastifyRequest } from 'fastify'
import { DomainError } from '../errors.ts'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser
    user: AuthUser
  }
}

/**
 * Hook onRequest cho mọi route cần đăng nhập. Sau hook này request.user là { userId, congTyId }
 * đã kiểm tra chữ ký và đúng dạng — nguồn duy nhất cho danh tính và công ty của người gọi.
 */
export async function requireAuth(req: FastifyRequest): Promise<void> {
  try {
    await req.jwtVerify()
  } catch {
    throw new DomainError('KHONG_DANG_NHAP', 'Chưa đăng nhập hoặc phiên đăng nhập đã hết hạn')
  }
  const result = AuthUserSchema.safeParse(req.user)
  if (!result.success) throw new DomainError('KHONG_DANG_NHAP', 'Token không hợp lệ')
  req.user = result.data
}
