import { TaskListQuerySchema, type TaskListQuery } from '@longdo/contracts'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

const DEFAULTS = TaskListQuerySchema.parse({})

// Query string gần nhất của màn danh sách, để nút "‹ Danh sách" quay về đúng bộ lọc và trang đang xem.
let lastListSearch = ''

/** Đường dẫn về màn danh sách, giữ bộ lọc lần cuối (không có thì về danh sách mặc định). */
export function listHref(): string {
  return lastListSearch ? `/cong-viec?${lastListSearch}` : '/cong-viec'
}

/**
 * Bộ lọc danh sách nằm trên URL (?nhanh=...&trangThai=...) để tải lại trang hay gửi link vẫn giữ.
 * Parse bằng chính schema trong contracts; giá trị lạ trên URL thì bỏ qua, dùng mặc định.
 */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    lastListSearch = params.toString()
  }, [params])

  const filters = useMemo<TaskListQuery>(() => {
    const raw = Object.fromEntries([...params].filter(([, v]) => v !== ''))
    const result = TaskListQuerySchema.safeParse(raw)
    if (result.success) return result.data
    // Bỏ từng khóa sai thay vì bỏ hết.
    const valid: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (TaskListQuerySchema.safeParse({ [k]: v }).success) valid[k] = v
    }
    return TaskListQuerySchema.parse(valid)
  }, [params])

  const setFilters = useCallback(
    (changes: Partial<TaskListQuery>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(changes)) {
            const defaultValue = DEFAULTS[k as keyof TaskListQuery]
            if (v === undefined || v === '' || v === defaultValue) next.delete(k)
            else next.set(k, String(v))
          }
          // Đổi bộ lọc thì quay về trang 1 (trừ khi chính là đổi trang).
          if (!('page' in changes)) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return { filters, setFilters }
}

/** Trả về giá trị sau khi người dùng ngừng gõ một khoảng delay (ms). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
