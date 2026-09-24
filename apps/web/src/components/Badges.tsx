import { TEN_TRANG_THAI, TEN_UU_TIEN, type TrangThai, type UuTien } from '@longdo/contracts'

export function NhanTrangThai({ trangThai, quaHan }: { trangThai: TrangThai; quaHan?: boolean }) {
  return (
    <span className="nhom-nhan">
      <span className={`nhan tt-${trangThai}`}>{TEN_TRANG_THAI[trangThai]}</span>
      {quaHan && <span className="nhan qua-han">Quá hạn</span>}
    </span>
  )
}

export function NhanUuTien({ uuTien }: { uuTien: UuTien }) {
  return <span className={`nhan ut-${uuTien}`}>{TEN_UU_TIEN[uuTien]}</span>
}
