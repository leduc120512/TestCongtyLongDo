import type { HistoryAction, FieldChange } from '@longdo/contracts'
import { ObjectId, type ClientSession, type Collection, type Db } from 'mongodb'
import { stripUndefined } from '../db/strip-undefined.ts'
import { COLLECTIONS } from '../db/connection.ts'
import { toObjectId } from '../db/object-id.ts'
import type { HistoryRecord, NewHistoryRecord } from '../types.ts'
import type { HistoryRepository } from './interfaces.ts'

type HistoryDoc = {
  _id: ObjectId
  congTyId: ObjectId
  congViecId: ObjectId
  nguoiDoiId: ObjectId
  luc: Date
  hanhDong: HistoryAction
  /** Mỗi lần lưu là một bản ghi; các trường đổi trong lần đó nằm chung trong mảng này. */
  thayDoi: FieldChange[]
  lyDo?: string
}

function toRecord(d: HistoryDoc): HistoryRecord {
  return stripUndefined({
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

export class MongoHistoryRepository implements HistoryRepository {
  private readonly col: Collection<HistoryDoc>
  private readonly session: ClientSession | undefined

  constructor(db: Db, session?: ClientSession) {
    this.col = db.collection<HistoryDoc>(COLLECTIONS.history)
    this.session = session
  }

  async add(record: NewHistoryRecord): Promise<void> {
    const congTyId = toObjectId(record.congTyId)
    const congViecId = toObjectId(record.congViecId)
    const nguoiDoiId = toObjectId(record.nguoiDoiId)
    if (!congTyId || !congViecId || !nguoiDoiId) throw new Error('Id lịch sử không hợp lệ')
    await this.col.insertOne(
      stripUndefined({
        _id: new ObjectId(),
        congTyId,
        congViecId,
        nguoiDoiId,
        luc: record.luc,
        hanhDong: record.hanhDong,
        thayDoi: record.thayDoi,
        lyDo: record.lyDo,
      }),
      { session: this.session },
    )
  }

  async list(congTyId: string, congViecId: string): Promise<HistoryRecord[]> {
    const companyOid = toObjectId(congTyId)
    const taskOid = toObjectId(congViecId)
    if (!companyOid || !taskOid) return []
    const docs = await this.col
      .find({ congTyId: companyOid, congViecId: taskOid }, { session: this.session })
      .sort({ luc: -1, _id: -1 })
      .toArray()
    return docs.map(toRecord)
  }
}
