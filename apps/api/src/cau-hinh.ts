// Nạp .env nếu có (Node >= 20.12). Không có thì dùng giá trị mặc định cho môi trường dev.
try {
  process.loadEnvFile()
} catch {
  // không có file .env — dùng mặc định
}

export const cauHinh = {
  port: Number(process.env.PORT ?? 3000),
  mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017/longdo_congviec',
  jwtSecret: process.env.JWT_SECRET ?? 'bi-mat-dev-chi-dung-khi-phat-trien',
}
