import { taoApp } from './app.ts'
import { cauHinh } from './cau-hinh.ts'
import { moKetNoi, taoIndex } from './db/ket-noi.ts'
import { taoKhoMongo } from './repositories/index.ts'

const { client, db, coGiaoDich } = await moKetNoi(cauHinh.mongoUrl)
await taoIndex(db)

const app = await taoApp({
  kho: taoKhoMongo(client, db, coGiaoDich),
  jwtSecret: cauHinh.jwtSecret,
  logger: { level: 'info' },
})

const dong = async () => {
  await app.close()
  await client.close()
  process.exit(0)
}
process.on('SIGINT', dong)
process.on('SIGTERM', dong)

if (cauHinh.dungSecretMacDinh) {
  app.log.warn('Đang dùng JWT_SECRET mặc định cho môi trường dev. Đặt JWT_SECRET trong apps/api/.env khi chạy thật.')
}
if (!coGiaoDich) {
  app.log.warn(
    'MongoDB không chạy replica set: không dùng được transaction, ghi công việc và lịch sử sẽ không nguyên tử. Dùng docker compose của repo.',
  )
}
await app.listen({ port: cauHinh.port, host: cauHinh.host })
