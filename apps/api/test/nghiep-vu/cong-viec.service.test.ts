import { DanhSachCongViecQuerySchema, type NguoiDung, type TaoCongViec } from '@longdo/contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import { LoiNghiepVu } from '../../src/loi.ts'
import { CongViecService } from '../../src/services/cong-viec.service.ts'
import { taoId, taoKhoBoNho, type KhoBoNho } from '../ho-tro/kho-bo-nho.ts'

const CT = taoId()
const CT_KHAC = taoId()
const [GIAO, LAM, LAM_2, XEM, NGOAI, NGUOI_CT_KHAC] = Array.from({ length: 6 }, taoId) as [
  string, string, string, string, string, string,
]
const DU_AN = taoId()
const DU_AN_CT_KHAC = taoId()

const nd = (userId: string, congTyId = CT): NguoiDung => ({ userId, congTyId })

/** Bắt lỗi nghiệp vụ và trả về mã lỗi, để assert gọn. */
async function maLoi(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    if (e instanceof LoiNghiepVu) return e.code
    throw e
  }
  return 'KHONG_LOI'
}

let kho: KhoBoNho
let bayGio: Date
let sv: CongViecService

const viecMoi = (them: Partial<TaoCongViec> = {}): TaoCongViec => ({
  ten: 'Nghiệm thu cọc khoan nhồi trụ T5',
  nguoiThucHienIds: [LAM],
  nguoiTheoDoiIds: [XEM],
  uuTien: 'CAO',
  batDau: '2026-06-01',
  hetHan: '2026-06-10',
  duAnId: DU_AN,
  ...them,
})

beforeEach(() => {
  kho = taoKhoBoNho()
  for (const id of [GIAO, LAM, LAM_2, XEM, NGOAI]) kho.themNhanVien({ id, congTyId: CT, ten: id, chucVu: 'KS' })
  kho.themNhanVien({ id: NGUOI_CT_KHAC, congTyId: CT_KHAC, ten: 'khác', chucVu: 'KS' })
  kho.themDuAn({ id: DU_AN, congTyId: CT, ma: 'CNC', ten: 'Cầu Nam Căn' })
  kho.themDuAn({ id: DU_AN_CT_KHAC, congTyId: CT_KHAC, ma: 'X', ten: 'Dự án công ty khác' })
  bayGio = new Date('2026-06-05T03:00:00Z')
  // Mỗi lần gọi đồng hồ tiến 1ms để capNhatLuc luôn khác nhau như thực tế.
  sv = new CongViecService(kho, () => {
    bayGio = new Date(bayGio.getTime() + 1)
    return bayGio
  })
})

describe('tạo công việc', () => {
  it('người tạo là người giao, trạng thái đầu là CHUA_BAT_DAU, tiến độ 0', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    expect(cv).toMatchObject({ nguoiGiaoId: GIAO, congTyId: CT, trangThai: 'CHUA_BAT_DAU', tienDo: 0, ma: 'CV-0001' })
  })

  it('mã tự sinh tăng liền nhau trong một công ty, mỗi công ty đếm riêng', async () => {
    const a = await sv.tao(nd(GIAO), viecMoi())
    const b = await sv.tao(nd(GIAO), viecMoi())
    const c = await sv.tao(nd(NGUOI_CT_KHAC, CT_KHAC), viecMoi({ nguoiThucHienIds: [NGUOI_CT_KHAC], nguoiTheoDoiIds: [], duAnId: undefined }))
    expect([a.ma, b.ma, c.ma]).toEqual(['CV-0001', 'CV-0002', 'CV-0001'])
  })

  it('tạo đồng thời không trùng mã và không nhảy số', async () => {
    const ds = await Promise.all(Array.from({ length: 20 }, () => sv.tao(nd(GIAO), viecMoi())))
    const ma = ds.map((x) => x.ma).sort()
    expect(new Set(ma).size).toBe(20)
    expect(ma[0]).toBe('CV-0001')
    expect(ma[19]).toBe('CV-0020')
  })

  it('validate thất bại thì không tiêu số thứ tự (không nhảy số)', async () => {
    expect(await maLoi(sv.tao(nd(GIAO), viecMoi({ nguoiThucHienIds: [NGUOI_CT_KHAC] })))).toBe('VALIDATION')
    expect((await sv.tao(nd(GIAO), viecMoi())).ma).toBe('CV-0001')
  })

  it('không nhận người hoặc dự án của công ty khác', async () => {
    expect(await maLoi(sv.tao(nd(GIAO), viecMoi({ nguoiThucHienIds: [NGUOI_CT_KHAC] })))).toBe('VALIDATION')
    expect(await maLoi(sv.tao(nd(GIAO), viecMoi({ nguoiTheoDoiIds: [NGUOI_CT_KHAC] })))).toBe('VALIDATION')
    expect(await maLoi(sv.tao(nd(GIAO), viecMoi({ duAnId: DU_AN_CT_KHAC })))).toBe('VALIDATION')
  })

  it('bỏ trùng người, ai đã thực hiện thì không nằm trong theo dõi', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi({ nguoiThucHienIds: [LAM, LAM], nguoiTheoDoiIds: [LAM, XEM] }))
    expect(cv.nguoiThucHienIds).toEqual([LAM])
    expect(cv.nguoiTheoDoiIds).toEqual([XEM])
  })

  it('không có dự án = việc chung, không ghi trường undefined', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi({ duAnId: undefined, batDau: undefined, hetHan: undefined, moTa: '' }))
    const luu = kho.congViec.ds.get(cv.id)!
    for (const truong of ['duAnId', 'batDau', 'hetHan', 'moTa', 'deletedAt']) {
      expect(Object.hasOwn(luu, truong)).toBe(false)
    }
  })

  it('ghi một dòng lịch sử TAO', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    expect(kho.lichSuDs.filter((x) => x.congViecId === cv.id).map((x) => x.hanhDong)).toEqual(['TAO'])
  })
})

describe('quyền xem', () => {
  it('người giao, thực hiện, theo dõi đều xem được', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    for (const ai of [GIAO, LAM, XEM]) {
      expect((await sv.chiTiet(nd(ai), cv.id)).id).toBe(cv.id)
    }
  })

  it('người khác trong công ty không thấy (404, không lộ sự tồn tại)', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    expect(await maLoi(sv.chiTiet(nd(NGOAI), cv.id))).toBe('KHONG_TIM_THAY')
    expect(await maLoi(sv.lichSu(nd(NGOAI), cv.id))).toBe('KHONG_TIM_THAY')
    const ds = await sv.danhSach(nd(NGOAI), DanhSachCongViecQuerySchema.parse({}))
    expect(ds.meta.total).toBe(0)
  })

  it('token của công ty khác không thấy dù trùng userId', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    expect(await maLoi(sv.chiTiet(nd(GIAO, CT_KHAC), cv.id))).toBe('KHONG_TIM_THAY')
  })

  it('quyen trong chi tiết khớp vai trò người xem', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    expect((await sv.chiTiet(nd(GIAO), cv.id)).quyen).toMatchObject({ sua: true, xoa: true, batDau: false })
    expect((await sv.chiTiet(nd(LAM), cv.id)).quyen).toMatchObject({ sua: false, xoa: false, batDau: true })
    expect(Object.values((await sv.chiTiet(nd(XEM), cv.id)).quyen).every((x) => x === false)).toBe(true)
  })
})

describe('sửa thông tin', () => {
  it('chỉ người giao được sửa; người thực hiện và theo dõi bị chặn', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    expect(await maLoi(sv.sua(nd(LAM), cv.id, { ten: 'Đổi tên' }))).toBe('KHONG_CO_QUYEN')
    expect(await maLoi(sv.sua(nd(LAM), cv.id, { hetHan: '2026-07-01' }))).toBe('KHONG_CO_QUYEN')
    expect(await maLoi(sv.sua(nd(LAM), cv.id, { nguoiThucHienIds: [LAM, LAM_2] }))).toBe('KHONG_CO_QUYEN')
    expect(await maLoi(sv.sua(nd(XEM), cv.id, { ten: 'x' }))).toBe('KHONG_CO_QUYEN')
    expect(await maLoi(sv.sua(nd(NGOAI), cv.id, { ten: 'x' }))).toBe('KHONG_TIM_THAY')
  })

  it('đổi 5 trường trong một lần lưu → đúng 1 dòng lịch sử chứa 5 thay đổi (từ → đến)', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    await sv.sua(nd(GIAO), cv.id, {
      ten: 'Tên mới',
      uuTien: 'THAP',
      hetHan: '2026-06-20',
      nguoiThucHienIds: [LAM, LAM_2],
      moTa: 'Mô tả mới',
    })
    const dong = kho.lichSuDs.filter((x) => x.congViecId === cv.id && x.hanhDong === 'SUA')
    expect(dong).toHaveLength(1)
    expect(dong[0]!.nguoiDoiId).toBe(GIAO)
    expect(dong[0]!.thayDoi).toEqual(
      expect.arrayContaining([
        { truong: 'ten', tu: 'Nghiệm thu cọc khoan nhồi trụ T5', den: 'Tên mới' },
        { truong: 'uuTien', tu: 'CAO', den: 'THAP' },
        { truong: 'hetHan', tu: '2026-06-10', den: '2026-06-20' },
        { truong: 'nguoiThucHienIds', tu: [LAM], den: [LAM, LAM_2] },
        { truong: 'moTa', tu: null, den: 'Mô tả mới' },
      ]),
    )
    expect(dong[0]!.thayDoi).toHaveLength(5)
  })

  it('lưu mà không đổi gì thì không ghi lịch sử', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    await sv.sua(nd(GIAO), cv.id, { ten: cv.ten, nguoiThucHienIds: [LAM] })
    expect(kho.lichSuDs.filter((x) => x.hanhDong === 'SUA')).toHaveLength(0)
  })

  it('gửi null thì xóa giá trị (bỏ hạn, chuyển thành việc chung)', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    const moi = await sv.sua(nd(GIAO), cv.id, { hetHan: null, duAnId: null })
    expect(moi.hetHan).toBeUndefined()
    expect(moi.duAnId).toBeUndefined()
    expect(Object.hasOwn(kho.congViec.ds.get(cv.id)!, 'hetHan')).toBe(false)
  })

  it('hạn không được trước ngày bắt đầu, so với giá trị đang lưu', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi({ batDau: '2026-06-05', hetHan: '2026-06-10' }))
    expect(await maLoi(sv.sua(nd(GIAO), cv.id, { hetHan: '2026-06-04' }))).toBe('VALIDATION')
    expect(await maLoi(sv.sua(nd(GIAO), cv.id, { batDau: '2026-06-11' }))).toBe('VALIDATION')
    expect(await maLoi(sv.sua(nd(GIAO), cv.id, { hetHan: '2026-06-05' }))).toBe('KHONG_LOI')
  })

  it('không sửa được việc đã hoàn thành', async () => {
    const cv = await lamToiHoanThanh()
    expect(await maLoi(sv.sua(nd(GIAO), cv.id, { ten: 'x' }))).toBe('TRANG_THAI_KHONG_HOP_LE')
  })

  it('người vừa bị gỡ khỏi danh sách thực hiện không ghi được trên bản đã đọc trước đó', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'DANG_LAM' })
    const banLamDoc = await kho.congViec.timTheoId(CT, cv.id)
    await sv.sua(nd(GIAO), cv.id, { nguoiThucHienIds: [LAM_2] })
    // LAM đã đọc bản cũ (còn là người thực hiện) nhưng phiên bản đã tăng → không khớp → không ghi.
    const ghi = await kho.congViec.capNhat(CT, cv.id, { trangThai: 'DANG_LAM', phienBan: banLamDoc!.phienBan }, { tienDo: 90 }, new Date())
    expect(ghi).toBeNull()
    expect(await maLoi(sv.capNhatTienDo(nd(LAM), cv.id, { tienDo: 90 }))).toBe('KHONG_TIM_THAY')
  })

  it('mỗi lần ghi tăng phiên bản đúng 1', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    expect(kho.congViec.ds.get(cv.id)!.phienBan).toBe(0)
    await sv.sua(nd(GIAO), cv.id, { ten: 'a' })
    await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'DANG_LAM' })
    expect(kho.congViec.ds.get(cv.id)!.phienBan).toBe(2)
  })

  it('hai người sửa cùng lúc từ cùng một bản: người sau nhận XUNG_DOT, không ghi đè im lặng', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    const banDoc = await kho.congViec.timTheoId(CT, cv.id)
    await sv.sua(nd(GIAO), cv.id, { ten: 'Lần 1' })
    // Mô phỏng yêu cầu thứ hai đã đọc bản cũ trước khi lần 1 ghi xong.
    const moi = await kho.congViec.capNhat(CT, cv.id, { phienBan: banDoc!.phienBan }, { ten: 'Lần 2' }, new Date())
    expect(moi).toBeNull()
  })
})

describe('chuyển trạng thái qua service', () => {
  it('đi hết luồng, gửi duyệt tự lên 100%, lịch sử ghi đủ', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'DANG_LAM' })
    await sv.capNhatTienDo(nd(LAM), cv.id, { tienDo: 40 })
    const cho = await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'CHO_DUYET' })
    expect(cho.tienDo).toBe(100)
    const xong = await sv.chuyenTrangThai(nd(GIAO), cv.id, { trangThai: 'HOAN_THANH' })
    expect(xong.trangThai).toBe('HOAN_THANH')
    const ls = await sv.lichSu(nd(XEM), cv.id)
    expect(ls.map((x) => x.hanhDong)).toEqual(['CHUYEN_TRANG_THAI', 'CHUYEN_TRANG_THAI', 'CAP_NHAT_TIEN_DO', 'CHUYEN_TRANG_THAI', 'TAO'])
    expect(ls[1]!.thayDoi).toEqual([
      { truong: 'trangThai', tu: 'DANG_LAM', den: 'CHO_DUYET' },
      { truong: 'tienDo', tu: 40, den: 100 },
    ])
  })

  it('trả lại lưu lý do vào lịch sử', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'DANG_LAM' })
    await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'CHO_DUYET' })
    expect(await maLoi(sv.chuyenTrangThai(nd(GIAO), cv.id, { trangThai: 'DANG_LAM' }))).toBe('VALIDATION')
    await sv.chuyenTrangThai(nd(GIAO), cv.id, { trangThai: 'DANG_LAM', lyDo: '  Thiếu biên bản nghiệm thu  ' })
    const ls = await sv.lichSu(nd(GIAO), cv.id)
    expect(ls[0]!.lyDo).toBe('Thiếu biên bản nghiệm thu')
  })

  it('người theo dõi không đổi được trạng thái', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    expect(await maLoi(sv.chuyenTrangThai(nd(XEM), cv.id, { trangThai: 'DANG_LAM' }))).toBe('KHONG_CO_QUYEN')
  })

  it('hai yêu cầu cùng lúc (duyệt và trả lại): chỉ một yêu cầu thắng', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'DANG_LAM' })
    await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'CHO_DUYET' })
    const kq = await Promise.all([
      maLoi(sv.chuyenTrangThai(nd(GIAO), cv.id, { trangThai: 'HOAN_THANH' })),
      maLoi(sv.chuyenTrangThai(nd(GIAO), cv.id, { trangThai: 'DANG_LAM', lyDo: 'x' })),
    ])
    expect(kq.filter((x) => x === 'KHONG_LOI')).toHaveLength(1)
  })
})

describe('tiến độ', () => {
  it('chỉ người thực hiện, chỉ khi đang làm', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    expect(await maLoi(sv.capNhatTienDo(nd(LAM), cv.id, { tienDo: 10 }))).toBe('TRANG_THAI_KHONG_HOP_LE')
    await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'DANG_LAM' })
    expect(await maLoi(sv.capNhatTienDo(nd(GIAO), cv.id, { tienDo: 10 }))).toBe('KHONG_CO_QUYEN')
    expect(await maLoi(sv.capNhatTienDo(nd(XEM), cv.id, { tienDo: 10 }))).toBe('KHONG_CO_QUYEN')
    expect((await sv.capNhatTienDo(nd(LAM), cv.id, { tienDo: 55 })).tienDo).toBe(55)
  })
})

describe('xóa mềm', () => {
  it('chỉ người giao; bản ghi còn trong kho nhưng có deletedAt và không ai thấy nữa', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    expect(await maLoi(sv.xoa(nd(LAM), cv.id))).toBe('KHONG_CO_QUYEN')
    expect(await maLoi(sv.xoa(nd(XEM), cv.id))).toBe('KHONG_CO_QUYEN')
    await sv.xoa(nd(GIAO), cv.id)
    expect(kho.congViec.ds.get(cv.id)!.deletedAt).toBeInstanceOf(Date)
    expect(await maLoi(sv.chiTiet(nd(GIAO), cv.id))).toBe('KHONG_TIM_THAY')
    expect((await sv.danhSach(nd(GIAO), DanhSachCongViecQuerySchema.parse({}))).meta.total).toBe(0)
  })

  it('không xóa được việc đã hoàn thành', async () => {
    const cv = await lamToiHoanThanh()
    expect(await maLoi(sv.xoa(nd(GIAO), cv.id))).toBe('TRANG_THAI_KHONG_HOP_LE')
  })
})

describe('danh sách và Quá hạn', () => {
  it('quaHan tính theo giờ VN tại thời điểm đọc', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi({ hetHan: '2026-06-10' }))
    bayGio = new Date('2026-06-10T16:59:59.000Z')
    expect((await sv.chiTiet(nd(GIAO), cv.id)).quaHan).toBe(false)
    bayGio = new Date('2026-06-10T17:00:00.000Z')
    expect((await sv.chiTiet(nd(GIAO), cv.id)).quaHan).toBe(true)
  })

  it('lọc nhanh và số đếm', async () => {
    await sv.tao(nd(GIAO), viecMoi()) // GIAO giao, LAM làm, XEM theo dõi
    await sv.tao(nd(LAM), viecMoi({ nguoiThucHienIds: [GIAO], nguoiTheoDoiIds: [] })) // LAM giao cho GIAO
    const q = DanhSachCongViecQuerySchema.parse({})
    expect(await sv.demLocNhanh(nd(GIAO), q)).toEqual({ CUA_TOI: 1, TOI_GIAO: 1, THEO_DOI: 0, TAT_CA: 2 })
    expect(await sv.demLocNhanh(nd(XEM), q)).toEqual({ CUA_TOI: 0, TOI_GIAO: 0, THEO_DOI: 1, TAT_CA: 1 })
  })

  it('lọc Quá hạn có phân trang', async () => {
    for (let i = 1; i <= 5; i++) await sv.tao(nd(GIAO), viecMoi({ batDau: undefined, hetHan: `2026-06-0${i}` }))
    await sv.tao(nd(GIAO), viecMoi({ batDau: undefined, hetHan: undefined }))
    bayGio = new Date('2026-06-04T05:00:00Z') // hôm nay VN = 04/06 → 01, 02, 03 quá hạn
    const trang1 = await sv.danhSach(nd(GIAO), DanhSachCongViecQuerySchema.parse({ trangThai: 'QUA_HAN', limit: 2 }))
    const trang2 = await sv.danhSach(nd(GIAO), DanhSachCongViecQuerySchema.parse({ trangThai: 'QUA_HAN', limit: 2, page: 2 }))
    expect(trang1.meta.total).toBe(3)
    expect(trang1.data.map((x) => x.hetHan)).toEqual(['2026-06-01', '2026-06-02'])
    expect(trang2.data.map((x) => x.hetHan)).toEqual(['2026-06-03'])
    expect([...trang1.data, ...trang2.data].every((x) => x.quaHan)).toBe(true)
  })
})

async function lamToiHoanThanh() {
  const cv = await sv.tao(nd(GIAO), viecMoi())
  await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'DANG_LAM' })
  await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'CHO_DUYET' })
  return sv.chuyenTrangThai(nd(GIAO), cv.id, { trangThai: 'HOAN_THANH' })
}
