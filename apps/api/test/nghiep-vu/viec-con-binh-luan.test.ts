import { SO_VIEC_CON_TOI_DA, type NguoiDung, type TaoCongViec } from '@longdo/contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import { LoiNghiepVu } from '../../src/loi.ts'
import { CongViecService } from '../../src/services/cong-viec.service.ts'
import { xetChuyenTrangThai } from '../../src/services/nghiep-vu/trang-thai.ts'
import { tinhTienDo } from '../../src/services/nghiep-vu/viec-con.ts'
import { taoId, taoKhoBoNho, type KhoBoNho } from '../ho-tro/kho-bo-nho.ts'

const CT = taoId()
const [GIAO, LAM, XEM, NGOAI] = Array.from({ length: 4 }, taoId) as [string, string, string, string]
const nd = (userId: string): NguoiDung => ({ userId, congTyId: CT })

async function maLoi(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    if (e instanceof LoiNghiepVu) return e.code
    throw e
  }
  return 'KHONG_LOI'
}

describe('tinhTienDo — luật thuần', () => {
  const vc = (...xong: boolean[]) => xong.map((x) => ({ xong: x }))
  it('không có việc con thì giữ tiến độ nhập tay', () => {
    expect(tinhTienDo([], 'DANG_LAM', 35)).toBe(35)
  })
  it('có việc con thì bằng tỉ lệ đã xong, làm tròn', () => {
    expect(tinhTienDo(vc(false, false, false), 'DANG_LAM', 80)).toBe(0)
    expect(tinhTienDo(vc(true, false, false), 'DANG_LAM', 0)).toBe(33)
    expect(tinhTienDo(vc(true, true, false), 'DANG_LAM', 0)).toBe(67)
    expect(tinhTienDo(vc(true, true, true), 'DANG_LAM', 0)).toBe(100)
  })
  it('chờ duyệt / hoàn thành thì giữ nguyên 100%', () => {
    expect(tinhTienDo(vc(true, false), 'CHO_DUYET', 100)).toBe(100)
    expect(tinhTienDo(vc(true, false), 'HOAN_THANH', 100)).toBe(100)
  })
  it('gửi duyệt bị chặn khi còn việc con chưa xong; trả lại thì tính lại tiến độ', () => {
    const cv = { nguoiGiaoId: GIAO, nguoiThucHienIds: [LAM], nguoiTheoDoiIds: [], tienDo: 50 }
    expect(xetChuyenTrangThai({ ...cv, trangThai: 'DANG_LAM', viecCon: vc(true, false) }, LAM, 'CHO_DUYET')).toMatchObject({
      ok: false,
      code: 'TRANG_THAI_KHONG_HOP_LE',
      message: 'Còn 1 việc con chưa xong, chưa gửi duyệt được',
    })
    expect(xetChuyenTrangThai({ ...cv, trangThai: 'DANG_LAM', viecCon: vc(true, true) }, LAM, 'CHO_DUYET')).toEqual({
      ok: true,
      capNhat: { trangThai: 'CHO_DUYET', tienDo: 100 },
    })
    expect(
      xetChuyenTrangThai({ ...cv, tienDo: 100, trangThai: 'CHO_DUYET', viecCon: vc(true, true) }, GIAO, 'DANG_LAM', 'lý do'),
    ).toEqual({ ok: true, capNhat: { trangThai: 'DANG_LAM' } })
  })
})

describe('việc con qua service', () => {
  let kho: KhoBoNho
  let sv: CongViecService
  let t = new Date('2026-06-05T03:00:00Z')

  const viecMoi = (them: Partial<TaoCongViec> = {}): TaoCongViec => ({
    ten: 'Lắp dựng cốt thép trụ T5',
    nguoiThucHienIds: [LAM],
    nguoiTheoDoiIds: [XEM],
    uuTien: 'BINH_THUONG',
    ...them,
  })

  beforeEach(() => {
    kho = taoKhoBoNho()
    for (const id of [GIAO, LAM, XEM, NGOAI]) kho.themNhanVien({ id, congTyId: CT, ten: id, chucVu: 'KS' })
    sv = new CongViecService(kho, () => (t = new Date(t.getTime() + 1)))
  })

  it('người giao thêm/xóa; người thực hiện đánh dấu; tiến độ tự tính; lịch sử ghi đủ', async () => {
    let cv = await sv.tao(nd(GIAO), viecMoi())
    cv = await sv.themViecCon(nd(GIAO), cv.id, { ten: 'Gia công thép' })
    cv = await sv.themViecCon(nd(GIAO), cv.id, { ten: 'Lắp dựng' })
    cv = await sv.themViecCon(nd(GIAO), cv.id, { ten: 'Nghiệm thu cốt thép' })
    expect(cv.viecCon.map((v) => v.ten)).toEqual(['Gia công thép', 'Lắp dựng', 'Nghiệm thu cốt thép'])
    expect(cv.tienDo).toBe(0)

    await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'DANG_LAM' })
    cv = await sv.danhDauViecCon(nd(LAM), cv.id, cv.viecCon[0]!.id, { xong: true })
    expect(cv.tienDo).toBe(33)
    cv = await sv.danhDauViecCon(nd(LAM), cv.id, cv.viecCon[1]!.id, { xong: true })
    expect(cv.tienDo).toBe(67)
    expect(cv.quyen.guiDuyet).toBe(false)
    expect(await maLoi(sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'CHO_DUYET' }))).toBe('TRANG_THAI_KHONG_HOP_LE')

    // Xóa việc con chưa xong → còn 2/2 xong → 100%, gửi duyệt được.
    cv = await sv.xoaViecCon(nd(GIAO), cv.id, cv.viecCon[2]!.id)
    expect(cv.tienDo).toBe(100)
    expect((await sv.chiTiet(nd(LAM), cv.id)).quyen.guiDuyet).toBe(true)
    expect((await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'CHO_DUYET' })).trangThai).toBe('CHO_DUYET')

    const ls = await sv.lichSu(nd(XEM), cv.id)
    const viecConLs = ls.filter((x) => x.hanhDong === 'VIEC_CON')
    expect(viecConLs).toHaveLength(6) // 3 thêm + 2 đánh dấu + 1 xóa
    expect(viecConLs[0]!.thayDoi).toEqual([
      { truong: 'viecCon', tu: { ten: 'Nghiệm thu cốt thép', xong: false }, den: null },
      { truong: 'tienDo', tu: 67, den: 100 },
    ])
  })

  it('quyền: người thực hiện không thêm/xóa; người giao (không thực hiện) không đánh dấu; theo dõi không làm gì', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    const coViecCon = await sv.themViecCon(nd(GIAO), cv.id, { ten: 'A' })
    const vcId = coViecCon.viecCon[0]!.id
    await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'DANG_LAM' })
    expect(await maLoi(sv.themViecCon(nd(LAM), cv.id, { ten: 'B' }))).toBe('KHONG_CO_QUYEN')
    expect(await maLoi(sv.xoaViecCon(nd(LAM), cv.id, vcId))).toBe('KHONG_CO_QUYEN')
    expect(await maLoi(sv.danhDauViecCon(nd(GIAO), cv.id, vcId, { xong: true }))).toBe('KHONG_CO_QUYEN')
    expect(await maLoi(sv.danhDauViecCon(nd(XEM), cv.id, vcId, { xong: true }))).toBe('KHONG_CO_QUYEN')
    expect(await maLoi(sv.themViecCon(nd(NGOAI), cv.id, { ten: 'B' }))).toBe('KHONG_TIM_THAY')
    expect(await maLoi(sv.danhDauViecCon(nd(LAM), cv.id, taoId(), { xong: true }))).toBe('KHONG_TIM_THAY')
  })

  it('trạng thái: chưa bắt đầu thì chưa đánh dấu; chờ duyệt thì người giao không thêm việc con', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    const vcId = (await sv.themViecCon(nd(GIAO), cv.id, { ten: 'A' })).viecCon[0]!.id
    expect(await maLoi(sv.danhDauViecCon(nd(LAM), cv.id, vcId, { xong: true }))).toBe('TRANG_THAI_KHONG_HOP_LE')
    await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'DANG_LAM' })
    await sv.danhDauViecCon(nd(LAM), cv.id, vcId, { xong: true })
    await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'CHO_DUYET' })
    expect(await maLoi(sv.themViecCon(nd(GIAO), cv.id, { ten: 'B' }))).toBe('TRANG_THAI_KHONG_HOP_LE')
    // Trả lại thì thêm được việc mới, tiến độ tính lại (1/2 = 50%).
    await sv.chuyenTrangThai(nd(GIAO), cv.id, { trangThai: 'DANG_LAM', lyDo: 'Bổ sung việc' })
    expect((await sv.themViecCon(nd(GIAO), cv.id, { ten: 'B' })).tienDo).toBe(50)
  })

  it('có việc con thì không nhập tiến độ tay', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    await sv.themViecCon(nd(GIAO), cv.id, { ten: 'A' })
    await sv.chuyenTrangThai(nd(LAM), cv.id, { trangThai: 'DANG_LAM' })
    expect(await maLoi(sv.capNhatTienDo(nd(LAM), cv.id, { tienDo: 80 }))).toBe('TRANG_THAI_KHONG_HOP_LE')
  })

  it(`tối đa ${SO_VIEC_CON_TOI_DA} việc con`, async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    for (let i = 0; i < SO_VIEC_CON_TOI_DA; i++) await sv.themViecCon(nd(GIAO), cv.id, { ten: `Việc ${i}` })
    expect(await maLoi(sv.themViecCon(nd(GIAO), cv.id, { ten: 'Thừa' }))).toBe('VALIDATION')
  })

  it('bình luận: ai liên quan cũng đọc/viết được, người ngoài không thấy, cũ trước mới sau', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    await sv.vietBinhLuan(nd(GIAO), cv.id, { noiDung: 'Nhớ chụp ảnh nghiệm thu' })
    await sv.vietBinhLuan(nd(LAM), cv.id, { noiDung: 'Đã rõ' })
    await sv.vietBinhLuan(nd(XEM), cv.id, { noiDung: 'QA/QC sẽ có mặt lúc 8h' })
    expect(await maLoi(sv.vietBinhLuan(nd(NGOAI), cv.id, { noiDung: 'x' }))).toBe('KHONG_TIM_THAY')
    expect(await maLoi(sv.danhSachBinhLuan(nd(NGOAI), cv.id))).toBe('KHONG_TIM_THAY')
    const ds = await sv.danhSachBinhLuan(nd(LAM), cv.id)
    expect(ds.map((b) => [b.nguoiVietId, b.noiDung])).toEqual([
      [GIAO, 'Nhớ chụp ảnh nghiệm thu'],
      [LAM, 'Đã rõ'],
      [XEM, 'QA/QC sẽ có mặt lúc 8h'],
    ])
  })

  it('bình luận trên việc đã xóa → 404', async () => {
    const cv = await sv.tao(nd(GIAO), viecMoi())
    await sv.xoa(nd(GIAO), cv.id)
    expect(await maLoi(sv.vietBinhLuan(nd(GIAO), cv.id, { noiDung: 'x' }))).toBe('KHONG_TIM_THAY')
  })
})
