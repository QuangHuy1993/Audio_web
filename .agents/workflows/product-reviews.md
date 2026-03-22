# Workflow: Đánh giá sản phẩm (Product Reviews)

Hướng dẫn quy trình triển khai tính năng đánh giá cho người dùng sau khi mua hàng thành công.

## 1. Điều kiện đánh giá
- Người dùng chỉ được đánh giá sản phẩm khi:
    - Đã mua sản phẩm đó.
    - Đơn hàng chứa sản phẩm đó có trạng thái là `COMPLETED`.
- Mỗi lần mua (mỗi Order) tương ứng với 1 lần đánh giá sản phẩm đó để đảm bảo tính khách quan.

## 2. Quy trình Backend (API)

### API Tạo đánh giá (`POST /api/shop/reviews`)
- **Input**: `productId`, `orderId`, `rating` (1-5), `comment`.
- **Validation**:
    - Kiểm tra `orderId` thuộc về `userId` hiện tại.
    - Kiểm tra `order.status === 'COMPLETED'`.
    - Kiểm tra `productId` có nằm trong `order.items`.
    - Kiểm tra xem user đã đánh giá cho sản phẩm này cho đơn hàng này chưa (tránh spam).
- **Action**: Tạo record trong table `Review`.

### API Quản lý đánh giá (CRUD)
- `PATCH /api/shop/reviews/[id]`: Chỉnh sửa nội dung hoặc số sao (chỉ chủ sở hữu).
- `DELETE /api/shop/reviews/[id]`: Xóa đánh giá (chủ sở hữu hoặc Admin).
- `GET /api/shop/products/[slug]/reviews`: Lấy danh sách đánh giá của sản phẩm (hỗ trợ phân trang, lọc theo số sao).

## 3. Quy trình Frontend (UI/UX)

### Tại trang Lịch sử đơn hàng (`/account/orders`)
- Hiển thị nút **"Đánh giá sản phẩm"** bên cạnh các sản phẩm trong đơn hàng có trạng thái `COMPLETED`.
- Khi nhấn, mở Modal/Form đánh giá.

### Tại trang Chi tiết sản phẩm (`/product/[slug]`)
- Hiển thị tổng số đánh giá và điểm trung bình (Ví dụ: 4.8/5 ⭐).
- Hiển thị danh sách các bình luận bên dưới.
- Đánh dấu các review là **"Đã mua hàng"** (Verified Purchase) nếu có `orderId`.

## 4. Cấu trúc Schema đề xuất (Cần cập nhật)
```prisma
model Review {
  id        String   @id @default(cuid())
  userId    String
  productId String
  orderId   String?  // Thêm trường này để verify
  rating    Int
  comment   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  product   Product  @relation(fields: [productId], references: [id])
  user      User     @relation(fields: [userId], references: [id])
  order     Order?   @relation(fields: [orderId], references: [id])
}
```
