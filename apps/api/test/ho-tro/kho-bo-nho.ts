import type { LocNhanh, SapXep, ThongKeNhanh } from '@longdo/contracts'
import type {
  BinhLuanBanGhi,
  CongViecBanGhi,
  CongViecMoi,
  DuAnBanGhi,
  LichSuBanGhi,
  LichSuMoi,
  NhanVienBanGhi,
  ThayDoiCongViec,
} from '../../src/kieu.ts'
import type {
  BoLocCongViec,
  CongViecRepository,
  DieuKienCapNhat,
  KhoDuLieu,
} from '../../src/repositories/giao-dien.ts'
import { chuanHoaTimKiem } from '../../src/repositories/tim-kiem.ts'

/**
 * Kho dữ liệu trong bộ nhớ, cài đặt đúng các giao diện repository. Dùng để test nghiệp vụ và quyền
 * ở tầng service mà không cần Mongo. Hành vi Mongo thật được kiểm ở test tích hợp.
 */

let dem = 0
export const taoId = () => (++dem).toString(16).padStart(24, 'a')

class CongViecBoNho implements CongViecRepository {
  readonly ds = new Map<string, CongViecBanGhi>()

  async timTheoId(congTyId: string, id: string) {
    const cv = this.ds.get(id)
    return cv && cv.congTyId === congTyId && !cv.deletedAt ? structuredClone(cv) : null
  }

  async tao(duLieu: CongViecMoi) {
    if ([...this.ds.values()].some((x) => x.congTyId === duLieu.congTyId && x.ma === duLieu.ma)) {
      throw new Error('trùng mã')
    }
    const cv = { ...duLieu, id: taoId() }
    this.ds.set(cv.id, structuredClone(cv))
    return cv
  }

  async capNhat(congTyId: string, id: string, dk: DieuKienCapNhat, thayDoi: ThayDoiCongViec, luc: Date) {
    const cv = this.ds.get(id)
    if (!cv || cv.congTyId !== congTyId || cv.deletedAt) return null
    if (dk.trangThai && cv.trangThai !== dk.trangThai) return null
    if (dk.phienBan !== undefined && cv.phienBan !== dk.phienBan) return null
    const moi: Record<string, unknown> = { ...cv, capNhatLuc: luc, phienBan: cv.phienBan + 1 }
    for (const [k, v] of Object.entries(thayDoi)) {
      if (v === undefined) continue
      if (v === null) delete moi[k]
      else moi[k] = v
    }
    this.ds.set(id, moi as CongViecBanGhi)
    return structuredClone(moi as CongViecBanGhi)
  }

  private loc(b: BoLocCongViec, nhanh: LocNhanh) {
    const tuKhoa = b.q ? chuanHoaTimKiem(b.q) : ''
    return [...this.ds.values()].filter((cv) => {
      if (cv.congTyId !== b.congTyId || cv.deletedAt) return false
      const th = cv.nguoiThucHienIds.includes(b.userId)
      const g = cv.nguoiGiaoId === b.userId
      const td = cv.nguoiTheoDoiIds.includes(b.userId)
      const theoNhanh = { CUA_TOI: th, TOI_GIAO: g, THEO_DOI: td, TAT_CA: th || g || td }[nhanh]
      if (!theoNhanh) return false
      if (b.duAnId === null && cv.duAnId) return false
      if (b.duAnId && cv.duAnId !== b.duAnId) return false
      if (b.trangThai === 'QUA_HAN') {
        if (cv.trangThai === 'HOAN_THANH' || !cv.hetHan || cv.hetHan >= b.homNay) return false
      } else if (b.trangThai && cv.trangThai !== b.trangThai) return false
      if (b.uuTien && cv.uuTien !== b.uuTien) return false
      if (tuKhoa && !chuanHoaTimKiem(cv.ten).includes(tuKhoa) && !cv.ma.toLowerCase().includes(tuKhoa)) return false
      return true
    })
  }

  async danhSach(b: BoLocCongViec & { nhanh: LocNhanh }, trang: { page: number; limit: number }, sapXep: SapXep) {
    const huong = sapXep === 'hetHan_desc' ? -1 : 1
    const khoa = (cv: CongViecBanGhi) => `${cv.hetHan ?? '9999-12-31'}|${cv.id}`
    const tatCa = this.loc(b, b.nhanh).sort((x, y) => (khoa(x) < khoa(y) ? -huong : huong))
    const batDau = (trang.page - 1) * trang.limit
    return { items: tatCa.slice(batDau, batDau + trang.limit).map((x) => structuredClone(x)), total: tatCa.length }
  }

  async demTheoLocNhanh(b: BoLocCongViec): Promise<ThongKeNhanh> {
    return {
      CUA_TOI: this.loc(b, 'CUA_TOI').length,
      TOI_GIAO: this.loc(b, 'TOI_GIAO').length,
      THEO_DOI: this.loc(b, 'THEO_DOI').length,
      TAT_CA: this.loc(b, 'TAT_CA').length,
    }
  }
}

export type KhoBoNho = KhoDuLieu & {
  congViec: CongViecBoNho
  lichSuDs: LichSuBanGhi[]
  themNhanVien(nv: NhanVienBanGhi): void
  themDuAn(da: DuAnBanGhi): void
}

export function taoKhoBoNho(): KhoBoNho {
  const nhanVien: NhanVienBanGhi[] = []
  const duAn: DuAnBanGhi[] = []
  const lichSuDs: LichSuBanGhi[] = []
  const binhLuanDs: BinhLuanBanGhi[] = []
  const boDem = new Map<string, number>()

  const kho: KhoBoNho = {
    congViec: new CongViecBoNho(),
    lichSuDs,
    // Trong bộ nhớ không có giao dịch thật; test tính nguyên tử nằm ở test tích hợp Mongo.
    giaoDich: (fn) => fn(kho),
    themNhanVien: (nv) => nhanVien.push(nv),
    themDuAn: (da) => duAn.push(da),
    boDem: {
      async laySoTiepTheo(congTyId) {
        const so = (boDem.get(congTyId) ?? 0) + 1
        boDem.set(congTyId, so)
        return so
      },
    },
    lichSu: {
      async ghi(ls: LichSuMoi) {
        lichSuDs.push({ ...structuredClone(ls), id: taoId() })
      },
      async danhSach(congTyId, congViecId) {
        return lichSuDs
          .filter((x) => x.congTyId === congTyId && x.congViecId === congViecId)
          .sort((a, b) => b.luc.getTime() - a.luc.getTime())
      },
    },
    binhLuan: {
      async ghi(bl) {
        const moi = { ...structuredClone(bl), id: taoId() }
        binhLuanDs.push(moi)
        return moi
      },
      async danhSach(congTyId, congViecId) {
        return binhLuanDs.filter((x) => x.congTyId === congTyId && x.congViecId === congViecId)
      },
    },
    nhanVien: {
      async danhSach(congTyId) {
        return nhanVien.filter((x) => x.congTyId === congTyId)
      },
      async danhSachGiaLap() {
        return [...nhanVien]
      },
      async timTheoId(id) {
        return nhanVien.find((x) => x.id === id) ?? null
      },
      async timNhieu(congTyId, ids) {
        return nhanVien.filter((x) => x.congTyId === congTyId && ids.includes(x.id))
      },
    },
    duAn: {
      async danhSach(congTyId) {
        return duAn.filter((x) => x.congTyId === congTyId)
      },
      async timTheoId(congTyId, id) {
        return duAn.find((x) => x.congTyId === congTyId && x.id === id) ?? null
      },
    },
  }
  return kho
}
