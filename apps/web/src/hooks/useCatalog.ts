import type { Project, Employee } from '@longdo/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { catalogApi, authApi } from '../api/catalog.api'
import { setSession, useSession } from '../auth/session'

// Danh mục ít đổi: giữ lâu trong cache.
const CATALOG_STALE_TIME = 5 * 60_000

export function useEmployees() {
  const session = useSession()
  return useQuery({
    queryKey: ['employees', session?.nhanVien.congTyId],
    queryFn: catalogApi.employees,
    enabled: !!session,
    staleTime: CATALOG_STALE_TIME,
  })
}

export function useProjects() {
  const session = useSession()
  return useQuery({
    queryKey: ['projects', session?.nhanVien.congTyId],
    queryFn: catalogApi.projects,
    enabled: !!session,
    staleTime: CATALOG_STALE_TIME,
  })
}

/** Tra tên theo id, dùng khi hiển thị danh sách người, dự án, lịch sử. */
export function useLookup() {
  const employeesQuery = useEmployees()
  const projectsQuery = useProjects()
  const employees = employeesQuery.data
  const projects = projectsQuery.data
  const error = employeesQuery.error ?? projectsQuery.error
  const { refetch: refetchEmployees } = employeesQuery
  const { refetch: refetchProjects } = projectsQuery
  return useMemo(() => {
    const employeeById = new Map<string, Employee>((employees ?? []).map((x) => [x.id, x]))
    const projectById = new Map<string, Project>((projects ?? []).map((x) => [x.id, x]))
    const loading = !employees || !projects
    return {
      employeeName: (id: string) => employeeById.get(id)?.ten ?? (loading ? '…' : '(không rõ)'),
      projectName: (id?: string | null) => (id ? (projectById.get(id)?.ten ?? (loading ? '…' : '(không rõ)')) : 'Việc chung'),
      /** Lỗi tải danh mục nhân viên/dự án (null nếu không lỗi). */
      error,
      retry: () => {
        void refetchEmployees()
        void refetchProjects()
      },
    }
  }, [employees, projects, error, refetchEmployees, refetchProjects])
}

export function useMockUsers() {
  return useQuery({ queryKey: ['mock-users'], queryFn: authApi.mockUsers, staleTime: CATALOG_STALE_TIME })
}

/** Đổi người đang đăng nhập: lấy token mới, xóa sạch cache của người trước. */
export function useMockLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: authApi.mockLogin,
    onSuccess: (result) => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'mock-users' })
      setSession({ token: result.token, nhanVien: result.nhanVien })
    },
  })
}
