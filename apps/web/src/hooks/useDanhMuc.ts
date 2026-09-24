import type { DuAn, NhanVien } from '@longdo/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { danhMucApi, xacThucApi } from '../api/danh-muc.api'
import { datPhien, usePhien } from '../auth/phien'

// Danh mục ít đổi: giữ lâu trong cache.
const LAU = 5 * 60_000

export function useNhanVien() {
  const phien = usePhien()
  return useQuery({
    queryKey: ['nhan-vien', phien?.nhanVien.congTyId],
    queryFn: danhMucApi.nhanVien,
    enabled: !!phien,
    staleTime: LAU,
  })
}

export function useDuAn() {
  const phien = usePhien()
  return useQuery({
    queryKey: ['du-an', phien?.nhanVien.congTyId],
    queryFn: danhMucApi.duAn,
    enabled: !!phien,
    staleTime: LAU,
  })
}

/** Tra tên theo id, dùng khi hiển thị danh sách người, dự án, lịch sử. */
export function useTraCuu() {
  const { data: nhanVien } = useNhanVien()
  const { data: duAn } = useDuAn()
  return useMemo(() => {
    const nv = new Map<string, NhanVien>((nhanVien ?? []).map((x) => [x.id, x]))
    const da = new Map<string, DuAn>((duAn ?? []).map((x) => [x.id, x]))
    return {
      tenNguoi: (id: string) => nv.get(id)?.ten ?? '(không rõ)',
      tenDuAn: (id?: string | null) => (id ? (da.get(id)?.ten ?? '(không rõ)') : 'Việc chung'),
    }
  }, [nhanVien, duAn])
}

export function useNguoiDungGiaLap() {
  return useQuery({ queryKey: ['nguoi-dung-gia-lap'], queryFn: xacThucApi.nguoiDungGiaLap, staleTime: LAU })
}

/** Đổi người đang đăng nhập: lấy token mới, xóa sạch cache của người trước. */
export function useDangNhapGiaLap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: xacThucApi.dangNhapGiaLap,
    onSuccess: (kq) => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'nguoi-dung-gia-lap' })
      datPhien({ token: kq.token, nhanVien: kq.nhanVien })
    },
  })
}
