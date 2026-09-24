import type { ClientSession, Db, MongoClient } from 'mongodb'
import { MongoBoDemRepository } from './bo-dem.repository.ts'
import { MongoCongViecRepository } from './cong-viec.repository.ts'
import { MongoDuAnRepository, MongoNhanVienRepository } from './danh-muc.repository.ts'
import type { KhoDuLieu } from './giao-dien.ts'
import { MongoLichSuRepository } from './lich-su.repository.ts'

/**
 * Tạo kho dữ liệu Mongo. Nếu Mongo chạy replica set (docker-compose của repo), giaoDich dùng transaction
 * thật; nếu là mongod đơn lẻ (không hỗ trợ transaction) thì chạy tuần tự và ghi cảnh báo lúc khởi động.
 */
export function taoKhoMongo(client: MongoClient, db: Db, coGiaoDich: boolean): KhoDuLieu {
  const tao = (session?: ClientSession): KhoDuLieu => {
    const kho: KhoDuLieu = {
      congViec: new MongoCongViecRepository(db, session),
      boDem: new MongoBoDemRepository(db, session),
      lichSu: new MongoLichSuRepository(db, session),
      nhanVien: new MongoNhanVienRepository(db),
      duAn: new MongoDuAnRepository(db),
      giaoDich: async (fn) => {
        // Đã ở trong giao dịch, hoặc Mongo không hỗ trợ: chạy thẳng.
        if (session || !coGiaoDich) return fn(kho)
        // withTransaction tự thử lại khi gặp lỗi tạm thời (vd. hai giao dịch cùng tăng bộ đếm).
        return client.withSession((s) => s.withTransaction(() => fn(tao(s))))
      },
    }
    return kho
  }
  return tao()
}
