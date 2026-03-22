# Báo cáo Kiểm tra (Audit) Thông báo Toast trong Hệ thống

Báo cáo này liệt kê các trang và hành động (actions) trong ứng dụng hiện đang thiếu thông báo `toast` để xác nhận thành công, lỗi hoặc trạng thái đang xử lý, nhằm đảm bảo trải nghiệm người dùng đồng nhất.

## 1. Các trang cần bổ sung Toast ngay lập tức

### [Mua sắm] Trang Danh sách Sản phẩm (`src/app/products/page.tsx`)
- **Hành động: Thêm vào giỏ hàng (`handleAddToCart`)**
  - **Hiện tại:** Chỉ gọi `refreshCartCount()`, người dùng không có thông báo xác nhận đã thêm thành công hay chưa.
  - **Đề xuất:** Thêm `toast.success("Đã thêm sản phẩm vào giỏ hàng")` và `toast.error` khi thất bại.
- **Hành động: Thêm/Xóa Yêu thích (`handleToggleWishlist`)**
  - **Hiện tại:** Cập nhật state nội bộ và icon, không có thông báo text.
  - **Đề xuất:** Thêm `toast.success` thông báo "Đã thêm vào danh sách yêu thích" hoặc "Đã xóa khỏi danh sách yêu thích".

### [Mua sắm] Trang Danh sách Yêu thích (`src/app/wishlist/page.tsx`)
- **Hành động: Thêm vào giỏ hàng (`handleAddToCart`)**
  - **Hiện tại:** Chỉ gọi `refreshCartCount()`, thiếu phản hồi trực quan.
  - **Đề xuất:** Thêm `toast.success("Đã chuyển sản phẩm vào giỏ hàng")`.

### [Tài khoản] Chi tiết Đơn hàng (`src/app/account/orders/[orderId]/page.tsx`)
- **Hành động: Hủy đơn hàng (`handleCancelOrder`)**
  - **Hiện tại:** Đang là placeholder chuyển hướng trang.
  - **Đề xuất:** Khi kết nối API thật, cần có `toast.loading` trong khi chờ và `toast.success` khi hủy thành công.

---

## 2. Các khu vực đã đồng bộ tốt (Tham khảo)

Dưới đây là các khu vực đã sử dụng `toast` đúng chuẩn, có thể dùng làm mẫu để áp dụng cho các phần trên:

- **src/features/shop/components/product-detail/ProductDetailPage.tsx**: Đã có toast cho cả "Thêm vào giỏ" và "Yêu thích".
- **src/features/shop/components/product-detail/ProductAiSuggestionCard.tsx**: Đã có toast cho "Thêm vào giỏ".
- **src/features/account/components/AddressList.tsx**: Đã có toast cho xóa và đặt mặc định.
- **src/features/account/components/ProfileInfo.tsx**: Đã có toast cho upload ảnh đại diện.
- **src/features/admin/components/categories/AdminCategoryUpsertModal.tsx**: Đã có toast cho lưu danh mục và sinh nội dung AI.

---

## 3. Ghi chú chung về trải nghiệm người dùng (UX)

- **Trạng thái Loading:** Đối với các tác vụ mất thời gian (API call), nên sử dụng `toast.loading` hoặc disable nút bấm có kèm spinner.
- **Thông báo lỗi chi tiết:** Thay vì "Có lỗi xảy ra", nên hiển thị lỗi từ backend nếu có (ví dụ: "Sản phẩm đã hết hàng").
- **Vị trí Toast:** Đảm bảo `Toaster` được cấu hình ở level cao nhất (Layout) để không bị che khuất bởi Modal hoặc Drawer.

---
*Báo cáo được thực hiện bởi Antigravity AI.*
