import type { Employee } from '@longdo/contracts'
import { useSyncExternalStore } from 'react'

/**
 * Phiên đăng nhập giả lập: token + nhân viên đang đóng vai.
 * Lưu ở sessionStorage để mỗi tab có thể là một người khác nhau (tiện demo người giao và người thực hiện).
 */
export type Session = { token: string; nhanVien: Employee }

const STORAGE_KEY = 'longdo.session'
const listeners = new Set<() => void>()

function readStoredSession(): Session | null {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY)
    return s ? (JSON.parse(s) as Session) : null
  } catch {
    return null
  }
}

let current: Session | null = readStoredSession()

export function getSession(): Session | null {
  return current
}

export function setSession(session: Session | null): void {
  current = session
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // trình duyệt chặn storage — vẫn chạy được trong bộ nhớ
  }
  listeners.forEach((f) => f())
}

function subscribe(f: () => void) {
  listeners.add(f)
  return () => listeners.delete(f)
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession)
}
