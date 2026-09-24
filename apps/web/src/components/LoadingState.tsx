import type { ReactNode } from 'react'

export function Loading({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden />
      {label}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof Error ? error.message : 'Đã có lỗi xảy ra'
  return (
    <div className="state error" role="alert">
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        Thử lại
      </button>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="state empty">{children}</div>
}
