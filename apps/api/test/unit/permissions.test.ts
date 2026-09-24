import type { TaskPermissions, TaskStatus } from '@longdo/contracts'
import { describe, expect, it } from 'vitest'
import { getPermissions, getRoles } from '../../src/services/domain/permissions.ts'

const makeTask = (trangThai: TaskStatus) => ({
  nguoiGiaoId: 'giao',
  nguoiThucHienIds: ['lam'],
  nguoiTheoDoiIds: ['xem'],
  trangThai,
})

const NONE: TaskPermissions = {
  sua: false,
  xoa: false,
  batDau: false,
  guiDuyet: false,
  duyet: false,
  traLai: false,
  capNhatTienDo: false,
  quanLyViecCon: false,
  danhDauViecCon: false,
}

describe('getRoles', () => {
  it('người ngoài không liên quan', () => {
    expect(getRoles(makeTask('DANG_LAM'), 'ngoai').isInvolved).toBe(false)
  })
  it('người theo dõi có liên quan nhưng không có vai trò nào khác', () => {
    expect(getRoles(makeTask('DANG_LAM'), 'xem')).toEqual({
      isAssigner: false,
      isAssignee: false,
      isFollower: true,
      isInvolved: true,
    })
  })
})

describe('getPermissions — nút nào được hiện theo vai trò và trạng thái', () => {
  it('người theo dõi chỉ xem ở mọi trạng thái', () => {
    for (const status of ['CHUA_BAT_DAU', 'DANG_LAM', 'CHO_DUYET', 'HOAN_THANH'] as const) {
      expect(getPermissions(makeTask(status), 'xem')).toEqual(NONE)
    }
  })

  it('người ngoài không có quyền gì', () => {
    expect(getPermissions(makeTask('DANG_LAM'), 'ngoai')).toEqual(NONE)
  })

  it('người giao: sửa/xóa khi chưa hoàn thành, duyệt/trả lại khi chờ duyệt', () => {
    expect(getPermissions(makeTask('CHUA_BAT_DAU'), 'giao')).toEqual({ ...NONE, sua: true, xoa: true, quanLyViecCon: true })
    expect(getPermissions(makeTask('DANG_LAM'), 'giao')).toEqual({ ...NONE, sua: true, xoa: true, quanLyViecCon: true })
    expect(getPermissions(makeTask('CHO_DUYET'), 'giao')).toEqual({ ...NONE, sua: true, xoa: true, duyet: true, traLai: true })
    expect(getPermissions(makeTask('HOAN_THANH'), 'giao')).toEqual(NONE)
  })

  it('người thực hiện: không bao giờ sửa/xóa; bắt đầu, cập nhật tiến độ, gửi duyệt đúng lúc', () => {
    expect(getPermissions(makeTask('CHUA_BAT_DAU'), 'lam')).toEqual({ ...NONE, batDau: true })
    expect(getPermissions(makeTask('DANG_LAM'), 'lam')).toEqual({
      ...NONE,
      guiDuyet: true,
      capNhatTienDo: true,
      danhDauViecCon: true,
    })
    expect(getPermissions(makeTask('CHO_DUYET'), 'lam')).toEqual(NONE)
    expect(getPermissions(makeTask('HOAN_THANH'), 'lam')).toEqual(NONE)
  })

  it('việc cá nhân (giao kiêm thực hiện) có quyền của cả hai vai trò', () => {
    const personal = { ...makeTask('CHO_DUYET'), nguoiThucHienIds: ['giao'] }
    expect(getPermissions(personal, 'giao')).toEqual({ ...NONE, sua: true, xoa: true, duyet: true, traLai: true })
    expect(getPermissions({ ...personal, trangThai: 'DANG_LAM' }, 'giao')).toEqual({
      ...NONE,
      sua: true,
      xoa: true,
      guiDuyet: true,
      capNhatTienDo: true,
      quanLyViecCon: true,
      danhDauViecCon: true,
    })
  })

  it('có việc con: không nhập tiến độ tay; còn việc con chưa xong thì chưa gửi duyệt', () => {
    const withSubtasks = { ...makeTask('DANG_LAM'), viecCon: [{ xong: true }, { xong: false }] }
    expect(getPermissions(withSubtasks, 'lam')).toMatchObject({ capNhatTienDo: false, guiDuyet: false, danhDauViecCon: true })
    const allDone = { ...makeTask('DANG_LAM'), viecCon: [{ xong: true }, { xong: true }] }
    expect(getPermissions(allDone, 'lam')).toMatchObject({ capNhatTienDo: false, guiDuyet: true })
  })

  it('người giao không thêm/xóa việc con khi chờ duyệt hoặc đã hoàn thành', () => {
    expect(getPermissions(makeTask('CHO_DUYET'), 'giao').quanLyViecCon).toBe(false)
    expect(getPermissions(makeTask('HOAN_THANH'), 'giao').quanLyViecCon).toBe(false)
  })
})
