import type { DuAn, KetQuaDangNhap, NhanVien, PhanHoi } from '@longdo/contracts'
import { goiApi } from './http'

export const danhMucApi = {
  nhanVien: async () => (await goiApi<PhanHoi<NhanVien[]>>('/nhan-vien')).data,
  duAn: async () => (await goiApi<PhanHoi<DuAn[]>>('/du-an')).data,
}

export const xacThucApi = {
  nguoiDungGiaLap: async () => (await goiApi<PhanHoi<NhanVien[]>>('/xac-thuc/nguoi-dung-gia-lap')).data,
  dangNhapGiaLap: async (userId: string) =>
    (await goiApi<PhanHoi<KetQuaDangNhap>>('/xac-thuc/dang-nhap-gia-lap', { method: 'POST', body: { userId } })).data,
}
