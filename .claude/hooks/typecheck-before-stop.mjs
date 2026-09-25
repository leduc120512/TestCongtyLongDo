#!/usr/bin/env node
// Hook Stop: trước khi Claude kết thúc lượt, nếu có file .ts/.tsx thay đổi thì chạy typecheck.
// Lỗi → thoát mã 2, Claude nhận lỗi và phải sửa tiếp thay vì báo "xong".
// Chỉ chạy typecheck (vài giây); test đầy đủ vẫn là việc của `pnpm verify` theo CLAUDE.md.
import { execSync } from 'node:child_process'

// Luôn chạy ở gốc repo, kể cả khi phiên Claude đang đứng ở thư mục con (apps/api...).
const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd()

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (d) => (raw += d))
process.stdin.on('end', () => {
  let input = {}
  try {
    input = JSON.parse(raw)
  } catch {
    // bỏ qua
  }
  // Đã bị hook này chặn một lần trong lượt này → không chặn tiếp, tránh vòng lặp vô hạn.
  if (input.stop_hook_active) process.exit(0)

  let changed = ''
  try {
    // --untracked-files=all: liệt kê từng file trong thư mục mới, không gộp thành một dòng "?? thu-muc/".
    changed = execSync('git status --porcelain --untracked-files=all', { cwd, encoding: 'utf8' })
  } catch {
    process.exit(0) // không phải repo git
  }
  if (!/\.(ts|tsx)\s*$/m.test(changed)) process.exit(0)

  try {
    execSync('pnpm -r run typecheck', { cwd, stdio: 'pipe', encoding: 'utf8', timeout: 180_000 })
    process.exit(0)
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.split('\n').filter((l) => /error TS|Failed/.test(l))
    process.stderr.write(
      `Typecheck đang lỗi, chưa được báo xong. Sửa các lỗi sau rồi chạy lại "pnpm verify":\n${out.slice(0, 30).join('\n')}`,
    )
    process.exit(2)
  }
})
