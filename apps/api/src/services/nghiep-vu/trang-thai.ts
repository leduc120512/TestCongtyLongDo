import { TEN_TRANG_THAI, type MaLoi, type TrangThai } from '@longdo/contracts'
import { xacDinhVaiTro, type VaiTro } from './quyen'

type CongViecToiThieu = {
  nguoiGiaoId: string
  nguoiThucHienIds: string[]
  nguoiTheoDoiIds: string[]
  trangThai: TrangThai
  tienDo: number
}

type BuocChuyen = {
  tu: TrangThai
  den: TrangThai
  duocPhep: (vt: VaiTro) => boolean
  loiQuyen: string
  canLyDo?: boolean
}

/**
 * Luồng: CHUA_BAT_DAU → DANG_LAM → CHO_DUYET → HOAN_THANH, và CHO_DUYET → DANG_LAM (trả lại, kèm lý do).
 * HOAN_THANH là trạng thái cuối. Người giao đồng thời là người thực hiện vẫn tự duyệt được.
 */
export const BUOC_CHUYEN: readonly BuocChuyen[] = [
  {
    tu: 'CHUA_BAT_DAU',
    den: 'DANG_LAM',
    duocPhep: (vt) => vt.laNguoiThucHien,
    loiQuyen: 'Chỉ người thực hiện mới được bắt đầu công việc',
  },
  {
    tu: 'DANG_LAM',
    den: 'CHO_DUYET',
    duocPhep: (vt) => vt.laNguoiThucHien,
    loiQuyen: 'Chỉ người thực hiện mới được gửi duyệt',
  },
  {
    tu: 'CHO_DUYET',
    den: 'HOAN_THANH',
    duocPhep: (vt) => vt.laNguoiGiao,
    loiQuyen: 'Chỉ người giao việc mới được duyệt',
  },
  {
    tu: 'CHO_DUYET',
    den: 'DANG_LAM',
    duocPhep: (vt) => vt.laNguoiGiao,
    loiQuyen: 'Chỉ người giao việc mới được trả lại',
    canLyDo: true,
  },
]

export type KetQuaChuyen =
  | { ok: true; capNhat: { trangThai: TrangThai; tienDo?: number } }
  | { ok: false; code: MaLoi; message: string }

/** Hàm thuần: quyết định một lần chuyển trạng thái có hợp lệ không và cần cập nhật gì. */
export function xetChuyenTrangThai(
  cv: CongViecToiThieu,
  userId: string,
  den: TrangThai,
  lyDo?: string | null,
): KetQuaChuyen {
  if (cv.trangThai === 'HOAN_THANH') {
    return { ok: false, code: 'TRANG_THAI_KHONG_HOP_LE', message: 'Công việc đã hoàn thành, không thay đổi được nữa' }
  }
  const buoc = BUOC_CHUYEN.find((b) => b.tu === cv.trangThai && b.den === den)
  if (!buoc) {
    return {
      ok: false,
      code: 'TRANG_THAI_KHONG_HOP_LE',
      message: `Không thể chuyển từ "${TEN_TRANG_THAI[cv.trangThai]}" sang "${TEN_TRANG_THAI[den]}"`,
    }
  }
  const vt = xacDinhVaiTro(cv, userId)
  if (!buoc.duocPhep(vt)) {
    return { ok: false, code: 'KHONG_CO_QUYEN', message: buoc.loiQuyen }
  }
  if (buoc.canLyDo && !lyDo?.trim()) {
    return { ok: false, code: 'VALIDATION', message: 'Trả lại công việc phải ghi lý do' }
  }
  const capNhat: { trangThai: TrangThai; tienDo?: number } = { trangThai: den }
  if (den === 'CHO_DUYET') capNhat.tienDo = 100
  return { ok: true, capNhat }
}
