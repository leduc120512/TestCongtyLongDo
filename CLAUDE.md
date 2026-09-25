# Phân hệ Công việc — ERP Long Đỗ

pnpm workspace: `packages/contracts` (Zod dùng chung) · `apps/api` (Fastify 5 + MongoDB, Node chạy TS trực tiếp) · `apps/web` (React 19 + Vite + TanStack Query).
- Đặt tên: code tiếng Anh (file `.ts` kebab-case như `task.service.ts`, component/page PascalCase `.tsx`, hook React `useX.ts`). Hợp đồng dữ liệu giữ tiếng Việt không dấu theo mẫu của đề: tên trường JSON/Mongo (`nguoiGiaoId`, `trangThai`...), giá trị enum, URL API, mã lỗi. Chữ hiển thị, thông báo lỗi, comment: tiếng Việt.

## Lệnh
- Chạy: `pnpm install` → `docker compose up -d --wait` (chờ replica set Mongo sẵn sàng) → `pnpm seed` → `pnpm dev` (API :3000, web :5173)
- **Trước khi báo xong phải chạy `pnpm verify`** (typecheck 3 package + test) và đọc kết quả thật. Test tích hợp cần Mongo; "bỏ qua" không phải "đạt". Xem skill `/verify`.
- Thêm/đổi trường công việc: làm theo skill `/add-task-field`.

## Phân tầng (bắt buộc)
- API: `routes/` chỉ `validate(Schema, req.body)` → gọi service → bọc `{ data }` (danh sách: service trả `{ items, total }`, route dựng `meta`). `services/` chứa nghiệp vụ + quyền, **không import `mongodb`**, làm việc qua `repositories/interfaces.ts`. `repositories/` là nơi duy nhất truy vấn Mongo.
- Luật thuần (trạng thái, quyền, quá hạn) ở `services/domain/*.ts`, không I/O — viết test ở đó trước.
- Web: `pages/`, `components/` → `hooks/` (TanStack Query) → `api/`. Component **không** gọi `callApi`/`fetch`.
- Schema Zod chỉ viết trong `packages/contracts`; API validate bằng nó, web dùng lại cho form (`zodResolver`). Không định nghĩa lại.

## Dữ liệu và bảo mật
- `userId`, `congTyId` **chỉ** lấy từ `req.user` (JWT). Không đọc từ body/query. Mọi truy vấn Mongo phải có `congTyId` — ngoại lệ duy nhất: đăng nhập giả lập `xac-thuc/*` (chưa có token nên chưa biết công ty).
- Người không liên quan tới công việc (kể cả khác công ty) nhận **404**, không phải 403 — không lộ sự tồn tại.
- Response: `{ data }`, danh sách `{ data, meta: { page, limit, total } }`, lỗi `{ error: { code, message } }` với `code` trong `ERROR_CODES`; ném `DomainError`, không `reply.send` lỗi tự chế. Id trả ra là chuỗi.
- Mongo: không ghi trường `undefined`/`null` ở cấp document (dùng `stripUndefined`; trong thay đổi `null` = `$unset`). Riêng `thayDoi` của lịch sử, `tu/den: null` nghĩa là "trống". Tham chiếu lưu `ObjectId`, đổi sang chuỗi ở repository.
- Xóa là **xóa mềm** (`deletedAt`); mọi truy vấn đọc lọc `deletedAt: { $exists: false }`. Không bao giờ `deleteOne`/`deleteMany` công việc.
- Truy vấn danh sách mới cần index trong `db/connection.ts` (thứ tự khóa: bằng → sắp xếp → khoảng).
- Mọi lệnh ghi lên công việc đã có (sửa, trạng thái, tiến độ, việc con, xóa) đi qua `writeWithLock`: điều kiện `trangThai` + `phienBan` (khóa lạc quan, người sau nhận `XUNG_DOT`) và ghi lịch sử trong cùng `store.transaction`. Tạo việc: tăng bộ đếm + insert + lịch sử trong một `store.transaction`. Không ghi công việc rồi ghi lịch sử ở hai bước rời.

## Thời gian
- `batDau`/`hetHan` là **ngày lịch** `YYYY-MM-DD` theo giờ Việt Nam (UTC+7), lưu chuỗi. "Hôm nay" luôn dùng `todayInVietnam()`; cấm `new Date().toISOString().slice(0,10)` (ra ngày UTC, sai từ 0h–7h sáng).
- Quá hạn **tính khi đọc** (`isOverdue`), không lưu. Lọc Quá hạn: `trangThai != HOAN_THANH` và `hanSapXep < today`.
- Service nhận `clock` để test cố định thời điểm; test mốc 23:59:59 và 00:00 giờ VN.

## Nghiệp vụ cốt lõi
- Luồng: `CHUA_BAT_DAU → DANG_LAM → CHO_DUYET → HOAN_THANH`; trả lại `CHO_DUYET → DANG_LAM` cần lý do. Mọi chuyển trạng thái đi qua `checkStatusTransition`. `HOAN_THANH` là cuối.
- Người giao: sửa, xóa, duyệt, trả lại. Người thực hiện: bắt đầu, gửi duyệt (tiến độ → 100), cập nhật tiến độ khi đang làm. Theo dõi: chỉ xem (vẫn đọc/viết bình luận). Nhiều người thực hiện dùng chung trạng thái và tiến độ.
- Mỗi lần lưu ghi **một** bản ghi lịch sử, mảng `thayDoi` chứa các trường đổi `{ truong, tu, den }`.

## Cấm
- Không `git push`, `git reset --hard`, `git rebase`, `--no-verify`, `rm -rf`, xóa DB (hook trong `.claude/hooks/` chặn; thử bằng `node .claude/hooks/test-hooks.mjs`).
- Không đọc/sửa `.env` (chỉ `.env.example`). Không commit bí mật.
- Không thêm thư viện khi làm được gọn bằng code sẵn có; hỏi trước khi `pnpm add`.
- Không sửa test cho "xanh" khi code sai; không xóa test.
- Commit theo Conventional Commits (`feat:`, `fix:`, `test:`...), chỉ commit file của việc đang làm.
- Chưa rõ nghiệp vụ thì hỏi lại, đừng đoán.
