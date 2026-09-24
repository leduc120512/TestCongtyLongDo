import type { FastifyInstance } from 'fastify'
import { MongoClient, ObjectId, type Db } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { taoApp } from '../../src/app.ts'
import { taoIndex, TEN_BANG } from '../../src/db/ket-noi.ts'
import { xayDungBoLoc, type CongViecDoc } from '../../src/repositories/cong-viec.repository.ts'
import { taoKhoMongo } from '../../src/repositories/index.ts'

/**
 * Test tích hợp: HTTP thật (app.inject) + MongoDB thật, DB riêng cho test.
 * Cần Mongo đang chạy (docker compose up -d). Không kết nối được thì bỏ qua và in cảnh báo.
 */

const MONGO_GOC = process.env.MONGO_URL_TEST ?? 'mongodb://localhost:27017'
const TEN_DB = `longdo_congviec_test_${process.pid}`

async function thuKetNoi(): Promise<MongoClient | null> {
  const client = new MongoClient(`${MONGO_GOC}/${TEN_DB}?directConnection=true`, {
    serverSelectionTimeoutMS: 1500,
    ignoreUndefined: true,
  })
  try {
    await client.connect()
    return client
  } catch {
    console.warn(`⚠ Bỏ qua test tích hợp: không kết nối được MongoDB tại ${MONGO_GOC}`)
    return null
  }
}

const client = await thuKetNoi()

const CT = new ObjectId()
const CT_KHAC = new ObjectId()
const id = () => new ObjectId()
const GIAO = id()
const LAM = id()
const XEM = id()
const NGOAI = id()
const NV_CT_KHAC = id()
const DU_AN = id()

describe.skipIf(!client)('API tích hợp với MongoDB', () => {
  let db: Db
  let app: FastifyInstance
  let coGiaoDich = false
  let bayGio = new Date('2026-06-05T03:00:00Z')
  const token: Record<string, string> = {}

  const goi = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, ai?: ObjectId, payload?: unknown) =>
    app.inject({
      method,
      url,
      headers: ai ? { authorization: `Bearer ${token[ai.toHexString()]}` } : {},
      ...(payload !== undefined ? { payload: payload as object } : {}),
    })

  const taoViec = async (them: Record<string, unknown> = {}, ai = GIAO) => {
    const res = await goi('POST', '/api/cong-viec', ai, {
      ten: 'Nghiệm thu cọc khoan nhồi trụ T5',
      nguoiThucHienIds: [LAM.toHexString()],
      nguoiTheoDoiIds: [XEM.toHexString()],
      duAnId: DU_AN.toHexString(),
      uuTien: 'CAO',
      batDau: '2026-06-01',
      hetHan: '2026-06-10',
      ...them,
    })
    expect(res.statusCode, res.body).toBe(201)
    return res.json().data
  }

  beforeAll(async () => {
    db = client!.db(TEN_DB)
    await db.dropDatabase()
    await taoIndex(db)
    await db.collection(TEN_BANG.nhanVien).insertMany([
      { _id: GIAO, congTyId: CT, ten: 'Nguyễn Văn An', chucVu: 'Chỉ huy trưởng' },
      { _id: LAM, congTyId: CT, ten: 'Lê Văn Cường', chucVu: 'Kỹ sư' },
      { _id: XEM, congTyId: CT, ten: 'Vũ Thị Giang', chucVu: 'QA/QC' },
      { _id: NGOAI, congTyId: CT, ten: 'Ngô Thị Nga', chucVu: 'Thư ký' },
      { _id: NV_CT_KHAC, congTyId: CT_KHAC, ten: 'Người công ty khác', chucVu: 'Kỹ sư' },
    ])
    await db.collection(TEN_BANG.duAn).insertOne({ _id: DU_AN, congTyId: CT, ma: 'CNC', ten: 'Cầu Nam Căn' })
    const hello = await db.admin().command({ hello: 1 })
    coGiaoDich = Boolean(hello.setName)
    app = await taoApp({ kho: taoKhoMongo(client!, db, coGiaoDich), jwtSecret: 'bi-mat-test', dongHo: () => bayGio })
    for (const nv of [GIAO, LAM, XEM, NGOAI, NV_CT_KHAC]) {
      const res = await goi('POST', '/api/xac-thuc/dang-nhap-gia-lap', undefined, { userId: nv.toHexString() })
      token[nv.toHexString()] = res.json().data.token
    }
  })

  beforeEach(async () => {
    bayGio = new Date('2026-06-05T03:00:00Z')
    await db.collection(TEN_BANG.congViec).deleteMany({})
    await db.collection(TEN_BANG.lichSu).deleteMany({})
    await db.collection(TEN_BANG.boDem).deleteMany({})
  })

  afterAll(async () => {
    await app?.close()
    await db?.dropDatabase()
    await client?.close()
  })

  describe('xác thực và dạng response', () => {
    it('không có token → 401 { error: { code, message } }', async () => {
      const res = await goi('GET', '/api/cong-viec')
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({ error: { code: 'KHONG_DANG_NHAP', message: expect.any(String) } })
    })

    it('token giả mạo → 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/cong-viec', headers: { authorization: 'Bearer abc.def.ghi' } })
      expect(res.statusCode).toBe(401)
    })

    it('token chứa congTyId lấy từ hồ sơ nhân viên', async () => {
      const payload = app.jwt.decode<{ userId: string; congTyId: string }>(token[GIAO.toHexString()]!)
      expect(payload).toMatchObject({ userId: GIAO.toHexString(), congTyId: CT.toHexString() })
    })

    it('đường dẫn không tồn tại → 404 đúng dạng lỗi', async () => {
      const res = await goi('GET', '/api/khong-co', GIAO)
      expect(res.json()).toEqual({ error: { code: 'KHONG_TIM_THAY', message: expect.any(String) } })
    })

    it('JSON sai cú pháp → 400 VALIDATION', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cong-viec',
        headers: { authorization: `Bearer ${token[GIAO.toHexString()]}`, 'content-type': 'application/json' },
        payload: '{sai',
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error.code).toBe('VALIDATION')
    })

    it('chi tiết trả { data } với id là chuỗi, không lộ trường nội bộ', async () => {
      const cv = await taoViec()
      const res = await goi('GET', `/api/cong-viec/${cv.id}`, GIAO)
      const { data } = res.json()
      expect(typeof data.id).toBe('string')
      expect(data.nguoiThucHienIds).toEqual([LAM.toHexString()])
      for (const noiBo of ['_id', 'tuKhoa', 'hanSapXep', 'deletedAt', 'phienBan']) expect(data).not.toHaveProperty(noiBo)
    })

    it('danh sách trả { data, meta: { page, limit, total } }', async () => {
      await taoViec()
      const res = await goi('GET', '/api/cong-viec?page=1&limit=5', GIAO)
      expect(res.json()).toEqual({ data: [expect.any(Object)], meta: { page: 1, limit: 5, total: 1 } })
    })
  })

  describe('không tin dữ liệu client gửi', () => {
    it('bỏ qua congTyId, nguoiGiaoId, trangThai, tienDo, ma trong body', async () => {
      const cv = await taoViec({
        congTyId: CT_KHAC.toHexString(),
        nguoiGiaoId: NGOAI.toHexString(),
        trangThai: 'HOAN_THANH',
        tienDo: 100,
        ma: 'CV-9999',
      })
      expect(cv).toMatchObject({
        congTyId: CT.toHexString(),
        nguoiGiaoId: GIAO.toHexString(),
        trangThai: 'CHUA_BAT_DAU',
        tienDo: 0,
        ma: 'CV-0001',
      })
    })

    it('người công ty khác không thấy, không sửa, không xóa được', async () => {
      const cv = await taoViec()
      expect((await goi('GET', `/api/cong-viec/${cv.id}`, NV_CT_KHAC)).statusCode).toBe(404)
      expect((await goi('PATCH', `/api/cong-viec/${cv.id}`, NV_CT_KHAC, { ten: 'x' })).statusCode).toBe(404)
      expect((await goi('DELETE', `/api/cong-viec/${cv.id}`, NV_CT_KHAC)).statusCode).toBe(404)
      expect((await goi('GET', '/api/cong-viec', NV_CT_KHAC)).json().meta.total).toBe(0)
    })

    it('không giao việc được cho người công ty khác', async () => {
      const res = await goi('POST', '/api/cong-viec', GIAO, {
        ten: 'x',
        nguoiThucHienIds: [NV_CT_KHAC.toHexString()],
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('API tự chặn theo vai trò (không dựa vào việc web ẩn nút)', () => {
    it('người thực hiện không sửa tên, hạn, người thực hiện → 403', async () => {
      const cv = await taoViec()
      for (const body of [{ ten: 'x' }, { hetHan: '2026-12-31' }, { nguoiThucHienIds: [LAM.toHexString(), XEM.toHexString()] }]) {
        const res = await goi('PATCH', `/api/cong-viec/${cv.id}`, LAM, body)
        expect(res.statusCode).toBe(403)
        expect(res.json().error.code).toBe('KHONG_CO_QUYEN')
      }
    })

    it('người theo dõi không đổi trạng thái, không cập nhật tiến độ, không xóa', async () => {
      const cv = await taoViec()
      expect((await goi('POST', `/api/cong-viec/${cv.id}/trang-thai`, XEM, { trangThai: 'DANG_LAM' })).statusCode).toBe(403)
      expect((await goi('POST', `/api/cong-viec/${cv.id}/tien-do`, XEM, { tienDo: 10 })).statusCode).toBe(403)
      expect((await goi('DELETE', `/api/cong-viec/${cv.id}`, XEM)).statusCode).toBe(403)
    })

    it('người ngoài trong cùng công ty → 404', async () => {
      const cv = await taoViec()
      expect((await goi('GET', `/api/cong-viec/${cv.id}`, NGOAI)).statusCode).toBe(404)
      expect((await goi('GET', `/api/cong-viec/${cv.id}/lich-su`, NGOAI)).statusCode).toBe(404)
    })

    it('đi hết luồng qua HTTP; HOAN_THANH thì không sửa, không xóa', async () => {
      const cv = await taoViec()
      const buoc = async (ai: ObjectId, body: object) => {
        const res = await goi('POST', `/api/cong-viec/${cv.id}/trang-thai`, ai, body)
        expect(res.statusCode, res.body).toBe(200)
        return res.json().data
      }
      await buoc(LAM, { trangThai: 'DANG_LAM' })
      expect((await buoc(LAM, { trangThai: 'CHO_DUYET' })).tienDo).toBe(100)
      expect((await goi('POST', `/api/cong-viec/${cv.id}/trang-thai`, GIAO, { trangThai: 'DANG_LAM' })).statusCode).toBe(400)
      await buoc(GIAO, { trangThai: 'DANG_LAM', lyDo: 'Thiếu biên bản' })
      await buoc(LAM, { trangThai: 'CHO_DUYET' })
      const xong = await buoc(GIAO, { trangThai: 'HOAN_THANH' })
      expect(xong.quyen).toEqual({ sua: false, xoa: false, batDau: false, guiDuyet: false, duyet: false, traLai: false, capNhatTienDo: false })
      expect((await goi('PATCH', `/api/cong-viec/${cv.id}`, GIAO, { ten: 'x' })).statusCode).toBe(409)
      expect((await goi('DELETE', `/api/cong-viec/${cv.id}`, GIAO)).statusCode).toBe(409)
    })
  })

  describe('lưu trữ Mongo', () => {
    it('không ghi trường undefined/null; tham chiếu lưu dạng ObjectId', async () => {
      const cv = await taoViec({ duAnId: undefined, batDau: undefined, hetHan: undefined, moTa: undefined })
      const doc = await db.collection(TEN_BANG.congViec).findOne({ _id: new ObjectId(cv.id) })
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
      const cv = await taoViec()
      await goi('PATCH', `/api/cong-viec/${cv.id}`, GIAO, { hetHan: null, duAnId: null, batDau: null })
      const doc = await db.collection(TEN_BANG.congViec).findOne({ _id: new ObjectId(cv.id) })
      for (const k of ['hetHan', 'duAnId', 'batDau']) expect(doc).not.toHaveProperty(k)
    })

    it('xóa mềm: bản ghi còn, có deletedAt, biến khỏi danh sách', async () => {
      const cv = await taoViec()
      expect((await goi('DELETE', `/api/cong-viec/${cv.id}`, GIAO)).json()).toEqual({ data: { id: cv.id } })
      const doc = await db.collection(TEN_BANG.congViec).findOne({ _id: new ObjectId(cv.id) })
      expect(doc!.deletedAt).toBeInstanceOf(Date)
      expect((await goi('GET', '/api/cong-viec', GIAO)).json().meta.total).toBe(0)
    })

    it('20 yêu cầu tạo đồng thời: mã không trùng, liền nhau CV-0001..CV-0020', async () => {
      const ds = await Promise.all(Array.from({ length: 20 }, () => taoViec()))
      const ma = ds.map((x) => x.ma).sort()
      expect(ma).toEqual(Array.from({ length: 20 }, (_, i) => `CV-${String(i + 1).padStart(4, '0')}`))
    })

    it('một lần PATCH đổi 5 trường → 1 bản ghi lịch sử', async () => {
      const cv = await taoViec()
      await goi('PATCH', `/api/cong-viec/${cv.id}`, GIAO, {
        ten: 'Tên mới',
        moTa: 'Mô tả',
        uuTien: 'THAP',
        hetHan: '2026-06-30',
        nguoiTheoDoiIds: [NGOAI.toHexString()],
      })
      const ls = (await goi('GET', `/api/cong-viec/${cv.id}/lich-su`, GIAO)).json().data
      const sua = ls.filter((x: { hanhDong: string }) => x.hanhDong === 'SUA')
      expect(sua).toHaveLength(1)
      expect(sua[0].thayDoi).toHaveLength(5)
      expect(await db.collection(TEN_BANG.lichSu).countDocuments({ congViecId: new ObjectId(cv.id) })).toBe(2)
    })

    it('truy vấn "Việc của tôi" dùng index, không quét toàn bộ collection', async () => {
      const plan = await db
        .collection(TEN_BANG.congViec)
        .find({ congTyId: CT, nguoiThucHienIds: LAM, deletedAt: { $exists: false } })
        .sort({ hanSapXep: 1, _id: 1 })
        .explain('queryPlanner')
      const chuoi = JSON.stringify(plan.queryPlanner.winningPlan)
      expect(chuoi).toContain('IXSCAN')
      expect(chuoi).not.toContain('COLLSCAN')
      expect(chuoi).not.toContain('"SORT"')
    })
  })

  describe('danh sách: lọc, tìm, sắp xếp, phân trang', () => {
    beforeEach(async () => {
      await taoViec({ ten: 'Nghiệm thu cọc T5', hetHan: '2026-06-01', batDau: '2026-05-01' })
      await taoViec({ ten: 'Đổ bê tông bệ trụ T6', hetHan: '2026-06-03', batDau: '2026-05-01', uuTien: 'THAP' })
      await taoViec({ ten: 'Việc chung không hạn', duAnId: undefined, hetHan: undefined, batDau: undefined })
      await taoViec({ ten: 'Việc tương lai', hetHan: '2026-06-20' })
      await taoViec({ ten: 'Việc LAM giao', nguoiThucHienIds: [GIAO.toHexString()], nguoiTheoDoiIds: [] }, LAM)
    })

    const ds = async (qs: string, ai = GIAO) => (await goi('GET', `/api/cong-viec?${qs}`, ai)).json()

    it('lọc nhanh', async () => {
      expect((await ds('nhanh=TOI_GIAO')).meta.total).toBe(4)
      expect((await ds('nhanh=CUA_TOI')).meta.total).toBe(1)
      expect((await ds('nhanh=THEO_DOI')).meta.total).toBe(0)
      expect((await ds('nhanh=TAT_CA')).meta.total).toBe(5)
      expect((await ds('nhanh=THEO_DOI', XEM)).meta.total).toBe(4)
    })

    it('số đếm mỗi lọc nhanh, áp cùng bộ lọc phụ', async () => {
      const res = await goi('GET', '/api/cong-viec/dem', GIAO)
      expect(res.json()).toEqual({ data: { CUA_TOI: 1, TOI_GIAO: 4, THEO_DOI: 0, TAT_CA: 5 } })
      const theoUuTien = await goi('GET', '/api/cong-viec/dem?uuTien=THAP', GIAO)
      expect(theoUuTien.json().data.TAT_CA).toBe(1)
    })

    it('lọc dự án và "Việc chung"', async () => {
      expect((await ds('duAnId=CHUNG')).data.map((x: { ten: string }) => x.ten)).toEqual(['Việc chung không hạn'])
      expect((await ds(`duAnId=${DU_AN.toHexString()}&nhanh=TOI_GIAO`)).meta.total).toBe(3)
    })

    it('lọc Quá hạn có phân trang ở server (hôm nay VN = 05/06)', async () => {
      const t1 = await ds('trangThai=QUA_HAN&limit=1&page=1')
      const t2 = await ds('trangThai=QUA_HAN&limit=1&page=2')
      expect(t1.meta.total).toBe(2)
      expect(t1.data[0].hetHan).toBe('2026-06-01')
      expect(t2.data[0].hetHan).toBe('2026-06-03')
      expect([t1.data[0].quaHan, t2.data[0].quaHan]).toEqual([true, true])
    })

    it('Quá hạn đổi đúng lúc 00:00 giờ VN', async () => {
      bayGio = new Date('2026-06-03T16:59:59Z') // 23:59:59 VN 03/06
      expect((await ds('trangThai=QUA_HAN')).meta.total).toBe(1)
      bayGio = new Date('2026-06-03T17:00:00Z') // 00:00 VN 04/06
      expect((await ds('trangThai=QUA_HAN')).meta.total).toBe(2)
    })

    it('tìm theo tên không dấu và theo mã', async () => {
      expect((await ds('q=be tong')).data.map((x: { ten: string }) => x.ten)).toEqual(['Đổ bê tông bệ trụ T6'])
      expect((await ds('q=NGHIEM')).meta.total).toBe(1)
      expect((await ds('q=cv-0002')).data[0].ma).toBe('CV-0002')
      expect((await ds('q=(.*')).meta.total).toBe(0) // ký tự regex được thoát, không lỗi
    })

    it('sắp xếp theo hạn: tăng dần, việc không hạn nằm cuối', async () => {
      const han = (await ds('sapXep=hetHan_asc')).data.map((x: { hetHan?: string }) => x.hetHan ?? null)
      expect(han.at(-1)).toBeNull()
      const coHan = han.filter(Boolean)
      expect(coHan).toEqual([...coHan].sort())
    })

    it('query sai → 400 tiếng Việt', async () => {
      const res = await goi('GET', '/api/cong-viec?limit=1000', GIAO)
      expect(res.statusCode).toBe(400)
      expect(res.json().error.message).toContain('tối đa là 100')
    })

    it('hạn trước ngày bắt đầu → 400 tiếng Việt', async () => {
      const res = await goi('POST', '/api/cong-viec', GIAO, {
        ten: 'x',
        nguoiThucHienIds: [LAM.toHexString()],
        batDau: '2026-06-10',
        hetHan: '2026-06-01',
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error.message).toContain('Hạn không được trước ngày bắt đầu')
    })
  })
  describe('hồi quy sau review', () => {
    it('PATCH chỉ gửi {ten}: ưu tiên và người theo dõi giữ nguyên, lịch sử đúng 1 thay đổi', async () => {
      const cv = await taoViec({ uuTien: 'CAO' })
      const res = await goi('PATCH', `/api/cong-viec/${cv.id}`, GIAO, { ten: 'Chỉ đổi tên' })
      expect(res.statusCode, res.body).toBe(200)
      expect(res.json().data).toMatchObject({ ten: 'Chỉ đổi tên', uuTien: 'CAO', nguoiTheoDoiIds: [XEM.toHexString()] })
      expect((await goi('GET', `/api/cong-viec/${cv.id}`, XEM)).statusCode).toBe(200)
      const ls = (await goi('GET', `/api/cong-viec/${cv.id}/lich-su`, GIAO)).json().data
      const sua = ls.filter((x: { hanhDong: string }) => x.hanhDong === 'SUA')
      expect(sua).toHaveLength(1)
      expect(sua[0].thayDoi).toEqual([{ truong: 'ten', tu: 'Nghiệm thu cọc khoan nhồi trụ T5', den: 'Chỉ đổi tên' }])
    })

    it('PATCH {hetHan: null} không đụng tới ưu tiên và người theo dõi', async () => {
      const cv = await taoViec({ uuTien: 'CAO' })
      const moi = (await goi('PATCH', `/api/cong-viec/${cv.id}`, GIAO, { hetHan: null })).json().data
      expect(moi.hetHan).toBeUndefined()
      expect(moi).toMatchObject({ uuTien: 'CAO', nguoiTheoDoiIds: [XEM.toHexString()] })
    })

    it('tiến độ không nhận null, chuỗi rỗng, chuỗi số, boolean, số lẻ, ngoài 0..100', async () => {
      const cv = await taoViec()
      await goi('POST', `/api/cong-viec/${cv.id}/trang-thai`, LAM, { trangThai: 'DANG_LAM' })
      await goi('POST', `/api/cong-viec/${cv.id}/tien-do`, LAM, { tienDo: 70 })
      for (const tienDo of [null, '', '50', true, [50], 50.5, 101, -1]) {
        const res = await goi('POST', `/api/cong-viec/${cv.id}/tien-do`, LAM, { tienDo })
        expect(res.statusCode, JSON.stringify(tienDo)).toBe(400)
        expect(res.json().error.code).toBe('VALIDATION')
      }
      expect((await goi('GET', `/api/cong-viec/${cv.id}`, LAM)).json().data.tienDo).toBe(70)
    })

    it('URL mã hóa sai và tham số quá dài vẫn trả đúng dạng { error: { code, message } }', async () => {
      const sai = await goi('GET', '/api/cong-viec/%zz', GIAO)
      expect(sai.statusCode).toBe(400)
      expect(sai.json()).toEqual({ error: { code: 'VALIDATION', message: expect.any(String) } })
      const dai = await goi('GET', `/api/cong-viec/${'a'.repeat(200)}`, GIAO)
      expect(dai.json()).toEqual({ error: { code: expect.any(String), message: expect.any(String) } })
    })

    it('lỗi sai kiểu dữ liệu cũng báo tiếng Việt', async () => {
      const cv = await taoViec()
      const res = await goi('POST', `/api/cong-viec/${cv.id}/trang-thai`, LAM, ['khong-phai-object'])
      expect(res.statusCode).toBe(400)
      expect(res.json().error.message).not.toMatch(/Invalid input|expected/)
    })

    it('id viết hoa được chuẩn hóa: không bị coi là hai người khác nhau', async () => {
      const hoa = LAM.toHexString().toUpperCase()
      const cv = await taoViec({ nguoiThucHienIds: [hoa], nguoiTheoDoiIds: [LAM.toHexString(), XEM.toHexString()] })
      expect(cv.nguoiThucHienIds).toEqual([LAM.toHexString()])
      expect(cv.nguoiTheoDoiIds).toEqual([XEM.toHexString()])
      await goi('PATCH', `/api/cong-viec/${cv.id}`, GIAO, { nguoiThucHienIds: [hoa] })
      const ls = (await goi('GET', `/api/cong-viec/${cv.id}/lich-su`, GIAO)).json().data
      expect(ls.filter((x: { hanhDong: string }) => x.hanhDong === 'SUA')).toHaveLength(0)
    })

    it('id sai định dạng → 400', async () => {
      expect((await goi('GET', '/api/cong-viec/khong-phai-id', GIAO)).statusCode).toBe(400)
      expect((await goi('GET', '/api/cong-viec?duAnId=xyz', GIAO)).statusCode).toBe(400)
    })

    it('"Tất cả" kèm bộ lọc phụ vẫn dùng 3 index vai trò và không sắp xếp trong bộ nhớ', async () => {
      const col = db.collection<CongViecDoc>(TEN_BANG.congViec)
      const boLocGoc = { congTyId: CT.toHexString(), userId: GIAO.toHexString(), homNay: '2026-06-05' }
      const cacBoLoc = [
        { trangThai: 'DANG_LAM' as const },
        { trangThai: 'QUA_HAN' as const },
        { uuTien: 'CAO' as const },
        { duAnId: null },
        { q: 'coc' },
      ]
      for (const phu of cacBoLoc) {
        for (const nhanh of ['TAT_CA', 'CUA_TOI', 'TOI_GIAO', 'THEO_DOI'] as const) {
          const plan = await col
            .find(xayDungBoLoc({ ...boLocGoc, ...phu }, nhanh))
            .sort({ hanSapXep: 1, _id: 1 })
            .limit(20)
            .explain('queryPlanner')
          const chuoi = JSON.stringify(plan.queryPlanner.winningPlan)
          const moTa = `${nhanh} + ${JSON.stringify(phu)}`
          expect(chuoi, moTa).not.toContain('COLLSCAN')
          expect(chuoi, moTa).not.toContain('"stage":"SORT"')
          expect(chuoi, moTa).not.toContain('ma_duy_nhat_trong_cong_ty')
          expect(chuoi, moTa).toMatch(/ds_viec_cua_toi|ds_viec_toi_giao|ds_dang_theo_doi/)
        }
      }
    })

    it('truy vấn lịch sử dùng index, không sắp xếp trong bộ nhớ', async () => {
      const plan = await db
        .collection(TEN_BANG.lichSu)
        .find({ congTyId: CT, congViecId: new ObjectId() })
        .sort({ luc: -1, _id: -1 })
        .explain('queryPlanner')
      const chuoi = JSON.stringify(plan.queryPlanner.winningPlan)
      expect(chuoi).toContain('IXSCAN')
      expect(chuoi).not.toContain('"stage":"SORT"')
    })

    it('nhiều người cập nhật tiến độ cùng lúc: chuỗi lịch sử "từ → đến" luôn liền mạch', async () => {
      const cv = await taoViec({ nguoiThucHienIds: [LAM.toHexString(), GIAO.toHexString()] })
      await goi('POST', `/api/cong-viec/${cv.id}/trang-thai`, LAM, { trangThai: 'DANG_LAM' })
      const kq = await Promise.all(
        [10, 20, 30, 40, 50, 60].map((tienDo, i) =>
          goi('POST', `/api/cong-viec/${cv.id}/tien-do`, i % 2 ? LAM : GIAO, { tienDo }),
        ),
      )
      for (const r of kq) expect([200, 409], r.body).toContain(r.statusCode)
      const ls = (await goi('GET', `/api/cong-viec/${cv.id}/lich-su`, GIAO)).json().data
      const cacBuoc = ls
        .filter((x: { hanhDong: string }) => x.hanhDong === 'CAP_NHAT_TIEN_DO')
        .reverse()
        .map((x: { thayDoi: Array<{ tu: number; den: number }> }) => x.thayDoi[0]!)
      expect(cacBuoc.length).toBe(kq.filter((r) => r.statusCode === 200).length)
      let truoc = 0
      for (const buoc of cacBuoc) {
        expect(buoc.tu).toBe(truoc)
        truoc = buoc.den
      }
      expect((await goi('GET', `/api/cong-viec/${cv.id}`, GIAO)).json().data.tienDo).toBe(truoc)
    })

    it('ghi lịch sử lỗi thì cả thao tác được hoàn tác: không có việc "mồ côi", không nhảy số', async (ctx) => {
      if (!coGiaoDich) ctx.skip()
      const cv1 = await taoViec()
      // Buộc mọi lệnh ghi lịch sử thất bại.
      await db.command({
        collMod: TEN_BANG.lichSu,
        validator: { khongBaoGioCo: { $exists: true } },
        validationAction: 'error',
      })
      try {
        const tao = await goi('POST', '/api/cong-viec', GIAO, { ten: 'Sẽ không được lưu', nguoiThucHienIds: [LAM.toHexString()] })
        expect(tao.statusCode).toBe(500)
        expect(tao.json().error.code).toBe('LOI_HE_THONG')
        const sua = await goi('PATCH', `/api/cong-viec/${cv1.id}`, GIAO, { ten: 'Không được đổi' })
        expect(sua.statusCode).toBe(500)
      } finally {
        await db.command({ collMod: TEN_BANG.lichSu, validator: {}, validationLevel: 'off' })
      }
      expect(await db.collection(TEN_BANG.congViec).countDocuments()).toBe(1)
      expect((await goi('GET', `/api/cong-viec/${cv1.id}`, GIAO)).json().data.ten).toBe(cv1.ten)
      // Lượt tăng bộ đếm của lần tạo thất bại đã được hoàn tác → việc tiếp theo là CV-0002, không phải CV-0003.
      expect((await taoViec()).ma).toBe('CV-0002')
    })
  })
})
