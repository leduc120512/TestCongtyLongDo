// Nạp apps/api/.env nếu có (Node >= 20.12), theo vị trí file này chứ không theo thư mục đang chạy lệnh.
try {
  process.loadEnvFile(new URL('../.env', import.meta.url))
} catch {
  // không có file .env — dùng biến môi trường sẵn có hoặc mặc định cho dev
}

const DEV_SECRET = 'bi-mat-dev-chi-dung-khi-phat-trien-khong-dung-production'
const isProduction = process.env.NODE_ENV === 'production'
const jwtSecret = process.env.JWT_SECRET ?? DEV_SECRET

// Production mà thiếu secret, dùng secret mặc định (có sẵn trong source) hoặc secret quá ngắn → không cho chạy.
if (isProduction && (jwtSecret === DEV_SECRET || jwtSecret.length < 32)) {
  throw new Error('JWT_SECRET phải được đặt (tối thiểu 32 ký tự) khi NODE_ENV=production')
}

/**
 * Đăng nhập giả lập cấp token cho bất kỳ nhân viên nào nên production mặc định tắt.
 * Bản demo deploy bật lại bằng ALLOW_MOCK_LOGIN=true (Render luôn đặt NODE_ENV=production cho dịch vụ Node).
 */
export function isMockLoginEnabled(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV !== 'production' || env.ALLOW_MOCK_LOGIN === 'true'
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  /** Mặc định chỉ nghe trên máy cục bộ; đặt HOST=0.0.0.0 khi cần cho máy khác truy cập. */
  host: process.env.HOST ?? '127.0.0.1',
  mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017/longdo_congviec?directConnection=true',
  jwtSecret,
  usingDevSecret: jwtSecret === DEV_SECRET,
  /** Production: không cho chạy seed (seed xóa sạch dữ liệu). */
  isProduction,
  mockLogin: isMockLoginEnabled(process.env),
}
