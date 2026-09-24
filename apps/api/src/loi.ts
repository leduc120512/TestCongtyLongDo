import type { MaLoi } from '@longdo/contracts'
import type { z } from 'zod'

const MA_HTTP: Record<MaLoi, number> = {
  VALIDATION: 400,
  KHONG_DANG_NHAP: 401,
  KHONG_CO_QUYEN: 403,
  KHONG_TIM_THAY: 404,
  TRANG_THAI_KHONG_HOP_LE: 409,
  TRUNG_MA: 409,
  XUNG_DOT: 409,
  LOI_HE_THONG: 500,
}

/** Lỗi nghiệp vụ có mã; error handler đổi thành { error: { code, message } }. */
export class LoiNghiepVu extends Error {
  constructor(
    public readonly code: MaLoi,
    message: string,
  ) {
    super(message)
    this.name = 'LoiNghiepVu'
  }

  get httpStatus(): number {
    return MA_HTTP[this.code]
  }
}

/** Bỏ các khóa có giá trị chuỗi rỗng trong query string (web gửi "" khi không chọn gì). */
function boChuoiRong(duLieu: unknown): unknown {
  if (!duLieu || typeof duLieu !== 'object' || Array.isArray(duLieu)) return duLieu
  const kq: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(duLieu as Record<string, unknown>)) {
    if (v !== '') kq[k] = v
  }
  return kq
}

/** Validate bằng Zod; sai thì ném LoiNghiepVu VALIDATION với thông báo tiếng Việt. */
export function kiemTra<S extends z.ZodType>(schema: S, duLieu: unknown, tuyChon?: { boRong?: boolean }): z.output<S> {
  const kq = schema.safeParse(tuyChon?.boRong ? boChuoiRong(duLieu) : duLieu)
  if (!kq.success) {
    const thongBao = kq.error.issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ')
    throw new LoiNghiepVu('VALIDATION', thongBao)
  }
  return kq.data
}
