#!/usr/bin/env node
// Hook PreToolUse: chặn lệnh không thể hoàn tác và việc đọc/sửa file bí mật.
// Nhận JSON qua stdin; thoát mã 2 + ghi lý do ra stderr = chặn, Claude đọc được lý do.
// Hook chạy chắc chắn mỗi lần gọi công cụ, không phụ thuộc Claude có "nhớ" lời dặn trong CLAUDE.md hay không.
// Đây là lưới an toàn theo danh sách chặn, không phải sandbox: lệnh đủ lắt léo vẫn có thể lọt.

// `git` kèm tùy chọn toàn cục trước lệnh con: git -C . push, git -c user.name=x push, git --no-pager push...
const GIT = String.raw`\bgit(?:\s+(?:-[Cc]\s+\S+|--[\w-]+(?:=\S+)?))*\s+`
const git = (rest, flags = '') => new RegExp(GIT + rest, flags)

const BLOCKED_COMMANDS = [
  [git(String.raw`reset\b[^|;&\n]*--hard\b`), 'git reset --hard xóa thay đổi chưa commit'],
  [git(String.raw`push\b.*(--force\b|-f\b|--force-with-lease\b)`), 'push --force ghi đè lịch sử trên remote'],
  [git(String.raw`push\b`), 'push lên remote phải do người dùng tự làm'],
  // -f ở bất kỳ vị trí nào: git clean -fd, git clean -d -f, git clean --force.
  [git(String.raw`clean\b[^|;&\n]*\s(-[a-zA-Z]*f|--force\b)`), 'git clean -f xóa file chưa theo dõi'],
  [git(String.raw`(checkout|restore)\s+(--\s+)?\.(\s|$)`), 'bỏ toàn bộ thay đổi đang làm'],
  // --no-verify hoặc dạng viết tắt -n (kể cả gộp như -nm).
  [git(String.raw`commit\b[^|;&\n]*(--no-verify\b|\s-[a-zA-Z]*n[a-zA-Z]*(?![\p{L}\p{N}_-]))`, 'u'), 'không được bỏ qua hook khi commit'],
  [git(String.raw`rebase\b`), 'rebase viết lại lịch sử commit (đề yêu cầu giữ nguyên lịch sử)'],
  // Xóa đệ quy ở mọi dạng: bash (rm -rf, -Rf, -fR, -r -f, --recursive), PowerShell (rm/ri/Remove-Item -r/-Recurse),
  // cmd (rd/rmdir/del /s). Cờ gộp kiểu bash chỉ gồm các chữ r f v i d, để "-Force" của PowerShell không bị nhầm là -r.
  [
    /(?<![\p{L}\p{N}_-])(rm|rmdir|rd|del|erase|ri|Remove-Item)(?![\p{L}\p{N}_-])(?=[^|;&\n]*\s(-[rRfFvViIdD]*[rR][rRfFvViIdD]*|-[rR]ec(urse)?|--recursive|\/[sS])(?![\p{L}\p{N}_-]))/u,
    'xóa đệ quy không khôi phục được',
  ],
  // Liệt kê đệ quy rồi pipe sang lệnh xóa: Get-ChildItem apps -Recurse | Remove-Item -Force.
  [/-[rR]ec(urse)?\b[^;&\n]*\|\s*(Remove-Item|ri|rm|del|erase)\b/, 'xóa đệ quy không khôi phục được'],
  [/\bfind\b[^|;&\n]*\s(-delete\b|-exec\s+rm\b)/, 'find -delete xóa hàng loạt không khôi phục được'],
  // Chỉ chặn khi lệnh thực sự gửi tới Mongo (mongosh / docker exec), không chặn việc sửa code có chứa chuỗi này.
  [
    /\b(mongosh|mongo|docker\s+exec)\b[\s\S]*(\bdropDatabase\b|\.drop\(\)|\bdeleteMany\(\s*\{\s*\}\s*\)|\bremove\(\s*\{\s*\}\s*\))/,
    'xóa dữ liệu Mongo (dùng pnpm seed nếu cần làm lại dữ liệu demo)',
  ],
  [/docker\s+compose\s+down\b.*(-v\b|--volumes\b)/, 'xóa volume dữ liệu Mongo'],
  [/docker\s+volume\s+(rm|prune)\b/, 'xóa volume dữ liệu Mongo'],
]

// Lệnh đọc/ghi được coi là chạm vào file .env khi đứng trước một đường dẫn .env thật (không phải .env.example).
const ENV_TOOLS = [
  'cat', 'type', 'less', 'more', 'head', 'tail', 'bat', 'nano', 'vim?', 'code', 'notepad', 'Get-Content', 'gc',
  'Set-Content', 'Add-Content', 'Select-String', 'sls', 'sed', 'awk', 'grep', 'rg', 'findstr', 'cp', 'copy', 'mv',
  'move', 'source', 'base64', 'xxd', 'od', 'hexdump', 'strings', 'sort', 'uniq', 'cut', 'nl', 'tac', 'rev', 'dd',
  'tee', 'iconv', 'node', 'python3?', 'deno', 'bun',
].join('|')
const ENV_PATH = String.raw`\.env(\.(?!example(?![\p{L}\p{N}_]))[\p{L}\p{N}_]+)?(?=$|[\s'"|;&)])`
// Ranh giới từ theo Unicode: \b của JS chỉ hiểu ASCII nên "việc" từng bị hiểu là lệnh `vi`.
const ENV_READ_WRITE = new RegExp(
  String.raw`(?<![\p{L}\p{N}_-])(${ENV_TOOLS})(?![\p{L}\p{N}_-])[^|;&\n]*?[\s'"\\/=(]` + ENV_PATH +
    String.raw`|>{1,2}\s*\S*` + ENV_PATH +
    String.raw`|(^|[;&|]\s*)\.\s+\S*\.env(?![\p{L}\p{N}_.])`,
  'mu',
)

// .env thật là bí mật; .env.example thì được.
const SECRET_FILE = /(^|[\\/])\.env(\.(?!example$)[^\\/]+)?$/i

/**
 * Bỏ những phần chỉ là chữ, không phải lệnh, trước khi so mẫu:
 * - nội dung commit message (-m "..."/-m '...', kể cả -m "$(cat <<'EOF' ... EOF)"), để message nhắc
 *   "git push", "-n" hay ".env" không bị chặn nhầm;
 * - mẫu tìm của grep/rg đọc từ pipe (vd. `git ls-files | grep -i .env` chỉ lọc tên file, không đọc .env).
 */
export function stripNonCommandText(command) {
  let s = command
  if (git(String.raw`commit\b`).test(s)) {
    s = s.replace(/(\s(?:-m|--message)(?:\s+|=))("(?:[^"\\]|\\.)*"|'[^']*')/g, '$1""')
  }
  return s.replace(
    /(\|\s*(?:grep|rg|findstr|sls|Select-String)(?:\s+-{1,2}[\w-]+(?:=\S+)?)*)\s+("[^"]*"|'[^']*'|[^\s|;&)]+)\s*(?=$|[|;&\n)])/gmu,
    '$1 PATTERN',
  )
}

export function check(input) {
  const tool = input.tool_name ?? ''
  const toolInput = input.tool_input ?? {}

  if (tool === 'Bash' || tool === 'PowerShell') {
    const command = stripNonCommandText(String(toolInput.command ?? ''))
    for (const [pattern, reason] of BLOCKED_COMMANDS) {
      if (pattern.test(command)) return `Bị chặn bởi hook dự án: ${reason}. Lệnh: ${toolInput.command}\nNếu thật sự cần, hãy nhờ người dùng tự chạy.`
    }
    if (ENV_READ_WRITE.test(command)) return 'Bị chặn: không đọc/ghi file .env qua shell. Dùng .env.example.'
  }

  if (['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const filePath = String(toolInput.file_path ?? toolInput.notebook_path ?? '')
    if (SECRET_FILE.test(filePath)) return `Bị chặn: ${filePath} có thể chứa bí mật. Dùng .env.example để xem các biến cần có.`
  }
  return null
}

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
  const reason = check(input)
  if (reason) {
    process.stderr.write(reason)
    process.exit(2)
  }
  process.exit(0)
})
