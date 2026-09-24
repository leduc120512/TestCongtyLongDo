import type { AuthUser, CreateTask, TaskStatus } from '@longdo/contracts'
import { ObjectId } from 'mongodb'
import { config } from './config.ts'
import { connectMongo, COLLECTIONS, createIndexes } from './db/connection.ts'
import { createMongoStore } from './repositories/index.ts'
import type { ProjectDoc, EmployeeDoc } from './repositories/catalog.repository.ts'
import { TaskService } from './services/task.service.ts'
import { todayInVietnam } from './services/domain/time.ts'

/**
 * Seed lại toàn bộ dữ liệu demo. Id cố định để token đã lưu trên trình duyệt vẫn dùng được sau khi seed lại.
 * Công việc được tạo qua TaskService để mã CV, lịch sử và luồng trạng thái đi đúng nghiệp vụ.
 */

export const COMPANY_ID = '66c000000000000000000001'
const employeeId = (n: number) => `66e0000000000000000000${String(n).padStart(2, '0')}`
const projectId = (n: number) => `66d0000000000000000000${String(n).padStart(2, '0')}`

export const EMPLOYEES = [
  { id: employeeId(1), ten: 'Nguyễn Văn An', chucVu: 'Chỉ huy trưởng công trình' },
  { id: employeeId(2), ten: 'Trần Thị Bình', chucVu: 'Trưởng phòng Kỹ thuật' },
  { id: employeeId(3), ten: 'Lê Văn Cường', chucVu: 'Kỹ sư cầu đường' },
  { id: employeeId(4), ten: 'Phạm Thị Dung', chucVu: 'Kỹ sư điện' },
  { id: employeeId(5), ten: 'Hoàng Văn Em', chucVu: 'Kỹ sư thủy lợi' },
  { id: employeeId(6), ten: 'Vũ Thị Giang', chucVu: 'Kỹ sư QA/QC' },
  { id: employeeId(7), ten: 'Đặng Văn Hùng', chucVu: 'Tổ trưởng tổ cọc khoan nhồi' },
  { id: employeeId(8), ten: 'Bùi Thị Lan', chucVu: 'Cán bộ an toàn lao động' },
  { id: employeeId(9), ten: 'Đỗ Văn Minh', chucVu: 'Tổ trưởng tổ điện' },
  { id: employeeId(10), ten: 'Ngô Thị Nga', chucVu: 'Thư ký công trình' },
] as const

export const PROJECTS = [
  { id: projectId(1), ma: 'CNC', ten: 'Cầu Nam Căn' },
  { id: projectId(2), ma: 'DLLD', ten: 'Điện lực Linh Đàm' },
  { id: projectId(3), ma: 'TLBH', ten: 'Thủy lợi Bắc Hưng Hải' },
] as const

const [AN, BINH, CUONG, DUNG, EM, GIANG, HUNG, LAN, MINH, NGA] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(employeeId) as [
  string, string, string, string, string, string, string, string, string, string,
]
const [BRIDGE, POWER_GRID, IRRIGATION] = [1, 2, 3].map(projectId) as [string, string, string]

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

type SampleTask = {
  assigner: string
  task: Omit<CreateTask, 'nguoiTheoDoiIds' | 'uuTien'> & Partial<Pick<CreateTask, 'nguoiTheoDoiIds' | 'uuTien'>>
  /** Trạng thái muốn đạt tới; seed đi đúng luồng để tới đó. */
  targetStatus?: TaskStatus
  progress?: number
  subtasks?: Array<{ ten: string; xong?: boolean }>
  comments?: Array<{ author: string; noiDung: string }>
}

function sampleTasks(today: string): SampleTask[] {
  const n = (days: number) => addDays(today, days)
  return [
    {
      assigner: AN,
      task: { ten: 'Nghiệm thu cọc khoan nhồi trụ T5', duAnId: BRIDGE, nguoiThucHienIds: [CUONG, HUNG], nguoiTheoDoiIds: [GIANG], uuTien: 'CAO', batDau: n(-10), hetHan: n(-2), moTa: 'Nghiệm thu 12 cọc D1500 trụ T5, có mặt tư vấn giám sát.' },
      targetStatus: 'DANG_LAM',
      progress: 70,
      comments: [
        { author: GIANG, noiDung: 'Cọc T5-07 cần siêu âm lại, kết quả lần 1 chưa đạt.' },
        { author: CUONG, noiDung: 'Đã hẹn đơn vị thí nghiệm sáng thứ Hai.' },
      ],
    },
    {
      assigner: AN,
      task: { ten: 'Đổ bê tông bệ trụ T6', duAnId: BRIDGE, nguoiThucHienIds: [HUNG], nguoiTheoDoiIds: [CUONG, LAN], uuTien: 'CAO', batDau: n(-3), hetHan: n(4) },
      targetStatus: 'DANG_LAM',
      subtasks: [
        { ten: 'Lắp dựng ván khuôn', xong: true },
        { ten: 'Lắp dựng cốt thép', xong: true },
        { ten: 'Đổ bê tông M300' },
        { ten: 'Bảo dưỡng bê tông 7 ngày' },
      ],
    },
    {
      assigner: AN,
      task: { ten: 'Lập biện pháp thi công dầm Super-T nhịp 3', duAnId: BRIDGE, nguoiThucHienIds: [CUONG], nguoiTheoDoiIds: [BINH], batDau: n(-7), hetHan: n(0) },
      targetStatus: 'CHO_DUYET',
    },
    {
      assigner: AN,
      task: { ten: 'Kiểm tra an toàn giàn giáo trụ T4', duAnId: BRIDGE, nguoiThucHienIds: [LAN], uuTien: 'CAO', hetHan: n(-1) },
      targetStatus: 'HOAN_THANH',
    },
    {
      assigner: BINH,
      task: { ten: 'Thẩm tra hồ sơ thiết kế trạm biến áp 110kV', duAnId: POWER_GRID, nguoiThucHienIds: [DUNG], nguoiTheoDoiIds: [AN], uuTien: 'CAO', batDau: n(-5), hetHan: n(3) },
      targetStatus: 'DANG_LAM',
      progress: 50,
    },
    {
      assigner: BINH,
      task: { ten: 'Kéo dây cáp ngầm tuyến 22kV Linh Đàm', duAnId: POWER_GRID, nguoiThucHienIds: [MINH, DUNG], hetHan: n(14) },
      subtasks: [{ ten: 'Đào rãnh cáp' }, { ten: 'Rải cáp và đấu nối' }, { ten: 'Hoàn trả mặt bằng' }],
      comments: [{ author: BINH, noiDung: 'Xin giấy phép đào đường trước ngày 15.' }],
    },
    {
      assigner: BINH,
      task: { ten: 'Thí nghiệm máy biến áp T1', duAnId: POWER_GRID, nguoiThucHienIds: [MINH], nguoiTheoDoiIds: [GIANG], hetHan: n(-5) },
    },
    {
      assigner: DUNG,
      task: { ten: 'Lắp đặt tủ RMU khu đô thị', duAnId: POWER_GRID, nguoiThucHienIds: [MINH], nguoiTheoDoiIds: [BINH], batDau: n(-2), hetHan: n(7) },
      targetStatus: 'CHO_DUYET',
    },
    {
      assigner: BINH,
      task: { ten: 'Khảo sát địa chất cống Kênh Cầu', duAnId: IRRIGATION, nguoiThucHienIds: [EM], uuTien: 'BINH_THUONG', batDau: n(1), hetHan: n(10) },
    },
    {
      assigner: EM,
      task: { ten: 'Đo đạc cao độ đáy kênh đoạn K2–K5', duAnId: IRRIGATION, nguoiThucHienIds: [EM], uuTien: 'THAP', hetHan: n(5) },
      targetStatus: 'DANG_LAM',
      progress: 40,
    },
    {
      assigner: BINH,
      task: { ten: 'Nạo vét kênh dẫn đoạn K3', duAnId: IRRIGATION, nguoiThucHienIds: [EM], nguoiTheoDoiIds: [AN, NGA], hetHan: n(-12) },
      targetStatus: 'HOAN_THANH',
    },
    {
      assigner: AN,
      task: { ten: 'Tổng hợp báo cáo tuần gửi Ban quản lý dự án', nguoiThucHienIds: [NGA], nguoiTheoDoiIds: [BINH], uuTien: 'BINH_THUONG', hetHan: n(1) },
    },
    {
      assigner: NGA,
      task: { ten: 'Chuẩn bị phòng họp giao ban công trường', nguoiThucHienIds: [NGA], uuTien: 'THAP', hetHan: n(-1) },
    },
    {
      assigner: LAN,
      task: { ten: 'Huấn luyện an toàn lao động quý IV', nguoiThucHienIds: [LAN], nguoiTheoDoiIds: [AN, BINH], hetHan: n(20) },
    },
    {
      assigner: GIANG,
      task: { ten: 'Cập nhật quy trình kiểm soát chất lượng vật liệu', nguoiThucHienIds: [GIANG] },
    },
  ]
}

/** Các bước để đi từ CHUA_BAT_DAU tới trạng thái đích, theo đúng luồng. */
const STATUS_PATH: Record<TaskStatus, TaskStatus[]> = {
  CHUA_BAT_DAU: [],
  DANG_LAM: ['DANG_LAM'],
  CHO_DUYET: ['DANG_LAM', 'CHO_DUYET'],
  HOAN_THANH: ['DANG_LAM', 'CHO_DUYET', 'HOAN_THANH'],
}

async function main() {
  // Seed xóa sạch mọi collection rồi tạo lại: không bao giờ chạy trên dữ liệu thật.
  if (config.isProduction) throw new Error('Không chạy seed khi NODE_ENV=production: seed xóa toàn bộ dữ liệu')
  const { client, db, supportsTransactions } = await connectMongo(config.mongoUrl)
  try {
    await Promise.all(
      Object.values(COLLECTIONS).map((ten) => db.collection(ten).drop().catch(() => undefined)),
    )
    await createIndexes(db)

    const congTyId = new ObjectId(COMPANY_ID)
    await db.collection(COLLECTIONS.companies).insertOne({ _id: congTyId, ten: 'Công ty CP Xây dựng Long Đỗ' })
    await db.collection<EmployeeDoc>(COLLECTIONS.employees).insertMany(
      EMPLOYEES.map((n) => ({ _id: new ObjectId(n.id), congTyId, ten: n.ten, chucVu: n.chucVu })),
    )
    await db.collection<ProjectDoc>(COLLECTIONS.projects).insertMany(
      PROJECTS.map((d) => ({ _id: new ObjectId(d.id), congTyId, ma: d.ma, ten: d.ten })),
    )

    const service = new TaskService(createMongoStore(client, db, supportsTransactions))
    const today = todayInVietnam()
    for (const sample of sampleTasks(today)) {
      const assigner: AuthUser = { userId: sample.assigner, congTyId: COMPANY_ID }
      const assignee: AuthUser = { userId: sample.task.nguoiThucHienIds[0]!, congTyId: COMPANY_ID }
      const task = await service.create(assigner, { nguoiTheoDoiIds: [], uuTien: 'BINH_THUONG', ...sample.task })
      let subtasks = task.viecCon
      for (const subtask of sample.subtasks ?? []) subtasks = (await service.addSubtask(assigner, task.id, { ten: subtask.ten })).viecCon
      for (const step of STATUS_PATH[sample.targetStatus ?? 'CHUA_BAT_DAU']) {
        const actor = step === 'HOAN_THANH' ? assigner : assignee
        await service.changeStatus(actor, task.id, { trangThai: step })
        if (step === 'DANG_LAM') {
          // Đánh dấu việc con đã xong (phải xong hết thì mới gửi duyệt được).
          for (const [i, subtask] of (sample.subtasks ?? []).entries()) {
            if (subtask.xong) await service.markSubtask(assignee, task.id, subtasks[i]!.id, { xong: true })
          }
          if (sample.progress !== undefined && sample.targetStatus === 'DANG_LAM') {
            await service.updateProgress(assignee, task.id, { tienDo: sample.progress })
          }
        }
      }
      for (const comment of sample.comments ?? []) {
        await service.addComment({ userId: comment.author, congTyId: COMPANY_ID }, task.id, { noiDung: comment.noiDung })
      }
    }

    const taskCount = await db.collection(COLLECTIONS.tasks).countDocuments()
    console.log(`Đã seed: 1 công ty, ${EMPLOYEES.length} nhân viên, ${PROJECTS.length} dự án, ${taskCount} công việc.`)
  } finally {
    await client.close()
  }
}

// Chỉ chạy khi gọi trực tiếp (pnpm seed), không chạy khi test import hằng số.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/seed.ts')) {
  await main()
}
