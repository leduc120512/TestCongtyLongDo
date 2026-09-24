import { MongoClient, type Db } from 'mongodb'

export type KetNoiDb = { client: MongoClient; db: Db }

export async function moKetNoi(url: string): Promise<KetNoiDb> {
  // ignoreUndefined: lưới an toàn cuối cùng để không bao giờ ghi trường undefined vào Mongo.
  // Repository vẫn tự bỏ undefined (xem bo-undefined.ts), không dựa hoàn toàn vào cờ này.
  const client = new MongoClient(url, { ignoreUndefined: true, serverSelectionTimeoutMS: 5000 })
  await client.connect()
  return { client, db: client.db() }
}

export const TEN_BANG = {
  congTy: 'cong_ty',
  nhanVien: 'nhan_vien',
  duAn: 'du_an',
  congViec: 'cong_viec',
  lichSu: 'lich_su_cong_viec',
  boDem: 'bo_dem',
} as const

/**
 * Index cho các truy vấn danh sách. Thứ tự khóa theo quy tắc ESR (Equality → Sort → Range):
 * congTyId + vai trò + deletedAt là điều kiện bằng, hanSapXep là khóa sắp xếp và cũng là khoảng
 * khi lọc Quá hạn, _id để phân trang ổn định.
 */
export async function taoIndex(db: Db): Promise<void> {
  const congViec = db.collection(TEN_BANG.congViec)
  await Promise.all([
    congViec.createIndex({ congTyId: 1, ma: 1 }, { unique: true, name: 'ma_duy_nhat_trong_cong_ty' }),
    congViec.createIndex(
      { congTyId: 1, nguoiThucHienIds: 1, deletedAt: 1, hanSapXep: 1, _id: 1 },
      { name: 'ds_viec_cua_toi' },
    ),
    congViec.createIndex(
      { congTyId: 1, nguoiGiaoId: 1, deletedAt: 1, hanSapXep: 1, _id: 1 },
      { name: 'ds_viec_toi_giao' },
    ),
    congViec.createIndex(
      { congTyId: 1, nguoiTheoDoiIds: 1, deletedAt: 1, hanSapXep: 1, _id: 1 },
      { name: 'ds_dang_theo_doi' },
    ),
    db
      .collection(TEN_BANG.lichSu)
      .createIndex({ congTyId: 1, congViecId: 1, luc: -1 }, { name: 'lich_su_theo_viec' }),
    db.collection(TEN_BANG.nhanVien).createIndex({ congTyId: 1, ten: 1 }, { name: 'nhan_vien_theo_cong_ty' }),
    db.collection(TEN_BANG.duAn).createIndex({ congTyId: 1, ma: 1 }, { unique: true, name: 'du_an_theo_cong_ty' }),
  ])
}
