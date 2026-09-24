import type {
  CapNhatTienDo,
  ChiTietCongViec,
  ChuyenTrangThai,
  DanhSachCongViecQuery,
  SuaCongViecInput,
  TaoCongViec,
} from '@longdo/contracts'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { congViecApi, type BoLocDem } from '../api/cong-viec.api'

export const khoaCongViec = {
  tatCa: ['cong-viec'] as const,
  danhSach: (q: DanhSachCongViecQuery) => ['cong-viec', 'danh-sach', q] as const,
  dem: (q: BoLocDem) => ['cong-viec', 'dem', q] as const,
  chiTiet: (id: string) => ['cong-viec', 'chi-tiet', id] as const,
  lichSu: (id: string) => ['cong-viec', 'lich-su', id] as const,
}

export function useDanhSachCongViec(q: DanhSachCongViecQuery) {
  return useQuery({
    queryKey: khoaCongViec.danhSach(q),
    queryFn: () => congViecApi.danhSach(q),
    // Giữ trang cũ khi đổi bộ lọc/trang để bảng không nháy trắng.
    placeholderData: keepPreviousData,
  })
}

export function useDemLocNhanh(q: BoLocDem) {
  return useQuery({
    queryKey: khoaCongViec.dem(q),
    queryFn: () => congViecApi.dem(q),
    placeholderData: keepPreviousData,
  })
}

export function useChiTietCongViec(id: string) {
  return useQuery({ queryKey: khoaCongViec.chiTiet(id), queryFn: () => congViecApi.chiTiet(id) })
}

export function useLichSuCongViec(id: string) {
  return useQuery({ queryKey: khoaCongViec.lichSu(id), queryFn: () => congViecApi.lichSu(id) })
}

/** Sau mỗi thay đổi: đặt ngay chi tiết mới vào cache, làm mới danh sách/số đếm/lịch sử. */
function useSauKhiDoi() {
  const qc = useQueryClient()
  return (cv: ChiTietCongViec) => {
    qc.setQueryData(khoaCongViec.chiTiet(cv.id), cv)
    return qc.invalidateQueries({
      queryKey: khoaCongViec.tatCa,
      predicate: (q) => !(q.queryKey[1] === 'chi-tiet' && q.queryKey[2] === cv.id),
    })
  }
}

export function useTaoCongViec() {
  const sauKhiDoi = useSauKhiDoi()
  return useMutation({ mutationFn: (body: TaoCongViec) => congViecApi.tao(body), onSuccess: sauKhiDoi })
}

export function useSuaCongViec(id: string) {
  const sauKhiDoi = useSauKhiDoi()
  return useMutation({ mutationFn: (body: SuaCongViecInput) => congViecApi.sua(id, body), onSuccess: sauKhiDoi })
}

export function useChuyenTrangThai(id: string) {
  const sauKhiDoi = useSauKhiDoi()
  return useMutation({
    mutationFn: (body: ChuyenTrangThai) => congViecApi.chuyenTrangThai(id, body),
    onSuccess: sauKhiDoi,
  })
}

export function useCapNhatTienDo(id: string) {
  const sauKhiDoi = useSauKhiDoi()
  return useMutation({
    mutationFn: (body: CapNhatTienDo) => congViecApi.capNhatTienDo(id, body),
    onSuccess: sauKhiDoi,
  })
}

export function useXoaCongViec(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => congViecApi.xoa(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: khoaCongViec.chiTiet(id) })
      return qc.invalidateQueries({ queryKey: khoaCongViec.tatCa })
    },
  })
}
