import { MongoServerError, type ClientSession, type Collection, type Db } from 'mongodb'
import { COLLECTIONS } from '../db/connection.ts'
import type { CounterRepository } from './interfaces.ts'

type CounterDoc = { _id: string; giaTri: number }

/**
 * Bộ đếm mã công việc, một bản ghi cho mỗi công ty. $inc là nguyên tử nên hai yêu cầu tạo cùng lúc
 * luôn nhận hai số khác nhau. Chạy trong giao dịch cùng lệnh insert công việc, nên insert lỗi thì
 * lượt tăng cũng bị hoàn tác → không nhảy số.
 */
export class MongoCounterRepository implements CounterRepository {
  private readonly col: Collection<CounterDoc>
  private readonly session: ClientSession | undefined

  constructor(db: Db, session?: ClientSession) {
    this.col = db.collection<CounterDoc>(COLLECTIONS.counters)
    this.session = session
  }

  async nextSequence(congTyId: string): Promise<number> {
    const _id = `${congTyId}:CONG_VIEC`
    await this.ensureExists(_id)
    const doc = await this.col.findOneAndUpdate(
      { _id },
      { $inc: { giaTri: 1 } },
      { returnDocument: 'after', session: this.session },
    )
    if (!doc) throw new Error('Không lấy được số thứ tự công việc')
    return doc.giaTri
  }

  /**
   * Tạo bản ghi bộ đếm (nếu chưa có) NGOÀI giao dịch: upsert đồng thời trong giao dịch có thể gây
   * lỗi trùng khóa không tự thử lại được. Hai yêu cầu cùng tạo thì một bên nhận E11000 — bỏ qua là đúng.
   */
  private async ensureExists(_id: string): Promise<void> {
    try {
      await this.col.updateOne({ _id }, { $setOnInsert: { giaTri: 0 } }, { upsert: true })
    } catch (e) {
      if (!(e instanceof MongoServerError && e.code === 11000)) throw e
    }
  }
}
