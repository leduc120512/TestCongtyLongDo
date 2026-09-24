import { MongoClient, type Db } from 'mongodb'

export type DbConnection = { client: MongoClient; db: Db; supportsTransactions: boolean }

export async function connectMongo(url: string): Promise<DbConnection> {
  // ignoreUndefined: lưới an toàn cuối cùng để không bao giờ ghi trường undefined vào Mongo.
  // Repository vẫn tự bỏ undefined (xem strip-undefined.ts), không dựa hoàn toàn vào cờ này.
  const client = new MongoClient(url, { ignoreUndefined: true, serverSelectionTimeoutMS: 5000 })
  await client.connect()
  const db = client.db()
  // Transaction chỉ chạy được trên replica set hoặc mongos.
  const hello = await db.admin().command({ hello: 1 })
  const supportsTransactions = Boolean(hello.setName) || hello.msg === 'isdbgrid'
  return { client, db, supportsTransactions }
}

export const COLLECTIONS = {
  companies: 'cong_ty',
  employees: 'nhan_vien',
  projects: 'du_an',
  tasks: 'cong_viec',
  history: 'lich_su_cong_viec',
  comments: 'binh_luan_cong_viec',
  counters: 'bo_dem',
} as const

/**
 * Index cho các truy vấn danh sách. Thứ tự khóa theo quy tắc ESR (Equality → Sort → Range):
 * congTyId + vai trò + deletedAt là điều kiện bằng, hanSapXep là khóa sắp xếp và cũng là khoảng
 * khi lọc Quá hạn, _id để phân trang ổn định.
 */
export async function createIndexes(db: Db): Promise<void> {
  const tasks = db.collection(COLLECTIONS.tasks)
  await Promise.all([
    tasks.createIndex({ congTyId: 1, ma: 1 }, { unique: true, name: 'ma_duy_nhat_trong_cong_ty' }),
    tasks.createIndex(
      { congTyId: 1, nguoiThucHienIds: 1, deletedAt: 1, hanSapXep: 1, _id: 1 },
      { name: 'ds_viec_cua_toi' },
    ),
    tasks.createIndex(
      { congTyId: 1, nguoiGiaoId: 1, deletedAt: 1, hanSapXep: 1, _id: 1 },
      { name: 'ds_viec_toi_giao' },
    ),
    tasks.createIndex(
      { congTyId: 1, nguoiTheoDoiIds: 1, deletedAt: 1, hanSapXep: 1, _id: 1 },
      { name: 'ds_dang_theo_doi' },
    ),
    db
      .collection(COLLECTIONS.history)
      .createIndex({ congTyId: 1, congViecId: 1, luc: -1, _id: -1 }, { name: 'lich_su_theo_viec_luc' }),
    db
      .collection(COLLECTIONS.comments)
      .createIndex({ congTyId: 1, congViecId: 1, taoLuc: -1, _id: -1 }, { name: 'binh_luan_theo_viec' }),
    db
      .collection(COLLECTIONS.employees)
      .createIndex({ congTyId: 1, ten: 1 }, { name: 'nhan_vien_theo_cong_ty', collation: { locale: 'vi' } }),
    db.collection(COLLECTIONS.projects).createIndex({ congTyId: 1, ma: 1 }, { unique: true, name: 'du_an_theo_cong_ty' }),
  ])
}
