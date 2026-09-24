#!/usr/bin/env node
// Kiểm thử hook chặn: `node .claude/hooks/kiem-thu-hook.mjs`
// (Để ca thử trong file vì chính hook sẽ chặn lệnh shell có chứa các mẫu cấm.)
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HOOK = fileURLToPath(new URL('./chan-hanh-dong-nguy-hiem.mjs', import.meta.url))
const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } })
const doc = (file_path) => ({ tool_name: 'Read', tool_input: { file_path } })

const CA = [
  [bash('git reset --hard HEAD~1'), 2],
  [bash('git push origin main'), 2],
  [bash('git push -f origin main'), 2],
  [bash('git clean -fd'), 2],
  [bash('git checkout -- .'), 2],
  [bash('git rebase -i HEAD~3'), 2],
  [bash('git commit -m "feat: x" --no-verify'), 2],
  [bash('rm -rf apps'), 2],
  // Các biến thể từng lọt (phát hiện khi soát cuối).
  [bash('rm -Rf apps'), 2],
  [bash('rm -fR apps'), 2],
  [bash('rm -r -f apps'), 2],
  [bash('rm -r apps'), 2],
  [bash('rm --recursive --force apps'), 2],
  [{ tool_name: 'PowerShell', tool_input: { command: 'rm -Recurse -Force apps' } }, 2],
  [{ tool_name: 'PowerShell', tool_input: { command: 'Remove-Item apps -r -fo' } }, 2],
  [{ tool_name: 'PowerShell', tool_input: { command: 'ri apps -Recurse' } }, 2],
  [{ tool_name: 'PowerShell', tool_input: { command: 'cmd /c rd /s /q apps' } }, 2],
  [bash('git commit -n -m "x"'), 2],
  [bash('git commit -nm "x"'), 2],
  // Xóa một file thì cho; "-Force" không phải cờ đệ quy.
  [bash('rm apps/web/dist/index.html'), 0],
  [{ tool_name: 'PowerShell', tool_input: { command: 'Remove-Item apps/web/dist/index.html -Force' } }, 0],
  [bash('git commit -m "feat: thêm lọc theo dự án"'), 0],
  [bash('docker compose down -v'), 2],
  [bash('mongosh --eval "db.dropDatabase()"'), 2],
  [bash('docker exec longdo-mongo mongosh longdo_congviec --eval "db.cong_viec.deleteMany({})"'), 2],
  // Sửa code có chứa chuỗi deleteMany({}) không phải là xóa dữ liệu (từng bị chặn nhầm).
  [bash(`node -e "s = s.replace(a, 'await db.collection(x).deleteMany({})')"`), 0],
  [bash('cat apps/api/.env'), 2],
  [bash('grep JWT_SECRET apps/api/.env'), 2],
  [bash('echo JWT_SECRET=x >> apps/api/.env'), 2],
  [bash('Get-Content apps\\api\\.env'), 2],
  [bash('source .env'), 2],
  [bash('cat apps/api/.env.local'), 2],
  // Chữ ".env" trong commit message không phải là đọc file (từng bị chặn nhầm).
  [bash('git commit -m "docs: hook chặn đọc file .env"'), 0],
  // "việc" từng khớp nhầm lệnh `vi` vì \b của JS không hiểu chữ có dấu.
  [bash('git commit -m "chặn lệnh nguy hiểm và việc đọc/ghi file .env"'), 0],
  [bash('vi apps/api/.env'), 2],
  [bash('cp apps/api/.env.example apps/api/.env.example.bak'), 0],
  [doc('C:\\repo\\apps\\api\\.env'), 2],
  [doc('/repo/apps/api/.env.local'), 2],
  [{ tool_name: 'Edit', tool_input: { file_path: '/repo/.env' } }, 2],
  // Được phép
  [bash('cat apps/api/.env.example'), 0],
  [bash('pnpm kiem-tra'), 0],
  [bash('git status --short'), 0],
  [bash('git commit -m "fix: sửa lọc quá hạn"'), 0],
  [bash('docker compose up -d'), 0],
  [doc('/repo/apps/api/.env.example'), 0],
  [{ tool_name: 'Edit', tool_input: { file_path: '/repo/apps/api/src/app.ts' } }, 0],
]

let sai = 0
for (const [vao, mongDoi] of CA) {
  const kq = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(vao), encoding: 'utf8' })
  const dat = kq.status === mongDoi
  if (!dat) sai++
  const moTa = vao.tool_input.command ?? `${vao.tool_name} ${vao.tool_input.file_path}`
  console.log(`${dat ? 'ĐẠT ' : 'SAI '} ${mongDoi === 2 ? 'chặn' : 'cho '} ← ${moTa}`)
}
const hong = spawnSync(process.execPath, [HOOK], { input: 'không phải json', encoding: 'utf8' })
if (hong.status !== 0) sai++
console.log(`${hong.status === 0 ? 'ĐẠT ' : 'SAI '} cho  ← input không phải JSON`)

console.log(sai ? `\n${sai} ca SAI` : `\nTất cả ${CA.length + 1} ca đạt`)
process.exit(sai ? 1 : 0)
