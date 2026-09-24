import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, StrictMode, Suspense, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link, Navigate, RouterProvider, useRouteError } from 'react-router'
import { LoiApi } from './api/http'
import { Layout } from './components/Layout'
import { DangTai, KhongCoDuLieu } from './components/TrangThaiTai'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // Lỗi 4xx (không quyền, không tìm thấy, sai dữ liệu) thử lại cũng vô ích.
      retry: (lan, loi) => !(loi instanceof LoiApi && loi.status >= 400 && loi.status < 500) && lan < 2,
    },
  },
})

/** Tách mỗi trang thành chunk riêng, tải khi cần → bundle ban đầu nhẹ. */
function trangLuoi(nap: () => Promise<{ default: ComponentType }>) {
  const Trang = lazy(nap)
  return (
    <Suspense fallback={<DangTai />}>
      <Trang />
    </Suspense>
  )
}

function LoiTrang() {
  const loi = useRouteError()
  return (
    <div className="trang-thai loi" role="alert">
      <p>Trang gặp lỗi: {loi instanceof Error ? loi.message : 'không rõ'}</p>
      <button type="button" onClick={() => window.location.reload()}>
        Tải lại
      </button>
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <LoiTrang />,
    children: [
      { index: true, element: <Navigate to="/cong-viec" replace /> },
      { path: 'cong-viec', element: trangLuoi(() => import('./pages/DanhSachPage')) },
      { path: 'cong-viec/tao', element: trangLuoi(() => import('./pages/TaoPage')) },
      { path: 'cong-viec/:id', element: trangLuoi(() => import('./pages/ChiTietPage')) },
      { path: 'cong-viec/:id/sua', element: trangLuoi(() => import('./pages/SuaPage')) },
      {
        path: '*',
        element: (
          <KhongCoDuLieu>
            Không có trang này. <Link to="/cong-viec">Về danh sách công việc</Link>
          </KhongCoDuLieu>
        ),
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
