import type { QuyenCongViec } from '@longdo/contracts'

type CongViecToiThieu = {
  nguoiGiaoId: string
  nguoiThucHienIds: string[]
  nguoiTheoDoiIds: string[]
  trangThai: string
}

export type VaiTro = {
  laNguoiGiao: boolean
  laNguoiThucHien: boolean
  laNguoiTheoDoi: boolean
  /** Có ít nhất một vai trò trên công việc. Không liên quan thì không thấy công việc. */
  coLienQuan: boolean
}

export function xacDinhVaiTro(cv: CongViecToiThieu, userId: string): VaiTro {
  const laNguoiGiao = cv.nguoiGiaoId === userId
  const laNguoiThucHien = cv.nguoiThucHienIds.includes(userId)
  const laNguoiTheoDoi = cv.nguoiTheoDoiIds.includes(userId)
  return {
    laNguoiGiao,
    laNguoiThucHien,
    laNguoiTheoDoi,
    coLienQuan: laNguoiGiao || laNguoiThucHien || laNguoiTheoDoi,
  }
}

/**
 * Quyền theo vai trò VÀ trạng thái hiện tại. Web dùng để ẩn/hiện nút,
 * service dùng để chặn. Một người có thể vừa giao vừa thực hiện (việc cá nhân).
 */
export function tinhQuyen(cv: CongViecToiThieu, userId: string): QuyenCongViec {
  const vt = xacDinhVaiTro(cv, userId)
  const chuaXong = cv.trangThai !== 'HOAN_THANH'
  return {
    sua: vt.laNguoiGiao && chuaXong,
    xoa: vt.laNguoiGiao && chuaXong,
    batDau: vt.laNguoiThucHien && cv.trangThai === 'CHUA_BAT_DAU',
    guiDuyet: vt.laNguoiThucHien && cv.trangThai === 'DANG_LAM',
    duyet: vt.laNguoiGiao && cv.trangThai === 'CHO_DUYET',
    traLai: vt.laNguoiGiao && cv.trangThai === 'CHO_DUYET',
    capNhatTienDo: vt.laNguoiThucHien && cv.trangThai === 'DANG_LAM',
  }
}
