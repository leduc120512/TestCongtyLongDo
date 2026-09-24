import type { MaLoi, PhanHoiLoi } from '@longdo/contracts'
import type { FastifyError, FastifyInstance } from 'fastify'
import { LoiNghiepVu } from '../errors.ts'

function loi(code: MaLoi, message: string): PhanHoiLoi {
  return { error: { code, message } }
}

/** Mọi lỗi đều ra dạng { error: { code, message } }, thông báo tiếng Việt. */
export function dangKyXuLyLoi(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof LoiNghiepVu) {
      return reply.status(err.httpStatus).send(loi(err.code, err.message))
    }
    const status = err.statusCode ?? 500
    if (status === 401) return reply.status(401).send(loi('KHONG_DANG_NHAP', 'Chưa đăng nhập'))
    if (status >= 400 && status < 500) {
      // Lỗi từ Fastify: JSON sai cú pháp, body rỗng, content-type không hỗ trợ, body quá lớn...
      const message =
        err.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || err instanceof SyntaxError
          ? 'Dữ liệu gửi lên không đúng định dạng JSON'
          : err.code === 'FST_ERR_CTP_EMPTY_JSON_BODY'
            ? 'Thiếu dữ liệu gửi lên'
            : err.code === 'FST_ERR_CTP_BODY_TOO_LARGE'
              ? 'Dữ liệu gửi lên quá lớn'
              : 'Yêu cầu không hợp lệ'
      return reply.status(status).send(loi('VALIDATION', message))
    }
    req.log.error({ err }, 'Lỗi không mong đợi')
    return reply.status(500).send(loi('LOI_HE_THONG', 'Lỗi hệ thống, vui lòng thử lại sau'))
  })

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send(loi('KHONG_TIM_THAY', 'Không tìm thấy đường dẫn'))
  })
}
