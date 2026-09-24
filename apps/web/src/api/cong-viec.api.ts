import type {
  BinhLuan,
  CapNhatTienDo,
  ChiTietCongViec,
  ChuyenTrangThai,
  CongViec,
  DanhSachCongViecQuery,
  LichSu,
  PhanHoi,
  PhanHoiDanhSach,
  SuaCongViecInput,
  TaoCongViec,
  ThongKeNhanh,
} from '@longdo/contracts'
import { goiApi } from './http'

export type BoLocDem = Pick<DanhSachCongViecQuery, 'duAnId' | 'trangThai' | 'uuTien' | 'q'>

export const congViecApi = {
  danhSach: (q: DanhSachCongViecQuery) =>
    goiApi<PhanHoiDanhSach<CongViec>>('/cong-viec', { query: q }),

  dem: async (q: BoLocDem) => (await goiApi<PhanHoi<ThongKeNhanh>>('/cong-viec/dem', { query: q })).data,

  chiTiet: async (id: string) => (await goiApi<PhanHoi<ChiTietCongViec>>(`/cong-viec/${id}`)).data,

  lichSu: async (id: string) => (await goiApi<PhanHoi<LichSu[]>>(`/cong-viec/${id}/lich-su`)).data,

  tao: async (body: TaoCongViec) =>
    (await goiApi<PhanHoi<ChiTietCongViec>>('/cong-viec', { method: 'POST', body })).data,

  sua: async (id: string, body: SuaCongViecInput) =>
    (await goiApi<PhanHoi<ChiTietCongViec>>(`/cong-viec/${id}`, { method: 'PATCH', body })).data,

  chuyenTrangThai: async (id: string, body: ChuyenTrangThai) =>
    (await goiApi<PhanHoi<ChiTietCongViec>>(`/cong-viec/${id}/trang-thai`, { method: 'POST', body })).data,

  capNhatTienDo: async (id: string, body: CapNhatTienDo) =>
    (await goiApi<PhanHoi<ChiTietCongViec>>(`/cong-viec/${id}/tien-do`, { method: 'POST', body })).data,

  xoa: async (id: string) =>
    (await goiApi<PhanHoi<{ id: string }>>(`/cong-viec/${id}`, { method: 'DELETE' })).data,

  themViecCon: async (id: string, ten: string) =>
    (await goiApi<PhanHoi<ChiTietCongViec>>(`/cong-viec/${id}/viec-con`, { method: 'POST', body: { ten } })).data,

  danhDauViecCon: async (id: string, viecConId: string, xong: boolean) =>
    (
      await goiApi<PhanHoi<ChiTietCongViec>>(`/cong-viec/${id}/viec-con/${viecConId}/danh-dau`, {
        method: 'POST',
        body: { xong },
      })
    ).data,

  xoaViecCon: async (id: string, viecConId: string) =>
    (await goiApi<PhanHoi<ChiTietCongViec>>(`/cong-viec/${id}/viec-con/${viecConId}`, { method: 'DELETE' })).data,

  binhLuan: async (id: string) => (await goiApi<PhanHoi<BinhLuan[]>>(`/cong-viec/${id}/binh-luan`)).data,

  vietBinhLuan: async (id: string, noiDung: string) =>
    (await goiApi<PhanHoi<BinhLuan>>(`/cong-viec/${id}/binh-luan`, { method: 'POST', body: { noiDung } })).data,
}
