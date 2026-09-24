import { MockLoginSchema, type LoginResult, type Employee, type ApiResponse } from '@longdo/contracts'
import type { FastifyInstance } from 'fastify'
import { validate } from '../errors.ts'
import type { CatalogService } from '../services/catalog.service.ts'

/** Route công khai: đăng nhập giả lập (chọn "Đang đăng nhập là ai"). */
export function authRoutes(catalogService: CatalogService) {
  return async (app: FastifyInstance) => {
    app.get('/xac-thuc/nguoi-dung-gia-lap', async (): Promise<ApiResponse<Employee[]>> => {
      return { data: await catalogService.mockUsers() }
    })

    app.post('/xac-thuc/dang-nhap-gia-lap', async (req): Promise<ApiResponse<LoginResult>> => {
      const body = validate(MockLoginSchema, req.body)
      const { employee, payload } = await catalogService.mockLogin(body.userId)
      const token = app.jwt.sign(payload)
      return { data: { token, nhanVien: employee } }
    })
  }
}
