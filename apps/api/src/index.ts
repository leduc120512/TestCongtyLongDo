import { taoApp } from './app'
import { cauHinh } from './cau-hinh'
import { moKetNoi, taoIndex } from './db/ket-noi'
import { taoKhoMongo } from './repositories'

const { client, db } = await moKetNoi(cauHinh.mongoUrl)
await taoIndex(db)

const app = await taoApp({
  kho: taoKhoMongo(db),
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

await app.listen({ port: cauHinh.port, host: '0.0.0.0' })
