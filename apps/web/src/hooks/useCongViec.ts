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
import { usePhien } from '../auth/phien'

/**
 * Khóa cache luôn có userId: dữ liệu của người này không bao giờ hiện cho người khác,
 * kể cả khi một yêu cầu của người trước trả về sau khi đã đổi người đăng nhập.
 */
export const khoaCongViec = {
  tatCa: (uid: string) => ['cong-viec', uid] as const,
  danhSach: (uid: string, q: DanhSachCongViecQuery) => ['cong-viec', uid, 'danh-sach', q] as const,
  dem: (uid: string, q: BoLocDem) => ['cong-viec', uid, 'dem', q] as const,
  chiTiet: (uid: string, id: string) => ['cong-viec', uid, 'chi-tiet', id] as const,
  lichSu: (uid: string, id: string) => ['cong-viec', uid, 'lich-su', id] as const,
  binhLuan: (uid: string, id: string) => ['cong-viec', uid, 'binh-luan', id] as const,
}

function useUid(): string {
  return usePhien()?.nhanVien.id ?? ''
}

export function useDanhSachCongViec(q: DanhSachCongViecQuery) {
  const uid = useUid()
  return useQuery({
    queryKey: khoaCongViec.danhSach(uid, q),
    queryFn: () => congViecApi.danhSach(q),
    // Giữ trang cũ khi đổi bộ lọc/trang để bảng không nháy trắng (chỉ trong cùng một người dùng,
    // vì trang được dựng lại khi đổi người — xem Layout).
    placeholderData: keepPreviousData,
  })
}

export function useDemLocNhanh(q: BoLocDem) {
  const uid = useUid()
  return useQuery({
    queryKey: khoaCongViec.dem(uid, q),
    queryFn: () => congViecApi.dem(q),
    placeholderData: keepPreviousData,
  })
}

export function useChiTietCongViec(id: string) {
  const uid = useUid()
  return useQuery({ queryKey: khoaCongViec.chiTiet(uid, id), queryFn: () => congViecApi.chiTiet(id) })
}

export function useLichSuCongViec(id: string) {
  const uid = useUid()
  return useQuery({ queryKey: khoaCongViec.lichSu(uid, id), queryFn: () => congViecApi.lichSu(id) })
}

/** Sau mỗi thay đổi: đặt ngay chi tiết mới vào cache, làm mới danh sách/số đếm/lịch sử (không chờ). */
function useSauKhiDoi() {
  const qc = useQueryClient()
  const uid = useUid()
  return (cv: ChiTietCongViec) => {
    qc.setQueryData(khoaCongViec.chiTiet(uid, cv.id), cv)
    void qc.invalidateQueries({
      queryKey: khoaCongViec.tatCa(uid),
      // Bình luận không đổi khi công việc đổi nên không cần tải lại.
      predicate: (q) => !(q.queryKey[3] === cv.id && (q.queryKey[2] === 'chi-tiet' || q.queryKey[2] === 'binh-luan')),
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
  const uid = useUid()
  return useMutation({
    mutationFn: () => congViecApi.xoa(id),
    onSuccess: () => {
      // Bỏ hẳn chi tiết và lịch sử của việc đã xóa (tải lại chỉ nhận 404), làm mới danh sách và số đếm.
      qc.removeQueries({ queryKey: khoaCongViec.chiTiet(uid, id) })
      qc.removeQueries({ queryKey: khoaCongViec.lichSu(uid, id) })
      qc.removeQueries({ queryKey: khoaCongViec.binhLuan(uid, id) })
      void qc.invalidateQueries({ queryKey: [...khoaCongViec.tatCa(uid), 'danh-sach'] })
      void qc.invalidateQueries({ queryKey: [...khoaCongViec.tatCa(uid), 'dem'] })
    },
  })
}

// ---------- Việc con ----------

export function useThemViecCon(id: string) {
  const sauKhiDoi = useSauKhiDoi()
  return useMutation({ mutationFn: (ten: string) => congViecApi.themViecCon(id, ten), onSuccess: sauKhiDoi })
}

export function useDanhDauViecCon(id: string) {
  const sauKhiDoi = useSauKhiDoi()
  return useMutation({
    mutationFn: (v: { viecConId: string; xong: boolean }) => congViecApi.danhDauViecCon(id, v.viecConId, v.xong),
    onSuccess: sauKhiDoi,
  })
}

export function useXoaViecCon(id: string) {
  const sauKhiDoi = useSauKhiDoi()
  return useMutation({ mutationFn: (viecConId: string) => congViecApi.xoaViecCon(id, viecConId), onSuccess: sauKhiDoi })
}

// ---------- Bình luận ----------

export function useBinhLuan(id: string) {
  const uid = useUid()
  return useQuery({ queryKey: khoaCongViec.binhLuan(uid, id), queryFn: () => congViecApi.binhLuan(id) })
}

export function useVietBinhLuan(id: string) {
  const qc = useQueryClient()
  const uid = useUid()
  return useMutation({
    mutationFn: (noiDung: string) => congViecApi.vietBinhLuan(id, noiDung),
    onSuccess: () => qc.invalidateQueries({ queryKey: khoaCongViec.binhLuan(uid, id) }),
  })
}
