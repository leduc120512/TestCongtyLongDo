import type { CongViec, HanhDongLichSu, ThayDoiTruong } from '@longdo/contracts'

/** Bản ghi công việc như đang lưu (trước khi tính quaHan, ngày giờ là Date). */
export type CongViecBanGhi = Omit<CongViec, 'quaHan' | 'taoLuc' | 'capNhatLuc'> & {
  /** Tăng 1 sau mỗi lần ghi; khóa lạc quan nội bộ, không trả ra API. */
  phienBan: number
  taoLuc: Date
  capNhatLuc: Date
  deletedAt?: Date
}

export type CongViecMoi = Omit<CongViecBanGhi, 'id'>

/** Các trường người giao được sửa qua PATCH. */
export const TRUONG_SUA_DUOC = [
  'ten',
  'moTa',
  'duAnId',
  'nguoiThucHienIds',
  'nguoiTheoDoiIds',
  'uuTien',
  'batDau',
  'hetHan',
] as const
export type TruongSuaDuoc = (typeof TRUONG_SUA_DUOC)[number]

/** Thay đổi gửi xuống repository: undefined = không đụng, null = xóa trường. */
export type ThayDoiCongViec = Partial<{
  [K in TruongSuaDuoc]: CongViecBanGhi[K] | null
}> &
  Partial<Pick<CongViecBanGhi, 'trangThai' | 'tienDo' | 'viecCon' | 'deletedAt'>>

export type LichSuBanGhi = {
  id: string
  congViecId: string
  congTyId: string
  nguoiDoiId: string
  luc: Date
  hanhDong: HanhDongLichSu
  thayDoi: ThayDoiTruong[]
  lyDo?: string
}
export type LichSuMoi = Omit<LichSuBanGhi, 'id'>

export type BinhLuanBanGhi = {
  id: string
  congTyId: string
  congViecId: string
  nguoiVietId: string
  noiDung: string
  taoLuc: Date
}
export type BinhLuanMoi = Omit<BinhLuanBanGhi, 'id'>

export type NhanVienBanGhi = { id: string; ten: string; chucVu: string; congTyId: string }
export type DuAnBanGhi = { id: string; ma: string; ten: string; congTyId: string }
