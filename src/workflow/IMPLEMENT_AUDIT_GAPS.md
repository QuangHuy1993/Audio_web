---
description: Thực hiện các thay đổi còn thiếu sau Audit (AI Rate limiting, Admin Sidebar, Support API, UI Consistency)
---

// turbo-all
# Workflow: Hoàn thiện các lỗ hổng Audit

Hệ thống cần được cập nhật để đảm bảo tính bảo mật, đồng nhất và đầy đủ chức năng như đã xác định trong báo cáo Audit Final.

## Bước 1: Cập nhật Database
1. Thêm model `SupportTicket` vào `prisma/schema.prisma`.
2. Chạy `npx prisma generate` và push/migrate nếu cần.

## Bước 2: Triển khai Backend
1. **API Support**: Tạo `src/app/api/shop/support/route.ts` để lưu ticket.
2. **AI Rate Limiting**: Cập nhật 3 file API AI (`recommend`, `search`, `compare`) để kiểm tra `ai_rate_limit_per_user_per_day`.

## Bước 3: Cập nhật UI Quản trị
1. Thêm mục "Quản lý đánh giá" vào `src/components/layout/AdminSidebar.tsx`.
2. Sửa lỗi prop `open` -> `isOpen` trong `AdminReviewsPage.tsx` khi gọi `ConfirmActionDialog`.

## Bước 4: Đồng bộ UX Người dùng
1. Thay thế `confirm()` trong `src/app/account/orders/[orderId]/page.tsx` bằng `ConfirmActionDialog`.
2. Kết nối Form ở `src/app/support/page.tsx` với API Support thật.

## Bước 5: Kiểm tra hoàn tất
1. Xác minh việc gửi ticket thành công.
2. Xác minh thông báo giới hạn lượt dùng AI (Xử lý bằng cách hạ thấp config rate limit tạm thời).
3. Xác minh Dialog xác nhận hiển thị đúng ở các trang đã sửa.
