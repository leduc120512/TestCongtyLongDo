import type { ErrorCode } from '@longdo/contracts'
import type { z } from 'zod'

const HTTP_STATUS: Record<ErrorCode, number> = {
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
export class DomainError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code]
  }
}

/** Bỏ các khóa có giá trị chuỗi rỗng trong query string (web gửi "" khi không chọn gì). */
function dropEmptyStrings(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (v !== '') result[k] = v
  }
  return result
}

/** Validate bằng Zod; sai thì ném DomainError VALIDATION với thông báo tiếng Việt. */
export function validate<S extends z.ZodType>(schema: S, data: unknown, options?: { dropEmpty?: boolean }): z.output<S> {
  const result = schema.safeParse(options?.dropEmpty ? dropEmptyStrings(data) : data)
  if (!result.success) {
    const message = result.error.issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ')
    throw new DomainError('VALIDATION', message)
  }
  return result.data
}
