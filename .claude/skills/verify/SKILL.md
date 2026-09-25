---
name: verify
description: Chạy toàn bộ kiểm tra của repo (typecheck 3 package, test nghiệp vụ và test tích hợp Mongo) và rà checklist luật dự án trước khi báo xong việc. Dùng sau khi sửa code, trước khi commit, hoặc khi người dùng hỏi "đã chạy được chưa", "xong chưa".
---

# Kiểm tra trước khi báo xong

1. Mongo phải đang chạy cho test tích hợp (Docker Compose, hoặc Mongo cài sẵn trên máy có replica set). Cách chắc nhất là chạy bước 2 rồi xem có dòng "Bỏ qua test tích hợp" không; dùng Docker thì xem thêm `docker compose ps`. Chưa chạy thì nhắc người dùng `docker compose up -d --wait` (`--wait` chờ replica set sẵn sàng) (test tích hợp tự bỏ qua kèm cảnh báo nếu không có Mongo — **bị bỏ qua không phải là đạt**).
2. Chạy:
   ```bash
   pnpm verify
   ```
   Lệnh này = `pnpm -r run typecheck` + `pnpm --filter @longdo/api test`.
3. Đọc kết quả thật, không đoán. Báo đúng số test đạt/trượt/bỏ qua. Có dòng "Bỏ qua test tích hợp" thì nói rõ.
4. Rà nhanh diff (`git diff`) theo checklist:
   - [ ] Route không chứa nghiệp vụ, service không import `mongodb`, component web không gọi `callApi`/`fetch`.
   - [ ] Mọi truy vấn Mongo mới có `congTyId`; `userId`/`congTyId` lấy từ `req.user`, không từ body/query.
   - [ ] Response đúng dạng `{ data }` / `{ data, meta }` / `{ error: { code, message } }`.
   - [ ] Không ghi `undefined`/`null` vào Mongo; xóa là xóa mềm (`deletedAt`).
   - [ ] Ghi công việc + lịch sử nằm trong một `store.transaction` (qua `writeWithLock`), không tách hai bước.
   - [ ] Ngày `batDau`/`hetHan` là chuỗi `YYYY-MM-DD` giờ VN; "hôm nay" dùng `todayInVietnam()`.
   - [ ] Có test cho nghiệp vụ mới.
5. Nếu làm giao diện: mở web thử đúng luồng vừa sửa (đang tải, lỗi, trống).
6. Chỉ báo "xong" khi các bước trên đạt; nếu có bước chưa làm được thì nói rõ bước nào, vì sao.
