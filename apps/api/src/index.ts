import { buildApp } from './app.ts'
import { config } from './config.ts'
import { connectMongo, createIndexes } from './db/connection.ts'
import { createMongoStore } from './repositories/index.ts'

const { client, db, supportsTransactions } = await connectMongo(config.mongoUrl)
await createIndexes(db)

const app = await buildApp({
  store: createMongoStore(client, db, supportsTransactions),
  jwtSecret: config.jwtSecret,
  mockLogin: config.mockLogin,
  logger: { level: 'info' },
})

const shutdown = async () => {
  await app.close()
  await client.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

if (config.usingDevSecret) {
  app.log.warn('Đang dùng JWT_SECRET mặc định cho môi trường dev. Đặt JWT_SECRET trong apps/api/.env khi chạy thật.')
}
if (config.isProduction && config.mockLogin) {
  app.log.warn(
    'Đang bật đăng nhập giả lập khi production (ALLOW_MOCK_LOGIN=true): ai có đường dẫn cũng đăng nhập được với tư cách bất kỳ nhân viên nào. Chỉ dùng cho bản demo.',
  )
}
if (!supportsTransactions) {
  app.log.warn(
    'MongoDB không chạy replica set: không dùng được transaction, ghi công việc và lịch sử sẽ không nguyên tử. Dùng docker compose của repo.',
  )
}
await app.listen({ port: config.port, host: config.host })
