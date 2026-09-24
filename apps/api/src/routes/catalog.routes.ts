import type { Project, Employee, ApiResponse } from '@longdo/contracts'
import type { FastifyInstance } from 'fastify'
import type { CatalogService } from '../services/catalog.service.ts'

/** Danh mục trong công ty của người đang đăng nhập (congTyId lấy từ token). */
export function catalogRoutes(catalogService: CatalogService) {
  return async (app: FastifyInstance) => {
    app.get('/nhan-vien', async (req): Promise<ApiResponse<Employee[]>> => {
      return { data: await catalogService.employees(req.user) }
    })

    app.get('/du-an', async (req): Promise<ApiResponse<Project[]>> => {
      return { data: await catalogService.projects(req.user) }
    })
  }
}
