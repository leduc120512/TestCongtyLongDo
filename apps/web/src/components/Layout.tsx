import { Link, Outlet } from 'react-router'
import { usePhien } from '../auth/phien'
import { useDangNhapGiaLap, useNguoiDungGiaLap } from '../hooks/useDanhMuc'
import { CoLoi, DangTai } from './TrangThaiTai'

/** Ô chọn "Đang đăng nhập là ai" — thay cho đăng nhập thật trong bản demo. */
function ChonNguoiDangNhap() {
  const phien = usePhien()
  const ds = useNguoiDungGiaLap()
  const dangNhap = useDangNhapGiaLap()

  if (ds.isPending) return <span className="nho">Đang tải nhân viên…</span>
  if (ds.isError) {
    return (
      <button type="button" className="phu" onClick={() => ds.refetch()}>
        Lỗi tải nhân viên · Thử lại
      </button>
    )
  }

  return (
    <label className="chon-nguoi">
      <span>Đang đăng nhập là</span>
      <select
        value={phien?.nhanVien.id ?? ''}
        disabled={dangNhap.isPending}
        onChange={(e) => e.target.value && dangNhap.mutate(e.target.value)}
      >
        <option value="" disabled>
          — Chọn nhân viên —
        </option>
        {ds.data.map((nv) => (
          <option key={nv.id} value={nv.id}>
            {nv.ten} · {nv.chucVu}
          </option>
        ))}
      </select>
      {dangNhap.isError && <span className="loi-nho">{dangNhap.error.message}</span>}
    </label>
  )
}

export function Layout() {
  const phien = usePhien()
  const ds = useNguoiDungGiaLap()

  return (
    <>
      <header className="dau-trang">
        <Link to="/cong-viec" className="thuong-hieu">
          Long Đỗ · <strong>Công việc</strong>
        </Link>
        <ChonNguoiDangNhap />
      </header>
      <main className="noi-dung">
        {phien ? (
          <Outlet />
        ) : ds.isPending ? (
          <DangTai />
        ) : ds.isError ? (
          <CoLoi loi={ds.error} thuLai={() => ds.refetch()} />
        ) : (
          <div className="chao">
            <h1>Phân hệ Công việc</h1>
            <p>Chọn “Đang đăng nhập là” ở góc trên để bắt đầu. Mỗi tab trình duyệt có thể đóng vai một người khác.</p>
          </div>
        )}
      </main>
    </>
  )
}
