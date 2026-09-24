#!/usr/bin/env node
// Hook PreToolUse: chặn lệnh không thể hoàn tác và việc đọc/sửa file bí mật.
// Nhận JSON qua stdin; thoát mã 2 + ghi lý do ra stderr = chặn, Claude đọc được lý do.
// Hook chạy chắc chắn mỗi lần gọi công cụ, không phụ thuộc Claude có "nhớ" lời dặn trong CLAUDE.md hay không.

const BLOCKED_COMMANDS = [
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard xóa thay đổi chưa commit'],
  [/\bgit\s+push\b.*(--force\b|-f\b|--force-with-lease\b)/, 'push --force ghi đè lịch sử trên remote'],
  [/\bgit\s+push\b/, 'push lên remote phải do người dùng tự làm'],
  [/\bgit\s+clean\s+-[a-z]*f/, 'git clean -f xóa file chưa theo dõi'],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, 'bỏ toàn bộ thay đổi đang làm'],
  // --no-verify hoặc dạng viết tắt -n (kể cả gộp như -nm).
  [/\bgit\s+commit\b[^|;&\n]*(--no-verify\b|\s-[a-zA-Z]*n[a-zA-Z]*(?![\p{L}\p{N}_-]))/u, 'không được bỏ qua hook khi commit'],
  [/\bgit\s+rebase\b/, 'rebase viết lại lịch sử commit (đề yêu cầu giữ nguyên lịch sử)'],
  // Xóa đệ quy ở mọi dạng: bash (rm -rf, -Rf, -fR, -r -f, --recursive), PowerShell (rm/ri/Remove-Item -r/-Recurse),
  // cmd (rd/rmdir/del /s). Cờ gộp kiểu bash chỉ gồm các chữ r f v i d, để "-Force" của PowerShell không bị nhầm là -r.
  [
    /(?<![\p{L}\p{N}_-])(rm|rmdir|rd|del|erase|ri|Remove-Item)(?![\p{L}\p{N}_-])(?=[^|;&\n]*\s(-[rRfFvViIdD]*[rR][rRfFvViIdD]*|-[rR]ec(urse)?|--recursive|\/[sS])(?![\p{L}\p{N}_-]))/u,
    'xóa đệ quy không khôi phục được',
  ],
  // Chỉ chặn khi lệnh thực sự gửi tới Mongo (mongosh / docker exec), không chặn việc sửa code có chứa chuỗi này.
  [
    /\b(mongosh|mongo|docker\s+exec)\b[\s\S]*(\bdropDatabase\b|\.drop\(\)|\bdeleteMany\(\s*\{\s*\}\s*\)|\bremove\(\s*\{\s*\}\s*\))/,
    'xóa dữ liệu Mongo (dùng pnpm seed nếu cần làm lại dữ liệu demo)',
  ],
  [/docker\s+compose\s+down\b.*(-v\b|--volumes\b)/, 'xóa volume dữ liệu Mongo'],
]

// .env thật là bí mật; .env.example thì được.
const SECRET_FILE = /(^|[\\/])\.env(\.(?!example$)[^\\/]+)?$/i

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (d) => (raw += d))
process.stdin.on('end', () => {
  let input
  try {
    input = JSON.parse(raw)
  } catch {
    process.exit(0) // không đọc được input thì không chặn nhầm
  }
  const tool = input.tool_name ?? ''
  const toolInput = input.tool_input ?? {}

  if (tool === 'Bash' || tool === 'PowerShell') {
    const command = String(toolInput.command ?? '')
    for (const [pattern, reason] of BLOCKED_COMMANDS) {
      if (pattern.test(command)) {
        process.stderr.write(`Bị chặn bởi hook dự án: ${reason}. Lệnh: ${command}\nNếu thật sự cần, hãy nhờ người dùng tự chạy.`)
        process.exit(2)
      }
    }
    // Chỉ chặn khi có lệnh đọc/ghi thật sự trỏ vào file .env (không chặn chữ ".env" trong commit message).
    // Ranh giới từ theo Unicode: \b của JS chỉ hiểu ASCII nên "việc" từng bị hiểu là lệnh `vi`.
    const ENV_READ_WRITE =
      /(?<![\p{L}\p{N}_-])(cat|type|less|more|head|tail|bat|nano|vim?|code|notepad|Get-Content|gc|Set-Content|sed|awk|grep|rg|findstr|cp|copy|mv|move|source)(?![\p{L}\p{N}_-])[^|;&\n]*?[\s'"\\/=]\.env(\.(?!example(?![\p{L}\p{N}_]))[\p{L}\p{N}_]+)?(?=$|[\s'"|;&)])|>{1,2}\s*\S*\.env(\.(?!example(?![\p{L}\p{N}_]))[\p{L}\p{N}_]+)?(?=$|[\s'"|;&)])|(^|[;&|]\s*)\.\s+\S*\.env(?![\p{L}\p{N}_.])/mu
    if (ENV_READ_WRITE.test(command)) {
      process.stderr.write('Bị chặn: không đọc/ghi file .env qua shell. Dùng .env.example.')
      process.exit(2)
    }
  }

  if (['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const filePath = String(toolInput.file_path ?? toolInput.notebook_path ?? '')
    if (SECRET_FILE.test(filePath)) {
      process.stderr.write(`Bị chặn: ${filePath} có thể chứa bí mật. Dùng .env.example để xem các biến cần có.`)
      process.exit(2)
    }
  }
  process.exit(0)
})
