/** Trả về bản sao không còn khóa có giá trị undefined (chỉ tầng ngoài cùng). */
export function boUndefined<T extends Record<string, unknown>>(obj: T): T {
  const kq: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) kq[k] = v
  }
  return kq as T
}

/**
 * Tách một object thay đổi thành $set / $unset cho Mongo:
 * undefined = không đụng tới, null = xóa trường ($unset), còn lại = $set.
 */
export function tachSetUnset(thayDoi: Record<string, unknown>): {
  $set: Record<string, unknown>
  $unset: Record<string, ''>
} {
  const $set: Record<string, unknown> = {}
  const $unset: Record<string, ''> = {}
  for (const [k, v] of Object.entries(thayDoi)) {
    if (v === undefined) continue
    if (v === null) $unset[k] = ''
    else $set[k] = v
  }
  return { $set, $unset }
}
