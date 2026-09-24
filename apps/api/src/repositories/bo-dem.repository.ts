import { MongoServerError, type Collection, type Db } from 'mongodb'
import { TEN_BANG } from '../db/ket-noi.ts'
import type { BoDemRepository } from './giao-dien.ts'

type BoDemDoc = { _id: string; giaTri: number }

/**
 * Bộ đếm mã công việc, một bản ghi cho mỗi công ty. $inc trong findOneAndUpdate là nguyên tử
 * nên hai yêu cầu tạo cùng lúc luôn nhận hai số khác nhau, liền nhau.
 */
export class MongoBoDemRepository implements BoDemRepository {
  private readonly col: Collection<BoDemDoc>

  constructor(db: Db) {
    this.col = db.collection<BoDemDoc>(TEN_BANG.boDem)
  }

  async laySoTiepTheo(congTyId: string): Promise<number> {
    const _id = `${congTyId}:CONG_VIEC`
    // Hai yêu cầu đầu tiên cùng upsert có thể đụng khóa _id (E11000); thử lại một lần là đủ,
    // vì lần sau bản ghi đã tồn tại và $inc chạy bình thường.
    for (let lan = 0; lan < 2; lan++) {
      try {
        const doc = await this.col.findOneAndUpdate(
          { _id },
          { $inc: { giaTri: 1 } },
          { upsert: true, returnDocument: 'after' },
        )
        if (doc) return doc.giaTri
      } catch (e) {
        if (!(e instanceof MongoServerError && e.code === 11000) || lan === 1) throw e
      }
    }
    throw new Error('Không lấy được số thứ tự công việc')
  }
}
