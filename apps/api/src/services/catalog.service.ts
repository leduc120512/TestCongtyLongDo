import type { Project, AuthUser, Employee } from '@longdo/contracts'
import { DomainError } from '../errors.ts'
import type { DataStore } from '../repositories/interfaces.ts'

/** Danh mục nhân viên, dự án và đăng nhập giả lập. */
export class CatalogService {
  private readonly store: DataStore

  constructor(store: DataStore) {
    this.store = store
  }

  employees(user: AuthUser): Promise<Employee[]> {
    return this.store.employees.list(user.congTyId)
  }

  projects(user: AuthUser): Promise<Project[]> {
    return this.store.projects.list(user.congTyId)
  }

  /** Danh sách để chọn "Đang đăng nhập là ai" — chỉ phục vụ bản demo; production tắt route (xem app.ts). */
  mockUsers(): Promise<Employee[]> {
    return this.store.employees.listForMockLogin()
  }

  /** congTyId trong token lấy từ bản ghi nhân viên, không lấy từ client. */
  async mockLogin(userId: string): Promise<{ employee: Employee; payload: AuthUser }> {
    const employee = await this.store.employees.findById(userId)
    if (!employee) throw new DomainError('KHONG_TIM_THAY', 'Không tìm thấy nhân viên')
    return { employee: employee, payload: { userId: employee.id, congTyId: employee.congTyId } }
  }
}
