import type { FieldChange } from '@longdo/contracts'

function isEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    // Danh sách người: chỉ quan tâm ai có mặt, không quan tâm thứ tự.
    const sa = [...a].sort()
    const sb = [...b].sort()
    return sa.length === sb.length && sa.every((x, i) => x === sb[i])
  }
  // undefined và null coi như "không có"
  return (a ?? null) === (b ?? null)
}

/** So sánh từng trường, trả về danh sách trường đã đổi để ghi lịch sử. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: readonly (keyof T & string)[],
): FieldChange[] {
  const result: FieldChange[] = []
  for (const field of fields) {
    if (!isEqual(before[field], after[field])) {
      result.push({ truong: field, tu: before[field] ?? null, den: after[field] ?? null })
    }
  }
  return result
}
