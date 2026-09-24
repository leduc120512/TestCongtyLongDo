import { MAX_SUBTASKS, type AuthUser, type CreateTask } from '@longdo/contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import { DomainError } from '../../src/errors.ts'
import { TaskService } from '../../src/services/task.service.ts'
import { checkStatusTransition } from '../../src/services/domain/status.ts'
import { computeProgress } from '../../src/services/domain/subtasks.ts'
import { newId, createMemoryStore, type MemoryStore } from '../helpers/memory-store.ts'

const COMPANY = newId()
const [ASSIGNER, ASSIGNEE, FOLLOWER, OUTSIDER] = Array.from({ length: 4 }, newId) as [string, string, string, string]
const asUser = (userId: string): AuthUser => ({ userId, congTyId: COMPANY })

async function errorCodeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    if (e instanceof DomainError) return e.code
    throw e
  }
  return 'KHONG_LOI'
}

describe('computeProgress — luật thuần', () => {
  const subtaskStates = (...done: boolean[]) => done.map((x) => ({ xong: x }))
  it('không có việc con thì giữ tiến độ nhập tay', () => {
    expect(computeProgress([], 'DANG_LAM', 35)).toBe(35)
  })
  it('có việc con thì bằng tỉ lệ đã xong, làm tròn', () => {
    expect(computeProgress(subtaskStates(false, false, false), 'DANG_LAM', 80)).toBe(0)
    expect(computeProgress(subtaskStates(true, false, false), 'DANG_LAM', 0)).toBe(33)
    expect(computeProgress(subtaskStates(true, true, false), 'DANG_LAM', 0)).toBe(67)
    expect(computeProgress(subtaskStates(true, true, true), 'DANG_LAM', 0)).toBe(100)
  })
  it('chờ duyệt / hoàn thành thì giữ nguyên 100%', () => {
    expect(computeProgress(subtaskStates(true, false), 'CHO_DUYET', 100)).toBe(100)
    expect(computeProgress(subtaskStates(true, false), 'HOAN_THANH', 100)).toBe(100)
  })
  it('gửi duyệt bị chặn khi còn việc con chưa xong; trả lại thì tính lại tiến độ', () => {
    const task = { nguoiGiaoId: ASSIGNER, nguoiThucHienIds: [ASSIGNEE], nguoiTheoDoiIds: [], tienDo: 50 }
    expect(checkStatusTransition({ ...task, trangThai: 'DANG_LAM', viecCon: subtaskStates(true, false) }, ASSIGNEE, 'CHO_DUYET')).toMatchObject({
      ok: false,
      code: 'TRANG_THAI_KHONG_HOP_LE',
      message: 'Còn 1 việc con chưa xong, chưa gửi duyệt được',
    })
    expect(checkStatusTransition({ ...task, trangThai: 'DANG_LAM', viecCon: subtaskStates(true, true) }, ASSIGNEE, 'CHO_DUYET')).toEqual({
      ok: true,
      update: { trangThai: 'CHO_DUYET', tienDo: 100 },
    })
    expect(
      checkStatusTransition({ ...task, tienDo: 100, trangThai: 'CHO_DUYET', viecCon: subtaskStates(true, true) }, ASSIGNER, 'DANG_LAM', 'lý do'),
    ).toEqual({ ok: true, update: { trangThai: 'DANG_LAM' } })
  })
})

describe('việc con qua service', () => {
  let store: MemoryStore
  let service: TaskService
  let t = new Date('2026-06-05T03:00:00Z')

  const newTaskBody = (extra: Partial<CreateTask> = {}): CreateTask => ({
    ten: 'Lắp dựng cốt thép trụ T5',
    nguoiThucHienIds: [ASSIGNEE],
    nguoiTheoDoiIds: [FOLLOWER],
    uuTien: 'BINH_THUONG',
    ...extra,
  })

  beforeEach(() => {
    store = createMemoryStore()
    for (const id of [ASSIGNER, ASSIGNEE, FOLLOWER, OUTSIDER]) store.addEmployee({ id, congTyId: COMPANY, ten: id, chucVu: 'KS' })
    service = new TaskService(store, () => (t = new Date(t.getTime() + 1)))
  })

  it('người giao thêm/xóa; người thực hiện đánh dấu; tiến độ tự tính; lịch sử ghi đủ', async () => {
    let task = await service.create(asUser(ASSIGNER), newTaskBody())
    task = await service.addSubtask(asUser(ASSIGNER), task.id, { ten: 'Gia công thép' })
    task = await service.addSubtask(asUser(ASSIGNER), task.id, { ten: 'Lắp dựng' })
    task = await service.addSubtask(asUser(ASSIGNER), task.id, { ten: 'Nghiệm thu cốt thép' })
    expect(task.viecCon.map((v) => v.ten)).toEqual(['Gia công thép', 'Lắp dựng', 'Nghiệm thu cốt thép'])
    expect(task.tienDo).toBe(0)

    await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'DANG_LAM' })
    task = await service.markSubtask(asUser(ASSIGNEE), task.id, task.viecCon[0]!.id, { xong: true })
    expect(task.tienDo).toBe(33)
    task = await service.markSubtask(asUser(ASSIGNEE), task.id, task.viecCon[1]!.id, { xong: true })
    expect(task.tienDo).toBe(67)
    expect(task.quyen.guiDuyet).toBe(false)
    expect(await errorCodeOf(service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'CHO_DUYET' }))).toBe('TRANG_THAI_KHONG_HOP_LE')

    // Xóa việc con chưa xong → còn 2/2 xong → 100%, gửi duyệt được.
    task = await service.removeSubtask(asUser(ASSIGNER), task.id, task.viecCon[2]!.id)
    expect(task.tienDo).toBe(100)
    expect((await service.get(asUser(ASSIGNEE), task.id)).quyen.guiDuyet).toBe(true)
    expect((await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'CHO_DUYET' })).trangThai).toBe('CHO_DUYET')

    const history = await service.history(asUser(FOLLOWER), task.id)
    const subtaskHistory = history.filter((x) => x.hanhDong === 'VIEC_CON')
    expect(subtaskHistory).toHaveLength(6) // 3 thêm + 2 đánh dấu + 1 xóa
    expect(subtaskHistory[0]!.thayDoi).toEqual([
      { truong: 'viecCon', tu: { ten: 'Nghiệm thu cốt thép', xong: false }, den: null },
      { truong: 'tienDo', tu: 67, den: 100 },
    ])
  })

  it('quyền: người thực hiện không thêm/xóa; người giao (không thực hiện) không đánh dấu; theo dõi không làm gì', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    const withSubtask = await service.addSubtask(asUser(ASSIGNER), task.id, { ten: 'A' })
    const subtaskId = withSubtask.viecCon[0]!.id
    await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'DANG_LAM' })
    expect(await errorCodeOf(service.addSubtask(asUser(ASSIGNEE), task.id, { ten: 'B' }))).toBe('KHONG_CO_QUYEN')
    expect(await errorCodeOf(service.removeSubtask(asUser(ASSIGNEE), task.id, subtaskId))).toBe('KHONG_CO_QUYEN')
    expect(await errorCodeOf(service.markSubtask(asUser(ASSIGNER), task.id, subtaskId, { xong: true }))).toBe('KHONG_CO_QUYEN')
    expect(await errorCodeOf(service.markSubtask(asUser(FOLLOWER), task.id, subtaskId, { xong: true }))).toBe('KHONG_CO_QUYEN')
    expect(await errorCodeOf(service.addSubtask(asUser(OUTSIDER), task.id, { ten: 'B' }))).toBe('KHONG_TIM_THAY')
    expect(await errorCodeOf(service.markSubtask(asUser(ASSIGNEE), task.id, newId(), { xong: true }))).toBe('KHONG_TIM_THAY')
  })

  it('trạng thái: chưa bắt đầu thì chưa đánh dấu; chờ duyệt thì người giao không thêm việc con', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    const subtaskId = (await service.addSubtask(asUser(ASSIGNER), task.id, { ten: 'A' })).viecCon[0]!.id
    expect(await errorCodeOf(service.markSubtask(asUser(ASSIGNEE), task.id, subtaskId, { xong: true }))).toBe('TRANG_THAI_KHONG_HOP_LE')
    await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'DANG_LAM' })
    await service.markSubtask(asUser(ASSIGNEE), task.id, subtaskId, { xong: true })
    await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'CHO_DUYET' })
    expect(await errorCodeOf(service.addSubtask(asUser(ASSIGNER), task.id, { ten: 'B' }))).toBe('TRANG_THAI_KHONG_HOP_LE')
    // Trả lại thì thêm được việc mới, tiến độ tính lại (1/2 = 50%).
    await service.changeStatus(asUser(ASSIGNER), task.id, { trangThai: 'DANG_LAM', lyDo: 'Bổ sung việc' })
    expect((await service.addSubtask(asUser(ASSIGNER), task.id, { ten: 'B' })).tienDo).toBe(50)
  })

  it('có việc con thì không nhập tiến độ tay', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    await service.addSubtask(asUser(ASSIGNER), task.id, { ten: 'A' })
    await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'DANG_LAM' })
    expect(await errorCodeOf(service.updateProgress(asUser(ASSIGNEE), task.id, { tienDo: 80 }))).toBe('TRANG_THAI_KHONG_HOP_LE')
  })

  it(`tối đa ${MAX_SUBTASKS} việc con`, async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    for (let i = 0; i < MAX_SUBTASKS; i++) await service.addSubtask(asUser(ASSIGNER), task.id, { ten: `Việc ${i}` })
    expect(await errorCodeOf(service.addSubtask(asUser(ASSIGNER), task.id, { ten: 'Thừa' }))).toBe('VALIDATION')
  })

  it('bình luận: ai liên quan cũng đọc/viết được, người ngoài không thấy, cũ trước mới sau', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    await service.addComment(asUser(ASSIGNER), task.id, { noiDung: 'Nhớ chụp ảnh nghiệm thu' })
    await service.addComment(asUser(ASSIGNEE), task.id, { noiDung: 'Đã rõ' })
    await service.addComment(asUser(FOLLOWER), task.id, { noiDung: 'QA/QC sẽ có mặt lúc 8h' })
    expect(await errorCodeOf(service.addComment(asUser(OUTSIDER), task.id, { noiDung: 'x' }))).toBe('KHONG_TIM_THAY')
    expect(await errorCodeOf(service.listComments(asUser(OUTSIDER), task.id))).toBe('KHONG_TIM_THAY')
    const comments = await service.listComments(asUser(ASSIGNEE), task.id)
    expect(comments.map((b) => [b.nguoiVietId, b.noiDung])).toEqual([
      [ASSIGNER, 'Nhớ chụp ảnh nghiệm thu'],
      [ASSIGNEE, 'Đã rõ'],
      [FOLLOWER, 'QA/QC sẽ có mặt lúc 8h'],
    ])
  })

  it('bình luận trên việc đã xóa → 404', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    await service.remove(asUser(ASSIGNER), task.id)
    expect(await errorCodeOf(service.addComment(asUser(ASSIGNER), task.id, { noiDung: 'x' }))).toBe('KHONG_TIM_THAY')
  })
})
