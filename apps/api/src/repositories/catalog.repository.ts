import type { Collection, Db, ObjectId } from 'mongodb'
import { COLLECTIONS } from '../db/connection.ts'
import { toObjectId, toObjectIds } from '../db/object-id.ts'
import type { ProjectRecord, EmployeeRecord } from '../types.ts'
import type { ProjectRepository, EmployeeRepository } from './interfaces.ts'

/** Sắp xếp theo bảng chữ cái tiếng Việt. */
const VIETNAMESE_COLLATION = { locale: 'vi' } as const

export type EmployeeDoc = { _id: ObjectId; congTyId: ObjectId; ten: string; chucVu: string }
export type ProjectDoc = { _id: ObjectId; congTyId: ObjectId; ma: string; ten: string }

const toEmployeeRecord = (d: EmployeeDoc): EmployeeRecord => ({
  id: d._id.toHexString(),
  congTyId: d.congTyId.toHexString(),
  ten: d.ten,
  chucVu: d.chucVu,
})

const toProjectRecord = (d: ProjectDoc): ProjectRecord => ({
  id: d._id.toHexString(),
  congTyId: d.congTyId.toHexString(),
  ma: d.ma,
  ten: d.ten,
})

export class MongoEmployeeRepository implements EmployeeRepository {
  private readonly col: Collection<EmployeeDoc>

  constructor(db: Db) {
    this.col = db.collection<EmployeeDoc>(COLLECTIONS.employees)
  }

  async list(congTyId: string): Promise<EmployeeRecord[]> {
    const companyOid = toObjectId(congTyId)
    if (!companyOid) return []
    const docs = await this.col.find({ congTyId: companyOid }).collation(VIETNAMESE_COLLATION).sort({ ten: 1 }).toArray()
    return docs.map(toEmployeeRecord)
  }

  async listForMockLogin(): Promise<EmployeeRecord[]> {
    const docs = await this.col.find({}).collation(VIETNAMESE_COLLATION).sort({ congTyId: 1, ten: 1 }).limit(200).toArray()
    return docs.map(toEmployeeRecord)
  }

  async findById(id: string): Promise<EmployeeRecord | null> {
    const _id = toObjectId(id)
    if (!_id) return null
    const doc = await this.col.findOne({ _id })
    return doc ? toEmployeeRecord(doc) : null
  }

  async findMany(congTyId: string, ids: readonly string[]): Promise<EmployeeRecord[]> {
    const companyOid = toObjectId(congTyId)
    if (!companyOid || ids.length === 0) return []
    return (await this.col.find({ congTyId: companyOid, _id: { $in: toObjectIds(ids) } }).toArray()).map(toEmployeeRecord)
  }
}

export class MongoProjectRepository implements ProjectRepository {
  private readonly col: Collection<ProjectDoc>

  constructor(db: Db) {
    this.col = db.collection<ProjectDoc>(COLLECTIONS.projects)
  }

  async list(congTyId: string): Promise<ProjectRecord[]> {
    const companyOid = toObjectId(congTyId)
    if (!companyOid) return []
    return (await this.col.find({ congTyId: companyOid }).sort({ ma: 1 }).toArray()).map(toProjectRecord)
  }

  async findById(congTyId: string, id: string): Promise<ProjectRecord | null> {
    const companyOid = toObjectId(congTyId)
    const _id = toObjectId(id)
    if (!companyOid || !_id) return null
    const doc = await this.col.findOne({ _id, congTyId: companyOid })
    return doc ? toProjectRecord(doc) : null
  }
}
