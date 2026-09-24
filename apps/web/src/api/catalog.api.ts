import type { Project, LoginResult, Employee, ApiResponse } from '@longdo/contracts'
import { callApi } from './http'

export const catalogApi = {
  employees: async () => (await callApi<ApiResponse<Employee[]>>('/nhan-vien')).data,
  projects: async () => (await callApi<ApiResponse<Project[]>>('/du-an')).data,
}

export const authApi = {
  mockUsers: async () => (await callApi<ApiResponse<Employee[]>>('/xac-thuc/nguoi-dung-gia-lap')).data,
  mockLogin: async (userId: string) =>
    (await callApi<ApiResponse<LoginResult>>('/xac-thuc/dang-nhap-gia-lap', { method: 'POST', body: { userId } })).data,
}
