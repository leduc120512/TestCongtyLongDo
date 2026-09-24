import type { Db } from 'mongodb'
import { MongoBoDemRepository } from './bo-dem.repository'
import { MongoCongViecRepository } from './cong-viec.repository'
import { MongoDuAnRepository, MongoNhanVienRepository } from './danh-muc.repository'
import type { KhoDuLieu } from './giao-dien'
import { MongoLichSuRepository } from './lich-su.repository'

export function taoKhoMongo(db: Db): KhoDuLieu {
  return {
    congViec: new MongoCongViecRepository(db),
    boDem: new MongoBoDemRepository(db),
    lichSu: new MongoLichSuRepository(db),
    nhanVien: new MongoNhanVienRepository(db),
    duAn: new MongoDuAnRepository(db),
  }
}
