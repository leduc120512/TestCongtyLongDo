import { ObjectId, type ClientSession, type Collection, type Db } from 'mongodb'
import { COLLECTIONS } from '../db/connection.ts'
import { toObjectId } from '../db/object-id.ts'
import type { CommentRecord, NewCommentRecord } from '../types.ts'
import type { CommentRepository } from './interfaces.ts'

type CommentDoc = {
  _id: ObjectId
  congTyId: ObjectId
  congViecId: ObjectId
  nguoiVietId: ObjectId
  noiDung: string
  taoLuc: Date
}

/** Tối đa số bình luận trả về cho một công việc (mới nhất). */
const MAX_COMMENTS = 500

const toRecord = (d: CommentDoc): CommentRecord => ({
  id: d._id.toHexString(),
  congTyId: d.congTyId.toHexString(),
  congViecId: d.congViecId.toHexString(),
  nguoiVietId: d.nguoiVietId.toHexString(),
  noiDung: d.noiDung,
  taoLuc: d.taoLuc,
})

export class MongoCommentRepository implements CommentRepository {
  private readonly col: Collection<CommentDoc>
  private readonly session: ClientSession | undefined

  constructor(db: Db, session?: ClientSession) {
    this.col = db.collection<CommentDoc>(COLLECTIONS.comments)
    this.session = session
  }

  async add(record: NewCommentRecord): Promise<CommentRecord> {
    const congTyId = toObjectId(record.congTyId)
    const congViecId = toObjectId(record.congViecId)
    const nguoiVietId = toObjectId(record.nguoiVietId)
    if (!congTyId || !congViecId || !nguoiVietId) throw new Error('Id bình luận không hợp lệ')
    const doc: CommentDoc = {
      _id: new ObjectId(),
      congTyId,
      congViecId,
      nguoiVietId,
      noiDung: record.noiDung,
      taoLuc: record.taoLuc,
    }
    await this.col.insertOne(doc, { session: this.session })
    return toRecord(doc)
  }

  async list(congTyId: string, congViecId: string): Promise<CommentRecord[]> {
    const companyOid = toObjectId(congTyId)
    const taskOid = toObjectId(congViecId)
    if (!companyOid || !taskOid) return []
    // Lấy MAX_COMMENTS bình luận mới nhất (dùng index theo chiều giảm), rồi đảo lại cho cũ trước mới sau.
    const docs = await this.col
      .find({ congTyId: companyOid, congViecId: taskOid }, { session: this.session })
      .sort({ taoLuc: -1, _id: -1 })
      .limit(MAX_COMMENTS)
      .toArray()
    return docs.reverse().map(toRecord)
  }
}
