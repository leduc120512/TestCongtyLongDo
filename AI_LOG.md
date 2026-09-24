# Nhật ký làm việc với AI

Công cụ: Claude Code (desktop). Dưới đây là 6 lần làm việc đáng kể nhất, theo thứ tự thời gian. Lần 3, 4 và 6 là những lần **AI làm sai** và bị phát hiện.

> Sau các lần dưới đây, tên thư mục và tên file đã đổi sang tiếng Anh (vd. `services/nghiep-vu/` → `services/domain/`, `kiem-thu-hook.mjs` → `test-hooks.mjs`). Đường dẫn trong nhật ký đã cập nhật theo tên mới.

---

## 1. Dựng khung và luật nghiệp vụ thuần

**Muốn gì.** Có khung monorepo đúng yêu cầu (contracts, api, web), với luật trạng thái, quyền và quá hạn tách thành hàm thuần để test dễ.

**Ra lệnh thế nào.** Dán toàn bộ đề bài và yêu cầu làm đúng công nghệ của đề. Nói rõ ràng buộc: route → service → repository; userId/congTyId chỉ lấy từ token; không ghi undefined; múi giờ VN. Yêu cầu tách `services/domain/*.ts` không I/O.

**AI trả về.**
- Workspace pnpm; schema Zod trong `packages/contracts`.
- `xetChuyenTrangThai` dạng bảng các bước hợp lệ.
- `tinhQuyen` dùng chung cho web (ẩn/hiện nút) và API (chặn).
- `homNayVN` cộng 7 giờ rồi lấy phần ngày.
- Repository có giao diện riêng, để test service bằng kho trong bộ nhớ.

**Nhận, sửa hay bỏ.** Nhận phần lớn. Sửa hai điểm:
- Ngày `batDau`/`hetHan` lưu chuỗi `YYYY-MM-DD` thay vì `Date`, để không lệch múi giờ.
- Thêm trường `hanSapXep` (việc không có hạn = `9999-12-31`), để một khóa vừa sắp xếp vừa lọc được Quá hạn.

**Kiểm lại.**
- Typecheck.
- Test bảng cho **mọi** cặp (từ, đến) × vai trò.
- Test Quá hạn ở 23:59:59.999 và 00:00 giờ VN, chạy dưới 4 giá trị `TZ` khác nhau của máy.

---

## 2. Môi trường chạy lỗi, chuyển sang Node chạy TypeScript trực tiếp

**Muốn gì.** Chạy được API và test. `tsx` và Vite cần esbuild, nhưng trong thư mục làm việc (bị Windows ảo hóa đường dẫn) Node báo `spawn esbuild.exe ENOENT`.

**Ra lệnh thế nào.** Cho AI xem nguyên log lỗi, yêu cầu tìm nguyên nhân trước khi sửa, và **không** chỉnh cấu hình hệ thống.

**AI trả về.** AI chạy thử `esbuild.exe` từ bash: chạy được, nên file có tồn tại. Kết luận đây là lỗi đường dẫn ảo hóa. AI đưa hai hướng:
- Đặt `ESBUILD_BINARY_PATH`, chỉ dùng trong phiên, không đưa vào repo.
- Bỏ hẳn `tsx`, vì Node ≥ 22.18 tự bỏ kiểu TS. Cách này phải thêm đuôi `.ts` cho import và bỏ parameter properties.

**Nhận, sửa hay bỏ.** Nhận hướng thứ hai vì đúng yêu cầu "chạy cho nhẹ": API không còn bước build hay transpiler. Bật `erasableSyntaxOnly` để tsc báo ngay cú pháp mà Node không chạy được.

**Kiểm lại.**
- `node src/index.ts` khởi động được; gọi `curl` vào các endpoint.
- Typecheck 3 package; toàn bộ test.
- Vite 8 build được mà không cần biến môi trường esbuild.

---

## 3. AI làm sai: PATCH âm thầm xóa người theo dõi (Zod 4 `.partial()` vẫn áp `.default()`)

**Muốn gì.** Tìm lỗi thật trước khi nộp, không tin vào việc test đang xanh.

**Ra lệnh thế nào.** Chạy một workflow review đối kháng.
- 4 agent đọc code theo 4 mặt: nghiệp vụ so với đề, kỹ thuật API, web, lỗi và bảo mật. Mỗi agent được đưa tóm tắt đề và dặn "chỉ báo lỗi có dẫn chứng file:dòng và cách tái hiện".
- Sau đó mỗi mặt có một agent khác cố **bác bỏ** từng phát hiện.

**AI trả về.** 28 phát hiện, trong đó nhiều mục trùng giữa các agent. 25 được xác nhận là thật, 3 bị bác. Nghiêm trọng nhất là lỗi cả 4 agent cùng tìm ra độc lập:
- `SuaCongViecSchema = TruongNhapSchema.partial()`, trong đó schema gốc có `nguoiTheoDoiIds.default([])` và `uuTien.default('BINH_THUONG')`.
- Ở Zod 4, default vẫn chạy bên trong optional. `PATCH { ten }` vì thế thành `{ ten, nguoiTheoDoiIds: [], uuTien: 'BINH_THUONG' }`: người theo dõi mất quyền xem, còn lịch sử ghi như thể người giao tự đổi.
- Chính AI đã viết schema này ở bước 1. Test cũ không bắt được vì test service gọi thẳng service, bỏ qua schema; còn web luôn gửi đủ trường nên che mất lỗi.

**Nhận, sửa hay bỏ.**
- Nhận. Tách `TruongNhapGoc` không có default: `Tao...` dùng `.extend()` thêm default, còn `Sua...` là `TruongNhapGoc.partial()`.
- Thêm test ở mức schema (`parse({}) → {}`) và test HTTP (`PATCH {ten}` thì ưu tiên, người theo dõi và lịch sử giữ nguyên).

**Kiểm lại.** Tự chạy lại cách tái hiện trước khi sửa, bằng script Node gọi schema, và thấy đúng như agent mô tả. Sau khi sửa, test mới qua. Bài học đã ghi vào README (câu hỏi thiết kế 4): default chỉ đặt ở schema tạo.

---

## 4. Chọn lọc đề xuất của review: giao dịch, index, và những gì không làm theo

**Muốn gì.** Quyết định sửa gì trong 25 phát hiện đã xác nhận, và sửa đúng cách.

**Ra lệnh thế nào.** Đọc từng phát hiện cùng lý do của agent kiểm chứng. Tự tái hiện những mục quan trọng trước khi sửa.

**AI trả về và tôi quyết định.**
- **Ghi công việc và ghi lịch sử không nguyên tử.** Nhận. Chuyển Mongo sang replica set một node và bọc bộ đếm mã, ghi công việc, ghi lịch sử trong `withTransaction`. Service không import `mongodb`, chỉ gọi `kho.giaoDich(fn)`. Nhờ vậy mã CV **không nhảy số** kể cả khi lỗi giữa chừng.
- **"Tất cả" kèm bộ lọc phụ phải sắp xếp trong bộ nhớ** (`$and[$or, ...]`). Nhận. Đưa bộ lọc phụ vào từng nhánh `$or`.
- **Tiến độ dùng `z.coerce`**, nên `null` thành 0. Nhận: bỏ coerce cho body JSON.
- **Thông báo Zod mặc định bằng tiếng Anh.** Nhận: `z.config(z.locales.vi())` trong contracts.
- **Web còn hiện dữ liệu người trước sau khi đổi người đăng nhập.** Nhận: khóa cache có userId, `<Outlet key={userId}>`.
- **JWT dùng secret mặc định** (agent kiểm chứng bác, vì đăng nhập giả lập vốn cấp token cho bất kỳ ai). Vẫn giữ phần siết rẻ: bắt buộc `exp`, cố định HS256, không cho chạy production với secret mặc định. Lý do: khi đổi sang đăng nhập thật thì các điểm này thành lỗ hổng thật.
- **Bỏ một phần đề xuất:** gửi `phienBan` từ form sửa lên để chặn ghi đè. Agent kiểm chứng chỉ ra chỉ người giao được sửa, nên đó luôn là tự ghi đè chính mình. Nếu thêm thì người giao lại gặp xung đột giả mỗi khi người thực hiện cập nhật tiến độ. Tôi đồng ý và bỏ: chỉ giữ khóa phiên bản trong phạm vi một request.

**Kiểm lại.**
- Test ép bước ghi lịch sử lỗi bằng `collMod` validator, rồi kiểm tra không có việc "mồ côi" và việc tạo tiếp theo là `CV-0002`, không phải `CV-0003`.
- Test `explain` cho 20 tổ hợp lọc: không có stage SORT hay COLLSCAN.
- Test 6 cập nhật tiến độ đồng thời: chuỗi lịch sử "từ → đến" liền mạch.
- Mở web thật trong trình duyệt tích hợp và thử đổi người khi đang ở màn sửa.

---

## 5. Tính năng tùy chọn: việc con và bình luận

**Muốn gì.** Điểm cộng, nhưng không làm hỏng nghiệp vụ bắt buộc.

**Ra lệnh thế nào.** Yêu cầu AI chọn 2 tính năng rủi ro thấp, gắn với nghiệp vụ sẵn có, rồi đề xuất luật trước khi code. Ví dụ: việc con ảnh hưởng tiến độ và gửi duyệt ra sao.

**AI trả về.**
- Việc con nhúng trong document công việc.
- Tiến độ bằng tỉ lệ việc con đã xong.
- Còn việc con chưa xong thì chưa gửi duyệt.
- Người giao thêm/xóa khi chưa bắt đầu hoặc đang làm; người thực hiện tích khi đang làm.
- Mọi thay đổi đi qua cùng `ghiCoKhoa` (giao dịch + khóa phiên bản), ghi lịch sử hành động `VIEC_CON`.

**Nhận, sửa hay bỏ.** Nhận. Ghi rõ các luật này thành giả định trong README, vì đề không nói.

**Kiểm lại.**
- Test luật thuần (33%, 67%, 100%; chờ duyệt giữ 100%).
- Test service theo từng vai trò; test HTTP; seed có sẵn dữ liệu.
- Thử trên web: tích một việc thì 50% lên 75%, gợi ý "còn N việc con" cập nhật theo.

---

## 6. AI làm sai: hook chặn nhầm vì regex không hiểu chữ tiếng Việt

**Muốn gì.** Hook PreToolUse chặn lệnh không hoàn tác được và việc đọc/ghi `.env`, chắc chắn hơn lời dặn trong CLAUDE.md.

**Ra lệnh thế nào.** Yêu cầu hook bằng Node (chạy được trên cả Windows và macOS), đọc JSON từ stdin, thoát mã 2 kèm lý do để Claude hiểu vì sao bị chặn.

**AI trả về và sai ở đâu.**
- Lần 1: hook chặn chính lệnh commit, vì commit message có chữ ".env". AI siết lại: chỉ chặn khi có lệnh đọc/ghi (`cat`, `grep`, `vi`, `>`...) trỏ vào file `.env`.
- Lần 2: vẫn chặn. Nguyên nhân: `\b` của JavaScript chỉ hiểu chữ ASCII, nên trong "việc", đoạn "vi" bị coi là lệnh `vi`. Sửa bằng lookaround Unicode `(?<![\p{L}\p{N}_-])…` với cờ `u`.
- Lần 3: hook chặn lệnh sửa file test chỉ vì trong code có chuỗi `deleteMany({})`. Sửa: chỉ chặn xóa dữ liệu khi lệnh thực sự gửi tới Mongo (`mongosh`, `docker exec`).
- Lần 4, sai theo chiều ngược lại (chặn thiếu): workflow soát cuối chạy thử hook và thấy các biến thể `rm -Rf`, `rm -r -f`, PowerShell `Remove-Item -r -fo`, commit với `-n` (viết tắt của `--no-verify`) đều lọt. 33 ca thử cũ vẫn đạt vì không có ca nào thuộc các dạng này. Sửa regex, thêm 14 ca.

**Nhận, sửa hay bỏ.** Nhận cách tiếp cận, nhưng phải sửa 3 lần. Mỗi lần chặn nhầm đều thành một ca thử mới trong `.claude/hooks/test-hooks.mjs`, để lỗi cũ không quay lại.

**Kiểm lại.**
- `node .claude/hooks/test-hooks.mjs`: 47 ca chặn/cho phép đều đạt.
- Hook có hiệu lực ngay trong phiên làm bài: nó đã chặn thật lệnh thử có chứa `git reset --hard`. Đây là bằng chứng hook chắc chắn hơn lời dặn.
- Bài học: ca thử chứa mẫu cấm phải để trong file, vì đưa thẳng lên dòng lệnh thì chính hook sẽ chặn.
