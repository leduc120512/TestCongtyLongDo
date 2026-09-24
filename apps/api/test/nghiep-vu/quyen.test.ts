import type { QuyenCongViec, TrangThai } from '@longdo/contracts'
import { describe, expect, it } from 'vitest'
import { tinhQuyen, xacDinhVaiTro } from '../../src/services/nghiep-vu/quyen.ts'

const viec = (trangThai: TrangThai) => ({
  nguoiGiaoId: 'giao',
  nguoiThucHienIds: ['lam'],
  nguoiTheoDoiIds: ['xem'],
  trangThai,
})

const KHONG: QuyenCongViec = {
  sua: false,
  xoa: false,
  batDau: false,
  guiDuyet: false,
  duyet: false,
  traLai: false,
  capNhatTienDo: false,
}

describe('xacDinhVaiTro', () => {
  it('người ngoài không liên quan', () => {
    expect(xacDinhVaiTro(viec('DANG_LAM'), 'ngoai').coLienQuan).toBe(false)
  })
  it('người theo dõi có liên quan nhưng không có vai trò nào khác', () => {
    expect(xacDinhVaiTro(viec('DANG_LAM'), 'xem')).toEqual({
      laNguoiGiao: false,
      laNguoiThucHien: false,
      laNguoiTheoDoi: true,
      coLienQuan: true,
    })
  })
})

describe('tinhQuyen — nút nào được hiện theo vai trò và trạng thái', () => {
  it('người theo dõi chỉ xem ở mọi trạng thái', () => {
    for (const tt of ['CHUA_BAT_DAU', 'DANG_LAM', 'CHO_DUYET', 'HOAN_THANH'] as const) {
      expect(tinhQuyen(viec(tt), 'xem')).toEqual(KHONG)
    }
  })

  it('người ngoài không có quyền gì', () => {
    expect(tinhQuyen(viec('DANG_LAM'), 'ngoai')).toEqual(KHONG)
  })

  it('người giao: sửa/xóa khi chưa hoàn thành, duyệt/trả lại khi chờ duyệt', () => {
    expect(tinhQuyen(viec('CHUA_BAT_DAU'), 'giao')).toEqual({ ...KHONG, sua: true, xoa: true })
    expect(tinhQuyen(viec('DANG_LAM'), 'giao')).toEqual({ ...KHONG, sua: true, xoa: true })
    expect(tinhQuyen(viec('CHO_DUYET'), 'giao')).toEqual({ ...KHONG, sua: true, xoa: true, duyet: true, traLai: true })
    expect(tinhQuyen(viec('HOAN_THANH'), 'giao')).toEqual(KHONG)
  })

  it('người thực hiện: không bao giờ sửa/xóa; bắt đầu, cập nhật tiến độ, gửi duyệt đúng lúc', () => {
    expect(tinhQuyen(viec('CHUA_BAT_DAU'), 'lam')).toEqual({ ...KHONG, batDau: true })
    expect(tinhQuyen(viec('DANG_LAM'), 'lam')).toEqual({ ...KHONG, guiDuyet: true, capNhatTienDo: true })
    expect(tinhQuyen(viec('CHO_DUYET'), 'lam')).toEqual(KHONG)
    expect(tinhQuyen(viec('HOAN_THANH'), 'lam')).toEqual(KHONG)
  })

  it('việc cá nhân (giao kiêm thực hiện) có quyền của cả hai vai trò', () => {
    const caNhan = { ...viec('CHO_DUYET'), nguoiThucHienIds: ['giao'] }
    expect(tinhQuyen(caNhan, 'giao')).toEqual({ ...KHONG, sua: true, xoa: true, duyet: true, traLai: true })
    expect(tinhQuyen({ ...caNhan, trangThai: 'DANG_LAM' }, 'giao')).toEqual({
      ...KHONG,
      sua: true,
      xoa: true,
      guiDuyet: true,
      capNhatTienDo: true,
    })
  })
})
