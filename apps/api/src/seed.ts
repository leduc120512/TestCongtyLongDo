import type { NguoiDung, TaoCongViec, TrangThai } from '@longdo/contracts'
import { ObjectId } from 'mongodb'
import { cauHinh } from './config.ts'
import { moKetNoi, TEN_BANG, taoIndex } from './db/connection.ts'
import { taoKhoMongo } from './repositories/index.ts'
import type { DuAnDoc, NhanVienDoc } from './repositories/catalog.repository.ts'
import { CongViecService } from './services/task.service.ts'
import { homNayVN } from './services/domain/time.ts'

/**
 * Seed lại toàn bộ dữ liệu demo. Id cố định để token đã lưu trên trình duyệt vẫn dùng được sau khi seed lại.
 * Công việc được tạo qua CongViecService để mã CV, lịch sử và luồng trạng thái đi đúng nghiệp vụ.
 */

export const CONG_TY_ID = '66c000000000000000000001'
const nvId = (n: number) => `66e0000000000000000000${String(n).padStart(2, '0')}`
const daId = (n: number) => `66d0000000000000000000${String(n).padStart(2, '0')}`

export const NHAN_VIEN = [
  { id: nvId(1), ten: 'Nguyễn Văn An', chucVu: 'Chỉ huy trưởng công trình' },
  { id: nvId(2), ten: 'Trần Thị Bình', chucVu: 'Trưởng phòng Kỹ thuật' },
  { id: nvId(3), ten: 'Lê Văn Cường', chucVu: 'Kỹ sư cầu đường' },
  { id: nvId(4), ten: 'Phạm Thị Dung', chucVu: 'Kỹ sư điện' },
  { id: nvId(5), ten: 'Hoàng Văn Em', chucVu: 'Kỹ sư thủy lợi' },
  { id: nvId(6), ten: 'Vũ Thị Giang', chucVu: 'Kỹ sư QA/QC' },
  { id: nvId(7), ten: 'Đặng Văn Hùng', chucVu: 'Tổ trưởng tổ cọc khoan nhồi' },
  { id: nvId(8), ten: 'Bùi Thị Lan', chucVu: 'Cán bộ an toàn lao động' },
  { id: nvId(9), ten: 'Đỗ Văn Minh', chucVu: 'Tổ trưởng tổ điện' },
  { id: nvId(10), ten: 'Ngô Thị Nga', chucVu: 'Thư ký công trình' },
] as const

export const DU_AN = [
  { id: daId(1), ma: 'CNC', ten: 'Cầu Nam Căn' },
  { id: daId(2), ma: 'DLLD', ten: 'Điện lực Linh Đàm' },
  { id: daId(3), ma: 'TLBH', ten: 'Thủy lợi Bắc Hưng Hải' },
] as const

const [AN, BINH, CUONG, DUNG, EM, GIANG, HUNG, LAN, MINH, NGA] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(nvId) as [
  string, string, string, string, string, string, string, string, string, string,
]
const [CAU, DIEN, THUY_LOI] = [1, 2, 3].map(daId) as [string, string, string]

function congNgay(ngay: string, soNgay: number): string {
  const d = new Date(`${ngay}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + soNgay)
  return d.toISOString().slice(0, 10)
}

type ViecMau = {
  nguoiGiao: string
  viec: Omit<TaoCongViec, 'nguoiTheoDoiIds' | 'uuTien'> & Partial<Pick<TaoCongViec, 'nguoiTheoDoiIds' | 'uuTien'>>
  /** Trạng thái muốn đạt tới; seed đi đúng luồng để tới đó. */
  den?: TrangThai
  tienDo?: number
  viecCon?: Array<{ ten: string; xong?: boolean }>
  binhLuan?: Array<{ ai: string; noiDung: string }>
}

function danhSachViecMau(homNay: string): ViecMau[] {
  const n = (soNgay: number) => congNgay(homNay, soNgay)
  return [
    {
      nguoiGiao: AN,
      viec: { ten: 'Nghiệm thu cọc khoan nhồi trụ T5', duAnId: CAU, nguoiThucHienIds: [CUONG, HUNG], nguoiTheoDoiIds: [GIANG], uuTien: 'CAO', batDau: n(-10), hetHan: n(-2), moTa: 'Nghiệm thu 12 cọc D1500 trụ T5, có mặt tư vấn giám sát.' },
      den: 'DANG_LAM',
      tienDo: 70,
      binhLuan: [
        { ai: GIANG, noiDung: 'Cọc T5-07 cần siêu âm lại, kết quả lần 1 chưa đạt.' },
        { ai: CUONG, noiDung: 'Đã hẹn đơn vị thí nghiệm sáng thứ Hai.' },
      ],
    },
    {
      nguoiGiao: AN,
      viec: { ten: 'Đổ bê tông bệ trụ T6', duAnId: CAU, nguoiThucHienIds: [HUNG], nguoiTheoDoiIds: [CUONG, LAN], uuTien: 'CAO', batDau: n(-3), hetHan: n(4) },
      den: 'DANG_LAM',
      viecCon: [
        { ten: 'Lắp dựng ván khuôn', xong: true },
        { ten: 'Lắp dựng cốt thép', xong: true },
        { ten: 'Đổ bê tông M300' },
        { ten: 'Bảo dưỡng bê tông 7 ngày' },
      ],
    },
    {
      nguoiGiao: AN,
      viec: { ten: 'Lập biện pháp thi công dầm Super-T nhịp 3', duAnId: CAU, nguoiThucHienIds: [CUONG], nguoiTheoDoiIds: [BINH], batDau: n(-7), hetHan: n(0) },
      den: 'CHO_DUYET',
    },
    {
      nguoiGiao: AN,
      viec: { ten: 'Kiểm tra an toàn giàn giáo trụ T4', duAnId: CAU, nguoiThucHienIds: [LAN], uuTien: 'CAO', hetHan: n(-1) },
      den: 'HOAN_THANH',
    },
    {
      nguoiGiao: BINH,
      viec: { ten: 'Thẩm tra hồ sơ thiết kế trạm biến áp 110kV', duAnId: DIEN, nguoiThucHienIds: [DUNG], nguoiTheoDoiIds: [AN], uuTien: 'CAO', batDau: n(-5), hetHan: n(3) },
      den: 'DANG_LAM',
      tienDo: 50,
    },
    {
      nguoiGiao: BINH,
      viec: { ten: 'Kéo dây cáp ngầm tuyến 22kV Linh Đàm', duAnId: DIEN, nguoiThucHienIds: [MINH, DUNG], hetHan: n(14) },
      viecCon: [{ ten: 'Đào rãnh cáp' }, { ten: 'Rải cáp và đấu nối' }, { ten: 'Hoàn trả mặt bằng' }],
      binhLuan: [{ ai: BINH, noiDung: 'Xin giấy phép đào đường trước ngày 15.' }],
    },
    {
      nguoiGiao: BINH,
      viec: { ten: 'Thí nghiệm máy biến áp T1', duAnId: DIEN, nguoiThucHienIds: [MINH], nguoiTheoDoiIds: [GIANG], hetHan: n(-5) },
    },
    {
      nguoiGiao: DUNG,
      viec: { ten: 'Lắp đặt tủ RMU khu đô thị', duAnId: DIEN, nguoiThucHienIds: [MINH], nguoiTheoDoiIds: [BINH], batDau: n(-2), hetHan: n(7) },
      den: 'CHO_DUYET',
    },
    {
      nguoiGiao: BINH,
      viec: { ten: 'Khảo sát địa chất cống Kênh Cầu', duAnId: THUY_LOI, nguoiThucHienIds: [EM], uuTien: 'BINH_THUONG', batDau: n(1), hetHan: n(10) },
    },
    {
      nguoiGiao: EM,
      viec: { ten: 'Đo đạc cao độ đáy kênh đoạn K2–K5', duAnId: THUY_LOI, nguoiThucHienIds: [EM], uuTien: 'THAP', hetHan: n(5) },
      den: 'DANG_LAM',
      tienDo: 40,
    },
    {
      nguoiGiao: BINH,
      viec: { ten: 'Nạo vét kênh dẫn đoạn K3', duAnId: THUY_LOI, nguoiThucHienIds: [EM], nguoiTheoDoiIds: [AN, NGA], hetHan: n(-12) },
      den: 'HOAN_THANH',
    },
    {
      nguoiGiao: AN,
      viec: { ten: 'Tổng hợp báo cáo tuần gửi Ban quản lý dự án', nguoiThucHienIds: [NGA], nguoiTheoDoiIds: [BINH], uuTien: 'BINH_THUONG', hetHan: n(1) },
    },
    {
      nguoiGiao: NGA,
      viec: { ten: 'Chuẩn bị phòng họp giao ban công trường', nguoiThucHienIds: [NGA], uuTien: 'THAP', hetHan: n(-1) },
    },
    {
      nguoiGiao: LAN,
      viec: { ten: 'Huấn luyện an toàn lao động quý IV', nguoiThucHienIds: [LAN], nguoiTheoDoiIds: [AN, BINH], hetHan: n(20) },
    },
    {
      nguoiGiao: GIANG,
      viec: { ten: 'Cập nhật quy trình kiểm soát chất lượng vật liệu', nguoiThucHienIds: [GIANG] },
    },
  ]
}

/** Các bước để đi từ CHUA_BAT_DAU tới trạng thái đích, theo đúng luồng. */
const DUONG_DI: Record<TrangThai, TrangThai[]> = {
  CHUA_BAT_DAU: [],
  DANG_LAM: ['DANG_LAM'],
  CHO_DUYET: ['DANG_LAM', 'CHO_DUYET'],
  HOAN_THANH: ['DANG_LAM', 'CHO_DUYET', 'HOAN_THANH'],
}

async function main() {
  // Seed xóa sạch mọi collection rồi tạo lại: không bao giờ chạy trên dữ liệu thật.
  if (cauHinh.laProduction) throw new Error('Không chạy seed khi NODE_ENV=production: seed xóa toàn bộ dữ liệu')
  const { client, db, coGiaoDich } = await moKetNoi(cauHinh.mongoUrl)
  try {
    await Promise.all(
      Object.values(TEN_BANG).map((ten) => db.collection(ten).drop().catch(() => undefined)),
    )
    await taoIndex(db)

    const congTyId = new ObjectId(CONG_TY_ID)
    await db.collection(TEN_BANG.congTy).insertOne({ _id: congTyId, ten: 'Công ty CP Xây dựng Long Đỗ' })
    await db.collection<NhanVienDoc>(TEN_BANG.nhanVien).insertMany(
      NHAN_VIEN.map((n) => ({ _id: new ObjectId(n.id), congTyId, ten: n.ten, chucVu: n.chucVu })),
    )
    await db.collection<DuAnDoc>(TEN_BANG.duAn).insertMany(
      DU_AN.map((d) => ({ _id: new ObjectId(d.id), congTyId, ma: d.ma, ten: d.ten })),
    )

    const service = new CongViecService(taoKhoMongo(client, db, coGiaoDich))
    const homNay = homNayVN()
    for (const mau of danhSachViecMau(homNay)) {
      const giao: NguoiDung = { userId: mau.nguoiGiao, congTyId: CONG_TY_ID }
      const thucHien: NguoiDung = { userId: mau.viec.nguoiThucHienIds[0]!, congTyId: CONG_TY_ID }
      const cv = await service.tao(giao, { nguoiTheoDoiIds: [], uuTien: 'BINH_THUONG', ...mau.viec })
      let viecCon = cv.viecCon
      for (const vc of mau.viecCon ?? []) viecCon = (await service.themViecCon(giao, cv.id, { ten: vc.ten })).viecCon
      for (const buoc of DUONG_DI[mau.den ?? 'CHUA_BAT_DAU']) {
        const nguoi = buoc === 'HOAN_THANH' ? giao : thucHien
        await service.chuyenTrangThai(nguoi, cv.id, { trangThai: buoc })
        if (buoc === 'DANG_LAM') {
          // Đánh dấu việc con đã xong (phải xong hết thì mới gửi duyệt được).
          for (const [i, vc] of (mau.viecCon ?? []).entries()) {
            if (vc.xong) await service.danhDauViecCon(thucHien, cv.id, viecCon[i]!.id, { xong: true })
          }
          if (mau.tienDo !== undefined && mau.den === 'DANG_LAM') {
            await service.capNhatTienDo(thucHien, cv.id, { tienDo: mau.tienDo })
          }
        }
      }
      for (const bl of mau.binhLuan ?? []) {
        await service.vietBinhLuan({ userId: bl.ai, congTyId: CONG_TY_ID }, cv.id, { noiDung: bl.noiDung })
      }
    }

    const soViec = await db.collection(TEN_BANG.congViec).countDocuments()
    console.log(`Đã seed: 1 công ty, ${NHAN_VIEN.length} nhân viên, ${DU_AN.length} dự án, ${soViec} công việc.`)
  } finally {
    await client.close()
  }
}

// Chỉ chạy khi gọi trực tiếp (pnpm seed), không chạy khi test import hằng số.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/seed.ts')) {
  await main()
}
