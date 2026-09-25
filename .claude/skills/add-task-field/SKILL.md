---
name: add-task-field
description: Quy trình thêm hoặc đổi một trường của Công việc (vd. loaiCongViec, diaDiem, nganSach) xuyên suốt contracts → repository → service → route → web → test mà không làm hỏng app cũ. Dùng khi được yêu cầu thêm trường, thêm cột, thêm bộ lọc, hoặc đổi kiểu dữ liệu của công việc.
---

# Thêm trường cho Công việc

Làm theo đúng thứ tự dưới đây. Mỗi bước nhỏ, chạy typecheck ngay sau bước đó để lỗi lộ ra sớm.

## 0. Hỏi lại nếu chưa rõ
- Trường bắt buộc hay tùy chọn? Ai được sửa (chỉ người giao, hay cả người thực hiện)?
- Có cần lọc/sắp xếp theo trường này không (cần index)?
- Giá trị mặc định cho **bản ghi cũ** và cho **client cũ** không gửi trường này là gì?

## 1. `packages/contracts/src/task.ts`
- Thêm vào `BaseTaskFields` (schema gốc của body tạo/sửa) với thông báo lỗi tiếng Việt, chỉ dùng `.optional()`/`.nullish()`.
- **KHÔNG đặt `.default()` trong `BaseTaskFields`**: `UpdateTaskSchema = BaseTaskFields.partial()` và Zod 4 vẫn áp default bên trong `.partial()` → PATCH không gửi trường sẽ bị ghi đè bằng giá trị mặc định (lỗi này đã từng xảy ra, xem AI_LOG lần 3). Cần mặc định khi tạo thì thêm vào `CreateTaskSchema` qua `.extend()`, giống `nguoiTheoDoiIds`/`uuTien`.
- **Tương thích ngược**: ở API trường mới luôn không bắt buộc (có mặc định khi tạo), kể cả khi nghiệp vụ coi là bắt buộc — app điện thoại bản cũ không gửi trường này. Bắt buộc thật thì đặt ở form web bằng schema form riêng, **vẫn viết trong `packages/contracts`**: `CreateTaskFormSchema = CreateTaskSchema.extend({ loaiCongViec: LoaiCongViecSchema })`, `TaskForm` dùng qua `zodResolver`. API vẫn validate bằng `CreateTaskSchema` (trường tùy chọn, có mặc định).
- Chạy lại `contracts.test.ts`: `UpdateTaskSchema.parse({})` phải vẫn ra `{}`.
- Thêm vào `TaskSchema` (dữ liệu trả về) và `FIELD_LABELS` (nhãn cho lịch sử).

## 2. `apps/api/src/types.ts`
- Nếu người giao được sửa: thêm vào `EDITABLE_FIELDS` (lịch sử sẽ tự ghi trường này).

## 3. `apps/api/src/repositories/task.repository.ts`
- Thêm vào `TaskDoc`, `toRecord`, `create`. Tham chiếu tới bản ghi khác lưu dạng `ObjectId`.
- Không ghi `undefined`/`null`: dùng `stripUndefined` khi tạo, `null` trong thay đổi nghĩa là `$unset`.
- Lọc theo trường mới → thêm điều kiện trong `buildTaskFilter` **và** index trong `apps/api/src/db/connection.ts` (thứ tự khóa: bằng → sắp xếp → khoảng).
- Bản ghi cũ không có trường → `toRecord` phải trả giá trị mặc định, không để web nhận `undefined` bất ngờ.

## 4. `apps/api/src/services/task.service.ts`
- Kiểm tra nghiệp vụ và quyền ở đây (không ở route, không ở repository).
- Tham chiếu tới bản ghi khác (người, dự án...) phải kiểm tra **cùng congTyId**.

## 5. Route
- Thường không cần đổi: route chỉ `validate(schema, ...)` rồi gọi service.

## 6. Web
- `apps/web/src/components/TaskForm.tsx`: thêm ô nhập, thêm vào `TaskFormValues`, `EMPTY_FORM`; `pages/EditPage.tsx` (giá trị đầu và body PATCH).
- Hiển thị ở `pages/DetailPage.tsx`, cột ở `pages/ListPage.tsx` nếu cần, `displayValue` trong `components/ChangeHistory.tsx` nếu cần định dạng.
- Không gọi `callApi` trong component: thêm vào `api/` rồi `hooks/`.

## 7. Test (bắt buộc)
- `apps/api/test/unit/task.service.test.ts`: tạo có/không có trường, quyền sửa, lịch sử ghi đúng từ → đến.
- `apps/api/test/integration/api.test.ts`: **gửi body không có trường mới vẫn tạo được** (client cũ), bản ghi Mongo không có `null`/`undefined`.
- Cập nhật `test/helpers/memory-store.ts` nếu repository đổi hành vi lọc.

## 8. Kiểm tra trước khi báo xong
```bash
pnpm verify
```
Rồi mở web thử tạo, sửa, xem lịch sử. Ghi giả định mới vào README.
