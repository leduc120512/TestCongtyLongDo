import { DanhSachCongViecQuerySchema, type DanhSachCongViecQuery } from '@longdo/contracts'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

const MAC_DINH = DanhSachCongViecQuerySchema.parse({})

/**
 * Bộ lọc danh sách nằm trên URL (?nhanh=...&trangThai=...) để tải lại trang hay gửi link vẫn giữ.
 * Parse bằng chính schema trong contracts; giá trị lạ trên URL thì bỏ qua, dùng mặc định.
 */
export function useBoLocUrl() {
  const [params, setParams] = useSearchParams()

  const boLoc = useMemo<DanhSachCongViecQuery>(() => {
    const tho = Object.fromEntries([...params].filter(([, v]) => v !== ''))
    const kq = DanhSachCongViecQuerySchema.safeParse(tho)
    if (kq.success) return kq.data
    // Bỏ từng khóa sai thay vì bỏ hết.
    const hopLe: Record<string, string> = {}
    for (const [k, v] of Object.entries(tho)) {
      if (DanhSachCongViecQuerySchema.safeParse({ [k]: v }).success) hopLe[k] = v
    }
    return DanhSachCongViecQuerySchema.parse(hopLe)
  }, [params])

  const doiBoLoc = useCallback(
    (thayDoi: Partial<DanhSachCongViecQuery>) => {
      setParams(
        (cu) => {
          const moi = new URLSearchParams(cu)
          for (const [k, v] of Object.entries(thayDoi)) {
            const macDinh = MAC_DINH[k as keyof DanhSachCongViecQuery]
            if (v === undefined || v === '' || v === macDinh) moi.delete(k)
            else moi.set(k, String(v))
          }
          // Đổi bộ lọc thì quay về trang 1 (trừ khi chính là đổi trang).
          if (!('page' in thayDoi)) moi.delete('page')
          return moi
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return { boLoc, doiBoLoc }
}

/** Trả về giá trị sau khi người dùng ngừng gõ một khoảng tre (ms). */
export function useTreGiaTri<T>(giaTri: T, tre = 300): T {
  const [kq, setKq] = useState(giaTri)
  useEffect(() => {
    const t = setTimeout(() => setKq(giaTri), tre)
    return () => clearTimeout(t)
  }, [giaTri, tre])
  return kq
}
