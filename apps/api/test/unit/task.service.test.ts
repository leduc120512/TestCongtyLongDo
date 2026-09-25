import { TaskListQuerySchema, type AuthUser, type CreateTask } from '@longdo/contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import { DomainError } from '../../src/errors.ts'
import { TaskService } from '../../src/services/task.service.ts'
import { newId, createMemoryStore, type MemoryStore } from '../helpers/memory-store.ts'

const COMPANY = newId()
const OTHER_COMPANY = newId()
const [ASSIGNER, ASSIGNEE, ASSIGNEE_2, FOLLOWER, OUTSIDER, OTHER_COMPANY_EMPLOYEE] = Array.from({ length: 6 }, newId) as [
  string, string, string, string, string, string,
]
const PROJECT = newId()
const OTHER_COMPANY_PROJECT = newId()

const asUser = (userId: string, congTyId = COMPANY): AuthUser => ({ userId, congTyId })

/** Bắt lỗi nghiệp vụ và trả về mã lỗi, để assert gọn. */
async function errorCodeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    if (e instanceof DomainError) return e.code
    throw e
  }
  return 'KHONG_LOI'
}

let store: MemoryStore
let now: Date
let service: TaskService

const newTaskBody = (extra: Partial<CreateTask> = {}): CreateTask => ({
  ten: 'Nghiệm thu cọc khoan nhồi trụ T5',
  nguoiThucHienIds: [ASSIGNEE],
  nguoiTheoDoiIds: [FOLLOWER],
  uuTien: 'CAO',
  batDau: '2026-06-01',
  hetHan: '2026-06-10',
  duAnId: PROJECT,
  ...extra,
})

beforeEach(() => {
  store = createMemoryStore()
  for (const id of [ASSIGNER, ASSIGNEE, ASSIGNEE_2, FOLLOWER, OUTSIDER]) store.addEmployee({ id, congTyId: COMPANY, ten: id, chucVu: 'KS' })
  store.addEmployee({ id: OTHER_COMPANY_EMPLOYEE, congTyId: OTHER_COMPANY, ten: 'khác', chucVu: 'KS' })
  store.addProject({ id: PROJECT, congTyId: COMPANY, ma: 'CNC', ten: 'Cầu Nam Căn' })
  store.addProject({ id: OTHER_COMPANY_PROJECT, congTyId: OTHER_COMPANY, ma: 'X', ten: 'Dự án công ty khác' })
  now = new Date('2026-06-05T03:00:00Z')
  // Mỗi lần gọi đồng hồ tiến 1ms để capNhatLuc luôn khác nhau như thực tế.
  service = new TaskService(store, () => {
    now = new Date(now.getTime() + 1)
    return now
  })
})

describe('tạo công việc', () => {
  it('người tạo là người giao, trạng thái đầu là CHUA_BAT_DAU, tiến độ 0', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    expect(task).toMatchObject({ nguoiGiaoId: ASSIGNER, congTyId: COMPANY, trangThai: 'CHUA_BAT_DAU', tienDo: 0, ma: 'CV-0001' })
  })

  it('mã tự sinh tăng liền nhau trong một công ty, mỗi công ty đếm riêng', async () => {
    const a = await service.create(asUser(ASSIGNER), newTaskBody())
    const b = await service.create(asUser(ASSIGNER), newTaskBody())
    const c = await service.create(asUser(OTHER_COMPANY_EMPLOYEE, OTHER_COMPANY), newTaskBody({ nguoiThucHienIds: [OTHER_COMPANY_EMPLOYEE], nguoiTheoDoiIds: [], duAnId: undefined }))
    expect([a.ma, b.ma, c.ma]).toEqual(['CV-0001', 'CV-0002', 'CV-0001'])
  })

  it('tạo đồng thời không trùng mã và không nhảy số', async () => {
    const created = await Promise.all(Array.from({ length: 20 }, () => service.create(asUser(ASSIGNER), newTaskBody())))
    const codes = created.map((x) => x.ma).sort()
    expect(new Set(codes).size).toBe(20)
    expect(codes[0]).toBe('CV-0001')
    expect(codes[19]).toBe('CV-0020')
  })

  it('validate thất bại thì không tiêu số thứ tự (không nhảy số)', async () => {
    expect(await errorCodeOf(service.create(asUser(ASSIGNER), newTaskBody({ nguoiThucHienIds: [OTHER_COMPANY_EMPLOYEE] })))).toBe('VALIDATION')
    expect((await service.create(asUser(ASSIGNER), newTaskBody())).ma).toBe('CV-0001')
  })

  it('không nhận người hoặc dự án của công ty khác', async () => {
    expect(await errorCodeOf(service.create(asUser(ASSIGNER), newTaskBody({ nguoiThucHienIds: [OTHER_COMPANY_EMPLOYEE] })))).toBe('VALIDATION')
    expect(await errorCodeOf(service.create(asUser(ASSIGNER), newTaskBody({ nguoiTheoDoiIds: [OTHER_COMPANY_EMPLOYEE] })))).toBe('VALIDATION')
    expect(await errorCodeOf(service.create(asUser(ASSIGNER), newTaskBody({ duAnId: OTHER_COMPANY_PROJECT })))).toBe('VALIDATION')
  })

  it('bỏ trùng người, ai đã thực hiện thì không nằm trong theo dõi', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody({ nguoiThucHienIds: [ASSIGNEE, ASSIGNEE], nguoiTheoDoiIds: [ASSIGNEE, FOLLOWER] }))
    expect(task.nguoiThucHienIds).toEqual([ASSIGNEE])
    expect(task.nguoiTheoDoiIds).toEqual([FOLLOWER])
  })

  it('không có dự án = việc chung, không ghi trường undefined', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody({ duAnId: undefined, batDau: undefined, hetHan: undefined, moTa: '' }))
    const stored = store.tasks.items.get(task.id)!
    for (const field of ['duAnId', 'batDau', 'hetHan', 'moTa', 'deletedAt']) {
      expect(Object.hasOwn(stored, field)).toBe(false)
    }
  })

  it('ghi một dòng lịch sử TAO', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    expect(store.historyRecords.filter((x) => x.congViecId === task.id).map((x) => x.hanhDong)).toEqual(['TAO'])
  })
})

describe('quyền xem', () => {
  it('người giao, thực hiện, theo dõi đều xem được', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    for (const actor of [ASSIGNER, ASSIGNEE, FOLLOWER]) {
      expect((await service.get(asUser(actor), task.id)).id).toBe(task.id)
    }
  })

  it('người khác trong công ty không thấy (404, không lộ sự tồn tại)', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    expect(await errorCodeOf(service.get(asUser(OUTSIDER), task.id))).toBe('KHONG_TIM_THAY')
    expect(await errorCodeOf(service.history(asUser(OUTSIDER), task.id))).toBe('KHONG_TIM_THAY')
    const list = await service.list(asUser(OUTSIDER), TaskListQuerySchema.parse({}))
    expect(list.total).toBe(0)
  })

  it('token của công ty khác không thấy dù trùng userId', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    expect(await errorCodeOf(service.get(asUser(ASSIGNER, OTHER_COMPANY), task.id))).toBe('KHONG_TIM_THAY')
  })

  it('quyen trong chi tiết khớp vai trò người xem', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    expect((await service.get(asUser(ASSIGNER), task.id)).quyen).toMatchObject({ sua: true, xoa: true, batDau: false })
    expect((await service.get(asUser(ASSIGNEE), task.id)).quyen).toMatchObject({ sua: false, xoa: false, batDau: true })
    expect(Object.values((await service.get(asUser(FOLLOWER), task.id)).quyen).every((x) => x === false)).toBe(true)
  })
})

describe('sửa thông tin', () => {
  it('chỉ người giao được sửa; người thực hiện và theo dõi bị chặn', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    expect(await errorCodeOf(service.update(asUser(ASSIGNEE), task.id, { ten: 'Đổi tên' }))).toBe('KHONG_CO_QUYEN')
    expect(await errorCodeOf(service.update(asUser(ASSIGNEE), task.id, { hetHan: '2026-07-01' }))).toBe('KHONG_CO_QUYEN')
    expect(await errorCodeOf(service.update(asUser(ASSIGNEE), task.id, { nguoiThucHienIds: [ASSIGNEE, ASSIGNEE_2] }))).toBe('KHONG_CO_QUYEN')
    expect(await errorCodeOf(service.update(asUser(FOLLOWER), task.id, { ten: 'x' }))).toBe('KHONG_CO_QUYEN')
    expect(await errorCodeOf(service.update(asUser(OUTSIDER), task.id, { ten: 'x' }))).toBe('KHONG_TIM_THAY')
  })

  it('đổi 5 trường trong một lần lưu → đúng 1 dòng lịch sử chứa 5 thay đổi (từ → đến)', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    await service.update(asUser(ASSIGNER), task.id, {
      ten: 'Tên mới',
      uuTien: 'THAP',
      hetHan: '2026-06-20',
      nguoiThucHienIds: [ASSIGNEE, ASSIGNEE_2],
      moTa: 'Mô tả mới',
    })
    const edits = store.historyRecords.filter((x) => x.congViecId === task.id && x.hanhDong === 'SUA')
    expect(edits).toHaveLength(1)
    expect(edits[0]!.nguoiDoiId).toBe(ASSIGNER)
    expect(edits[0]!.thayDoi).toEqual(
      expect.arrayContaining([
        { truong: 'ten', tu: 'Nghiệm thu cọc khoan nhồi trụ T5', den: 'Tên mới' },
        { truong: 'uuTien', tu: 'CAO', den: 'THAP' },
        { truong: 'hetHan', tu: '2026-06-10', den: '2026-06-20' },
        { truong: 'nguoiThucHienIds', tu: [ASSIGNEE], den: [ASSIGNEE, ASSIGNEE_2] },
        { truong: 'moTa', tu: null, den: 'Mô tả mới' },
      ]),
    )
    expect(edits[0]!.thayDoi).toHaveLength(5)
  })

  it('lưu mà không đổi gì thì không ghi lịch sử', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    await service.update(asUser(ASSIGNER), task.id, { ten: task.ten, nguoiThucHienIds: [ASSIGNEE] })
    expect(store.historyRecords.filter((x) => x.hanhDong === 'SUA')).toHaveLength(0)
  })

  it('gửi null thì xóa giá trị (bỏ hạn, chuyển thành việc chung)', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    const updated = await service.update(asUser(ASSIGNER), task.id, { hetHan: null, duAnId: null })
    expect(updated.hetHan).toBeUndefined()
    expect(updated.duAnId).toBeUndefined()
    expect(Object.hasOwn(store.tasks.items.get(task.id)!, 'hetHan')).toBe(false)
  })

  it('hạn không được trước ngày bắt đầu, so với giá trị đang lưu', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody({ batDau: '2026-06-05', hetHan: '2026-06-10' }))
    expect(await errorCodeOf(service.update(asUser(ASSIGNER), task.id, { hetHan: '2026-06-04' }))).toBe('VALIDATION')
    expect(await errorCodeOf(service.update(asUser(ASSIGNER), task.id, { batDau: '2026-06-11' }))).toBe('VALIDATION')
    expect(await errorCodeOf(service.update(asUser(ASSIGNER), task.id, { hetHan: '2026-06-05' }))).toBe('KHONG_LOI')
  })

  it('không sửa được việc đã hoàn thành', async () => {
    const task = await completeTask()
    expect(await errorCodeOf(service.update(asUser(ASSIGNER), task.id, { ten: 'x' }))).toBe('TRANG_THAI_KHONG_HOP_LE')
  })

  it('người vừa bị gỡ khỏi danh sách thực hiện không ghi được trên bản đã đọc trước đó', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'DANG_LAM' })
    const assigneeCopy = await store.tasks.findById(COMPANY, task.id)
    await service.update(asUser(ASSIGNER), task.id, { nguoiThucHienIds: [ASSIGNEE_2] })
    // ASSIGNEE đã đọc bản cũ (còn là người thực hiện) nhưng phiên bản đã tăng → không khớp → không ghi.
    const written = await store.tasks.update(COMPANY, task.id, { trangThai: 'DANG_LAM', phienBan: assigneeCopy!.phienBan }, { tienDo: 90 }, new Date())
    expect(written).toBeNull()
    expect(await errorCodeOf(service.updateProgress(asUser(ASSIGNEE), task.id, { tienDo: 90 }))).toBe('KHONG_TIM_THAY')
  })

  it('mỗi lần ghi tăng phiên bản đúng 1', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    expect(store.tasks.items.get(task.id)!.phienBan).toBe(0)
    await service.update(asUser(ASSIGNER), task.id, { ten: 'a' })
    await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'DANG_LAM' })
    expect(store.tasks.items.get(task.id)!.phienBan).toBe(2)
  })

  it('hai người sửa cùng lúc từ cùng một bản: người sau nhận XUNG_DOT, không ghi đè im lặng', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    const readCopy = await store.tasks.findById(COMPANY, task.id)
    await service.update(asUser(ASSIGNER), task.id, { ten: 'Lần 1' })
    // Mô phỏng yêu cầu thứ hai đã đọc bản cũ trước khi lần 1 ghi xong.
    const updated = await store.tasks.update(COMPANY, task.id, { phienBan: readCopy!.phienBan }, { ten: 'Lần 2' }, new Date())
    expect(updated).toBeNull()
  })
})

describe('chuyển trạng thái qua service', () => {
  it('đi hết luồng, gửi duyệt tự lên 100%, lịch sử ghi đủ', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'DANG_LAM' })
    await service.updateProgress(asUser(ASSIGNEE), task.id, { tienDo: 40 })
    const pending = await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'CHO_DUYET' })
    expect(pending.tienDo).toBe(100)
    const done = await service.changeStatus(asUser(ASSIGNER), task.id, { trangThai: 'HOAN_THANH' })
    expect(done.trangThai).toBe('HOAN_THANH')
    const history = await service.history(asUser(FOLLOWER), task.id)
    expect(history.map((x) => x.hanhDong)).toEqual(['CHUYEN_TRANG_THAI', 'CHUYEN_TRANG_THAI', 'CAP_NHAT_TIEN_DO', 'CHUYEN_TRANG_THAI', 'TAO'])
    expect(history[1]!.thayDoi).toEqual([
      { truong: 'trangThai', tu: 'DANG_LAM', den: 'CHO_DUYET' },
      { truong: 'tienDo', tu: 40, den: 100 },
    ])
  })

  it('trả lại lưu lý do vào lịch sử', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'DANG_LAM' })
    await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'CHO_DUYET' })
    expect(await errorCodeOf(service.changeStatus(asUser(ASSIGNER), task.id, { trangThai: 'DANG_LAM' }))).toBe('VALIDATION')
    await service.changeStatus(asUser(ASSIGNER), task.id, { trangThai: 'DANG_LAM', lyDo: '  Thiếu biên bản nghiệm thu  ' })
    const history = await service.history(asUser(ASSIGNER), task.id)
    expect(history[0]!.lyDo).toBe('Thiếu biên bản nghiệm thu')
  })

  it('người theo dõi không đổi được trạng thái', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    expect(await errorCodeOf(service.changeStatus(asUser(FOLLOWER), task.id, { trangThai: 'DANG_LAM' }))).toBe('KHONG_CO_QUYEN')
  })

  it('hai yêu cầu cùng lúc (duyệt và trả lại): chỉ một yêu cầu thắng', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'DANG_LAM' })
    await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'CHO_DUYET' })
    const results = await Promise.all([
      errorCodeOf(service.changeStatus(asUser(ASSIGNER), task.id, { trangThai: 'HOAN_THANH' })),
      errorCodeOf(service.changeStatus(asUser(ASSIGNER), task.id, { trangThai: 'DANG_LAM', lyDo: 'x' })),
    ])
    expect(results.filter((x) => x === 'KHONG_LOI')).toHaveLength(1)
  })
})

describe('tiến độ', () => {
  it('chỉ người thực hiện, chỉ khi đang làm', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    expect(await errorCodeOf(service.updateProgress(asUser(ASSIGNEE), task.id, { tienDo: 10 }))).toBe('TRANG_THAI_KHONG_HOP_LE')
    await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'DANG_LAM' })
    expect(await errorCodeOf(service.updateProgress(asUser(ASSIGNER), task.id, { tienDo: 10 }))).toBe('KHONG_CO_QUYEN')
    expect(await errorCodeOf(service.updateProgress(asUser(FOLLOWER), task.id, { tienDo: 10 }))).toBe('KHONG_CO_QUYEN')
    expect((await service.updateProgress(asUser(ASSIGNEE), task.id, { tienDo: 55 })).tienDo).toBe(55)
  })
})

describe('xóa mềm', () => {
  it('chỉ người giao; bản ghi còn trong kho nhưng có deletedAt và không ai thấy nữa', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody())
    expect(await errorCodeOf(service.remove(asUser(ASSIGNEE), task.id))).toBe('KHONG_CO_QUYEN')
    expect(await errorCodeOf(service.remove(asUser(FOLLOWER), task.id))).toBe('KHONG_CO_QUYEN')
    await service.remove(asUser(ASSIGNER), task.id)
    expect(store.tasks.items.get(task.id)!.deletedAt).toBeInstanceOf(Date)
    expect(await errorCodeOf(service.get(asUser(ASSIGNER), task.id))).toBe('KHONG_TIM_THAY')
    expect((await service.list(asUser(ASSIGNER), TaskListQuerySchema.parse({}))).total).toBe(0)
  })

  it('không xóa được việc đã hoàn thành', async () => {
    const task = await completeTask()
    expect(await errorCodeOf(service.remove(asUser(ASSIGNER), task.id))).toBe('TRANG_THAI_KHONG_HOP_LE')
  })
})

describe('danh sách và Quá hạn', () => {
  it('quaHan tính theo giờ VN tại thời điểm đọc', async () => {
    const task = await service.create(asUser(ASSIGNER), newTaskBody({ hetHan: '2026-06-10' }))
    now = new Date('2026-06-10T16:59:59.000Z')
    expect((await service.get(asUser(ASSIGNER), task.id)).quaHan).toBe(false)
    now = new Date('2026-06-10T17:00:00.000Z')
    expect((await service.get(asUser(ASSIGNER), task.id)).quaHan).toBe(true)
  })

  it('lọc nhanh và số đếm', async () => {
    await service.create(asUser(ASSIGNER), newTaskBody()) // ASSIGNER giao, ASSIGNEE làm, FOLLOWER theo dõi
    await service.create(asUser(ASSIGNEE), newTaskBody({ nguoiThucHienIds: [ASSIGNER], nguoiTheoDoiIds: [] })) // ASSIGNEE giao cho ASSIGNER
    const q = TaskListQuerySchema.parse({})
    expect(await service.countByQuickFilter(asUser(ASSIGNER), q)).toEqual({ CUA_TOI: 1, TOI_GIAO: 1, THEO_DOI: 0, TAT_CA: 2 })
    expect(await service.countByQuickFilter(asUser(FOLLOWER), q)).toEqual({ CUA_TOI: 0, TOI_GIAO: 0, THEO_DOI: 1, TAT_CA: 1 })
  })

  it('lọc Quá hạn có phân trang', async () => {
    for (let i = 1; i <= 5; i++) await service.create(asUser(ASSIGNER), newTaskBody({ batDau: undefined, hetHan: `2026-06-0${i}` }))
    await service.create(asUser(ASSIGNER), newTaskBody({ batDau: undefined, hetHan: undefined }))
    now = new Date('2026-06-04T05:00:00Z') // hôm nay VN = 04/06 → 01, 02, 03 quá hạn
    const page1 = await service.list(asUser(ASSIGNER), TaskListQuerySchema.parse({ trangThai: 'QUA_HAN', limit: 2 }))
    const page2 = await service.list(asUser(ASSIGNER), TaskListQuerySchema.parse({ trangThai: 'QUA_HAN', limit: 2, page: 2 }))
    expect(page1.total).toBe(3)
    expect(page1.items.map((x) => x.hetHan)).toEqual(['2026-06-01', '2026-06-02'])
    expect(page2.items.map((x) => x.hetHan)).toEqual(['2026-06-03'])
    expect([...page1.items, ...page2.items].every((x) => x.quaHan)).toBe(true)
  })
})

async function completeTask() {
  const task = await service.create(asUser(ASSIGNER), newTaskBody())
  await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'DANG_LAM' })
  await service.changeStatus(asUser(ASSIGNEE), task.id, { trangThai: 'CHO_DUYET' })
  return service.changeStatus(asUser(ASSIGNER), task.id, { trangThai: 'HOAN_THANH' })
}
