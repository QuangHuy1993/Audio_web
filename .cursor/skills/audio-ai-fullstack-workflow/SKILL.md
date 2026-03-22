---
name: audio-ai-fullstack-workflow
description: Guides the agent to implement fullstack features for the Audio AI Shop project using Next.js 14 App Router, React, TypeScript, Prisma, PostgreSQL, and AI services, following the audio-ai-shop-core rules and project folder structure.
---

# Audio AI Fullstack Workflow

## Mục đích

Hướng dẫn agent khi cần triển khai hoặc chỉnh sửa một tính năng fullstack trong dự án Audio AI Shop, bao gồm:
- Route và UI (Next.js 14 App Router, React, TypeScript).
- API routes và service layer (Next.js API Routes + Prisma).
- Tích hợp AI (OpenAI API hoặc tương đương) khi tính năng có liên quan.
- Lưu trữ dữ liệu với PostgreSQL qua Prisma.

Skill này chỉ áp dụng cho **project Audio AI Shop** tại repo hiện tại và phải luôn tuân thủ các quy định trong `audio-ai-shop-core.mdc`.

## Khi nào dùng skill này

Agent nên dùng skill này khi:
- Người dùng yêu cầu tạo, mở rộng hoặc refactor một **tính năng cụ thể** có cả frontend và backend, ví dụ:
  - Thêm màn “Danh sách sản phẩm”, “Chi tiết sản phẩm”.
  - Thêm giỏ hàng, đặt hàng, thanh toán demo.
  - Thêm màn tư vấn AI, gợi ý, so sánh sản phẩm.
  - Thêm trang quản trị sản phẩm/đơn hàng/người dùng.
- Người dùng yêu cầu “kết nối từ UI đến DB” hoặc “hoàn thiện flow end-to-end”.

## Nguyên tắc chung

- Luôn xem và tuân thủ `audio-ai-shop-core.mdc`:
  - Kiến trúc, clean code, TypeScript strict, tách service, BEM, không emoji, không tự tạo file Markdown nếu không được yêu cầu.
- Không tự ý thay đổi cấu trúc thư mục lớn; chỉ thêm/điều chỉnh trong:
  - `src/app/**` cho route, page, layout, API routes.
  - `src/features/**` cho logic domain (auth, product, cart, ai, order, v.v.).
  - `src/components/**` cho component tái sử dụng.
  - `src/services/**` cho service chung.
  - `src/hooks/**`, `src/utils/**`, `src/types/**` cho hook, tiện ích, type.
- Đặt tên file và thư mục theo domain, tránh tên chung chung khó hiểu.

## Quy trình triển khai một tính năng fullstack

### Bước 1: Làm rõ yêu cầu và domain

1. Xác định rõ:
   - Domain: ví dụ product, cart, ai, order, auth, admin.
   - Loại người dùng: khách hàng hay admin.
   - Dữ liệu nào cần hiển thị, tạo, sửa, xoá.
   - Có cần AI hay không (tư vấn, gợi ý, so sánh, tìm kiếm).
2. Ghi chú các constraint đã nêu trong rule (không emoji, BEM, clean code, v.v.).

### Bước 2: Chọn vị trí trong cấu trúc thư mục

1. Với **route/UI**:
   - Đặt page trong `src/app/(shop)/...`, `(auth)/...`, `(admin)/...` phù hợp.
   - Dùng `page.tsx` chỉ cho entry của route; mọi UI tái sử dụng tách thành component.
2. Với **logic domain**:
   - Tạo hoặc sử dụng thư mục dưới `src/features/<domain>/`:
     - Ví dụ: `src/features/product/`, `src/features/cart/`, `src/features/ai/`, `src/features/order/`.
3. Với **service/data layer**:
   - Nếu là service theo domain, có thể:
     - `src/features/<domain>/<domain>-service.ts`, hoặc
     - `src/services/<domain>-service.ts`.
4. Với **type, util, hook dùng lại**:
   - Type: `src/types/<domain>.ts`.
   - Hook: `src/hooks/use<Domain>*.ts` hoặc `src/features/<domain>/hooks/use<Domain>*.ts`.
   - Util: `src/utils/<chuc-nang>.ts` hoặc util riêng trong `features`.

### Bước 3: Thiết kế API và Prisma

1. Nếu cần model mới trong DB:
   - Cập nhật `schema.prisma` với model mới hoặc field mới, tên đúng domain (ví dụ `Product`, `Order`, `User`, `AiSession`).
   - Chạy migration (nếu user yêu cầu) theo chuẩn Prisma; mô tả lệnh thay vì tự ý chạy nếu không được phép.
2. Thiết kế API route Next.js:
   - Đặt trong `src/app/api/<resource>/route.ts` hoặc nested phù hợp.
   - Chỉ rõ method: `GET`, `POST`, `PATCH`, `DELETE`, v.v.
3. Trong handler:
   - Validate input (dùng schema/guard nếu có).
   - Gọi Prisma client để truy vấn DB, tránh lấy thừa dữ liệu.
   - Bắt và xử lý lỗi, trả HTTP code, message chuẩn, không lộ secret.
   - Không đặt logic business phức tạp trực tiếp trong handler; gọi service.

### Bước 4: Service layer và logic nghiệp vụ

1. Tạo service theo domain:
   - Ví dụ: `product-service.ts`, `cart-service.ts`, `order-service.ts`, `ai-advice-service.ts`.
2. Service chịu trách nhiệm:
   - Đóng gói thao tác với Prisma (CRUD, query phức tạp).
   - Áp dụng rule business: filter, mapping, tính giá, trạng thái đơn hàng, v.v.
3. API route chỉ:
   - Parse/validate input.
   - Gọi service thích hợp.
   - Định dạng lại dữ liệu trả về cho client.

### Bước 5: UI và component React

1. Tạo page trong App Router:
   - File `page.tsx` trong đúng segment (ví dụ `src/app/(shop)/products/page.tsx`).
   - Ưu tiên server component cho dữ liệu load sẵn từ server.
2. Tách UI:
   - Component tái sử dụng: đặt trong `src/components/` hoặc `src/features/<domain>/components/`.
   - Đặt tên rõ ràng: `ProductCard`, `ProductList`, `CartSummary`, `AiAdviserPanel`, `OrderHistoryTable`.
3. Áp dụng BEM:
   - Tạo file style/module tương ứng với tên component/file.
   - Dùng block `{ten-file-khong-duoi}-{chuc-nang}`, element và modifier như đã quy định trong rule.
4. Kết nối UI–API:
   - Dùng hook hoặc service để gọi API (fetch, React Query, hoặc cách phù hợp theo stack hiện tại).
   - Luôn xử lý trạng thái loading, error, empty.

### Bước 6: Tích hợp AI (nếu có)

1. Đặt logic AI trong `src/features/ai/` hoặc `src/services/`:
   - Ví dụ: `ai-advice-service.ts`, `ai-recommendation-service.ts`.
2. Tuân thủ:
   - Key, endpoint, model lấy từ biến môi trường.
   - Prompt rõ ràng theo mục đích (tư vấn, gợi ý, so sánh, tìm kiếm).
   - Bắt lỗi từ AI (timeout, rate limit, invalid response) và trả trạng thái có thể xử lý ở UI.
3. UI hiển thị:
   - Thể hiện rõ khi AI đang xử lý, khi có kết quả, khi có lỗi.

### Bước 7: Kiểm tra và dọn dẹp

1. Xem lại:
   - Tên file, thư mục, component, hook, service có phản ánh đúng domain/chức năng không.
   - Có vi phạm quy tắc “tên chung chung” không (page/ index/ component vô nghĩa).
   - BEM đã được áp dụng đúng file và class chưa.
2. Đảm bảo:
   - Không để console.log dùng tạm cho debug.
   - Không để dead code hoặc TODO bỏ quên.
   - TypeScript không còn lỗi kiểu do `any` bừa bãi.

## Ví dụ sử dụng skill này

- Người dùng yêu cầu:
  - “Thêm trang danh sách sản phẩm kèm AI gợi ý sản phẩm liên quan.”
  - “Hoàn thiện flow đặt hàng từ giỏ hàng tới lưu đơn trong DB.”
  - “Tích hợp màn so sánh hai thiết bị âm thanh với AI.”
- Agent dùng quy trình:
  - Chọn route và cấu trúc thư mục.
  - Thiết kế API, Prisma, service.
  - Tạo UI tương ứng, kết nối API, tích hợp AI nếu có.
  - Đảm bảo tuân thủ toàn bộ quy tắc trong `audio-ai-shop-core.mdc`.

