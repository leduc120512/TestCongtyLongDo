# Phân hệ Công việc — ERP Long Đỗ

Bài test Full-stack Developer (Middle). Phân hệ giao việc và theo dõi tiến độ theo dự án cho nhiều công ty con.

- `packages/contracts` — schema Zod viết một lần, API dùng để validate, web dùng lại cho type và form.
- `apps/api` — Fastify 5 + MongoDB 7. Node chạy TypeScript trực tiếp, không có bước build.
- `apps/web` — React 19 + Vite 8 + TanStack Query 5 + react-hook-form.

## Chạy (4 lệnh)

Cần: Node ≥ 22.18, pnpm 10 (`corepack enable`), Docker.

```bash
pnpm install
docker compose up -d --wait
pnpm seed
pnpm dev
```

Mở http://localhost:5173 rồi chọn **"Đang đăng nhập là"** ở góc trên. Mỗi tab trình duyệt có thể đóng vai một người khác (phiên lưu trong `sessionStorage`), tiện thử người giao và người thực hiện cùng lúc.

Kiểm tra (typecheck 3 package + 155 test; test tích hợp cần Mongo đang chạy):

```bash
pnpm kiem-tra
```

Cấu hình tùy chọn: sao chép `apps/api/.env.example` thành `apps/api/.env`. Không có file này thì dùng mặc định cho dev.

## Cấu trúc

```
packages/contracts/src/   common.ts (id, ngày, phân trang, mã lỗi) · task.ts · auth.ts ...
apps/api/src/
  routes/        chỉ validate bằng schema contracts → gọi service → bọc { data }
  services/      nghiệp vụ + quyền; domain/*.ts là luật thuần (trạng thái, quyền, quá hạn, việc con)
  repositories/  nơi duy nhất truy vấn Mongo; interfaces.ts là hợp đồng service ↔ repository
  db/            kết nối, index, tiện ích ObjectId / bỏ undefined
apps/api/test/   unit/ (không cần Mongo) · integration/ (HTTP thật + Mongo thật)
apps/web/src/    pages → hooks (TanStack Query) → api (fetch); components dùng chung
.claude/         hook, skill, subagent cho Claude Code (xem cuối file)
```

## API

Mọi route (trừ `xac-thuc/*` và `suc-khoe`) cần `Authorization: Bearer <token>`. `userId`, `congTyId` chỉ lấy từ token.
Response: `{ data }`, danh sách `{ data, meta: { page, limit, total } }`, lỗi `{ error: { code, message } }`.

| Method | Đường dẫn | Ai được dùng |
|---|---|---|
| GET | `/api/suc-khoe` | công khai (kiểm tra API còn sống) |
| GET | `/api/xac-thuc/nguoi-dung-gia-lap` | công khai (ô chọn người); tắt khi production |
| POST | `/api/xac-thuc/dang-nhap-gia-lap` `{ userId }` | công khai → JWT 12 giờ; tắt khi production |
| GET | `/api/nhan-vien`, `/api/du-an` | người trong công ty |
| GET | `/api/cong-viec?nhanh&duAnId&trangThai&uuTien&q&sapXep&page&limit` | việc mình liên quan |
| GET | `/api/cong-viec/dem?duAnId&trangThai&uuTien&q` | số việc ở 4 lọc nhanh |
| POST | `/api/cong-viec` | ai cũng tạo được (thành người giao) |
| GET | `/api/cong-viec/:id` (kèm `quyen`) · `/:id/lich-su` | người liên quan |
| PATCH | `/api/cong-viec/:id` | người giao, chưa hoàn thành |
| POST | `/api/cong-viec/:id/trang-thai` `{ trangThai, lyDo? }` | theo luồng trạng thái |
| POST | `/api/cong-viec/:id/tien-do` `{ tienDo }` | người thực hiện, đang làm, không có việc con |
| DELETE | `/api/cong-viec/:id` | người giao, chưa hoàn thành (xóa mềm) |
| POST / DELETE | `/api/cong-viec/:id/viec-con[/:viecConId]` | người giao, chưa bắt đầu hoặc đang làm |
| POST | `/api/cong-viec/:id/viec-con/:viecConId/danh-dau` `{ xong }` | người thực hiện, đang làm |
| GET / POST | `/api/cong-viec/:id/binh-luan` | người liên quan |

## Đã làm và chưa làm

**Bắt buộc: đã làm đủ.** Gồm JWT giả lập và ô chọn người; seed 1 công ty, 10 nhân viên, 3 dự án, 15 công việc; luồng trạng thái và quyền theo vai trò; Quá hạn theo giờ Việt Nam; danh sách với lọc nhanh có số đếm, lọc dự án có "Việc chung", lọc trạng thái có "Quá hạn", lọc ưu tiên, tìm theo tên hoặc mã, sắp theo hạn, phân trang phía server. Có màn tạo, chi tiết, sửa với validate tiếng Việt; lịch sử thay đổi; xóa mềm; mỗi màn đủ trạng thái đang tải, lỗi có thử lại, trống. Có test cho luồng trạng thái, quyền từng vai trò, và Quá hạn quanh mốc nửa đêm giờ VN.

**Tùy chọn: chọn 2 mục.**
- **Việc con.** Người giao thêm/xóa việc con, người thực hiện tích xong, tiến độ tự tính theo tỉ lệ đã xong. Còn việc con chưa xong thì chưa gửi duyệt được.
- **Bình luận.** Ai liên quan tới công việc cũng đọc và viết được.

**Chưa làm**, vì đề chỉ cho chọn tối đa 2. Nếu làm thì dự kiến như sau:
- **Nhắc trước hạn.** Một job chạy mỗi giờ tìm việc chưa hoàn thành có `hetHan` bằng hôm nay + 1, 3 hoặc 7 ngày (giờ VN). Mỗi lần nhắc tạo một bản ghi thông báo có unique index `(congViecId, nguoiNhanId, mocNhac, hetHan)`. Chạy lại hay chạy song song cũng không gửi trùng; đổi hạn thì nhắc lại theo hạn mới.
- **Đính kèm.** Dùng MinIO trong Docker Compose. API cấp presigned URL để web tải thẳng lên, rồi lưu metadata kèm `congViecId`, `congTyId`. Tải xuống cũng qua presigned URL sau khi kiểm quyền.
- **Tổ đội thực hiện.** Thêm collection `to_doi` gồm thành viên. Có hai cách: lưu `toDoiIds` rồi mở rộng thành người lúc kiểm quyền (index theo `toDoiIds`), hoặc chụp danh sách thành viên lúc giao. Cách thứ nhất đúng hơn khi tổ đổi người.

## Giả định đã đặt

1. Người tạo là người giao, không đổi được. Ai trong công ty cũng tạo được việc.
2. Người giao sửa được mọi thông tin khi việc chưa hoàn thành, kể cả lúc chờ duyệt. Tiến độ và trạng thái không sửa qua form, chỉ qua thao tác riêng.
3. Tiến độ chỉ người thực hiện cập nhật và chỉ khi đang làm. Chưa bắt đầu thì là 0. Trả lại thì giữ tiến độ cũ, hoặc tính lại nếu có việc con.
4. Người không liên quan và người khác công ty đều nhận **404**, không phải 403, để không lộ công việc có tồn tại hay không.
5. Ai đã là người thực hiện thì tự bị loại khỏi danh sách theo dõi.
6. "Tất cả" là việc tôi giao, tôi thực hiện hoặc tôi theo dõi. Số đếm ở 4 lọc nhanh áp cùng bộ lọc phụ đang chọn.
7. Lọc "Đang làm" vẫn gồm việc đang làm đã quá hạn. "Quá hạn" là một lọc riêng: mọi trạng thái chưa hoàn thành đã qua hạn.
8. Việc không có hạn không bao giờ quá hạn. Khi sắp hạn tăng dần thì nằm cuối, giảm dần thì nằm đầu.
9. Mã dạng `CV-0001`, đếm riêng từng công ty, tự dài thêm khi quá 9999. Việc đã xóa giữ mã, không tái sử dụng.
10. `batDau`/`hetHan` là ngày lịch giờ VN, lưu chuỗi `YYYY-MM-DD`, không lưu `Date`.
11. Tìm kiếm không phân biệt hoa thường và dấu tiếng Việt: "nghiem thu" tìm được "Nghiệm thu". Tìm theo tên hoặc mã.
12. Việc con: người giao chỉ thêm/xóa khi chưa bắt đầu hoặc đang làm; lúc chờ duyệt phải trả lại trước. Có việc con thì tiến độ không nhập tay.
13. Hai người cùng thao tác trên một công việc thì người sau nhận `409 XUNG_DOT` và phải tải lại, không có chuyện ghi đè im lặng.
14. Mongo chạy replica set một node để dùng transaction. Nếu trỏ tới mongod đơn lẻ, API vẫn chạy nhưng không có transaction và ghi cảnh báo lúc khởi động.
15. Đăng nhập giả lập chỉ để demo: khi `NODE_ENV=production`, hai route `xac-thuc/*` trả 404 (chạy thật cần đăng nhập thật). Seed cũng từ chối chạy khi production, vì seed xóa sạch dữ liệu.

## Câu hỏi thiết kế

**1. Quá hạn: lưu hay tính khi đọc?** Tôi chọn tính khi đọc (`laQuaHan`) và không lưu.
- Được: không lệch thời gian. Đúng 00:00 giờ VN là việc thành quá hạn, không phải chờ job, và không phải đổi luồng trạng thái. Một việc vừa "Đang làm" vừa "Quá hạn" là chuyện bình thường; nếu lưu thành trạng thái thì hai khái niệm này phải gộp làm một.
- Mất: không lọc được bằng một giá trị có sẵn, và muốn gửi thông báo khi vừa quá hạn thì vẫn cần job riêng.
- Lưu thành trạng thái thì ngược lại. Truy vấn và thông báo đơn giản hơn, nhưng cần job lúc 0h, dữ liệu sai trong khoảng giữa hai lần chạy, và mọi thao tác đổi hạn đều phải tính lại.
- Lọc Quá hạn có phân trang: truy vấn `trangThai != HOAN_THANH` và `hanSapXep < homNayVN()`. `hanSapXep` bằng `hetHan`, hoặc `9999-12-31` nếu không có hạn. Đây vừa là khóa sắp xếp, vừa là khóa khoảng trong index `(congTyId, vai trò, deletedAt, hanSapXep, _id)`. Vì vậy `skip/limit` và `countDocuments` chạy trên index, không quét toàn bộ; có test `explain` khẳng định không có stage SORT hay COLLSCAN.

**2. Mã CV không trùng, không nhảy số.**
- Mỗi công ty có một bản ghi bộ đếm, tăng bằng `findOneAndUpdate({$inc})`. Lệnh này nguyên tử, nên hai người bấm cùng lúc luôn nhận hai số khác nhau.
- Mọi kiểm tra (người, dự án, ngày) chạy xong mới lấy số.
- Tăng bộ đếm, insert công việc và ghi lịch sử nằm trong **một transaction**. Lỗi ở bất kỳ bước nào thì cả khối được hoàn tác, lượt tăng cũng mất theo, nên không có số bị bỏ trống. Có test ép bước ghi lịch sử lỗi rồi kiểm tra việc tiếp theo vẫn là số liền kề.
- Unique index `(congTyId, ma)` là lưới an toàn cuối cùng.
- Đánh đổi: bản ghi bộ đếm là điểm nóng, các transaction đồng thời gặp write conflict và driver tự thử lại. Với tốc độ tạo việc của một công ty thì chấp nhận được; có test tạo đồng thời 20 việc.

**3. Lịch sử thay đổi lưu ở đâu, dạng gì?**
- Collection riêng `lich_su_cong_viec`. Mỗi lần lưu là **một** bản ghi `{ congViecId, congTyId, nguoiDoiId, luc, hanhDong, thayDoi: [{ truong, tu, den }], lyDo? }`. Đổi 5 trường thì ghi **1 dòng** chứa 5 phần tử.
- Lý do: khớp với cách người dùng hiểu ("một lần lưu"), ghi chung transaction với thay đổi, và có index `(congTyId, congViecId, luc, _id)`.
- Không nhúng vào document công việc, để tránh document phình mãi và để truy vấn danh sách nhẹ.
- Giá trị lưu thô (id, enum, ngày); web đổi ra tên khi hiển thị.
- Đánh đổi: nhân viên đổi tên thì lịch sử hiện tên mới. Muốn giữ đúng tên lúc đó thì chụp thêm tên khi ghi.
- Khóa lạc quan theo `phienBan` giúp giá trị "từ" luôn đúng khi nhiều người cùng thao tác.

**4. Thêm trường bắt buộc `loaiCongViec` mà app cũ vẫn gọi API tạo.**
- Ở API bản hiện tại, trường này **không bắt buộc** và có mặc định phía server (vd. `KHAC`, hoặc suy ra từ dự án). App cũ không gửi vẫn tạo được.
- Web mới bắt buộc chọn ở form, bằng schema form riêng.
- Chạy migration điền giá trị cho bản ghi cũ. Repository trả mặc định nếu bản ghi thiếu trường, để client không nhận `undefined` bất ngờ.
- Thêm header phiên bản app để đo còn bao nhiêu client cũ. Khi đủ ít và đã ép cập nhật qua "phiên bản tối thiểu", mới bắt buộc ở `/v2` hoặc theo phiên bản app, không đổi đột ngột hợp đồng v1.
- Response có thêm trường mới là tương thích ngược, miễn app cũ bỏ qua trường lạ.
- Bài học ngay trong bài này: default phải đặt ở schema **tạo**, không đặt ở schema dùng cho PATCH. Zod 4 vẫn áp `.default()` bên trong `.partial()`, và lỗi này từng làm PATCH xóa mất người theo dõi (xem AI_LOG).

## Ghi chú kỹ thuật

- **Nhẹ:** API không cần `tsx` hay bước build, vì Node ≥ 22.18 tự bỏ kiểu TS. tsconfig bật `erasableSyntaxOnly` để bảo đảm điều đó. Web tách chunk theo trang (`React.lazy`), không dùng thư viện UI, chỉ CSS thuần.
- **Index:** 3 index danh sách theo vai trò, sắp theo ESR (bằng → sắp xếp → khoảng). "Tất cả" là `$or` của 3 nhánh, bộ lọc phụ đưa vào từng nhánh, nên Mongo dùng `SORT_MERGE` trên index thay vì sắp xếp trong bộ nhớ.
- **Không ghi `undefined`:** `boUndefined` khi tạo; trong thay đổi, `null` nghĩa là `$unset`. Driver cũng bật `ignoreUndefined` làm lưới an toàn. Có test đọc thẳng document Mongo để kiểm tra.
- **Kiểm thử:** 155 test. `unit/` gồm luật thuần, contracts, service với kho trong bộ nhớ, và việc con/bình luận. `integration/` là HTTP thật trên Mongo thật: quyền, dạng response, index (`explain`), transaction, đồng thời.

## Claude Code trong repo (`.claude/`)

| Thành phần | Công dụng |
|---|---|
| `CLAUDE.md` | Luật cho phiên Claude mới: phân tầng, dạng response, xóa mềm, múi giờ, quyền theo công ty, lệnh kiểm tra, việc cấm. |
| `settings.json` | Chỉ cho phép sẵn đúng các lệnh đọc/kiểm tra; commit, seed, cài gói phải hỏi; cấm đọc `.env`, `git push`, `reset --hard`. |
| `hooks/block-dangerous-actions.mjs` | PreToolUse: chặn lệnh không hoàn tác được và đọc/ghi `.env`. Chạy `node .claude/hooks/test-hooks.mjs` để thử 47 ca. |
| `hooks/typecheck-before-stop.mjs` | Stop: còn file `.ts` thay đổi (kể cả file mới chưa theo dõi) mà typecheck lỗi thì không cho Claude kết thúc lượt. Có chống vòng lặp. |
| `skills/verify` | `/verify`: chạy kiểm tra và rà checklist luật trước khi báo xong. |
| `skills/add-task-field` | `/add-task-field`: quy trình thêm trường xuyên các tầng, có bước tương thích ngược. |
| `agents/rules-reviewer.md` | Subagent chỉ đọc, soát diff theo luật repo, dùng làm góc nhìn độc lập trước khi commit. |

## Xử lý sự cố

- **Cổng 27017 đã có Mongo khác chạy**: tắt Mongo đó, hoặc đổi cổng trong `docker-compose.yml` và `MONGO_URL` trong `apps/api/.env`.
- **API cảnh báo "không chạy replica set"**: đang trỏ tới mongod đơn lẻ. Dùng Mongo của `docker compose` trong repo để có transaction.
- **Sửa `packages/contracts` mà web chưa nhận**: tắt rồi chạy lại `pnpm dev` để Vite dịch lại gói dùng chung.

## Thời gian

Tổng số giờ thực tế đã làm: **… giờ** (ứng viên tự điền).
