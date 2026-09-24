import type { QuickFilter, SortOrder, QuickFilterCounts, TaskStatus, Priority } from '@longdo/contracts'
import { MongoServerError, ObjectId, type ClientSession, type Collection, type Db, type Filter, type Sort } from 'mongodb'
import { stripUndefined, splitSetUnset } from '../db/strip-undefined.ts'
import { COLLECTIONS } from '../db/connection.ts'
import { toObjectId, toObjectIds } from '../db/object-id.ts'
import type { TaskRecord, NewTask, TaskChanges } from '../types.ts'
import { DomainError } from '../errors.ts'
import type { TaskFilter, TaskRepository, UpdateCondition } from './interfaces.ts'
import { normalizeForSearch, escapeRegex } from './search.ts'

/** Việc không có hạn được xếp cuối khi sắp tăng dần. */
const NO_DEADLINE = '9999-12-31'

/** Dạng lưu trong Mongo: tham chiếu là ObjectId, có thêm trường phục vụ truy vấn. */
export type TaskDoc = {
  _id: ObjectId
  congTyId: ObjectId
  ma: string
  ten: string
  /** ten đã bỏ dấu, chữ thường — để tìm kiếm. */
  tuKhoa: string
  moTa?: string
  duAnId?: ObjectId
  nguoiGiaoId: ObjectId
  nguoiThucHienIds: ObjectId[]
  nguoiTheoDoiIds: ObjectId[]
  uuTien: Priority
  batDau?: string
  hetHan?: string
  /** = hetHan, hoặc 9999-12-31 nếu không có hạn. Khóa sắp xếp và lọc Quá hạn. */
  hanSapXep: string
  trangThai: TaskStatus
  tienDo: number
  /** Việc con nhúng trong công việc (danh sách ngắn, ghi cùng lúc với tiến độ). */
  viecCon?: Array<{ id: string; ten: string; xong: boolean }>
  /** Tăng 1 sau mỗi lần ghi; dùng làm khóa lạc quan. */
  phienBan: number
  taoLuc: Date
  capNhatLuc: Date
  deletedAt?: Date
}

function toRecord(d: TaskDoc): TaskRecord {
  return stripUndefined({
    id: d._id.toHexString(),
    congTyId: d.congTyId.toHexString(),
    ma: d.ma,
    ten: d.ten,
    moTa: d.moTa,
    duAnId: d.duAnId?.toHexString(),
    nguoiGiaoId: d.nguoiGiaoId.toHexString(),
    nguoiThucHienIds: d.nguoiThucHienIds.map((x) => x.toHexString()),
    nguoiTheoDoiIds: d.nguoiTheoDoiIds.map((x) => x.toHexString()),
    uuTien: d.uuTien,
    batDau: d.batDau,
    hetHan: d.hetHan,
    trangThai: d.trangThai,
    tienDo: d.tienDo,
    viecCon: (d.viecCon ?? []).map((v) => ({ id: v.id, ten: v.ten, xong: v.xong })),
    phienBan: d.phienBan ?? 0,
    taoLuc: d.taoLuc,
    capNhatLuc: d.capNhatLuc,
    deletedAt: d.deletedAt,
  })
}

/** Id không hợp lệ thì dùng một ObjectId không thể khớp, để truy vấn trả rỗng thay vì lỗi. */
function oid(id: string): ObjectId {
  return toObjectId(id) ?? new ObjectId('000000000000000000000000')
}

export class MongoTaskRepository implements TaskRepository {
  private readonly col: Collection<TaskDoc>
  /** Có khi repository chạy trong một giao dịch (xem DataStore.transaction). */
  private readonly session: ClientSession | undefined

  constructor(db: Db, session?: ClientSession) {
    this.col = db.collection<TaskDoc>(COLLECTIONS.tasks)
    this.session = session
  }

  async findById(congTyId: string, id: string): Promise<TaskRecord | null> {
    const _id = toObjectId(id)
    if (!_id) return null
    const doc = await this.col.findOne(
      { _id, congTyId: oid(congTyId), deletedAt: { $exists: false } },
      { session: this.session },
    )
    return doc ? toRecord(doc) : null
  }

  async create(data: NewTask): Promise<TaskRecord> {
    const doc: TaskDoc = stripUndefined({
      _id: new ObjectId(),
      congTyId: oid(data.congTyId),
      ma: data.ma,
      ten: data.ten,
      tuKhoa: normalizeForSearch(data.ten),
      moTa: data.moTa,
      duAnId: data.duAnId ? oid(data.duAnId) : undefined,
      nguoiGiaoId: oid(data.nguoiGiaoId),
      nguoiThucHienIds: toObjectIds(data.nguoiThucHienIds),
      nguoiTheoDoiIds: toObjectIds(data.nguoiTheoDoiIds),
      uuTien: data.uuTien,
      batDau: data.batDau,
      hetHan: data.hetHan,
      hanSapXep: data.hetHan ?? NO_DEADLINE,
      trangThai: data.trangThai,
      tienDo: data.tienDo,
      viecCon: data.viecCon.map((v) => ({ id: v.id, ten: v.ten, xong: v.xong })),
      phienBan: 0,
      taoLuc: data.taoLuc,
      capNhatLuc: data.capNhatLuc,
    })
    try {
      await this.col.insertOne(doc, { session: this.session })
    } catch (e) {
      // Chỉ xảy ra nếu bộ đếm bị đặt lại thủ công; index duy nhất (congTyId, ma) là lưới an toàn cuối.
      if (e instanceof MongoServerError && e.code === 11000) {
        throw new DomainError('TRUNG_MA', `Mã ${data.ma} đã tồn tại, vui lòng thử lại`)
      }
      throw e
    }
    return toRecord(doc)
  }

  async update(
    congTyId: string,
    id: string,
    condition: UpdateCondition,
    changes: TaskChanges,
    now: Date,
  ): Promise<TaskRecord | null> {
    const _id = toObjectId(id)
    if (!_id) return null

    // Đổi tham chiếu sang ObjectId và tính lại các trường phụ trợ khi trường gốc đổi.
    const values: Record<string, unknown> = { ...changes, capNhatLuc: now }
    if (changes.duAnId !== undefined) values.duAnId = changes.duAnId === null ? null : oid(changes.duAnId)
    if (changes.nguoiThucHienIds) values.nguoiThucHienIds = toObjectIds(changes.nguoiThucHienIds)
    if (changes.nguoiTheoDoiIds) values.nguoiTheoDoiIds = toObjectIds(changes.nguoiTheoDoiIds)
    if (changes.ten) values.tuKhoa = normalizeForSearch(changes.ten)
    if (changes.hetHan !== undefined) values.hanSapXep = changes.hetHan ?? NO_DEADLINE

    const { $set, $unset } = splitSetUnset(values)
    const query: Filter<TaskDoc> = { _id, congTyId: oid(congTyId), deletedAt: { $exists: false } }
    if (condition.trangThai) query.trangThai = condition.trangThai
    // Bản ghi tạo trước khi có phienBan được coi là phiên bản 0.
    if (condition.phienBan === 0) query.$or = [{ phienBan: 0 }, { phienBan: { $exists: false } }]
    else if (condition.phienBan !== undefined) query.phienBan = condition.phienBan

    const doc = await this.col.findOneAndUpdate(
      query,
      { $set, ...(Object.keys($unset).length ? { $unset } : {}), $inc: { phienBan: 1 } },
      { returnDocument: 'after', session: this.session },
    )
    return doc ? toRecord(doc) : null
  }

  async list(
    filter: TaskFilter & { nhanh: QuickFilter },
    paging: { page: number; limit: number },
    sortOrder: SortOrder,
  ): Promise<{ items: TaskRecord[]; total: number }> {
    const query = buildTaskFilter(filter, filter.nhanh)
    const direction = sortOrder === 'hetHan_desc' ? -1 : 1
    const sort: Sort = { hanSapXep: direction, _id: direction }
    const [docs, total] = await Promise.all([
      this.col
        .find(query, { session: this.session })
        .sort(sort)
        .skip((paging.page - 1) * paging.limit)
        .limit(paging.limit)
        .toArray(),
      this.col.countDocuments(query, { session: this.session }),
    ])
    return { items: docs.map(toRecord), total }
  }

  async countByQuickFilter(filter: TaskFilter): Promise<QuickFilterCounts> {
    const [mine, assigned, following, all] = await Promise.all(
      (['CUA_TOI', 'TOI_GIAO', 'THEO_DOI', 'TAT_CA'] as const).map((n) =>
        this.col.countDocuments(buildTaskFilter(filter, n), { session: this.session }),
      ),
    )
    return { CUA_TOI: mine ?? 0, TOI_GIAO: assigned ?? 0, THEO_DOI: following ?? 0, TAT_CA: all ?? 0 }
  }
}

/**
 * Mỗi nhánh vai trò = congTyId + chưa xóa + điều kiện vai trò, khớp với 3 index ds_*.
 * "Tất cả" là $or của 3 nhánh. Bộ lọc phụ được đưa VÀO TỪNG NHÁNH (không bọc $and bên ngoài $or),
 * để Mongo vẫn dùng index cho từng nhánh và gộp kết quả đã sắp xếp (SORT_MERGE), không phải quét
 * cả công ty rồi sắp xếp trong bộ nhớ.
 */
export function buildTaskFilter(filter: TaskFilter, quickFilter: QuickFilter): Filter<TaskDoc> {
  const base = { congTyId: oid(filter.congTyId), deletedAt: { $exists: false } }
  const uid = oid(filter.userId)
  const byRole: Record<Exclude<QuickFilter, 'TAT_CA'>, Filter<TaskDoc>> = {
    CUA_TOI: { ...base, nguoiThucHienIds: uid },
    TOI_GIAO: { ...base, nguoiGiaoId: uid },
    THEO_DOI: { ...base, nguoiTheoDoiIds: uid },
  }
  const extra = buildExtraConditions(filter)
  const withExtra = (roleFilter: Filter<TaskDoc>): Filter<TaskDoc> =>
    extra.length ? { $and: [roleFilter, ...extra] } : roleFilter
  return quickFilter === 'TAT_CA' ? { $or: Object.values(byRole).map(withExtra) } : withExtra(byRole[quickFilter])
}

/** Các điều kiện lọc phụ (dự án, trạng thái/Quá hạn, ưu tiên, từ khóa). */
function buildExtraConditions(filter: TaskFilter): Filter<TaskDoc>[] {
  const conditions: Filter<TaskDoc>[] = []

  if (filter.duAnId === null) conditions.push({ duAnId: { $exists: false } })
  else if (filter.duAnId !== undefined) conditions.push({ duAnId: oid(filter.duAnId) })

  if (filter.trangThai === 'QUA_HAN') {
    // Quá hạn = chưa hoàn thành và hạn < hôm nay (giờ VN). Việc không có hạn có hanSapXep = 9999-12-31 nên tự loại.
    conditions.push({ trangThai: { $ne: 'HOAN_THANH' }, hanSapXep: { $lt: filter.today } })
  } else if (filter.trangThai) {
    conditions.push({ trangThai: filter.trangThai })
  }

  if (filter.uuTien) conditions.push({ uuTien: filter.uuTien })

  const keyword = filter.q ? normalizeForSearch(filter.q) : ''
  if (keyword) {
    const re = new RegExp(escapeRegex(keyword), 'i')
    conditions.push({ $or: [{ tuKhoa: re }, { ma: re }] })
  }
  return conditions
}
