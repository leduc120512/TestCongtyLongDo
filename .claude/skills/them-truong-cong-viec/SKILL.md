---
name: them-truong-cong-viec
description: Quy trình thêm hoặc đổi một trường của Công việc (vd. loaiCongViec, diaDiem, nganSach) xuyên suốt contracts → repository → service → route → web → test mà không làm hỏng app cũ. Dùng khi được yêu cầu thêm trường, thêm cột, thêm bộ lọc, hoặc đổi kiểu dữ liệu của công việc.
---

# Thêm trường cho Công việc

Làm theo đúng thứ tự dưới đây. Mỗi bước nhỏ, chạy typecheck ngay sau bước đó để lỗi lộ ra sớm.

## 0. Hỏi lại nếu chưa rõ
- Trường bắt buộc hay tùy chọn? Ai được sửa (chỉ người giao, hay cả người thực hiện)?
- Có cần lọc/sắp xếp theo trường này không (cần index)?
- Giá trị mặc định cho **bản ghi cũ** và cho **client cũ** không gửi trường này là gì?

## 1. `packages/contracts/src/cong-viec.ts`
- Thêm vào `TruongNhapSchema` (body tạo/sửa) với thông báo lỗi tiếng Việt.
- **Tương thích ngược**: trường mới trong body phải `.optional()` hoặc `.default(...)` ở API, kể cả khi nghiệp vụ coi là bắt buộc. App điện thoại bản cũ không gửi trường này. Bắt buộc thật thì đặt ở form web (schema form riêng `.required()`), không đặt ở API.
- Thêm vào `CongViecSchema` (dữ liệu trả về) và `TEN_TRUONG` (nhãn cho lịch sử).

## 2. `apps/api/src/kieu.ts`
- Nếu người giao được sửa: thêm vào `TRUONG_SUA_DUOC` (lịch sử sẽ tự ghi trường này).

## 3. `apps/api/src/repositories/cong-viec.repository.ts`
- Thêm vào `CongViecDoc`, `sangBanGhi`, `tao`. Tham chiếu tới bản ghi khác lưu dạng `ObjectId`.
- Không ghi `undefined`/`null`: dùng `boUndefined` khi tạo, `null` trong thay đổi nghĩa là `$unset`.
- Lọc theo trường mới → thêm điều kiện trong `xayDungBoLoc` **và** index trong `apps/api/src/db/ket-noi.ts` (thứ tự khóa: bằng → sắp xếp → khoảng).
- Bản ghi cũ không có trường → `sangBanGhi` phải trả giá trị mặc định, không để web nhận `undefined` bất ngờ.

## 4. `apps/api/src/services/cong-viec.service.ts`
- Kiểm tra nghiệp vụ và quyền ở đây (không ở route, không ở repository).
- Tham chiếu tới bản ghi khác (người, dự án...) phải kiểm tra **cùng congTyId**.

## 5. Route
- Thường không cần đổi: route chỉ `kiemTra(schema, ...)` rồi gọi service.

## 6. Web
- `apps/web/src/components/FormCongViec.tsx`: thêm ô nhập, thêm vào `GiaTriForm`, `FORM_TRONG`, `SuaPage` (giá trị đầu và body PATCH).
- Hiển thị ở `ChiTietPage`, cột ở `DanhSachPage` nếu cần, `LichSuThayDoi.hienGiaTri` nếu cần định dạng.
- Không gọi `goiApi` trong component: thêm vào `api/` rồi `hooks/`.

## 7. Test (bắt buộc)
- `apps/api/test/nghiep-vu/cong-viec.service.test.ts`: tạo có/không có trường, quyền sửa, lịch sử ghi đúng từ → đến.
- `apps/api/test/tich-hop/api.test.ts`: **gửi body không có trường mới vẫn tạo được** (client cũ), bản ghi Mongo không có `null`/`undefined`.
- Cập nhật `test/ho-tro/kho-bo-nho.ts` nếu repository đổi hành vi lọc.

## 8. Kiểm tra trước khi báo xong
```bash
pnpm kiem-tra
```
Rồi mở web thử tạo, sửa, xem lịch sử. Ghi giả định mới vào README.
