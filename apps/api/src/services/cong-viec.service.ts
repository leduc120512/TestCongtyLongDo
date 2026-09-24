import { randomBytes } from 'node:crypto'
import {
  DU_AN_CHUNG,
  SO_VIEC_CON_TOI_DA,
  hanHopLe,
  type BinhLuan,
  type DanhDauViecCon,
  type ThemViecCon,
  type ViecCon,
  type VietBinhLuan,
  type CapNhatTienDo,
  type ChiTietCongViec,
  type ChuyenTrangThai,
  type CongViec,
  type DanhSachCongViecQuery,
  type DemCongViecQuery,
  type HanhDongLichSu,
  type LichSu,
  type NguoiDung,
  type PhanHoiDanhSach,
  type SuaCongViec,
  type TaoCongViec,
  type ThayDoiTruong,
  type ThongKeNhanh,
} from '@longdo/contracts'
import { boUndefined } from '../db/bo-undefined.ts'
import { TRUONG_SUA_DUOC, type CongViecBanGhi, type ThayDoiCongViec } from '../kieu.ts'
import { LoiNghiepVu } from '../loi.ts'
import type { BoLocCongViec, KhoDuLieu } from '../repositories/giao-dien.ts'
import { tinhQuyen, xacDinhVaiTro } from './nghiep-vu/quyen.ts'
import { soSanhTruong } from './nghiep-vu/so-sanh.ts'
import { homNayVN, laQuaHan } from './nghiep-vu/thoi-gian.ts'
import { xetChuyenTrangThai } from './nghiep-vu/trang-thai.ts'
import { coTheQuanLyViecCon, tinhTienDo } from './nghiep-vu/viec-con.ts'

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
  private readonly kho: KhoDuLieu
  /** Đồng hồ tiêm vào được, để test cố định "bây giờ" khi kiểm tra Quá hạn. */
  private readonly dongHo: () => Date

  constructor(kho: KhoDuLieu, dongHo: () => Date = () => new Date()) {
    this.kho = kho
    this.dongHo = dongHo
  }

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
  async demLocNhanh(nd: NguoiDung, q: DemCongViecQuery): Promise<ThongKeNhanh> {
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

    // Mọi kiểm tra xong mới lấy số. Tăng bộ đếm + tạo việc + ghi lịch sử nằm trong một giao dịch:
    // lỗi ở bất kỳ bước nào thì cả khối được hoàn tác, số thứ tự không bị "mất" → không nhảy số.
    const luc = this.dongHo()
    const cv = await this.kho.giaoDich(async (tx) => {
      const so = await tx.boDem.laySoTiepTheo(nd.congTyId)
      const moi = await tx.congViec.tao(
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
        viecCon: [],
        phienBan: 0,
        taoLuc: luc,
        capNhatLuc: luc,
      }),
      )
      await this.ghiLichSu(tx, nd, moi.id, 'TAO', [], luc)
      return moi
    })
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
    const moi = await this.ghiCoKhoa(cv, chiTruongDoi, luc, (tx) =>
      // Một lần lưu = một bản ghi lịch sử, dù đổi bao nhiêu trường.
      this.ghiLichSu(tx, nd, id, 'SUA', khacBiet, luc),
    )
    return sangChiTiet(moi, nd.userId, luc)
  }

  async chuyenTrangThai(nd: NguoiDung, id: string, body: ChuyenTrangThai): Promise<ChiTietCongViec> {
    const cv = await this.layViecDuocXem(nd, id)
    const kq = xetChuyenTrangThai(cv, nd.userId, body.trangThai, body.lyDo)
    if (!kq.ok) throw new LoiNghiepVu(kq.code, kq.message)

    const luc = this.dongHo()
    const khacBiet: ThayDoiTruong[] = [{ truong: 'trangThai', tu: cv.trangThai, den: kq.capNhat.trangThai }]
    if (kq.capNhat.tienDo !== undefined && kq.capNhat.tienDo !== cv.tienDo) {
      khacBiet.push({ truong: 'tienDo', tu: cv.tienDo, den: kq.capNhat.tienDo })
    }
    const laTraLai = cv.trangThai === 'CHO_DUYET' && kq.capNhat.trangThai === 'DANG_LAM'
    // Khóa theo phiên bản: hai người bấm cùng lúc (vd. duyệt và trả lại) thì chỉ một người thắng,
    // và người vừa bị gỡ vai trò không còn thao tác được trên bản cũ.
    const moi = await this.ghiCoKhoa(cv, kq.capNhat, luc, (tx) =>
      this.ghiLichSu(tx, nd, id, 'CHUYEN_TRANG_THAI', khacBiet, luc, laTraLai ? body.lyDo?.trim() : undefined),
    )
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
    if (cv.viecCon.length > 0) {
      throw new LoiNghiepVu('TRANG_THAI_KHONG_HOP_LE', 'Công việc có việc con: tiến độ được tính tự động theo việc con')
    }
    if (body.tienDo === cv.tienDo) return sangChiTiet(cv, nd.userId, this.dongHo())

    const luc = this.dongHo()
    // Khóa theo phiên bản để giá trị "từ" trong lịch sử luôn đúng khi hai người cùng cập nhật.
    const moi = await this.ghiCoKhoa(cv, { tienDo: body.tienDo }, luc, (tx) =>
      this.ghiLichSu(tx, nd, id, 'CAP_NHAT_TIEN_DO', [{ truong: 'tienDo', tu: cv.tienDo, den: body.tienDo }], luc),
    )
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
    await this.ghiCoKhoa(cv, { deletedAt: luc }, luc, (tx) =>
      this.ghiLichSu(tx, nd, id, 'XOA', [{ truong: 'deletedAt', tu: null, den: luc.toISOString() }], luc),
    )
    return { id }
  }

  // ---------- Việc con ----------

  /** Người giao thêm việc con khi việc chưa bắt đầu hoặc đang làm. Tiến độ tính lại ngay. */
  async themViecCon(nd: NguoiDung, id: string, body: ThemViecCon): Promise<ChiTietCongViec> {
    const cv = await this.layViecDuocXem(nd, id)
    this.kiemTraQuanLyViecCon(cv, nd.userId)
    if (cv.viecCon.length >= SO_VIEC_CON_TOI_DA) {
      throw new LoiNghiepVu('VALIDATION', `Tối đa ${SO_VIEC_CON_TOI_DA} việc con cho một công việc`)
    }
    const moi: ViecCon = { id: randomBytes(12).toString('hex'), ten: body.ten, xong: false }
    return this.ghiViecCon(nd, cv, [...cv.viecCon, moi], { truong: 'viecCon', tu: null, den: { ten: moi.ten, xong: false } })
  }

  /** Người thực hiện đánh dấu xong/chưa xong khi việc đang làm. */
  async danhDauViecCon(nd: NguoiDung, id: string, viecConId: string, body: DanhDauViecCon): Promise<ChiTietCongViec> {
    const cv = await this.layViecDuocXem(nd, id)
    if (!xacDinhVaiTro(cv, nd.userId).laNguoiThucHien) {
      throw new LoiNghiepVu('KHONG_CO_QUYEN', 'Chỉ người thực hiện mới được đánh dấu việc con')
    }
    if (cv.trangThai !== 'DANG_LAM') {
      throw new LoiNghiepVu('TRANG_THAI_KHONG_HOP_LE', 'Chỉ đánh dấu được việc con khi công việc đang làm')
    }
    const vc = this.timViecCon(cv, viecConId)
    if (vc.xong === body.xong) return sangChiTiet(cv, nd.userId, this.dongHo())
    const ds = cv.viecCon.map((x) => (x.id === vc.id ? { ...x, xong: body.xong } : x))
    return this.ghiViecCon(nd, cv, ds, {
      truong: 'viecCon',
      tu: { ten: vc.ten, xong: vc.xong },
      den: { ten: vc.ten, xong: body.xong },
    })
  }

  /** Người giao xóa việc con khi việc chưa bắt đầu hoặc đang làm. */
  async xoaViecCon(nd: NguoiDung, id: string, viecConId: string): Promise<ChiTietCongViec> {
    const cv = await this.layViecDuocXem(nd, id)
    this.kiemTraQuanLyViecCon(cv, nd.userId)
    const vc = this.timViecCon(cv, viecConId)
    return this.ghiViecCon(
      nd,
      cv,
      cv.viecCon.filter((x) => x.id !== vc.id),
      { truong: 'viecCon', tu: { ten: vc.ten, xong: vc.xong }, den: null },
    )
  }

  // ---------- Bình luận ----------

  /** Ai liên quan tới công việc (giao, thực hiện, theo dõi) đều đọc và viết bình luận được. */
  async danhSachBinhLuan(nd: NguoiDung, id: string): Promise<BinhLuan[]> {
    await this.layViecDuocXem(nd, id)
    return (await this.kho.binhLuan.danhSach(nd.congTyId, id)).map(sangBinhLuan)
  }

  async vietBinhLuan(nd: NguoiDung, id: string, body: VietBinhLuan): Promise<BinhLuan> {
    await this.layViecDuocXem(nd, id)
    const bl = await this.kho.binhLuan.ghi({
      congTyId: nd.congTyId,
      congViecId: id,
      nguoiVietId: nd.userId,
      noiDung: body.noiDung,
      taoLuc: this.dongHo(),
    })
    return sangBinhLuan(bl)
  }

  // ---------- Hỗ trợ ----------

  private kiemTraQuanLyViecCon(cv: CongViecBanGhi, userId: string): void {
    if (!xacDinhVaiTro(cv, userId).laNguoiGiao) {
      throw new LoiNghiepVu('KHONG_CO_QUYEN', 'Chỉ người giao việc mới được thêm hoặc xóa việc con')
    }
    if (!coTheQuanLyViecCon(cv.trangThai)) {
      throw new LoiNghiepVu(
        'TRANG_THAI_KHONG_HOP_LE',
        'Chỉ thêm hoặc xóa việc con khi công việc chưa bắt đầu hoặc đang làm',
      )
    }
  }

  private timViecCon(cv: CongViecBanGhi, viecConId: string): ViecCon {
    const vc = cv.viecCon.find((x) => x.id === viecConId)
    if (!vc) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy việc con')
    return vc
  }

  /** Ghi danh sách việc con mới, tính lại tiến độ, ghi một dòng lịch sử — trong một giao dịch có khóa. */
  private async ghiViecCon(
    nd: NguoiDung,
    cv: CongViecBanGhi,
    viecCon: ViecCon[],
    thayDoiViecCon: ThayDoiTruong,
  ): Promise<ChiTietCongViec> {
    const tienDo = tinhTienDo(viecCon, cv.trangThai, cv.tienDo)
    const thayDoi: ThayDoiCongViec = { viecCon }
    const khacBiet: ThayDoiTruong[] = [thayDoiViecCon]
    if (tienDo !== cv.tienDo) {
      thayDoi.tienDo = tienDo
      khacBiet.push({ truong: 'tienDo', tu: cv.tienDo, den: tienDo })
    }
    const luc = this.dongHo()
    const moi = await this.ghiCoKhoa(cv, thayDoi, luc, (tx) => this.ghiLichSu(tx, nd, cv.id, 'VIEC_CON', khacBiet, luc))
    return sangChiTiet(moi, nd.userId, luc)
  }

  /**
   * Ghi thay đổi với điều kiện trạng thái và phiên bản vẫn như lúc đọc, rồi ghi lịch sử, tất cả trong
   * một giao dịch. Có người ghi chen vào giữa thì trả XUNG_DOT và không ghi gì cả.
   */
  private async ghiCoKhoa(
    cv: CongViecBanGhi,
    thayDoi: ThayDoiCongViec,
    luc: Date,
    ghiThem: (tx: KhoDuLieu) => Promise<void>,
  ): Promise<CongViecBanGhi> {
    return this.kho.giaoDich(async (tx) => {
      const moi = await tx.congViec.capNhat(
        cv.congTyId,
        cv.id,
        { trangThai: cv.trangThai, phienBan: cv.phienBan },
        thayDoi,
        luc,
      )
      if (!moi) throw new LoiNghiepVu('XUNG_DOT', LOI_XUNG_DOT)
      await ghiThem(tx)
      return moi
    })
  }

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
    kho: KhoDuLieu,
    nd: NguoiDung,
    congViecId: string,
    hanhDong: HanhDongLichSu,
    thayDoi: ThayDoiTruong[],
    luc: Date,
    lyDo?: string,
  ): Promise<void> {
    return kho.lichSu.ghi(
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
    viecCon: cv.viecCon.map((v) => ({ id: v.id, ten: v.ten, xong: v.xong })),
    quaHan: laQuaHan(cv, luc),
    congTyId: cv.congTyId,
    taoLuc: cv.taoLuc.toISOString(),
    capNhatLuc: cv.capNhatLuc.toISOString(),
  })
}

function sangChiTiet(cv: CongViecBanGhi, userId: string, luc: Date): ChiTietCongViec {
  return { ...sangCongViec(cv, luc), quyen: tinhQuyen(cv, userId) }
}

function sangBinhLuan(bl: { id: string; congViecId: string; nguoiVietId: string; noiDung: string; taoLuc: Date }): BinhLuan {
  return {
    id: bl.id,
    congViecId: bl.congViecId,
    nguoiVietId: bl.nguoiVietId,
    noiDung: bl.noiDung,
    taoLuc: bl.taoLuc.toISOString(),
  }
}
