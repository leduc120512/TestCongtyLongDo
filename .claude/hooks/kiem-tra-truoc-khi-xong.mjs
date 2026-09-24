#!/usr/bin/env node
// Hook Stop: trước khi Claude kết thúc lượt, nếu có file .ts/.tsx thay đổi thì chạy typecheck.
// Lỗi → thoát mã 2, Claude nhận lỗi và phải sửa tiếp thay vì báo "xong".
// Chỉ chạy typecheck (vài giây); test đầy đủ vẫn là việc của `pnpm kiem-tra` theo CLAUDE.md.
import { execSync } from 'node:child_process'

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (d) => (raw += d))
process.stdin.on('end', () => {
  let vao = {}
  try {
    vao = JSON.parse(raw)
  } catch {
    // bỏ qua
  }
  // Đã bị hook này chặn một lần trong lượt này → không chặn tiếp, tránh vòng lặp vô hạn.
  if (vao.stop_hook_active) process.exit(0)

  let doi = ''
  try {
    doi = execSync('git status --porcelain', { encoding: 'utf8' })
  } catch {
    process.exit(0) // không phải repo git
  }
  if (!/\.(ts|tsx)\s*$/m.test(doi)) process.exit(0)

  try {
    execSync('pnpm -r run typecheck', { stdio: 'pipe', encoding: 'utf8', timeout: 180_000 })
    process.exit(0)
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.split('\n').filter((l) => /error TS|Failed/.test(l))
    process.stderr.write(
      `Typecheck đang lỗi, chưa được báo xong. Sửa các lỗi sau rồi chạy lại "pnpm kiem-tra":\n${out.slice(0, 30).join('\n')}`,
    )
    process.exit(2)
  }
})
