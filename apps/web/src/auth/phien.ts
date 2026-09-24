import type { NhanVien } from '@longdo/contracts'
import { useSyncExternalStore } from 'react'

/**
 * Phiên đăng nhập giả lập: token + nhân viên đang đóng vai.
 * Lưu ở sessionStorage để mỗi tab có thể là một người khác nhau (tiện demo người giao và người thực hiện).
 */
export type Phien = { token: string; nhanVien: NhanVien }

const KHOA = 'longdo.phien'
const nguoiNghe = new Set<() => void>()

function docLuu(): Phien | null {
  try {
    const s = sessionStorage.getItem(KHOA)
    return s ? (JSON.parse(s) as Phien) : null
  } catch {
    return null
  }
}

let hienTai: Phien | null = docLuu()

export function layPhien(): Phien | null {
  return hienTai
}

export function datPhien(phien: Phien | null): void {
  hienTai = phien
  try {
    if (phien) sessionStorage.setItem(KHOA, JSON.stringify(phien))
    else sessionStorage.removeItem(KHOA)
  } catch {
    // trình duyệt chặn storage — vẫn chạy được trong bộ nhớ
  }
  nguoiNghe.forEach((f) => f())
}

function dangKy(f: () => void) {
  nguoiNghe.add(f)
  return () => nguoiNghe.delete(f)
}

export function usePhien(): Phien | null {
  return useSyncExternalStore(dangKy, layPhien)
}
