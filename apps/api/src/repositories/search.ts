/**
 * Chuẩn hóa để tìm kiếm tiếng Việt không phân biệt dấu: "Nghiệm thu Đường" → "nghiem thu duong".
 * Lưu kèm bản ghi (trường tuKhoa) để truy vấn không phải bỏ dấu lúc chạy.
 */
export function normalizeForSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // dấu tổ hợp tách ra sau NFD
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Thoát ký tự đặc biệt để đưa chuỗi người dùng nhập vào RegExp an toàn. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
