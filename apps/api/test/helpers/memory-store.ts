import type { QuickFilter, SortOrder, QuickFilterCounts } from '@longdo/contracts'
import type {
  CommentRecord,
  TaskRecord,
  NewTask,
  ProjectRecord,
  HistoryRecord,
  NewHistoryRecord,
  EmployeeRecord,
  TaskChanges,
} from '../../src/types.ts'
import type {
  TaskFilter,
  TaskRepository,
  UpdateCondition,
  DataStore,
} from '../../src/repositories/interfaces.ts'
import { normalizeForSearch } from '../../src/repositories/search.ts'

/**
 * Kho dữ liệu trong bộ nhớ, cài đặt đúng các giao diện repository. Dùng để test nghiệp vụ và quyền
 * ở tầng service mà không cần Mongo. Hành vi Mongo thật được kiểm ở test tích hợp.
 */

let idCounter = 0
export const newId = () => (++idCounter).toString(16).padStart(24, 'a')

class MemoryTaskRepository implements TaskRepository {
  readonly items = new Map<string, TaskRecord>()

  async findById(congTyId: string, id: string) {
    const task = this.items.get(id)
    return task && task.congTyId === congTyId && !task.deletedAt ? structuredClone(task) : null
  }

  async create(data: NewTask) {
    if ([...this.items.values()].some((x) => x.congTyId === data.congTyId && x.ma === data.ma)) {
      throw new Error('trùng mã')
    }
    const task = { ...data, id: newId() }
    this.items.set(task.id, structuredClone(task))
    return task
  }

  async update(congTyId: string, id: string, condition: UpdateCondition, changes: TaskChanges, now: Date) {
    const task = this.items.get(id)
    if (!task || task.congTyId !== congTyId || task.deletedAt) return null
    if (condition.trangThai && task.trangThai !== condition.trangThai) return null
    if (condition.phienBan !== undefined && task.phienBan !== condition.phienBan) return null
    const updated: Record<string, unknown> = { ...task, capNhatLuc: now, phienBan: task.phienBan + 1 }
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined) continue
      if (v === null) delete updated[k]
      else updated[k] = v
    }
    this.items.set(id, updated as TaskRecord)
    return structuredClone(updated as TaskRecord)
  }

  private match(filter: TaskFilter, quickFilter: QuickFilter) {
    const keyword = filter.q ? normalizeForSearch(filter.q) : ''
    return [...this.items.values()].filter((task) => {
      if (task.congTyId !== filter.congTyId || task.deletedAt) return false
      const isAssignee = task.nguoiThucHienIds.includes(filter.userId)
      const isAssigner = task.nguoiGiaoId === filter.userId
      const isFollower = task.nguoiTheoDoiIds.includes(filter.userId)
      const matches = { CUA_TOI: isAssignee, TOI_GIAO: isAssigner, THEO_DOI: isFollower, TAT_CA: isAssignee || isAssigner || isFollower }[quickFilter]
      if (!matches) return false
      if (filter.duAnId === null && task.duAnId) return false
      if (filter.duAnId && task.duAnId !== filter.duAnId) return false
      if (filter.trangThai === 'QUA_HAN') {
        if (task.trangThai === 'HOAN_THANH' || !task.hetHan || task.hetHan >= filter.today) return false
      } else if (filter.trangThai && task.trangThai !== filter.trangThai) return false
      if (filter.uuTien && task.uuTien !== filter.uuTien) return false
      if (keyword && !normalizeForSearch(task.ten).includes(keyword) && !task.ma.toLowerCase().includes(keyword)) return false
      return true
    })
  }

  async list(filter: TaskFilter & { nhanh: QuickFilter }, paging: { page: number; limit: number }, sortOrder: SortOrder) {
    const direction = sortOrder === 'hetHan_desc' ? -1 : 1
    const sortKey = (task: TaskRecord) => `${task.hetHan ?? '9999-12-31'}|${task.id}`
    const all = this.match(filter, filter.nhanh).sort((x, y) => (sortKey(x) < sortKey(y) ? -direction : direction))
    const start = (paging.page - 1) * paging.limit
    return { items: all.slice(start, start + paging.limit).map((x) => structuredClone(x)), total: all.length }
  }

  async countByQuickFilter(filter: TaskFilter): Promise<QuickFilterCounts> {
    return {
      CUA_TOI: this.match(filter, 'CUA_TOI').length,
      TOI_GIAO: this.match(filter, 'TOI_GIAO').length,
      THEO_DOI: this.match(filter, 'THEO_DOI').length,
      TAT_CA: this.match(filter, 'TAT_CA').length,
    }
  }
}

export type MemoryStore = DataStore & {
  tasks: MemoryTaskRepository
  historyRecords: HistoryRecord[]
  addEmployee(employee: EmployeeRecord): void
  addProject(project: ProjectRecord): void
}

export function createMemoryStore(): MemoryStore {
  const employees: EmployeeRecord[] = []
  const projects: ProjectRecord[] = []
  const historyRecords: HistoryRecord[] = []
  const commentRecords: CommentRecord[] = []
  const counterValues = new Map<string, number>()

  const store: MemoryStore = {
    tasks: new MemoryTaskRepository(),
    historyRecords,
    // Trong bộ nhớ không có giao dịch thật; test tính nguyên tử nằm ở test tích hợp Mongo.
    transaction: (fn) => fn(store),
    addEmployee: (employee) => employees.push(employee),
    addProject: (project) => projects.push(project),
    counters: {
      async nextSequence(congTyId) {
        const seq = (counterValues.get(congTyId) ?? 0) + 1
        counterValues.set(congTyId, seq)
        return seq
      },
    },
    history: {
      async add(record: NewHistoryRecord) {
        historyRecords.push({ ...structuredClone(record), id: newId() })
      },
      async list(congTyId, congViecId) {
        return historyRecords
          .filter((x) => x.congTyId === congTyId && x.congViecId === congViecId)
          .sort((a, b) => b.luc.getTime() - a.luc.getTime())
      },
    },
    comments: {
      async add(comment) {
        const created = { ...structuredClone(comment), id: newId() }
        commentRecords.push(created)
        return created
      },
      async list(congTyId, congViecId) {
        return commentRecords.filter((x) => x.congTyId === congTyId && x.congViecId === congViecId)
      },
    },
    employees: {
      async list(congTyId) {
        return employees.filter((x) => x.congTyId === congTyId)
      },
      async listForMockLogin() {
        return [...employees]
      },
      async findById(id) {
        return employees.find((x) => x.id === id) ?? null
      },
      async findMany(congTyId, ids) {
        return employees.filter((x) => x.congTyId === congTyId && ids.includes(x.id))
      },
    },
    projects: {
      async list(congTyId) {
        return projects.filter((x) => x.congTyId === congTyId)
      },
      async findById(congTyId, id) {
        return projects.find((x) => x.congTyId === congTyId && x.id === id) ?? null
      },
    },
  }
  return store
}
