import { TRANG_THAI, type TrangThai } from '@longdo/contracts'
import { describe, expect, it } from 'vitest'
import { xetChuyenTrangThai } from '../../src/services/nghiep-vu/trang-thai.ts'

const GIAO = 'nguoi-giao'
const LAM = 'nguoi-lam'
const XEM = 'nguoi-xem'
const NGOAI = 'nguoi-ngoai'

const viec = (trangThai: TrangThai, tienDo = 30) => ({
  nguoiGiaoId: GIAO,
  nguoiThucHienIds: [LAM],
  nguoiTheoDoiIds: [XEM],
  trangThai,
  tienDo,
})

/** Mọi bước chuyển hợp lệ và ai được làm. Những cặp (từ, đến) không có ở đây đều bị cấm. */
const HOP_LE: Array<{ tu: TrangThai; den: TrangThai; ai: string }> = [
  { tu: 'CHUA_BAT_DAU', den: 'DANG_LAM', ai: LAM },
  { tu: 'DANG_LAM', den: 'CHO_DUYET', ai: LAM },
  { tu: 'CHO_DUYET', den: 'HOAN_THANH', ai: GIAO },
  { tu: 'CHO_DUYET', den: 'DANG_LAM', ai: GIAO },
]

describe('luồng chuyển trạng thái', () => {
  for (const { tu, den, ai } of HOP_LE) {
    it(`${tu} → ${den}: đúng người thì được`, () => {
      const kq = xetChuyenTrangThai(viec(tu), ai, den, 'lý do')
      expect(kq.ok).toBe(true)
    })

    for (const khac of [GIAO, LAM, XEM, NGOAI].filter((x) => x !== ai)) {
      it(`${tu} → ${den}: ${khac} bị chặn KHONG_CO_QUYEN`, () => {
        const kq = xetChuyenTrangThai(viec(tu), khac, den, 'lý do')
        expect(kq).toMatchObject({ ok: false, code: 'KHONG_CO_QUYEN' })
      })
    }
  }

  describe('mọi cặp (từ, đến) ngoài luồng đều bị chặn, kể cả với người giao kiêm thực hiện', () => {
    for (const tu of TRANG_THAI) {
      for (const den of TRANG_THAI) {
        if (HOP_LE.some((b) => b.tu === tu && b.den === den)) continue
        it(`${tu} → ${den}`, () => {
          const caHai = { ...viec(tu), nguoiThucHienIds: [GIAO] }
          const kq = xetChuyenTrangThai(caHai, GIAO, den, 'lý do')
          expect(kq).toMatchObject({ ok: false, code: 'TRANG_THAI_KHONG_HOP_LE' })
        })
      }
    }
  })

  it('không nhảy cóc: CHUA_BAT_DAU không sang thẳng CHO_DUYET hay HOAN_THANH', () => {
    expect(xetChuyenTrangThai(viec('CHUA_BAT_DAU'), LAM, 'CHO_DUYET').ok).toBe(false)
    expect(xetChuyenTrangThai(viec('CHUA_BAT_DAU'), GIAO, 'HOAN_THANH').ok).toBe(false)
  })

  it('gửi duyệt thì tiến độ tự thành 100%', () => {
    const kq = xetChuyenTrangThai(viec('DANG_LAM', 35), LAM, 'CHO_DUYET')
    expect(kq).toEqual({ ok: true, capNhat: { trangThai: 'CHO_DUYET', tienDo: 100 } })
  })

  it('các bước khác không đụng tới tiến độ', () => {
    expect(xetChuyenTrangThai(viec('CHUA_BAT_DAU', 0), LAM, 'DANG_LAM')).toEqual({
      ok: true,
      capNhat: { trangThai: 'DANG_LAM' },
    })
    expect(xetChuyenTrangThai(viec('CHO_DUYET', 100), GIAO, 'HOAN_THANH')).toEqual({
      ok: true,
      capNhat: { trangThai: 'HOAN_THANH' },
    })
  })

  describe('trả lại (CHO_DUYET → DANG_LAM) bắt buộc có lý do', () => {
    for (const lyDo of [undefined, null, '', '   ']) {
      it(`lý do = ${JSON.stringify(lyDo)} → VALIDATION`, () => {
        const kq = xetChuyenTrangThai(viec('CHO_DUYET'), GIAO, 'DANG_LAM', lyDo)
        expect(kq).toMatchObject({ ok: false, code: 'VALIDATION' })
      })
    }
    it('có lý do thì được', () => {
      expect(xetChuyenTrangThai(viec('CHO_DUYET'), GIAO, 'DANG_LAM', 'Thiếu biên bản').ok).toBe(true)
    })
  })

  it('HOAN_THANH là trạng thái cuối: không ai chuyển đi đâu được', () => {
    for (const den of TRANG_THAI) {
      for (const ai of [GIAO, LAM]) {
        expect(xetChuyenTrangThai(viec('HOAN_THANH', 100), ai, den, 'x')).toMatchObject({
          ok: false,
          code: 'TRANG_THAI_KHONG_HOP_LE',
        })
      }
    }
  })

  it('người giao đồng thời là người thực hiện: tự làm và tự duyệt được (việc cá nhân)', () => {
    const caNhan = { nguoiGiaoId: GIAO, nguoiThucHienIds: [GIAO], nguoiTheoDoiIds: [], tienDo: 0 }
    expect(xetChuyenTrangThai({ ...caNhan, trangThai: 'CHUA_BAT_DAU' }, GIAO, 'DANG_LAM').ok).toBe(true)
    expect(xetChuyenTrangThai({ ...caNhan, trangThai: 'DANG_LAM' }, GIAO, 'CHO_DUYET').ok).toBe(true)
    expect(xetChuyenTrangThai({ ...caNhan, trangThai: 'CHO_DUYET' }, GIAO, 'HOAN_THANH').ok).toBe(true)
  })

  it('người thực hiện không tự duyệt được việc do người khác giao', () => {
    expect(xetChuyenTrangThai(viec('CHO_DUYET'), LAM, 'HOAN_THANH')).toMatchObject({
      ok: false,
      code: 'KHONG_CO_QUYEN',
    })
  })
})
