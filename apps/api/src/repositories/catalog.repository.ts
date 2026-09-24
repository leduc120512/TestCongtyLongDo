import type { Collection, Db, ObjectId } from 'mongodb'
import { TEN_BANG } from '../db/connection.ts'
import { sangObjectId, sangObjectIds } from '../db/object-id.ts'
import type { DuAnBanGhi, NhanVienBanGhi } from '../types.ts'
import type { DuAnRepository, NhanVienRepository } from './interfaces.ts'

/** Sắp xếp theo bảng chữ cái tiếng Việt. */
const TIENG_VIET = { locale: 'vi' } as const

export type NhanVienDoc = { _id: ObjectId; congTyId: ObjectId; ten: string; chucVu: string }
export type DuAnDoc = { _id: ObjectId; congTyId: ObjectId; ma: string; ten: string }

const nhanVienSang = (d: NhanVienDoc): NhanVienBanGhi => ({
  id: d._id.toHexString(),
  congTyId: d.congTyId.toHexString(),
  ten: d.ten,
  chucVu: d.chucVu,
})

const duAnSang = (d: DuAnDoc): DuAnBanGhi => ({
  id: d._id.toHexString(),
  congTyId: d.congTyId.toHexString(),
  ma: d.ma,
  ten: d.ten,
})

export class MongoNhanVienRepository implements NhanVienRepository {
  private readonly col: Collection<NhanVienDoc>

  constructor(db: Db) {
    this.col = db.collection<NhanVienDoc>(TEN_BANG.nhanVien)
  }

  async danhSach(congTyId: string): Promise<NhanVienBanGhi[]> {
    const ct = sangObjectId(congTyId)
    if (!ct) return []
    const docs = await this.col.find({ congTyId: ct }).collation(TIENG_VIET).sort({ ten: 1 }).toArray()
    return docs.map(nhanVienSang)
  }

  async danhSachGiaLap(): Promise<NhanVienBanGhi[]> {
    const docs = await this.col.find({}).collation(TIENG_VIET).sort({ congTyId: 1, ten: 1 }).limit(200).toArray()
    return docs.map(nhanVienSang)
  }

  async timTheoId(id: string): Promise<NhanVienBanGhi | null> {
    const _id = sangObjectId(id)
    if (!_id) return null
    const doc = await this.col.findOne({ _id })
    return doc ? nhanVienSang(doc) : null
  }

  async timNhieu(congTyId: string, ids: readonly string[]): Promise<NhanVienBanGhi[]> {
    const ct = sangObjectId(congTyId)
    if (!ct || ids.length === 0) return []
    return (await this.col.find({ congTyId: ct, _id: { $in: sangObjectIds(ids) } }).toArray()).map(nhanVienSang)
  }
}

export class MongoDuAnRepository implements DuAnRepository {
  private readonly col: Collection<DuAnDoc>

  constructor(db: Db) {
    this.col = db.collection<DuAnDoc>(TEN_BANG.duAn)
  }

  async danhSach(congTyId: string): Promise<DuAnBanGhi[]> {
    const ct = sangObjectId(congTyId)
    if (!ct) return []
    return (await this.col.find({ congTyId: ct }).sort({ ma: 1 }).toArray()).map(duAnSang)
  }

  async timTheoId(congTyId: string, id: string): Promise<DuAnBanGhi | null> {
    const ct = sangObjectId(congTyId)
    const _id = sangObjectId(id)
    if (!ct || !_id) return null
    const doc = await this.col.findOne({ _id, congTyId: ct })
    return doc ? duAnSang(doc) : null
  }
}
