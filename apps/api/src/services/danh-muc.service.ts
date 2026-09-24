import type { DuAn, NguoiDung, NhanVien } from '@longdo/contracts'
import { LoiNghiepVu } from '../loi.ts'
import type { KhoDuLieu } from '../repositories/giao-dien.ts'

/** Danh mục nhân viên, dự án và đăng nhập giả lập. */
export class DanhMucService {
  private readonly kho: KhoDuLieu

  constructor(kho: KhoDuLieu) {
    this.kho = kho
  }

  nhanVien(nd: NguoiDung): Promise<NhanVien[]> {
    return this.kho.nhanVien.danhSach(nd.congTyId)
  }

  duAn(nd: NguoiDung): Promise<DuAn[]> {
    return this.kho.duAn.danhSach(nd.congTyId)
  }

  /** Danh sách để chọn "Đang đăng nhập là ai" — chỉ phục vụ bản demo, không có ở production. */
  nguoiDungGiaLap(): Promise<NhanVien[]> {
    return this.kho.nhanVien.danhSachGiaLap()
  }

  /** congTyId trong token lấy từ bản ghi nhân viên, không lấy từ client. */
  async dangNhapGiaLap(userId: string): Promise<{ nhanVien: NhanVien; payload: NguoiDung }> {
    const nv = await this.kho.nhanVien.timTheoId(userId)
    if (!nv) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy nhân viên')
    return { nhanVien: nv, payload: { userId: nv.id, congTyId: nv.congTyId } }
  }
}
