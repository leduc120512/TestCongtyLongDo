import { Link, Outlet } from 'react-router'
import { useSession } from '../auth/session'
import { useMockLogin, useMockUsers } from '../hooks/useCatalog'
import { ErrorState, Loading, EmptyState } from './LoadingState'

/** Ô chọn "Đang đăng nhập là ai" — thay cho đăng nhập thật trong bản demo. */
function LoginPicker() {
  const session = useSession()
  const mockUsers = useMockUsers()
  const login = useMockLogin()

  if (mockUsers.isPending) return <span className="muted">Đang tải nhân viên…</span>
  if (mockUsers.isError) {
    return (
      <button type="button" className="secondary" onClick={() => mockUsers.refetch()}>
        Lỗi tải nhân viên · Thử lại
      </button>
    )
  }

  if (mockUsers.data.length === 0) return <span className="muted">Chưa có nhân viên</span>

  return (
    <label className="user-picker">
      <span>Đang đăng nhập là</span>
      <select
        value={session?.nhanVien.id ?? ''}
        disabled={login.isPending}
        onChange={(e) => e.target.value && login.mutate(e.target.value)}
      >
        <option value="" disabled>
          — Chọn nhân viên —
        </option>
        {mockUsers.data.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.ten} · {employee.chucVu}
          </option>
        ))}
      </select>
      {login.isError && <span className="field-error">{login.error.message}</span>}
    </label>
  )
}

export function Layout() {
  const session = useSession()
  const mockUsers = useMockUsers()

  return (
    <>
      <header className="site-header">
        <Link to="/cong-viec" className="brand">
          Long Đỗ · <strong>Công việc</strong>
        </Link>
        <LoginPicker />
      </header>
      <main className="content">
        {session ? (
          // key theo người đăng nhập: đổi người là dựng lại trang, không giữ dữ liệu/state của người trước.
          <Outlet key={session.nhanVien.id} />
        ) : mockUsers.isPending ? (
          <Loading />
        ) : mockUsers.isError ? (
          <ErrorState error={mockUsers.error} onRetry={() => mockUsers.refetch()} />
        ) : mockUsers.data.length === 0 ? (
          <EmptyState>
            Chưa có nhân viên nào để đăng nhập. Chạy <code>pnpm seed</code> để tạo dữ liệu mẫu rồi{' '}
            <button type="button" className="link-button" onClick={() => mockUsers.refetch()}>
              tải lại
            </button>
            .
          </EmptyState>
        ) : (
          <div className="welcome">
            <h1>Phân hệ Công việc</h1>
            <p>Chọn “Đang đăng nhập là” ở góc trên để bắt đầu. Mỗi tab trình duyệt có thể đóng vai một người khác.</p>
          </div>
        )}
      </main>
    </>
  )
}
