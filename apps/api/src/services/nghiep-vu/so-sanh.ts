import type { ThayDoiTruong } from '@longdo/contracts'

function bangNhau(a: unknown, b: unknown): boolean {
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
export function soSanhTruong<T extends Record<string, unknown>>(
  cu: T,
  moi: T,
  cacTruong: readonly (keyof T & string)[],
): ThayDoiTruong[] {
  const kq: ThayDoiTruong[] = []
  for (const truong of cacTruong) {
    if (!bangNhau(cu[truong], moi[truong])) {
      kq.push({ truong, tu: cu[truong] ?? null, den: moi[truong] ?? null })
    }
  }
  return kq
}
