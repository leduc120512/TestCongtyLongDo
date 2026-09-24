import { afterEach, describe, expect, it } from 'vitest'
import { homNayVN, laQuaHan } from '../../src/services/nghiep-vu/thoi-gian.ts'

const dangLam = (hetHan?: string) => ({ trangThai: 'DANG_LAM', hetHan })

describe('homNayVN — ngày theo giờ Việt Nam (UTC+7)', () => {
  it('23:59:59.999 giờ VN vẫn là ngày cũ', () => {
    expect(homNayVN(new Date('2026-06-10T16:59:59.999Z'))).toBe('2026-06-10')
  })

  it('00:00:00 giờ VN sang ngày mới dù UTC vẫn là hôm trước', () => {
    expect(homNayVN(new Date('2026-06-10T17:00:00.000Z'))).toBe('2026-06-11')
  })

  it('qua năm mới', () => {
    expect(homNayVN(new Date('2026-12-31T16:59:59.999Z'))).toBe('2026-12-31')
    expect(homNayVN(new Date('2026-12-31T17:00:00.000Z'))).toBe('2027-01-01')
  })
})

describe('laQuaHan — quanh mốc nửa đêm giờ Việt Nam', () => {
  const HAN = '2026-06-10'

  it('trong ngày hết hạn (giờ VN) thì chưa quá hạn', () => {
    expect(laQuaHan(dangLam(HAN), new Date('2026-06-09T17:00:00.000Z'))).toBe(false) // 00:00 VN 10/6
    expect(laQuaHan(dangLam(HAN), new Date('2026-06-10T00:00:00.000Z'))).toBe(false) // 07:00 VN 10/6
    expect(laQuaHan(dangLam(HAN), new Date('2026-06-10T16:59:59.999Z'))).toBe(false) // 23:59:59.999 VN 10/6
  })

  it('đúng 00:00 giờ VN ngày hôm sau thì quá hạn', () => {
    expect(laQuaHan(dangLam(HAN), new Date('2026-06-10T17:00:00.000Z'))).toBe(true)
  })

  it('máy chủ chạy giờ UTC: 23:00 UTC ngày 10/6 đã là 06:00 VN ngày 11/6 → quá hạn', () => {
    expect(laQuaHan(dangLam(HAN), new Date('2026-06-10T23:00:00.000Z'))).toBe(true)
  })

  it('việc đã hoàn thành không bao giờ quá hạn', () => {
    expect(laQuaHan({ trangThai: 'HOAN_THANH', hetHan: HAN }, new Date('2027-01-01T00:00:00Z'))).toBe(false)
  })

  it('việc không có hạn không bao giờ quá hạn', () => {
    expect(laQuaHan(dangLam(undefined), new Date('2027-01-01T00:00:00Z'))).toBe(false)
    expect(laQuaHan({ trangThai: 'DANG_LAM', hetHan: null }, new Date('2027-01-01T00:00:00Z'))).toBe(false)
  })

  it('mọi trạng thái chưa hoàn thành đều có thể quá hạn', () => {
    const sau = new Date('2026-06-11T01:00:00Z')
    for (const trangThai of ['CHUA_BAT_DAU', 'DANG_LAM', 'CHO_DUYET']) {
      expect(laQuaHan({ trangThai, hetHan: HAN }, sau)).toBe(true)
    }
  })

  describe('không phụ thuộc múi giờ của máy chạy API', () => {
    const tzCu = process.env.TZ
    afterEach(() => {
      process.env.TZ = tzCu
    })

    for (const tz of ['UTC', 'America/New_York', 'Asia/Ho_Chi_Minh', 'Pacific/Kiritimati']) {
      it(`TZ=${tz}`, () => {
        process.env.TZ = tz
        expect(laQuaHan(dangLam(HAN), new Date('2026-06-10T16:59:59.999Z'))).toBe(false)
        expect(laQuaHan(dangLam(HAN), new Date('2026-06-10T17:00:00.000Z'))).toBe(true)
      })
    }
  })
})
