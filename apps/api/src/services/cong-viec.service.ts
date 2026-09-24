import {
  DU_AN_CHUNG,
  hanHopLe,
  type CapNhatTienDo,
  type ChiTietCongViec,
  type ChuyenTrangThai,
  type CongViec,
  type DanhSachCongViecQuery,
  type HanhDongLichSu,
  type LichSu,
  type NguoiDung,
  type PhanHoiDanhSach,
  type SuaCongViec,
  type TaoCongViec,
  type ThayDoiTruong,
  type ThongKeNhanh,
} from '@longdo/contracts'
import { boUndefined } from '../db/bo-undefined'
import { TRUONG_SUA_DUOC, type CongViecBanGhi, type ThayDoiCongViec } from '../kieu'
import { LoiNghiepVu } from '../loi'
import type { BoLocCongViec, KhoDuLieu } from '../repositories/giao-dien'
import { tinhQuyen, xacDinhVaiTro } from './nghiep-vu/quyen'
import { soSanhTruong } from './nghiep-vu/so-sanh'
import { homNayVN, laQuaHan } from './nghiep-vu/thoi-gian'
import { xetChuyenTrangThai } from './nghiep-vu/trang-thai'

const LOI_KHONG_THAY = 'Không tìm thấy công việc'
const LOI_XUNG_DOT = 'Công việc vừa được người khác cập nhật, vui lòng tải lại rồi thử lại'

/** Bỏ trùng, giữ thứ tự. */
const khongTrung = (ids: readonly string[]) => [...new Set(ids)]

export function taoMaCongViec(so: number): string {
  return `CV-${String(so).padStart(4, '0')}`
}

/**
 * Nghiệp vụ và phân quyền của phân hệ Công việc. userId/congTyId luôn lấy từ token (tham số nd),
 * không bao giờ lấy từ body. Service không biết Mongo, chỉ làm việc qua KhoDuLieu.
 */
export class CongViecService {
  constructor(
    private readonly kho: KhoDuLieu,
    private readonly dongHo: () => Date = () => new Date(),
  ) {}

  // ---------- Đọc ----------

  async danhSach(nd: NguoiDung, q: DanhSachCongViecQuery): Promise<PhanHoiDanhSach<CongViec>> {
    const luc = this.dongHo()
    const { items, total } = await this.kho.congViec.danhSach(
      { ...this.boLocChung(nd, q, luc), nhanh: q.nhanh },
      { page: q.page, limit: q.limit },
      q.sapXep,
    )
    return {
      data: items.map((cv) => sangCongViec(cv, luc)),
      meta: { page: q.page, limit: q.limit, total },
    }
  }

  /** Số việc ở mỗi lọc nhanh, áp cùng các bộ lọc phụ (dự án, trạng thái, ưu tiên, từ khóa). */
  async demLocNhanh(nd: NguoiDung, q: Omit<DanhSachCongViecQuery, 'nhanh' | 'page' | 'limit' | 'sapXep'>): Promise<ThongKeNhanh> {
    return this.kho.congViec.demTheoLocNhanh(this.boLocChung(nd, q, this.dongHo()))
  }

  async chiTiet(nd: NguoiDung, id: string): Promise<ChiTietCongViec> {
    const cv = await this.layViecDuocXem(nd, id)
    return sangChiTiet(cv, nd.userId, this.dongHo())
  }

  async lichSu(nd: NguoiDung, id: string): Promise<LichSu[]> {
    await this.layViecDuocXem(nd, id)
    const ds = await this.kho.lichSu.danhSach(nd.congTyId, id)
    return ds.map((ls) =>
      boUndefined({
        id: ls.id,
        congViecId: ls.congViecId,
        nguoiDoiId: ls.nguoiDoiId,
        luc: ls.luc.toISOString(),
        hanhDong: ls.hanhDong,
        thayDoi: ls.thayDoi,
        lyDo: ls.lyDo,
      }),
    )
  }

  // ---------- Ghi ----------

  async tao(nd: NguoiDung, body: TaoCongViec): Promise<ChiTietCongViec> {
    const nguoiThucHienIds = khongTrung(body.nguoiThucHienIds)
    // Ai đã là người thực hiện thì không cần theo dõi nữa.
    const nguoiTheoDoiIds = khongTrung(body.nguoiTheoDoiIds).filter((x) => !nguoiThucHienIds.includes(x))
    await this.kiemTraNguoi(nd.congTyId, nguoiThucHienIds, nguoiTheoDoiIds)
    if (body.duAnId) await this.kiemTraDuAn(nd.congTyId, body.duAnId)

    // Lấy số thứ tự SAU khi mọi kiểm tra đã qua, ngay trước khi ghi, để hạn chế nhảy số.
    const so = await this.kho.boDem.laySoTiepTheo(nd.congTyId)
    const luc = this.dongHo()
    const cv = await this.kho.congViec.tao(
      boUndefined({
        congTyId: nd.congTyId,
        ma: taoMaCongViec(so),
        ten: body.ten,
        moTa: body.moTa || undefined,
        duAnId: body.duAnId || undefined,
        nguoiGiaoId: nd.userId,
        nguoiThucHienIds,
        nguoiTheoDoiIds,
        uuTien: body.uuTien,
        batDau: body.batDau || undefined,
        hetHan: body.hetHan || undefined,
        trangThai: 'CHUA_BAT_DAU' as const,
        tienDo: 0,
        taoLuc: luc,
        capNhatLuc: luc,
      }),
    )
    await this.ghiLichSu(nd, cv.id, 'TAO', [], luc)
    return sangChiTiet(cv, nd.userId, luc)
  }

  /** Chỉ người giao được sửa thông tin; không sửa được việc đã hoàn thành. */
  async sua(nd: NguoiDung, id: string, body: SuaCongViec): Promise<ChiTietCongViec> {
    const cv = await this.layViecDuocXem(nd, id)
    if (!xacDinhVaiTro(cv, nd.userId).laNguoiGiao) {
      throw new LoiNghiepVu('KHONG_CO_QUYEN', 'Chỉ người giao việc mới được sửa thông tin công việc')
    }
    if (cv.trangThai === 'HOAN_THANH') {
      throw new LoiNghiepVu('TRANG_THAI_KHONG_HOP_LE', 'Công việc đã hoàn thành, không sửa được nữa')
    }

    // Gộp thay đổi vào bản hiện tại: undefined = giữ nguyên, null/"" = xóa giá trị.
    const thayDoi: ThayDoiCongViec = {}
    if (body.ten !== undefined) thayDoi.ten = body.ten
    if (body.moTa !== undefined) thayDoi.moTa = body.moTa || null
    if (body.duAnId !== undefined) thayDoi.duAnId = body.duAnId || null
    if (body.uuTien !== undefined) thayDoi.uuTien = body.uuTien
    if (body.batDau !== undefined) thayDoi.batDau = body.batDau || null
    if (body.hetHan !== undefined) thayDoi.hetHan = body.hetHan || null
    if (body.nguoiThucHienIds !== undefined) thayDoi.nguoiThucHienIds = khongTrung(body.nguoiThucHienIds)
    if (body.nguoiTheoDoiIds !== undefined) thayDoi.nguoiTheoDoiIds = khongTrung(body.nguoiTheoDoiIds)

    const sau = { ...cv, ...thayDoi } as Record<string, unknown> & CongViecBanGhi
    const thucHienSau = (sau.nguoiThucHienIds ?? []) as string[]
    if (thayDoi.nguoiThucHienIds || thayDoi.nguoiTheoDoiIds) {
      sau.nguoiTheoDoiIds = (sau.nguoiTheoDoiIds as string[]).filter((x) => !thucHienSau.includes(x))
      thayDoi.nguoiTheoDoiIds = sau.nguoiTheoDoiIds
    }

    if (!hanHopLe({ batDau: sau.batDau ?? null, hetHan: sau.hetHan ?? null })) {
      throw new LoiNghiepVu('VALIDATION', 'hetHan: Hạn không được trước ngày bắt đầu')
    }
    if (thayDoi.nguoiThucHienIds || thayDoi.nguoiTheoDoiIds) {
      await this.kiemTraNguoi(nd.congTyId, thucHienSau, sau.nguoiTheoDoiIds as string[])
    }
    if (thayDoi.duAnId) await this.kiemTraDuAn(nd.congTyId, thayDoi.duAnId)

    const khacBiet = soSanhTruong(
      cv as unknown as Record<string, unknown>,
      sau as unknown as Record<string, unknown>,
      TRUONG_SUA_DUOC,
    )
    if (khacBiet.length === 0) return sangChiTiet(cv, nd.userId, this.dongHo())

    // Chỉ gửi xuống các trường thực sự đổi.
    const chiTruongDoi: ThayDoiCongViec = {}
    for (const { truong } of khacBiet) {
      ;(chiTruongDoi as Record<string, unknown>)[truong] = (thayDoi as Record<string, unknown>)[truong]
    }

    const luc = this.dongHo()
    const moi = await this.kho.congViec.capNhat(
      nd.congTyId,
      id,
      { trangThai: cv.trangThai, capNhatLuc: cv.capNhatLuc },
      chiTruongDoi,
      luc,
    )
    if (!moi) throw new LoiNghiepVu('XUNG_DOT', LOI_XUNG_DOT)
    // Một lần lưu = một bản ghi lịch sử, dù đổi bao nhiêu trường.
    await this.ghiLichSu(nd, id, 'SUA', khacBiet, luc)
    return sangChiTiet(moi, nd.userId, luc)
  }

  async chuyenTrangThai(nd: NguoiDung, id: string, body: ChuyenTrangThai): Promise<ChiTietCongViec> {
    const cv = await this.layViecDuocXem(nd, id)
    const kq = xetChuyenTrangThai(cv, nd.userId, body.trangThai, body.lyDo)
    if (!kq.ok) throw new LoiNghiepVu(kq.code, kq.message)

    const luc = this.dongHo()
    // Điều kiện trangThai cũ: hai người bấm cùng lúc (vd. duyệt và trả lại) thì chỉ một người thắng.
    const moi = await this.kho.congViec.capNhat(nd.congTyId, id, { trangThai: cv.trangThai }, kq.capNhat, luc)
    if (!moi) throw new LoiNghiepVu('XUNG_DOT', LOI_XUNG_DOT)

    const khacBiet: ThayDoiTruong[] = [{ truong: 'trangThai', tu: cv.trangThai, den: moi.trangThai }]
    if (moi.tienDo !== cv.tienDo) khacBiet.push({ truong: 'tienDo', tu: cv.tienDo, den: moi.tienDo })
    const laTraLai = cv.trangThai === 'CHO_DUYET' && moi.trangThai === 'DANG_LAM'
    await this.ghiLichSu(nd, id, 'CHUYEN_TRANG_THAI', khacBiet, luc, laTraLai ? body.lyDo?.trim() : undefined)
    return sangChiTiet(moi, nd.userId, luc)
  }

  /** Người thực hiện cập nhật tiến độ khi việc đang làm. */
  async capNhatTienDo(nd: NguoiDung, id: string, body: CapNhatTienDo): Promise<ChiTietCongViec> {
    const cv = await this.layViecDuocXem(nd, id)
    if (!xacDinhVaiTro(cv, nd.userId).laNguoiThucHien) {
      throw new LoiNghiepVu('KHONG_CO_QUYEN', 'Chỉ người thực hiện mới được cập nhật tiến độ')
    }
    if (cv.trangThai !== 'DANG_LAM') {
      throw new LoiNghiepVu('TRANG_THAI_KHONG_HOP_LE', 'Chỉ cập nhật được tiến độ khi công việc đang làm')
    }
    if (body.tienDo === cv.tienDo) return sangChiTiet(cv, nd.userId, this.dongHo())

    const luc = this.dongHo()
    const moi = await this.kho.congViec.capNhat(nd.congTyId, id, { trangThai: 'DANG_LAM' }, { tienDo: body.tienDo }, luc)
    if (!moi) throw new LoiNghiepVu('XUNG_DOT', LOI_XUNG_DOT)
    await this.ghiLichSu(nd, id, 'CAP_NHAT_TIEN_DO', [{ truong: 'tienDo', tu: cv.tienDo, den: body.tienDo }], luc)
    return sangChiTiet(moi, nd.userId, luc)
  }

  /** Xóa mềm: chỉ người giao, không xóa được việc đã hoàn thành. */
  async xoa(nd: NguoiDung, id: string): Promise<{ id: string }> {
    const cv = await this.layViecDuocXem(nd, id)
    if (!xacDinhVaiTro(cv, nd.userId).laNguoiGiao) {
      throw new LoiNghiepVu('KHONG_CO_QUYEN', 'Chỉ người giao việc mới được xóa công việc')
    }
    if (cv.trangThai === 'HOAN_THANH') {
      throw new LoiNghiepVu('TRANG_THAI_KHONG_HOP_LE', 'Không xóa được công việc đã hoàn thành')
    }
    const luc = this.dongHo()
    const moi = await this.kho.congViec.capNhat(nd.congTyId, id, { trangThai: cv.trangThai }, { deletedAt: luc }, luc)
    if (!moi) throw new LoiNghiepVu('XUNG_DOT', LOI_XUNG_DOT)
    await this.ghiLichSu(nd, id, 'XOA', [{ truong: 'deletedAt', tu: null, den: luc.toISOString() }], luc)
    return { id }
  }

  // ---------- Hỗ trợ ----------

  /**
   * Lấy công việc mà người này có liên quan. Không tồn tại, khác công ty, đã xóa, hoặc không
   * liên quan đều trả 404 như nhau để không lộ sự tồn tại của công việc.
   */
  private async layViecDuocXem(nd: NguoiDung, id: string): Promise<CongViecBanGhi> {
    const cv = await this.kho.congViec.timTheoId(nd.congTyId, id)
    if (!cv || !xacDinhVaiTro(cv, nd.userId).coLienQuan) {
      throw new LoiNghiepVu('KHONG_TIM_THAY', LOI_KHONG_THAY)
    }
    return cv
  }

  private boLocChung(
    nd: NguoiDung,
    q: Pick<DanhSachCongViecQuery, 'duAnId' | 'trangThai' | 'uuTien' | 'q'>,
    luc: Date,
  ): BoLocCongViec {
    return boUndefined({
      congTyId: nd.congTyId,
      userId: nd.userId,
      homNay: homNayVN(luc),
      duAnId: q.duAnId === undefined ? undefined : q.duAnId === DU_AN_CHUNG ? null : q.duAnId,
      trangThai: q.trangThai,
      uuTien: q.uuTien,
      q: q.q || undefined,
    })
  }

  private async kiemTraNguoi(congTyId: string, thucHien: string[], theoDoi: string[]): Promise<void> {
    if (thucHien.length === 0) {
      throw new LoiNghiepVu('VALIDATION', 'nguoiThucHienIds: Cần ít nhất một người thực hiện')
    }
    const tatCa = khongTrung([...thucHien, ...theoDoi])
    const timThay = await this.kho.nhanVien.timNhieu(congTyId, tatCa)
    if (timThay.length !== tatCa.length) {
      throw new LoiNghiepVu('VALIDATION', 'Có người thực hiện hoặc người theo dõi không thuộc công ty')
    }
  }

  private async kiemTraDuAn(congTyId: string, duAnId: string): Promise<void> {
    if (!(await this.kho.duAn.timTheoId(congTyId, duAnId))) {
      throw new LoiNghiepVu('VALIDATION', 'duAnId: Dự án không tồn tại trong công ty')
    }
  }

  private ghiLichSu(
    nd: NguoiDung,
    congViecId: string,
    hanhDong: HanhDongLichSu,
    thayDoi: ThayDoiTruong[],
    luc: Date,
    lyDo?: string,
  ): Promise<void> {
    return this.kho.lichSu.ghi(
      boUndefined({ congTyId: nd.congTyId, congViecId, nguoiDoiId: nd.userId, luc, hanhDong, thayDoi, lyDo }),
    )
  }
}

export function sangCongViec(cv: CongViecBanGhi, luc: Date): CongViec {
  return boUndefined({
    id: cv.id,
    ma: cv.ma,
    ten: cv.ten,
    moTa: cv.moTa,
    duAnId: cv.duAnId,
    nguoiGiaoId: cv.nguoiGiaoId,
    nguoiThucHienIds: cv.nguoiThucHienIds,
    nguoiTheoDoiIds: cv.nguoiTheoDoiIds,
    uuTien: cv.uuTien,
    batDau: cv.batDau,
    hetHan: cv.hetHan,
    trangThai: cv.trangThai,
    tienDo: cv.tienDo,
    quaHan: laQuaHan(cv, luc),
    congTyId: cv.congTyId,
    taoLuc: cv.taoLuc.toISOString(),
    capNhatLuc: cv.capNhatLuc.toISOString(),
  })
}

function sangChiTiet(cv: CongViecBanGhi, userId: string, luc: Date): ChiTietCongViec {
  return { ...sangCongViec(cv, luc), quyen: tinhQuyen(cv, userId) }
}
