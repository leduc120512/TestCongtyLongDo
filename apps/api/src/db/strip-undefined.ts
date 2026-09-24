/** Trả về bản sao không còn khóa có giá trị undefined (chỉ tầng ngoài cùng). */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v
  }
  return result as T
}

/**
 * Tách một object thay đổi thành $set / $unset cho Mongo:
 * undefined = không đụng tới, null = xóa trường ($unset), còn lại = $set.
 */
export function splitSetUnset(changes: Record<string, unknown>): {
  $set: Record<string, unknown>
  $unset: Record<string, ''>
} {
  const $set: Record<string, unknown> = {}
  const $unset: Record<string, ''> = {}
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined) continue
    if (v === null) $unset[k] = ''
    else $set[k] = v
  }
  return { $set, $unset }
}
