import type { LocNhanh, SapXep, ThongKeNhanh, TrangThai, UuTien } from '@longdo/contracts'
import { MongoServerError, ObjectId, type Collection, type Db, type Filter, type Sort } from 'mongodb'
import { boUndefined, tachSetUnset } from '../db/bo-undefined'
import { TEN_BANG } from '../db/ket-noi'
import { sangObjectId, sangObjectIds } from '../db/object-id'
import type { CongViecBanGhi, CongViecMoi, ThayDoiCongViec } from '../kieu'
import { LoiNghiepVu } from '../loi'
import type { BoLocCongViec, CongViecRepository, DieuKienCapNhat } from './giao-dien'
import { chuanHoaTimKiem, thoatRegex } from './tim-kiem'

/** Việc không có hạn được xếp cuối khi sắp tăng dần. */
const KHONG_CO_HAN = '9999-12-31'

/** Dạng lưu trong Mongo: tham chiếu là ObjectId, có thêm trường phục vụ truy vấn. */
export type CongViecDoc = {
  _id: ObjectId
  congTyId: ObjectId
  ma: string
  ten: string
  /** ten đã bỏ dấu, chữ thường — để tìm kiếm. */
  tuKhoa: string
  moTa?: string
  duAnId?: ObjectId
  nguoiGiaoId: ObjectId
  nguoiThucHienIds: ObjectId[]
  nguoiTheoDoiIds: ObjectId[]
  uuTien: UuTien
  batDau?: string
  hetHan?: string
  /** = hetHan, hoặc 9999-12-31 nếu không có hạn. Khóa sắp xếp và lọc Quá hạn. */
  hanSapXep: string
  trangThai: TrangThai
  tienDo: number
  taoLuc: Date
  capNhatLuc: Date
  deletedAt?: Date
}

function sangBanGhi(d: CongViecDoc): CongViecBanGhi {
  return boUndefined({
    id: d._id.toHexString(),
    congTyId: d.congTyId.toHexString(),
    ma: d.ma,
    ten: d.ten,
    moTa: d.moTa,
    duAnId: d.duAnId?.toHexString(),
    nguoiGiaoId: d.nguoiGiaoId.toHexString(),
    nguoiThucHienIds: d.nguoiThucHienIds.map((x) => x.toHexString()),
    nguoiTheoDoiIds: d.nguoiTheoDoiIds.map((x) => x.toHexString()),
    uuTien: d.uuTien,
    batDau: d.batDau,
    hetHan: d.hetHan,
    trangThai: d.trangThai,
    tienDo: d.tienDo,
    taoLuc: d.taoLuc,
    capNhatLuc: d.capNhatLuc,
    deletedAt: d.deletedAt,
  })
}

/** Id không hợp lệ thì dùng một ObjectId không thể khớp, để truy vấn trả rỗng thay vì lỗi. */
function oid(id: string): ObjectId {
  return sangObjectId(id) ?? new ObjectId('000000000000000000000000')
}

export class MongoCongViecRepository implements CongViecRepository {
  private readonly col: Collection<CongViecDoc>

  constructor(db: Db) {
    this.col = db.collection<CongViecDoc>(TEN_BANG.congViec)
  }

  async timTheoId(congTyId: string, id: string): Promise<CongViecBanGhi | null> {
    const _id = sangObjectId(id)
    if (!_id) return null
    const doc = await this.col.findOne({ _id, congTyId: oid(congTyId), deletedAt: { $exists: false } })
    return doc ? sangBanGhi(doc) : null
  }

  async tao(duLieu: CongViecMoi): Promise<CongViecBanGhi> {
    const doc: CongViecDoc = boUndefined({
      _id: new ObjectId(),
      congTyId: oid(duLieu.congTyId),
      ma: duLieu.ma,
      ten: duLieu.ten,
      tuKhoa: chuanHoaTimKiem(duLieu.ten),
      moTa: duLieu.moTa,
      duAnId: duLieu.duAnId ? oid(duLieu.duAnId) : undefined,
      nguoiGiaoId: oid(duLieu.nguoiGiaoId),
      nguoiThucHienIds: sangObjectIds(duLieu.nguoiThucHienIds),
      nguoiTheoDoiIds: sangObjectIds(duLieu.nguoiTheoDoiIds),
      uuTien: duLieu.uuTien,
      batDau: duLieu.batDau,
      hetHan: duLieu.hetHan,
      hanSapXep: duLieu.hetHan ?? KHONG_CO_HAN,
      trangThai: duLieu.trangThai,
      tienDo: duLieu.tienDo,
      taoLuc: duLieu.taoLuc,
      capNhatLuc: duLieu.capNhatLuc,
    })
    try {
      await this.col.insertOne(doc)
    } catch (e) {
      // Chỉ xảy ra nếu bộ đếm bị đặt lại thủ công; index duy nhất (congTyId, ma) là lưới an toàn cuối.
      if (e instanceof MongoServerError && e.code === 11000) {
        throw new LoiNghiepVu('TRUNG_MA', `Mã ${duLieu.ma} đã tồn tại, vui lòng thử lại`)
      }
      throw e
    }
    return sangBanGhi(doc)
  }

  async capNhat(
    congTyId: string,
    id: string,
    dieuKien: DieuKienCapNhat,
    thayDoi: ThayDoiCongViec,
    luc: Date,
  ): Promise<CongViecBanGhi | null> {
    const _id = sangObjectId(id)
    if (!_id) return null

    // Đổi tham chiếu sang ObjectId và tính lại các trường phụ trợ khi trường gốc đổi.
    const giaTri: Record<string, unknown> = { ...thayDoi, capNhatLuc: luc }
    if (thayDoi.duAnId !== undefined) giaTri.duAnId = thayDoi.duAnId === null ? null : oid(thayDoi.duAnId)
    if (thayDoi.nguoiThucHienIds) giaTri.nguoiThucHienIds = sangObjectIds(thayDoi.nguoiThucHienIds)
    if (thayDoi.nguoiTheoDoiIds) giaTri.nguoiTheoDoiIds = sangObjectIds(thayDoi.nguoiTheoDoiIds)
    if (thayDoi.ten) giaTri.tuKhoa = chuanHoaTimKiem(thayDoi.ten)
    if (thayDoi.hetHan !== undefined) giaTri.hanSapXep = thayDoi.hetHan ?? KHONG_CO_HAN

    const { $set, $unset } = tachSetUnset(giaTri)
    const loc: Filter<CongViecDoc> = { _id, congTyId: oid(congTyId), deletedAt: { $exists: false } }
    if (dieuKien.trangThai) loc.trangThai = dieuKien.trangThai
    if (dieuKien.capNhatLuc) loc.capNhatLuc = dieuKien.capNhatLuc

    const doc = await this.col.findOneAndUpdate(
      loc,
      Object.keys($unset).length ? { $set, $unset } : { $set },
      { returnDocument: 'after' },
    )
    return doc ? sangBanGhi(doc) : null
  }

  async danhSach(
    boLoc: BoLocCongViec & { nhanh: LocNhanh },
    trang: { page: number; limit: number },
    sapXep: SapXep,
  ): Promise<{ items: CongViecBanGhi[]; total: number }> {
    const loc = this.xayDungBoLoc(boLoc, boLoc.nhanh)
    const huong = sapXep === 'hetHan_desc' ? -1 : 1
    const sort: Sort = { hanSapXep: huong, _id: huong }
    const [docs, total] = await Promise.all([
      this.col
        .find(loc)
        .sort(sort)
        .skip((trang.page - 1) * trang.limit)
        .limit(trang.limit)
        .toArray(),
      this.col.countDocuments(loc),
    ])
    return { items: docs.map(sangBanGhi), total }
  }

  async demTheoLocNhanh(boLoc: BoLocCongViec): Promise<ThongKeNhanh> {
    const [CUA_TOI, TOI_GIAO, THEO_DOI, TAT_CA] = await Promise.all(
      (['CUA_TOI', 'TOI_GIAO', 'THEO_DOI', 'TAT_CA'] as const).map((n) =>
        this.col.countDocuments(this.xayDungBoLoc(boLoc, n)),
      ),
    )
    return { CUA_TOI: CUA_TOI ?? 0, TOI_GIAO: TOI_GIAO ?? 0, THEO_DOI: THEO_DOI ?? 0, TAT_CA: TAT_CA ?? 0 }
  }

  /**
   * Mọi nhánh đều có congTyId + chưa xóa (deletedAt không tồn tại) + điều kiện vai trò, khớp với 3 index danh sách.
   * "Tất cả" là $or của 3 vai trò; mỗi nhánh $or dùng index riêng của nó.
   */
  private xayDungBoLoc(boLoc: BoLocCongViec, nhanh: LocNhanh): Filter<CongViecDoc> {
    const goc = { congTyId: oid(boLoc.congTyId), deletedAt: { $exists: false } }
    const uid = oid(boLoc.userId)
    const theoVaiTro: Record<Exclude<LocNhanh, 'TAT_CA'>, Filter<CongViecDoc>> = {
      CUA_TOI: { ...goc, nguoiThucHienIds: uid },
      TOI_GIAO: { ...goc, nguoiGiaoId: uid },
      THEO_DOI: { ...goc, nguoiTheoDoiIds: uid },
    }
    const dieuKien: Filter<CongViecDoc>[] = [
      nhanh === 'TAT_CA' ? { $or: Object.values(theoVaiTro) } : theoVaiTro[nhanh],
    ]

    if (boLoc.duAnId === null) dieuKien.push({ duAnId: { $exists: false } })
    else if (boLoc.duAnId !== undefined) dieuKien.push({ duAnId: oid(boLoc.duAnId) })

    if (boLoc.trangThai === 'QUA_HAN') {
      // Quá hạn = chưa hoàn thành và hạn < hôm nay (giờ VN). Việc không có hạn có hanSapXep = 9999-12-31 nên tự loại.
      dieuKien.push({ trangThai: { $ne: 'HOAN_THANH' }, hanSapXep: { $lt: boLoc.homNay } })
    } else if (boLoc.trangThai) {
      dieuKien.push({ trangThai: boLoc.trangThai })
    }

    if (boLoc.uuTien) dieuKien.push({ uuTien: boLoc.uuTien })

    const tuKhoa = boLoc.q ? chuanHoaTimKiem(boLoc.q) : ''
    if (tuKhoa) {
      const re = new RegExp(thoatRegex(tuKhoa), 'i')
      dieuKien.push({ $or: [{ tuKhoa: re }, { ma: re }] })
    }

    return dieuKien.length === 1 ? dieuKien[0]! : { $and: dieuKien }
  }
}
