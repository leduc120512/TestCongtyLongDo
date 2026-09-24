import type { ClientSession, Db, MongoClient } from 'mongodb'
import { MongoCommentRepository } from './comment.repository.ts'
import { MongoCounterRepository } from './counter.repository.ts'
import { MongoTaskRepository } from './task.repository.ts'
import { MongoProjectRepository, MongoEmployeeRepository } from './catalog.repository.ts'
import type { DataStore } from './interfaces.ts'
import { MongoHistoryRepository } from './history.repository.ts'

/**
 * Tạo kho dữ liệu Mongo. Nếu Mongo chạy replica set (docker-compose của repo), store.transaction dùng transaction
 * thật; nếu là mongod đơn lẻ (không hỗ trợ transaction) thì chạy tuần tự và ghi cảnh báo lúc khởi động.
 */
export function createMongoStore(client: MongoClient, db: Db, supportsTransactions: boolean): DataStore {
  const build = (session?: ClientSession): DataStore => {
    const store: DataStore = {
      tasks: new MongoTaskRepository(db, session),
      counters: new MongoCounterRepository(db, session),
      history: new MongoHistoryRepository(db, session),
      comments: new MongoCommentRepository(db, session),
      employees: new MongoEmployeeRepository(db),
      projects: new MongoProjectRepository(db),
      transaction: async (fn) => {
        // Đã ở trong giao dịch, hoặc Mongo không hỗ trợ: chạy thẳng.
        if (session || !supportsTransactions) return fn(store)
        // withTransaction tự thử lại khi gặp lỗi tạm thời (vd. hai giao dịch cùng tăng bộ đếm).
        return client.withSession((s) => s.withTransaction(() => fn(build(s))))
      },
    }
    return store
  }
  return build()
}
