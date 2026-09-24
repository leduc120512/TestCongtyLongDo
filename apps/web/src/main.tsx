import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, StrictMode, Suspense, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link, Navigate, RouterProvider, useRouteError } from 'react-router'
import { ApiError } from './api/http'
import { Layout } from './components/Layout'
import { Loading, EmptyState } from './components/LoadingState'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // Lỗi 4xx (không quyền, không tìm thấy, sai dữ liệu) thử lại cũng vô ích.
      retry: (attempt, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && attempt < 2,
    },
  },
})

/** Tách mỗi trang thành chunk riêng, tải khi cần → bundle ban đầu nhẹ. */
function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(load)
  return (
    <Suspense fallback={<Loading />}>
      <Page />
    </Suspense>
  )
}

function RouteError() {
  const error = useRouteError()
  return (
    <div className="state error" role="alert">
      <p>Trang gặp lỗi: {error instanceof Error ? error.message : 'không rõ'}</p>
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
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/cong-viec" replace /> },
      { path: 'cong-viec', element: lazyPage(() => import('./pages/ListPage')) },
      { path: 'cong-viec/tao', element: lazyPage(() => import('./pages/CreatePage')) },
      { path: 'cong-viec/:id', element: lazyPage(() => import('./pages/DetailPage')) },
      { path: 'cong-viec/:id/sua', element: lazyPage(() => import('./pages/EditPage')) },
      {
        path: '*',
        element: (
          <EmptyState>
            Không có trang này. <Link to="/cong-viec">Về danh sách công việc</Link>
          </EmptyState>
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
