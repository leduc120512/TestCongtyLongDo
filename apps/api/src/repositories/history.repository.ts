import type { HanhDongLichSu, ThayDoiTruong } from '@longdo/contracts'
import { ObjectId, type ClientSession, type Collection, type Db } from 'mongodb'
import { boUndefined } from '../db/strip-undefined.ts'
import { TEN_BANG } from '../db/connection.ts'
import { sangObjectId } from '../db/object-id.ts'
import type { LichSuBanGhi, LichSuMoi } from '../types.ts'
import type { LichSuRepository } from './interfaces.ts'

type LichSuDoc = {
  _id: ObjectId
  congTyId: ObjectId
  congViecId: ObjectId
  nguoiDoiId: ObjectId
  luc: Date
  hanhDong: HanhDongLichSu
  /** Mỗi lần lưu là một bản ghi; các trường đổi trong lần đó nằm chung trong mảng này. */
  thayDoi: ThayDoiTruong[]
  lyDo?: string
}

function sangBanGhi(d: LichSuDoc): LichSuBanGhi {
  return boUndefined({
    id: d._id.toHexString(),
    congTyId: d.congTyId.toHexString(),
    congViecId: d.congViecId.toHexString(),
    nguoiDoiId: d.nguoiDoiId.toHexString(),
    luc: d.luc,
    hanhDong: d.hanhDong,
    thayDoi: d.thayDoi,
    lyDo: d.lyDo,
  })
}

export class MongoLichSuRepository implements LichSuRepository {
  private readonly col: Collection<LichSuDoc>
  private readonly session: ClientSession | undefined

  constructor(db: Db, session?: ClientSession) {
    this.col = db.collection<LichSuDoc>(TEN_BANG.lichSu)
    this.session = session
  }

  async ghi(banGhi: LichSuMoi): Promise<void> {
    const congTyId = sangObjectId(banGhi.congTyId)
    const congViecId = sangObjectId(banGhi.congViecId)
    const nguoiDoiId = sangObjectId(banGhi.nguoiDoiId)
    if (!congTyId || !congViecId || !nguoiDoiId) throw new Error('Id lịch sử không hợp lệ')
    await this.col.insertOne(
      boUndefined({
        _id: new ObjectId(),
        congTyId,
        congViecId,
        nguoiDoiId,
        luc: banGhi.luc,
        hanhDong: banGhi.hanhDong,
        thayDoi: banGhi.thayDoi,
        lyDo: banGhi.lyDo,
      }),
      { session: this.session },
    )
  }

  async danhSach(congTyId: string, congViecId: string): Promise<LichSuBanGhi[]> {
    const ct = sangObjectId(congTyId)
    const cv = sangObjectId(congViecId)
    if (!ct || !cv) return []
    const docs = await this.col.find({ congTyId: ct, congViecId: cv }, { session: this.session })
      .sort({ luc: -1, _id: -1 })
      .toArray()
    return docs.map(sangBanGhi)
  }
}
