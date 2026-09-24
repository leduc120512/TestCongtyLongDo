import type { TrangThai } from '@longdo/contracts'

type ViecConToiThieu = { xong: boolean }

/** Số việc con chưa xong. */
export function soViecConChuaXong(viecCon: readonly ViecConToiThieu[]): number {
  return viecCon.filter((v) => !v.xong).length
}

/**
 * Tiến độ khi công việc có việc con = tỉ lệ việc con đã xong, làm tròn.
 * - Không có việc con: giữ tiến độ nhập tay.
 * - Chờ duyệt / Hoàn thành: giữ nguyên (đề bài: sang Chờ duyệt thì tiến độ là 100%).
 */
export function tinhTienDo(viecCon: readonly ViecConToiThieu[], trangThai: TrangThai, tienDoHienTai: number): number {
  if (viecCon.length === 0) return tienDoHienTai
  if (trangThai === 'CHO_DUYET' || trangThai === 'HOAN_THANH') return tienDoHienTai
  return Math.round(((viecCon.length - soViecConChuaXong(viecCon)) * 100) / viecCon.length)
}

/** Người giao chỉ thêm/xóa việc con khi việc chưa bắt đầu hoặc đang làm (chờ duyệt thì phải trả lại trước). */
export function coTheQuanLyViecCon(trangThai: TrangThai): boolean {
  return trangThai === 'CHUA_BAT_DAU' || trangThai === 'DANG_LAM'
}
