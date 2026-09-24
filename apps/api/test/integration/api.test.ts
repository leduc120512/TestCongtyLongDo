import type { FastifyInstance } from 'fastify'
import { MongoClient, ObjectId, type Db } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.ts'
import { createIndexes, COLLECTIONS } from '../../src/db/connection.ts'
import { buildTaskFilter, type TaskDoc } from '../../src/repositories/task.repository.ts'
import { createMongoStore } from '../../src/repositories/index.ts'

/**
 * Test tích hợp: HTTP thật (app.inject) + MongoDB thật, DB riêng cho test.
 * Cần Mongo đang chạy (docker compose up -d). Không kết nối được thì bỏ qua và in cảnh báo.
 */

const MONGO_BASE_URL = process.env.MONGO_URL_TEST ?? 'mongodb://localhost:27017'
const DB_NAME = `longdo_congviec_test_${process.pid}`

async function tryConnect(): Promise<MongoClient | null> {
  const client = new MongoClient(`${MONGO_BASE_URL}/${DB_NAME}?directConnection=true`, {
    serverSelectionTimeoutMS: 1500,
    ignoreUndefined: true,
  })
  try {
    await client.connect()
    return client
  } catch {
    console.warn(`⚠ Bỏ qua test tích hợp: không kết nối được MongoDB tại ${MONGO_BASE_URL}`)
    return null
  }
}

const client = await tryConnect()

const COMPANY = new ObjectId()
const OTHER_COMPANY = new ObjectId()
const id = () => new ObjectId()
const ASSIGNER = id()
const ASSIGNEE = id()
const FOLLOWER = id()
const OUTSIDER = id()
const OTHER_COMPANY_EMPLOYEE = id()
const PROJECT = id()

describe.skipIf(!client)('API tích hợp với MongoDB', () => {
  let db: Db
  let app: FastifyInstance
  let supportsTransactions = false
  let now = new Date('2026-06-05T03:00:00Z')
  const token: Record<string, string> = {}

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, actor?: ObjectId, payload?: unknown) =>
    app.inject({
      method,
      url,
      headers: actor ? { authorization: `Bearer ${token[actor.toHexString()]}` } : {},
      ...(payload !== undefined ? { payload: payload as object } : {}),
    })

  const createTask = async (extra: Record<string, unknown> = {}, actor = ASSIGNER) => {
    const res = await call('POST', '/api/cong-viec', actor, {
      ten: 'Nghiệm thu cọc khoan nhồi trụ T5',
      nguoiThucHienIds: [ASSIGNEE.toHexString()],
      nguoiTheoDoiIds: [FOLLOWER.toHexString()],
      duAnId: PROJECT.toHexString(),
      uuTien: 'CAO',
      batDau: '2026-06-01',
      hetHan: '2026-06-10',
      ...extra,
    })
    expect(res.statusCode, res.body).toBe(201)
    return res.json().data
  }

  beforeAll(async () => {
    db = client!.db(DB_NAME)
    await db.dropDatabase()
    await createIndexes(db)
    await db.collection(COLLECTIONS.employees).insertMany([
      { _id: ASSIGNER, congTyId: COMPANY, ten: 'Nguyễn Văn An', chucVu: 'Chỉ huy trưởng' },
      { _id: ASSIGNEE, congTyId: COMPANY, ten: 'Lê Văn Cường', chucVu: 'Kỹ sư' },
      { _id: FOLLOWER, congTyId: COMPANY, ten: 'Vũ Thị Giang', chucVu: 'QA/QC' },
      { _id: OUTSIDER, congTyId: COMPANY, ten: 'Ngô Thị Nga', chucVu: 'Thư ký' },
      { _id: OTHER_COMPANY_EMPLOYEE, congTyId: OTHER_COMPANY, ten: 'Người công ty khác', chucVu: 'Kỹ sư' },
    ])
    await db.collection(COLLECTIONS.projects).insertOne({ _id: PROJECT, congTyId: COMPANY, ma: 'CNC', ten: 'Cầu Nam Căn' })
    const hello = await db.admin().command({ hello: 1 })
    supportsTransactions = Boolean(hello.setName)
    app = await buildApp({
      store: createMongoStore(client!, db, supportsTransactions),
      jwtSecret: 'bi-mat-test',
      mockLogin: true,
      clock: () => now,
    })
    for (const employee of [ASSIGNER, ASSIGNEE, FOLLOWER, OUTSIDER, OTHER_COMPANY_EMPLOYEE]) {
      const res = await call('POST', '/api/xac-thuc/dang-nhap-gia-lap', undefined, { userId: employee.toHexString() })
      token[employee.toHexString()] = res.json().data.token
    }
  })

  beforeEach(async () => {
    now = new Date('2026-06-05T03:00:00Z')
    await db.collection(COLLECTIONS.tasks).deleteMany({})
    await db.collection(COLLECTIONS.history).deleteMany({})
    await db.collection(COLLECTIONS.counters).deleteMany({})
    await db.collection(COLLECTIONS.comments).deleteMany({})
  })

  afterAll(async () => {
    await app?.close()
    await db?.dropDatabase()
    await client?.close()
  })

  describe('xác thực và dạng response', () => {
    it('không có token → 401 { error: { code, message } }', async () => {
      const res = await call('GET', '/api/cong-viec')
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({ error: { code: 'KHONG_DANG_NHAP', message: expect.any(String) } })
    })

    it('token giả mạo → 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/cong-viec', headers: { authorization: 'Bearer abc.def.ghi' } })
      expect(res.statusCode).toBe(401)
    })

    it('token chứa congTyId lấy từ hồ sơ nhân viên', async () => {
      const payload = app.jwt.decode<{ userId: string; congTyId: string }>(token[ASSIGNER.toHexString()]!)
      expect(payload).toMatchObject({ userId: ASSIGNER.toHexString(), congTyId: COMPANY.toHexString() })
    })

    it('tắt đăng nhập giả lập (production): không tự cấp token, không lộ danh sách nhân viên', async () => {
      const prodApp = await buildApp({ store: createMongoStore(client!, db, supportsTransactions), jwtSecret: 'bi-mat-test', mockLogin: false })
      try {
        const loginRes = await prodApp.inject({
          method: 'POST',
          url: '/api/xac-thuc/dang-nhap-gia-lap',
          payload: { userId: ASSIGNER.toHexString() },
        })
        expect(loginRes.statusCode).toBe(404)
        expect(loginRes.json()).toEqual({ error: { code: 'KHONG_TIM_THAY', message: expect.any(String) } })
        const mockUsersRes = await prodApp.inject({ method: 'GET', url: '/api/xac-thuc/nguoi-dung-gia-lap' })
        expect(mockUsersRes.statusCode).toBe(404)
      } finally {
        await prodApp.close()
      }
    })

    it('đường dẫn không tồn tại → 404 đúng dạng lỗi', async () => {
      const res = await call('GET', '/api/khong-co', ASSIGNER)
      expect(res.json()).toEqual({ error: { code: 'KHONG_TIM_THAY', message: expect.any(String) } })
    })

    it('JSON sai cú pháp → 400 VALIDATION', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cong-viec',
        headers: { authorization: `Bearer ${token[ASSIGNER.toHexString()]}`, 'content-type': 'application/json' },
        payload: '{sai',
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error.code).toBe('VALIDATION')
    })

    it('chi tiết trả { data } với id là chuỗi, không lộ trường nội bộ', async () => {
      const task = await createTask()
      const res = await call('GET', `/api/cong-viec/${task.id}`, ASSIGNER)
      const { data } = res.json()
      expect(typeof data.id).toBe('string')
      expect(data.nguoiThucHienIds).toEqual([ASSIGNEE.toHexString()])
      for (const internalField of ['_id', 'tuKhoa', 'hanSapXep', 'deletedAt', 'phienBan']) expect(data).not.toHaveProperty(internalField)
    })

    it('danh sách trả { data, meta: { page, limit, total } }', async () => {
      await createTask()
      const res = await call('GET', '/api/cong-viec?page=1&limit=5', ASSIGNER)
      expect(res.json()).toEqual({ data: [expect.any(Object)], meta: { page: 1, limit: 5, total: 1 } })
    })
  })

  describe('không tin dữ liệu client gửi', () => {
    it('bỏ qua congTyId, nguoiGiaoId, trangThai, tienDo, ma trong body', async () => {
      const task = await createTask({
        congTyId: OTHER_COMPANY.toHexString(),
        nguoiGiaoId: OUTSIDER.toHexString(),
        trangThai: 'HOAN_THANH',
        tienDo: 100,
        ma: 'CV-9999',
      })
      expect(task).toMatchObject({
        congTyId: COMPANY.toHexString(),
        nguoiGiaoId: ASSIGNER.toHexString(),
        trangThai: 'CHUA_BAT_DAU',
        tienDo: 0,
        ma: 'CV-0001',
      })
    })

    it('người công ty khác không thấy, không sửa, không xóa được', async () => {
      const task = await createTask()
      expect((await call('GET', `/api/cong-viec/${task.id}`, OTHER_COMPANY_EMPLOYEE)).statusCode).toBe(404)
      expect((await call('PATCH', `/api/cong-viec/${task.id}`, OTHER_COMPANY_EMPLOYEE, { ten: 'x' })).statusCode).toBe(404)
      expect((await call('DELETE', `/api/cong-viec/${task.id}`, OTHER_COMPANY_EMPLOYEE)).statusCode).toBe(404)
      expect((await call('GET', '/api/cong-viec', OTHER_COMPANY_EMPLOYEE)).json().meta.total).toBe(0)
    })

    it('không giao việc được cho người công ty khác', async () => {
      const res = await call('POST', '/api/cong-viec', ASSIGNER, {
        ten: 'x',
        nguoiThucHienIds: [OTHER_COMPANY_EMPLOYEE.toHexString()],
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('API tự chặn theo vai trò (không dựa vào việc web ẩn nút)', () => {
    it('người thực hiện không sửa tên, hạn, người thực hiện → 403', async () => {
      const task = await createTask()
      for (const body of [{ ten: 'x' }, { hetHan: '2026-12-31' }, { nguoiThucHienIds: [ASSIGNEE.toHexString(), FOLLOWER.toHexString()] }]) {
        const res = await call('PATCH', `/api/cong-viec/${task.id}`, ASSIGNEE, body)
        expect(res.statusCode).toBe(403)
        expect(res.json().error.code).toBe('KHONG_CO_QUYEN')
      }
    })

    it('người theo dõi không đổi trạng thái, không cập nhật tiến độ, không xóa', async () => {
      const task = await createTask()
      expect((await call('POST', `/api/cong-viec/${task.id}/trang-thai`, FOLLOWER, { trangThai: 'DANG_LAM' })).statusCode).toBe(403)
      expect((await call('POST', `/api/cong-viec/${task.id}/tien-do`, FOLLOWER, { tienDo: 10 })).statusCode).toBe(403)
      expect((await call('DELETE', `/api/cong-viec/${task.id}`, FOLLOWER)).statusCode).toBe(403)
    })

    it('người ngoài trong cùng công ty → 404', async () => {
      const task = await createTask()
      expect((await call('GET', `/api/cong-viec/${task.id}`, OUTSIDER)).statusCode).toBe(404)
      expect((await call('GET', `/api/cong-viec/${task.id}/lich-su`, OUTSIDER)).statusCode).toBe(404)
    })

    it('đi hết luồng qua HTTP; HOAN_THANH thì không sửa, không xóa', async () => {
      const task = await createTask()
      const changeStatus = async (actor: ObjectId, body: object) => {
        const res = await call('POST', `/api/cong-viec/${task.id}/trang-thai`, actor, body)
        expect(res.statusCode, res.body).toBe(200)
        return res.json().data
      }
      await changeStatus(ASSIGNEE, { trangThai: 'DANG_LAM' })
      expect((await changeStatus(ASSIGNEE, { trangThai: 'CHO_DUYET' })).tienDo).toBe(100)
      expect((await call('POST', `/api/cong-viec/${task.id}/trang-thai`, ASSIGNER, { trangThai: 'DANG_LAM' })).statusCode).toBe(400)
      await changeStatus(ASSIGNER, { trangThai: 'DANG_LAM', lyDo: 'Thiếu biên bản' })
      await changeStatus(ASSIGNEE, { trangThai: 'CHO_DUYET' })
      const done = await changeStatus(ASSIGNER, { trangThai: 'HOAN_THANH' })
      // Hoàn thành là trạng thái cuối: không còn quyền thao tác nào.
      expect(Object.values(done.quyen).every((x) => x === false)).toBe(true)
      expect((await call('PATCH', `/api/cong-viec/${task.id}`, ASSIGNER, { ten: 'x' })).statusCode).toBe(409)
      expect((await call('DELETE', `/api/cong-viec/${task.id}`, ASSIGNER)).statusCode).toBe(409)
    })
  })

  describe('lưu trữ Mongo', () => {
    it('không ghi trường undefined/null; tham chiếu lưu dạng ObjectId', async () => {
      const task = await createTask({ duAnId: undefined, batDau: undefined, hetHan: undefined, moTa: undefined })
      const doc = await db.collection(COLLECTIONS.tasks).findOne({ _id: new ObjectId(task.id) })
      expect(doc).not.toBeNull()
      for (const [k, v] of Object.entries(doc!)) {
        expect(v, `trường ${k}`).not.toBeUndefined()
        expect(v, `trường ${k}`).not.toBeNull()
      }
      for (const k of ['duAnId', 'batDau', 'hetHan', 'moTa', 'deletedAt']) expect(doc).not.toHaveProperty(k)
      expect(doc!.congTyId).toBeInstanceOf(ObjectId)
      expect(doc!.nguoiThucHienIds[0]).toBeInstanceOf(ObjectId)
    })

    it('PATCH với null thì $unset trường, không để lại null', async () => {
      const task = await createTask()
      await call('PATCH', `/api/cong-viec/${task.id}`, ASSIGNER, { hetHan: null, duAnId: null, batDau: null })
      const doc = await db.collection(COLLECTIONS.tasks).findOne({ _id: new ObjectId(task.id) })
      for (const k of ['hetHan', 'duAnId', 'batDau']) expect(doc).not.toHaveProperty(k)
    })

    it('xóa mềm: bản ghi còn, có deletedAt, biến khỏi danh sách', async () => {
      const task = await createTask()
      expect((await call('DELETE', `/api/cong-viec/${task.id}`, ASSIGNER)).json()).toEqual({ data: { id: task.id } })
      const doc = await db.collection(COLLECTIONS.tasks).findOne({ _id: new ObjectId(task.id) })
      expect(doc!.deletedAt).toBeInstanceOf(Date)
      expect((await call('GET', '/api/cong-viec', ASSIGNER)).json().meta.total).toBe(0)
    })

    it('20 yêu cầu tạo đồng thời: mã không trùng, liền nhau CV-0001..CV-0020', async () => {
      const created = await Promise.all(Array.from({ length: 20 }, () => createTask()))
      const codes = created.map((x) => x.ma).sort()
      expect(codes).toEqual(Array.from({ length: 20 }, (_, i) => `CV-${String(i + 1).padStart(4, '0')}`))
    })

    it('một lần PATCH đổi 5 trường → 1 bản ghi lịch sử', async () => {
      const task = await createTask()
      await call('PATCH', `/api/cong-viec/${task.id}`, ASSIGNER, {
        ten: 'Tên mới',
        moTa: 'Mô tả',
        uuTien: 'THAP',
        hetHan: '2026-06-30',
        nguoiTheoDoiIds: [OUTSIDER.toHexString()],
      })
      const history = (await call('GET', `/api/cong-viec/${task.id}/lich-su`, ASSIGNER)).json().data
      const edits = history.filter((x: { hanhDong: string }) => x.hanhDong === 'SUA')
      expect(edits).toHaveLength(1)
      expect(edits[0].thayDoi).toHaveLength(5)
      expect(await db.collection(COLLECTIONS.history).countDocuments({ congViecId: new ObjectId(task.id) })).toBe(2)
    })

    it('truy vấn "Việc của tôi" dùng index, không quét toàn bộ collection', async () => {
      const plan = await db
        .collection(COLLECTIONS.tasks)
        .find({ congTyId: COMPANY, nguoiThucHienIds: ASSIGNEE, deletedAt: { $exists: false } })
        .sort({ hanSapXep: 1, _id: 1 })
        .explain('queryPlanner')
      const planText = JSON.stringify(plan.queryPlanner.winningPlan)
      expect(planText).toContain('IXSCAN')
      expect(planText).not.toContain('COLLSCAN')
      expect(planText).not.toContain('"SORT"')
    })
  })

  describe('danh sách: lọc, tìm, sắp xếp, phân trang', () => {
    beforeEach(async () => {
      await createTask({ ten: 'Nghiệm thu cọc T5', hetHan: '2026-06-01', batDau: '2026-05-01' })
      await createTask({ ten: 'Đổ bê tông bệ trụ T6', hetHan: '2026-06-03', batDau: '2026-05-01', uuTien: 'THAP' })
      await createTask({ ten: 'Việc chung không hạn', duAnId: undefined, hetHan: undefined, batDau: undefined })
      await createTask({ ten: 'Việc tương lai', hetHan: '2026-06-20' })
      await createTask({ ten: 'Việc LAM giao', nguoiThucHienIds: [ASSIGNER.toHexString()], nguoiTheoDoiIds: [] }, ASSIGNEE)
    })

    const listTasks = async (qs: string, actor = ASSIGNER) => (await call('GET', `/api/cong-viec?${qs}`, actor)).json()

    it('lọc nhanh', async () => {
      expect((await listTasks('nhanh=TOI_GIAO')).meta.total).toBe(4)
      expect((await listTasks('nhanh=CUA_TOI')).meta.total).toBe(1)
      expect((await listTasks('nhanh=THEO_DOI')).meta.total).toBe(0)
      expect((await listTasks('nhanh=TAT_CA')).meta.total).toBe(5)
      expect((await listTasks('nhanh=THEO_DOI', FOLLOWER)).meta.total).toBe(4)
    })

    it('số đếm mỗi lọc nhanh, áp cùng bộ lọc phụ', async () => {
      const res = await call('GET', '/api/cong-viec/dem', ASSIGNER)
      expect(res.json()).toEqual({ data: { CUA_TOI: 1, TOI_GIAO: 4, THEO_DOI: 0, TAT_CA: 5 } })
      const byPriority = await call('GET', '/api/cong-viec/dem?uuTien=THAP', ASSIGNER)
      expect(byPriority.json().data.TAT_CA).toBe(1)
    })

    it('lọc dự án và "Việc chung"', async () => {
      expect((await listTasks('duAnId=CHUNG')).data.map((x: { ten: string }) => x.ten)).toEqual(['Việc chung không hạn'])
      expect((await listTasks(`duAnId=${PROJECT.toHexString()}&nhanh=TOI_GIAO`)).meta.total).toBe(3)
    })

    it('lọc Quá hạn có phân trang ở server (hôm nay VN = 05/06)', async () => {
      const t1 = await listTasks('trangThai=QUA_HAN&limit=1&page=1')
      const t2 = await listTasks('trangThai=QUA_HAN&limit=1&page=2')
      expect(t1.meta.total).toBe(2)
      expect(t1.data[0].hetHan).toBe('2026-06-01')
      expect(t2.data[0].hetHan).toBe('2026-06-03')
      expect([t1.data[0].quaHan, t2.data[0].quaHan]).toEqual([true, true])
    })

    it('Quá hạn đổi đúng lúc 00:00 giờ VN', async () => {
      now = new Date('2026-06-03T16:59:59Z') // 23:59:59 VN 03/06
      expect((await listTasks('trangThai=QUA_HAN')).meta.total).toBe(1)
      now = new Date('2026-06-03T17:00:00Z') // 00:00 VN 04/06
      expect((await listTasks('trangThai=QUA_HAN')).meta.total).toBe(2)
    })

    it('tìm theo tên không dấu và theo mã', async () => {
      expect((await listTasks('q=be tong')).data.map((x: { ten: string }) => x.ten)).toEqual(['Đổ bê tông bệ trụ T6'])
      expect((await listTasks('q=NGHIEM')).meta.total).toBe(1)
      expect((await listTasks('q=cv-0002')).data[0].ma).toBe('CV-0002')
      expect((await listTasks('q=(.*')).meta.total).toBe(0) // ký tự regex được thoát, không lỗi
    })

    it('sắp xếp theo hạn: tăng dần, việc không hạn nằm cuối', async () => {
      const deadlines = (await listTasks('sapXep=hetHan_asc')).data.map((x: { hetHan?: string }) => x.hetHan ?? null)
      expect(deadlines.at(-1)).toBeNull()
      const withDeadline = deadlines.filter(Boolean)
      expect(withDeadline).toEqual([...withDeadline].sort())
    })

    it('query sai → 400 tiếng Việt', async () => {
      const res = await call('GET', '/api/cong-viec?limit=1000', ASSIGNER)
      expect(res.statusCode).toBe(400)
      expect(res.json().error.message).toContain('tối đa là 100')
    })

    it('hạn trước ngày bắt đầu → 400 tiếng Việt', async () => {
      const res = await call('POST', '/api/cong-viec', ASSIGNER, {
        ten: 'x',
        nguoiThucHienIds: [ASSIGNEE.toHexString()],
        batDau: '2026-06-10',
        hetHan: '2026-06-01',
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error.message).toContain('Hạn không được trước ngày bắt đầu')
    })
  })
  describe('hồi quy sau review', () => {
    it('PATCH chỉ gửi {ten}: ưu tiên và người theo dõi giữ nguyên, lịch sử đúng 1 thay đổi', async () => {
      const task = await createTask({ uuTien: 'CAO' })
      const res = await call('PATCH', `/api/cong-viec/${task.id}`, ASSIGNER, { ten: 'Chỉ đổi tên' })
      expect(res.statusCode, res.body).toBe(200)
      expect(res.json().data).toMatchObject({ ten: 'Chỉ đổi tên', uuTien: 'CAO', nguoiTheoDoiIds: [FOLLOWER.toHexString()] })
      expect((await call('GET', `/api/cong-viec/${task.id}`, FOLLOWER)).statusCode).toBe(200)
      const history = (await call('GET', `/api/cong-viec/${task.id}/lich-su`, ASSIGNER)).json().data
      const edits = history.filter((x: { hanhDong: string }) => x.hanhDong === 'SUA')
      expect(edits).toHaveLength(1)
      expect(edits[0].thayDoi).toEqual([{ truong: 'ten', tu: 'Nghiệm thu cọc khoan nhồi trụ T5', den: 'Chỉ đổi tên' }])
    })

    it('PATCH {hetHan: null} không đụng tới ưu tiên và người theo dõi', async () => {
      const task = await createTask({ uuTien: 'CAO' })
      const updated = (await call('PATCH', `/api/cong-viec/${task.id}`, ASSIGNER, { hetHan: null })).json().data
      expect(updated.hetHan).toBeUndefined()
      expect(updated).toMatchObject({ uuTien: 'CAO', nguoiTheoDoiIds: [FOLLOWER.toHexString()] })
    })

    it('tiến độ không nhận null, chuỗi rỗng, chuỗi số, boolean, số lẻ, ngoài 0..100', async () => {
      const task = await createTask()
      await call('POST', `/api/cong-viec/${task.id}/trang-thai`, ASSIGNEE, { trangThai: 'DANG_LAM' })
      await call('POST', `/api/cong-viec/${task.id}/tien-do`, ASSIGNEE, { tienDo: 70 })
      for (const tienDo of [null, '', '50', true, [50], 50.5, 101, -1]) {
        const res = await call('POST', `/api/cong-viec/${task.id}/tien-do`, ASSIGNEE, { tienDo })
        expect(res.statusCode, JSON.stringify(tienDo)).toBe(400)
        expect(res.json().error.code).toBe('VALIDATION')
      }
      expect((await call('GET', `/api/cong-viec/${task.id}`, ASSIGNEE)).json().data.tienDo).toBe(70)
    })

    it('URL mã hóa sai và tham số quá dài vẫn trả đúng dạng { error: { code, message } }', async () => {
      const badUrl = await call('GET', '/api/cong-viec/%zz', ASSIGNER)
      expect(badUrl.statusCode).toBe(400)
      expect(badUrl.json()).toEqual({ error: { code: 'VALIDATION', message: expect.any(String) } })
      const tooLong = await call('GET', `/api/cong-viec/${'a'.repeat(200)}`, ASSIGNER)
      expect(tooLong.json()).toEqual({ error: { code: expect.any(String), message: expect.any(String) } })
    })

    it('lỗi sai kiểu dữ liệu cũng báo tiếng Việt', async () => {
      const task = await createTask()
      const res = await call('POST', `/api/cong-viec/${task.id}/trang-thai`, ASSIGNEE, ['khong-phai-object'])
      expect(res.statusCode).toBe(400)
      expect(res.json().error.message).not.toMatch(/Invalid input|expected/)
    })

    it('id viết hoa được chuẩn hóa: không bị coi là hai người khác nhau', async () => {
      const upperCaseId = ASSIGNEE.toHexString().toUpperCase()
      const task = await createTask({ nguoiThucHienIds: [upperCaseId], nguoiTheoDoiIds: [ASSIGNEE.toHexString(), FOLLOWER.toHexString()] })
      expect(task.nguoiThucHienIds).toEqual([ASSIGNEE.toHexString()])
      expect(task.nguoiTheoDoiIds).toEqual([FOLLOWER.toHexString()])
      await call('PATCH', `/api/cong-viec/${task.id}`, ASSIGNER, { nguoiThucHienIds: [upperCaseId] })
      const history = (await call('GET', `/api/cong-viec/${task.id}/lich-su`, ASSIGNER)).json().data
      expect(history.filter((x: { hanhDong: string }) => x.hanhDong === 'SUA')).toHaveLength(0)
    })

    it('id sai định dạng → 400', async () => {
      expect((await call('GET', '/api/cong-viec/khong-phai-id', ASSIGNER)).statusCode).toBe(400)
      expect((await call('GET', '/api/cong-viec?duAnId=xyz', ASSIGNER)).statusCode).toBe(400)
    })

    it('"Tất cả" kèm bộ lọc phụ vẫn dùng 3 index vai trò và không sắp xếp trong bộ nhớ', async () => {
      const col = db.collection<TaskDoc>(COLLECTIONS.tasks)
      const baseFilter = { congTyId: COMPANY.toHexString(), userId: ASSIGNER.toHexString(), today: '2026-06-05' }
      const filters = [
        { trangThai: 'DANG_LAM' as const },
        { trangThai: 'QUA_HAN' as const },
        { uuTien: 'CAO' as const },
        { duAnId: null },
        { q: 'coc' },
      ]
      for (const extra of filters) {
        for (const quickFilter of ['TAT_CA', 'CUA_TOI', 'TOI_GIAO', 'THEO_DOI'] as const) {
          const plan = await col
            .find(buildTaskFilter({ ...baseFilter, ...extra }, quickFilter))
            .sort({ hanSapXep: 1, _id: 1 })
            .limit(20)
            .explain('queryPlanner')
          const planText = JSON.stringify(plan.queryPlanner.winningPlan)
          const label = `${quickFilter} + ${JSON.stringify(extra)}`
          expect(planText, label).not.toContain('COLLSCAN')
          expect(planText, label).not.toContain('"stage":"SORT"')
          expect(planText, label).not.toContain('ma_duy_nhat_trong_cong_ty')
          expect(planText, label).toMatch(/ds_viec_cua_toi|ds_viec_toi_giao|ds_dang_theo_doi/)
        }
      }
    })

    it('truy vấn lịch sử dùng index, không sắp xếp trong bộ nhớ', async () => {
      const plan = await db
        .collection(COLLECTIONS.history)
        .find({ congTyId: COMPANY, congViecId: new ObjectId() })
        .sort({ luc: -1, _id: -1 })
        .explain('queryPlanner')
      const planText = JSON.stringify(plan.queryPlanner.winningPlan)
      expect(planText).toContain('IXSCAN')
      expect(planText).not.toContain('"stage":"SORT"')
    })

    it('nhiều người cập nhật tiến độ cùng lúc: chuỗi lịch sử "từ → đến" luôn liền mạch', async () => {
      const task = await createTask({ nguoiThucHienIds: [ASSIGNEE.toHexString(), ASSIGNER.toHexString()] })
      await call('POST', `/api/cong-viec/${task.id}/trang-thai`, ASSIGNEE, { trangThai: 'DANG_LAM' })
      const results = await Promise.all(
        [10, 20, 30, 40, 50, 60].map((tienDo, i) =>
          call('POST', `/api/cong-viec/${task.id}/tien-do`, i % 2 ? ASSIGNEE : ASSIGNER, { tienDo }),
        ),
      )
      for (const r of results) expect([200, 409], r.body).toContain(r.statusCode)
      const history = (await call('GET', `/api/cong-viec/${task.id}/lich-su`, ASSIGNER)).json().data
      const steps = history
        .filter((x: { hanhDong: string }) => x.hanhDong === 'CAP_NHAT_TIEN_DO')
        .reverse()
        .map((x: { thayDoi: Array<{ tu: number; den: number }> }) => x.thayDoi[0]!)
      expect(steps.length).toBe(results.filter((r) => r.statusCode === 200).length)
      let previous = 0
      for (const step of steps) {
        expect(step.tu).toBe(previous)
        previous = step.den
      }
      expect((await call('GET', `/api/cong-viec/${task.id}`, ASSIGNER)).json().data.tienDo).toBe(previous)
    })

    it('ghi lịch sử lỗi thì cả thao tác được hoàn tác: không có việc "mồ côi", không nhảy số', async (ctx) => {
      if (!supportsTransactions) ctx.skip()
      const task1 = await createTask()
      // Buộc mọi lệnh ghi lịch sử thất bại.
      await db.command({
        collMod: COLLECTIONS.history,
        validator: { fieldThatNeverExists: { $exists: true } },
        validationAction: 'error',
      })
      try {
        const createRes = await call('POST', '/api/cong-viec', ASSIGNER, { ten: 'Sẽ không được lưu', nguoiThucHienIds: [ASSIGNEE.toHexString()] })
        expect(createRes.statusCode).toBe(500)
        expect(createRes.json().error.code).toBe('LOI_HE_THONG')
        const patchRes = await call('PATCH', `/api/cong-viec/${task1.id}`, ASSIGNER, { ten: 'Không được đổi' })
        expect(patchRes.statusCode).toBe(500)
      } finally {
        await db.command({ collMod: COLLECTIONS.history, validator: {}, validationLevel: 'off' })
      }
      expect(await db.collection(COLLECTIONS.tasks).countDocuments()).toBe(1)
      expect((await call('GET', `/api/cong-viec/${task1.id}`, ASSIGNER)).json().data.ten).toBe(task1.ten)
      // Lượt tăng bộ đếm của lần tạo thất bại đã được hoàn tác → việc tiếp theo là CV-0002, không phải CV-0003.
      expect((await createTask()).ma).toBe('CV-0002')
    })
  })
  describe('tùy chọn: việc con và bình luận qua HTTP', () => {
    it('luồng việc con: thêm (201), đánh dấu, xóa; quyền và dạng response', async () => {
      const task = await createTask()
      const addRes = await call('POST', `/api/cong-viec/${task.id}/viec-con`, ASSIGNER, { ten: 'Khoan cọc' })
      expect(addRes.statusCode, addRes.body).toBe(201)
      const subtaskId = addRes.json().data.viecCon[0].id
      expect(typeof subtaskId).toBe('string')
      await call('POST', `/api/cong-viec/${task.id}/viec-con`, ASSIGNER, { ten: 'Đổ bê tông cọc' })
      expect((await call('POST', `/api/cong-viec/${task.id}/viec-con`, ASSIGNEE, { ten: 'x' })).statusCode).toBe(403)
      expect((await call('POST', `/api/cong-viec/${task.id}/viec-con`, ASSIGNER, { ten: '  ' })).statusCode).toBe(400)

      await call('POST', `/api/cong-viec/${task.id}/trang-thai`, ASSIGNEE, { trangThai: 'DANG_LAM' })
      const markRes = await call('POST', `/api/cong-viec/${task.id}/viec-con/${subtaskId}/danh-dau`, ASSIGNEE, { xong: true })
      expect(markRes.statusCode, markRes.body).toBe(200)
      expect(markRes.json().data.tienDo).toBe(50)
      expect((await call('POST', `/api/cong-viec/${task.id}/viec-con/${subtaskId}/danh-dau`, ASSIGNEE, { xong: 'có' })).statusCode).toBe(400)
      expect((await call('POST', `/api/cong-viec/${task.id}/viec-con/${subtaskId}/danh-dau`, FOLLOWER, { xong: false })).statusCode).toBe(403)
      expect((await call('POST', `/api/cong-viec/${task.id}/tien-do`, ASSIGNEE, { tienDo: 90 })).statusCode).toBe(409)
      expect((await call('POST', `/api/cong-viec/${task.id}/trang-thai`, ASSIGNEE, { trangThai: 'CHO_DUYET' })).statusCode).toBe(409)

      const secondSubtaskId = markRes.json().data.viecCon[1].id
      const removeRes = await call('DELETE', `/api/cong-viec/${task.id}/viec-con/${secondSubtaskId}`, ASSIGNER)
      expect(removeRes.json().data).toMatchObject({ tienDo: 100, viecCon: [{ id: subtaskId, ten: 'Khoan cọc', xong: true }] })

      const doc = await db.collection(COLLECTIONS.tasks).findOne({ _id: new ObjectId(task.id) })
      expect(doc!.viecCon).toEqual([{ id: subtaskId, ten: 'Khoan cọc', xong: true }])
    })

    it('bình luận: người liên quan viết/đọc, người ngoài và công ty khác nhận 404', async () => {
      const task = await createTask()
      const postRes = await call('POST', `/api/cong-viec/${task.id}/binh-luan`, FOLLOWER, { noiDung: '  Cần biên bản có chữ ký TVGS  ' })
      expect(postRes.statusCode, postRes.body).toBe(201)
      expect(postRes.json().data).toMatchObject({ nguoiVietId: FOLLOWER.toHexString(), noiDung: 'Cần biên bản có chữ ký TVGS' })
      await call('POST', `/api/cong-viec/${task.id}/binh-luan`, ASSIGNEE, { noiDung: 'Đã bổ sung' })
      const comments = (await call('GET', `/api/cong-viec/${task.id}/binh-luan`, ASSIGNER)).json()
      expect(comments.data.map((b: { noiDung: string }) => b.noiDung)).toEqual(['Cần biên bản có chữ ký TVGS', 'Đã bổ sung'])
      expect((await call('GET', `/api/cong-viec/${task.id}/binh-luan`, OUTSIDER)).statusCode).toBe(404)
      expect((await call('POST', `/api/cong-viec/${task.id}/binh-luan`, OTHER_COMPANY_EMPLOYEE, { noiDung: 'x' })).statusCode).toBe(404)
      expect((await call('POST', `/api/cong-viec/${task.id}/binh-luan`, ASSIGNER, { noiDung: '' })).statusCode).toBe(400)
      const stored = await db.collection(COLLECTIONS.comments).findOne({})
      for (const [k, v] of Object.entries(stored!)) expect(v, k).not.toBeUndefined()
      expect(stored!.congTyId).toBeInstanceOf(ObjectId)
    })
  })
})
