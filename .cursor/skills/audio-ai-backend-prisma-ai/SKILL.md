---
name: audio-ai-backend-prisma-ai
description: Guides the agent to design and implement backend logic for the Audio AI Shop project using Next.js API routes, Prisma ORM, PostgreSQL, and AI integration while following project-specific standards.
---

# Audio AI Backend, Prisma & AI Integration

## Mục đích

Hướng dẫn agent khi làm việc với backend của Audio AI Shop:
- Thiết kế và triển khai API route Next.js cho các domain: auth, product, cart, order, ai, admin.
- Làm việc với Prisma ORM và PostgreSQL (NeonDB) theo quy ước đặt tên và cấu trúc chuẩn.
- Tích hợp AI (OpenAI API hoặc tương đương) ở backend (service layer, API routes).

Skill này luôn tuân thủ rule `audio-ai-shop-core.mdc`.

## Khi nào dùng skill này

Agent nên dùng skill này khi:
- Người dùng yêu cầu:
  - Thêm/chỉnh sửa API route.
  - Thêm/chỉnh sửa model trong `schema.prisma`.
  - Thiết kế luồng backend cho đặt hàng, quản lý sản phẩm, gợi ý/tư vấn AI.
- Cần quyết định về:
  - Vị trí đặt route, service, schema.
  - Cách validate input/output và xử lý lỗi.
  - Cách gọi/tích hợp AI từ backend.

## Cấu trúc backend đề xuất

- `src/app/api/**`:
  - Chứa các Next.js API routes.
  - Mỗi resource hoặc nhóm hành động có một thư mục riêng:
    - Ví dụ: `src/app/api/products/route.ts`, `src/app/api/cart/route.ts`, `src/app/api/orders/route.ts`, `src/app/api/ai/advice/route.ts`.
- `src/features/<domain>/`:
  - Có thể chứa service theo domain, ví dụ: `src/features/product/product-service.ts`.
- `src/services/`:
  - Chứa các service chia sẻ nhiều domain, ví dụ: `stripe-service.ts`, `email-service.ts`, `cloudinary-service.ts`, `ai-client.ts`.
- `prisma/schema.prisma` (hoặc tương đương):
  - Chứa định nghĩa schema DB, model cho `User`, `Product`, `Order`, `OrderItem`, `Cart`, `AiSession`, v.v.

## Nguyên tắc Prisma

- Đặt tên model rõ nghĩa, PascalCase: `Product`, `Order`, `User`, `AiSession`.
- Trường sử dụng camelCase: `createdAt`, `updatedAt`, `totalPrice`, `userId`, `productId`.
- Đảm bảo quan hệ 1-n, n-n rõ ràng, có trường liên kết và onDelete/onUpdate phù hợp.
- Khi query:
  - Chỉ select/trả về các trường cần thiết cho use case.
  - Sử dụng `include` cẩn thận, tránh tải quá nhiều dữ liệu không cần.
- Migration:
  - Khi thêm/sửa model, nêu rõ (hoặc gợi ý) lệnh migration nhưng không tự động thay đổi DB nếu không có yêu cầu cụ thể.

## Nguyên tắc API Routes

- Mỗi `route.ts` nên:
  - Export handler cho các HTTP method cần dùng: `GET`, `POST`, `PATCH`, `DELETE`, v.v.
  - Validate input từ body/query; với logic phức tạp nên dùng schema.
  - Gọi service tương ứng để thao tác với DB hoặc AI.
  - Trả về JSON với:
    - Mã HTTP phù hợp.
    - Cấu trúc rõ ràng, thống nhất (ví dụ `{ data, error }`).
- Không:
  - Chứa logic nghiệp vụ nặng hoặc lặp lại ở nhiều route.
  - Trả chi tiết lỗi nội bộ (stack trace, thông tin DB) ra client.

## Tích hợp AI ở backend

- Cấu trúc:
  - Tạo client hoặc service dùng chung, ví dụ: `src/services/ai-client.ts`.
  - Với từng use case:
    - `ai-advice-service.ts` cho tư vấn sản phẩm theo ngân sách, không gian, mục đích.
    - `ai-recommendation-service.ts` cho gợi ý sản phẩm liên quan.
    - `ai-comparison-service.ts` cho so sánh thiết bị.
    - `ai-search-service.ts` cho tìm kiếm thông minh.
- Nguyên tắc:
  - Đọc key, endpoint, model từ biến môi trường.
  - Thiết kế prompt ngắn gọn, định hướng rõ output (tư vấn, danh sách gợi ý, bảng so sánh, v.v.).
  - Bắt lỗi:
    - Timeout, rate limit, lỗi mạng.
    - Invalid response format.
  - Xử lý fallback:
    - Trả về trạng thái lỗi rõ ràng cho frontend.
    - Nếu có thể, trả về kết quả dự phòng (ví dụ danh sách sản phẩm mặc định) khi AI lỗi.

## Quy trình thiết kế một tính năng backend mới

1. Xác định domain và hành vi:
   - Ví dụ: “Lưu lại phiên tư vấn AI của người dùng”.
2. Thiết kế schema Prisma:
   - Thêm model `AiSession` với các trường: user liên quan, input, output, metadata.
3. Tạo service:
   - Ví dụ `ai-session-service.ts` để tạo/lấy/lưu lịch sử.
4. Tạo API route:
   - Ví dụ `src/app/api/ai/sessions/route.ts` cho tạo và liệt kê phiên.
5. Tích hợp AI nếu cần:
   - Gọi service AI tương ứng, lưu lại kết quả vào `AiSession`.
6. Kiểm tra:
   - Kiểm tra luồng end-to-end với input hợp lệ, input lỗi, và trường hợp AI lỗi.

## Checklist khi làm backend

- [ ] Model Prisma có tên rõ nghĩa, không trùng/khó hiểu.
- [ ] API route nằm đúng thư mục `src/app/api/**`, tên phản ánh resource.
- [ ] Logic nghiệp vụ chính nằm ở service, không rải rác trong nhiều handler.
- [ ] Xử lý lỗi và status code nhất quán.
- [ ] Không để lộ secret, không log thông tin nhạy cảm.
- [ ] Tích hợp AI (nếu có) qua service + env, có xử lý fallback.

