import { ObjectId, type ClientSession, type Collection, type Db } from 'mongodb'
import { TEN_BANG } from '../db/connection.ts'
import { sangObjectId } from '../db/object-id.ts'
import type { BinhLuanBanGhi, BinhLuanMoi } from '../types.ts'
import type { BinhLuanRepository } from './interfaces.ts'

type BinhLuanDoc = {
  _id: ObjectId
  congTyId: ObjectId
  congViecId: ObjectId
  nguoiVietId: ObjectId
  noiDung: string
  taoLuc: Date
}

/** Tối đa số bình luận trả về cho một công việc (mới nhất). */
const TOI_DA = 500

const sangBanGhi = (d: BinhLuanDoc): BinhLuanBanGhi => ({
  id: d._id.toHexString(),
  congTyId: d.congTyId.toHexString(),
  congViecId: d.congViecId.toHexString(),
  nguoiVietId: d.nguoiVietId.toHexString(),
  noiDung: d.noiDung,
  taoLuc: d.taoLuc,
})

export class MongoBinhLuanRepository implements BinhLuanRepository {
  private readonly col: Collection<BinhLuanDoc>
  private readonly session: ClientSession | undefined

  constructor(db: Db, session?: ClientSession) {
    this.col = db.collection<BinhLuanDoc>(TEN_BANG.binhLuan)
    this.session = session
  }

  async ghi(banGhi: BinhLuanMoi): Promise<BinhLuanBanGhi> {
    const congTyId = sangObjectId(banGhi.congTyId)
    const congViecId = sangObjectId(banGhi.congViecId)
    const nguoiVietId = sangObjectId(banGhi.nguoiVietId)
    if (!congTyId || !congViecId || !nguoiVietId) throw new Error('Id bình luận không hợp lệ')
    const doc: BinhLuanDoc = { _id: new ObjectId(), congTyId, congViecId, nguoiVietId, noiDung: banGhi.noiDung, taoLuc: banGhi.taoLuc }
    await this.col.insertOne(doc, { session: this.session })
    return sangBanGhi(doc)
  }

  async danhSach(congTyId: string, congViecId: string): Promise<BinhLuanBanGhi[]> {
    const ct = sangObjectId(congTyId)
    const cv = sangObjectId(congViecId)
    if (!ct || !cv) return []
    // Lấy TOI_DA bình luận mới nhất (dùng index theo chiều giảm), rồi đảo lại cho cũ trước mới sau.
    const docs = await this.col
      .find({ congTyId: ct, congViecId: cv }, { session: this.session })
      .sort({ taoLuc: -1, _id: -1 })
      .limit(TOI_DA)
      .toArray()
    return docs.reverse().map(sangBanGhi)
  }
}
