import type { LocNhanh, LocTrangThai, SapXep, ThongKeNhanh, TrangThai, UuTien } from '@longdo/contracts'
import type {
  BinhLuanBanGhi,
  BinhLuanMoi,
  CongViecBanGhi,
  CongViecMoi,
  DuAnBanGhi,
  LichSuBanGhi,
  LichSuMoi,
  NhanVienBanGhi,
  ThayDoiCongViec,
} from '../kieu.ts'

/**
 * Hợp đồng giữa service và repository. Service chỉ biết các giao diện này, không biết Mongo,
 * nên test nghiệp vụ có thể thay bằng bản cài đặt trong bộ nhớ.
 * Mọi hàm đều nhận congTyId: không có truy vấn nào chạy mà không lọc theo công ty.
 */

export type BoLocCongViec = {
  congTyId: string
  userId: string
  /** Ngày hôm nay theo giờ VN (YYYY-MM-DD), để lọc Quá hạn. */
  homNay: string
  /** undefined = mọi dự án; null = chỉ việc chung; chuỗi = một dự án. */
  duAnId?: string | null
  trangThai?: LocTrangThai
  uuTien?: UuTien
  /** Từ khóa người dùng gõ; repository tự chuẩn hóa (bỏ dấu, chữ thường). Tìm theo tên hoặc mã. */
  q?: string
}

export type DieuKienCapNhat = {
  /** Chỉ cập nhật nếu trạng thái hiện tại đúng bằng giá trị này. */
  trangThai?: TrangThai
  /** Chỉ cập nhật nếu phiên bản vẫn là giá trị đã đọc (khóa lạc quan). Mỗi lần ghi tăng phiên bản 1. */
  phienBan?: number
}

export interface CongViecRepository {
  /** Tìm theo id trong công ty, bỏ qua bản ghi đã xóa mềm. */
  timTheoId(congTyId: string, id: string): Promise<CongViecBanGhi | null>
  tao(duLieu: CongViecMoi): Promise<CongViecBanGhi>
  /** Cập nhật có điều kiện; trả null nếu không còn khớp điều kiện (đã bị người khác đổi). */
  capNhat(
    congTyId: string,
    id: string,
    dieuKien: DieuKienCapNhat,
    thayDoi: ThayDoiCongViec,
    luc: Date,
  ): Promise<CongViecBanGhi | null>
  danhSach(
    boLoc: BoLocCongViec & { nhanh: LocNhanh },
    trang: { page: number; limit: number },
    sapXep: SapXep,
  ): Promise<{ items: CongViecBanGhi[]; total: number }>
  demTheoLocNhanh(boLoc: BoLocCongViec): Promise<ThongKeNhanh>
}

export interface BoDemRepository {
  /** Lấy số thứ tự tiếp theo cho mã công việc của một công ty (nguyên tử). */
  laySoTiepTheo(congTyId: string): Promise<number>
}

export interface LichSuRepository {
  ghi(banGhi: LichSuMoi): Promise<void>
  danhSach(congTyId: string, congViecId: string): Promise<LichSuBanGhi[]>
}

export interface BinhLuanRepository {
  ghi(banGhi: BinhLuanMoi): Promise<BinhLuanBanGhi>
  /** Bình luận của một công việc, cũ trước mới sau. */
  danhSach(congTyId: string, congViecId: string): Promise<BinhLuanBanGhi[]>
}

export interface NhanVienRepository {
  danhSach(congTyId: string): Promise<NhanVienBanGhi[]>
  /** Tất cả nhân viên mọi công ty, chỉ dùng cho màn chọn "Đang đăng nhập là ai". */
  danhSachGiaLap(): Promise<NhanVienBanGhi[]>
  timTheoId(id: string): Promise<NhanVienBanGhi | null>
  timNhieu(congTyId: string, ids: readonly string[]): Promise<NhanVienBanGhi[]>
}

export interface DuAnRepository {
  danhSach(congTyId: string): Promise<DuAnBanGhi[]>
  timTheoId(congTyId: string, id: string): Promise<DuAnBanGhi | null>
}

export type KhoDuLieu = {
  congViec: CongViecRepository
  boDem: BoDemRepository
  lichSu: LichSuRepository
  binhLuan: BinhLuanRepository
  nhanVien: NhanVienRepository
  duAn: DuAnRepository
  /**
   * Chạy nhiều thao tác ghi như một khối: hoặc tất cả được lưu, hoặc không gì cả
   * (ghi công việc + ghi lịch sử + tăng bộ đếm mã). fn nhận một kho gắn với giao dịch đó.
   */
  giaoDich<T>(fn: (kho: KhoDuLieu) => Promise<T>): Promise<T>
}
