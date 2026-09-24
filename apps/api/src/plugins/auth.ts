import { NguoiDungSchema, type NguoiDung } from '@longdo/contracts'
import type { FastifyRequest } from 'fastify'
import { LoiNghiepVu } from '../errors.ts'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: NguoiDung
    user: NguoiDung
  }
}

/**
 * Hook onRequest cho mọi route cần đăng nhập. Sau hook này request.user là { userId, congTyId }
 * đã kiểm tra chữ ký và đúng dạng — nguồn duy nhất cho danh tính và công ty của người gọi.
 */
export async function batBuocDangNhap(req: FastifyRequest): Promise<void> {
  try {
    await req.jwtVerify()
  } catch {
    throw new LoiNghiepVu('KHONG_DANG_NHAP', 'Chưa đăng nhập hoặc phiên đăng nhập đã hết hạn')
  }
  const kq = NguoiDungSchema.safeParse(req.user)
  if (!kq.success) throw new LoiNghiepVu('KHONG_DANG_NHAP', 'Token không hợp lệ')
  req.user = kq.data
}
