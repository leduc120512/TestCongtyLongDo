import type { ReactNode } from 'react'

export function DangTai({ noiDung = 'Đang tải…' }: { noiDung?: string }) {
  return (
    <div className="trang-thai" role="status" aria-live="polite">
      <span className="vong-quay" aria-hidden />
      {noiDung}
    </div>
  )
}

export function CoLoi({ loi, thuLai }: { loi: unknown; thuLai: () => void }) {
  const thongBao = loi instanceof Error ? loi.message : 'Đã có lỗi xảy ra'
  return (
    <div className="trang-thai loi" role="alert">
      <p>{thongBao}</p>
      <button type="button" onClick={thuLai}>
        Thử lại
      </button>
    </div>
  )
}

export function KhongCoDuLieu({ children }: { children: ReactNode }) {
  return <div className="trang-thai trong">{children}</div>
}
