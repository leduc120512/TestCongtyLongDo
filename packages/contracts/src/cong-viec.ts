import { z } from 'zod'
import { IdSchema, NgaySchema, PhanTrangQuerySchema } from './chung.ts'

// ---------- Enum ----------

export const UU_TIEN = ['THAP', 'BINH_THUONG', 'CAO'] as const
export const UuTienSchema = z.enum(UU_TIEN, { error: 'Ưu tiên không hợp lệ' })
export type UuTien = z.infer<typeof UuTienSchema>
export const TEN_UU_TIEN: Record<UuTien, string> = {
  THAP: 'Thấp',
  BINH_THUONG: 'Bình thường',
  CAO: 'Cao',
}

export const TRANG_THAI = ['CHUA_BAT_DAU', 'DANG_LAM', 'CHO_DUYET', 'HOAN_THANH'] as const
export const TrangThaiSchema = z.enum(TRANG_THAI, { error: 'Trạng thái không hợp lệ' })
export type TrangThai = z.infer<typeof TrangThaiSchema>
export const TEN_TRANG_THAI: Record<TrangThai, string> = {
  CHUA_BAT_DAU: 'Chưa bắt đầu',
  DANG_LAM: 'Đang làm',
  CHO_DUYET: 'Chờ duyệt',
  HOAN_THANH: 'Hoàn thành',
}

/** Lọc nhanh trên màn danh sách. */
export const LOC_NHANH = ['CUA_TOI', 'TOI_GIAO', 'THEO_DOI', 'TAT_CA'] as const
export const LocNhanhSchema = z.enum(LOC_NHANH, { error: 'Lọc nhanh không hợp lệ' })
export type LocNhanh = z.infer<typeof LocNhanhSchema>
export const TEN_LOC_NHANH: Record<LocNhanh, string> = {
  CUA_TOI: 'Việc của tôi',
  TOI_GIAO: 'Việc tôi giao',
  THEO_DOI: 'Đang theo dõi',
  TAT_CA: 'Tất cả',
}

/** Lọc theo trạng thái có thêm "Quá hạn" (tính ra khi đọc, không lưu trong DB). */
export const LocTrangThaiSchema = z.enum([...TRANG_THAI, 'QUA_HAN'], {
  error: 'Trạng thái lọc không hợp lệ',
})
export type LocTrangThai = z.infer<typeof LocTrangThaiSchema>

/** Giá trị đặc biệt cho lọc dự án: chỉ lấy việc chung (không thuộc dự án nào). */
export const DU_AN_CHUNG = 'CHUNG'

export const SAP_XEP = ['hetHan_asc', 'hetHan_desc'] as const
export const SapXepSchema = z.enum(SAP_XEP, { error: 'Sắp xếp không hợp lệ' })
export type SapXep = z.infer<typeof SapXepSchema>

// ---------- Body tạo / sửa ----------

/**
 * Trường gốc KHÔNG có .default(): Zod 4 vẫn áp default bên trong .partial(), nên nếu schema sửa
 * dựng từ schema có default thì PATCH thiếu trường sẽ bị điền mặc định và ghi đè dữ liệu thật.
 */
const TruongNhapGoc = z.object({
  ten: z
    .string({ error: 'Tên công việc không được để trống' })
    .trim()
    .min(1, 'Tên công việc không được để trống')
    .max(200, 'Tên công việc tối đa 200 ký tự'),
  moTa: z.string().trim().max(5000, 'Mô tả tối đa 5000 ký tự').nullish(),
  duAnId: IdSchema.nullish(),
  nguoiThucHienIds: z
    .array(IdSchema, { error: 'Cần ít nhất một người thực hiện' })
    .min(1, 'Cần ít nhất một người thực hiện'),
  nguoiTheoDoiIds: z.array(IdSchema, { error: 'Danh sách người theo dõi không hợp lệ' }),
  uuTien: UuTienSchema,
  batDau: NgaySchema.nullish(),
  hetHan: NgaySchema.nullish(),
})

type CoHan = { batDau?: string | null; hetHan?: string | null }

/** Hạn không được trước ngày bắt đầu (khi có cả hai). So sánh chuỗi YYYY-MM-DD là đủ. */
export function hanHopLe(d: CoHan): boolean {
  return !(d.batDau && d.hetHan && d.hetHan < d.batDau)
}

function kiemTraHan(d: CoHan, ctx: z.RefinementCtx) {
  if (!hanHopLe(d)) {
    ctx.addIssue({ code: 'custom', path: ['hetHan'], message: 'Hạn không được trước ngày bắt đầu' })
  }
}

export const TaoCongViecSchema = TruongNhapGoc.extend({
  nguoiTheoDoiIds: TruongNhapGoc.shape.nguoiTheoDoiIds.default([]),
  uuTien: UuTienSchema.default('BINH_THUONG'),
}).superRefine(kiemTraHan)
export type TaoCongViec = z.output<typeof TaoCongViecSchema>
export type TaoCongViecInput = z.input<typeof TaoCongViecSchema>

/**
 * PATCH: trường không gửi = giữ nguyên; gửi null = xóa giá trị (bỏ hạn, bỏ dự án...).
 * Kiểm tra hạn so với giá trị đang lưu (khi chỉ gửi một trong hai) do service làm.
 */
export const SuaCongViecSchema = TruongNhapGoc.partial().superRefine(kiemTraHan)
export type SuaCongViec = z.output<typeof SuaCongViecSchema>
export type SuaCongViecInput = z.input<typeof SuaCongViecSchema>

export const ChuyenTrangThaiSchema = z.object({
  trangThai: TrangThaiSchema,
  lyDo: z.string().trim().max(1000, 'Lý do tối đa 1000 ký tự').nullish(),
})
export type ChuyenTrangThai = z.infer<typeof ChuyenTrangThaiSchema>

// Body JSON đã mang kiểu số: không dùng coerce (coerce biến null, "", true thành 0/1 và lọt validate).
export const CapNhatTienDoSchema = z.object({
  tienDo: z
    .number({ error: 'Tiến độ phải là số' })
    .int('Tiến độ phải là số nguyên')
    .min(0, 'Tiến độ từ 0 đến 100')
    .max(100, 'Tiến độ từ 0 đến 100'),
})
export type CapNhatTienDo = z.infer<typeof CapNhatTienDoSchema>

// ---------- Query danh sách ----------

export const DanhSachCongViecQuerySchema = PhanTrangQuerySchema.extend({
  nhanh: LocNhanhSchema.default('TAT_CA'),
  /** Id dự án, hoặc "CHUNG" = chỉ việc chung. */
  duAnId: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === DU_AN_CHUNG.toLowerCase() || /^[0-9a-f]{24}$/.test(v), 'Dự án không hợp lệ')
    .transform((v) => (v === DU_AN_CHUNG.toLowerCase() ? DU_AN_CHUNG : v))
    .optional(),
  trangThai: LocTrangThaiSchema.optional(),
  uuTien: UuTienSchema.optional(),
  q: z.string().trim().max(100, 'Từ khóa tối đa 100 ký tự').optional(),
  sapXep: SapXepSchema.default('hetHan_asc'),
})
export type DanhSachCongViecQuery = z.output<typeof DanhSachCongViecQuerySchema>
export type DanhSachCongViecQueryInput = z.input<typeof DanhSachCongViecQuerySchema>

// ---------- Việc con (tùy chọn 1) ----------

/** Tối đa số việc con trong một công việc. */
export const SO_VIEC_CON_TOI_DA = 50

export const ViecConSchema = z.object({
  id: z.string(),
  ten: z.string(),
  xong: z.boolean(),
})
export type ViecCon = z.infer<typeof ViecConSchema>

export const ThemViecConSchema = z.object({
  ten: z
    .string({ error: 'Tên việc con không được để trống' })
    .trim()
    .min(1, 'Tên việc con không được để trống')
    .max(200, 'Tên việc con tối đa 200 ký tự'),
})
export type ThemViecCon = z.infer<typeof ThemViecConSchema>

export const DanhDauViecConSchema = z.object({
  xong: z.boolean({ error: 'Trạng thái việc con phải là đúng/sai' }),
})
export type DanhDauViecCon = z.infer<typeof DanhDauViecConSchema>

// ---------- Bình luận (tùy chọn 2) ----------

export const BinhLuanSchema = z.object({
  id: z.string(),
  congViecId: z.string(),
  nguoiVietId: z.string(),
  noiDung: z.string(),
  taoLuc: z.string(),
})
export type BinhLuan = z.infer<typeof BinhLuanSchema>

export const VietBinhLuanSchema = z.object({
  noiDung: z
    .string({ error: 'Nội dung bình luận không được để trống' })
    .trim()
    .min(1, 'Nội dung bình luận không được để trống')
    .max(2000, 'Bình luận tối đa 2000 ký tự'),
})
export type VietBinhLuan = z.infer<typeof VietBinhLuanSchema>

// ---------- Dữ liệu trả về ----------

export const CongViecSchema = z.object({
  id: z.string(),
  ma: z.string(),
  ten: z.string(),
  moTa: z.string().optional(),
  duAnId: z.string().optional(),
  nguoiGiaoId: z.string(),
  nguoiThucHienIds: z.array(z.string()),
  nguoiTheoDoiIds: z.array(z.string()),
  uuTien: UuTienSchema,
  batDau: NgaySchema.optional(),
  hetHan: NgaySchema.optional(),
  trangThai: TrangThaiSchema,
  tienDo: z.number().int().min(0).max(100),
  /** Danh sách đầu việc; khi có ít nhất một việc con thì tiến độ tự tính theo tỉ lệ việc con đã xong. */
  viecCon: z.array(ViecConSchema),
  /** Tính lúc đọc: chưa hoàn thành và đã qua hết ngày hetHan theo giờ Việt Nam. */
  quaHan: z.boolean(),
  congTyId: z.string(),
  taoLuc: z.string(),
  capNhatLuc: z.string(),
})
export type CongViec = z.infer<typeof CongViecSchema>

/** Các nút mà người đang xem được phép dùng. API vẫn tự chặn, đây chỉ để web ẩn/hiện. */
export const QuyenCongViecSchema = z.object({
  sua: z.boolean(),
  xoa: z.boolean(),
  batDau: z.boolean(),
  guiDuyet: z.boolean(),
  duyet: z.boolean(),
  traLai: z.boolean(),
  capNhatTienDo: z.boolean(),
  /** Thêm/xóa việc con (người giao, khi chưa bắt đầu hoặc đang làm). */
  quanLyViecCon: z.boolean(),
  /** Đánh dấu việc con xong/chưa xong (người thực hiện, khi đang làm). */
  danhDauViecCon: z.boolean(),
})
export type QuyenCongViec = z.infer<typeof QuyenCongViecSchema>

export const ChiTietCongViecSchema = CongViecSchema.extend({
  quyen: QuyenCongViecSchema,
})
export type ChiTietCongViec = z.infer<typeof ChiTietCongViecSchema>

export const ThongKeNhanhSchema = z.object({
  CUA_TOI: z.number().int(),
  TOI_GIAO: z.number().int(),
  THEO_DOI: z.number().int(),
  TAT_CA: z.number().int(),
})
export type ThongKeNhanh = z.infer<typeof ThongKeNhanhSchema>

// ---------- Lịch sử thay đổi ----------

export const HANH_DONG_LICH_SU = ['TAO', 'SUA', 'CHUYEN_TRANG_THAI', 'CAP_NHAT_TIEN_DO', 'VIEC_CON', 'XOA'] as const
export const HanhDongLichSuSchema = z.enum(HANH_DONG_LICH_SU)
export type HanhDongLichSu = z.infer<typeof HanhDongLichSuSchema>
export const TEN_HANH_DONG: Record<HanhDongLichSu, string> = {
  TAO: 'Tạo công việc',
  SUA: 'Sửa thông tin',
  CHUYEN_TRANG_THAI: 'Chuyển trạng thái',
  CAP_NHAT_TIEN_DO: 'Cập nhật tiến độ',
  VIEC_CON: 'Việc con',
  XOA: 'Xóa công việc',
}

export const ThayDoiTruongSchema = z.object({
  truong: z.string(),
  tu: z.unknown(),
  den: z.unknown(),
})
export type ThayDoiTruong = z.infer<typeof ThayDoiTruongSchema>

/** Một dòng lịch sử = một lần lưu; các trường đổi trong lần đó nằm trong mảng thayDoi. */
export const LichSuSchema = z.object({
  id: z.string(),
  congViecId: z.string(),
  nguoiDoiId: z.string(),
  luc: z.string(),
  hanhDong: HanhDongLichSuSchema,
  thayDoi: z.array(ThayDoiTruongSchema),
  lyDo: z.string().optional(),
})
export type LichSu = z.infer<typeof LichSuSchema>

export const TEN_TRUONG: Record<string, string> = {
  ten: 'Tên',
  moTa: 'Mô tả',
  duAnId: 'Dự án',
  nguoiThucHienIds: 'Người thực hiện',
  nguoiTheoDoiIds: 'Người theo dõi',
  uuTien: 'Ưu tiên',
  batDau: 'Bắt đầu',
  hetHan: 'Hạn',
  trangThai: 'Trạng thái',
  tienDo: 'Tiến độ',
  viecCon: 'Việc con',
  deletedAt: 'Đã xóa',
}
