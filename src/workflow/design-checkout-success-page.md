# Thiết kế UI: Trang cảm ơn (Final Receipt) (`/checkout/success`)

Tài liệu này mô tả **thiết kế giao diện cực chi tiết** cho trang “Cảm ơn bạn đã đặt hàng” của **Đức Uy Audio**. Đây là **trang cuối cùng (final)** sau khi tạo đơn: luôn đóng vai trò **receipt** (biên nhận) và **không tách sang các trang thanh toán riêng** (VNPAY/QR sẽ tính sau).

Theo lựa chọn **B**, user **luôn** được chuyển tới trang này ngay sau khi `POST /api/shop/orders` thành công, dù `paymentStatus` vẫn còn `PENDING`.

Mục tiêu: sau khi `POST /api/shop/orders` thành công, client redirect về:

```
/checkout/success?orderId=<id>
```

Trang này là “receipt/order confirmation page”: xác nhận đơn đã được tạo, hiển thị biên nhận và chỉ đưa **hướng dẫn ngắn gọn** theo phương thức thanh toán (không biến trang thành flow thanh toán).

---

## 1) Bối cảnh mã nguồn hiện tại (để đồng bộ thiết kế)

### 1.1 Luồng redirect hiện tại

- Ở `CheckoutPage.tsx`, sau khi tạo đơn thành công:
  - Nếu response có `orderId` → `router.push(/checkout/success?orderId=...)`
  - Nếu không có `orderId` → `router.push(/checkout/success)`

### 1.2 Dữ liệu Order hiện có trong DB (Prisma)

Trong `prisma/schema.prisma`, `Order` có các nhóm trường quan trọng cho trang success:

- **Định danh**: `id`, `orderNumber`, `createdAt`
- **Trạng thái**:
  - `status`: `PENDING | PAID | FAILED | CANCELLED | SHIPPED | COMPLETED`
  - `paymentStatus`: `PENDING | PAID | REFUNDED`
  - `paymentProvider`: string (thực tế đang dùng `"COD" | "VNPAY" | "QR_TRANSFER"`)
- **Giá trị**:
  - `totalAmount`
  - `shippingFee`
  - `couponDiscount` (đang lưu tổng tiết kiệm)
  - `shippingCouponDiscount` (giảm phí ship, nếu có)
- **Thanh toán VietQR**:
  - `qrImageUrl`
  - `qrExpiresAt`

### 1.3 CSS đã có sẵn

Repo đã có file style cho route này:

- `src/app/checkout/success/page.module.css`

Thiết kế dưới đây **bám theo** cấu trúc BEM trong file CSS này (block: `checkout-success-page-*`) để khi implement, có thể tận dụng tối đa.

---

## 2) Nguyên tắc UX của trang cảm ơn (final)

- **Xác nhận rõ ràng**: headline xác nhận + số đơn hàng + trạng thái thanh toán.
- **Final = receipt**: mọi nội dung phải “kết sổ” đơn hàng (tổng tiền, items, địa chỉ, trạng thái).
- **Nhắc việc cần làm tiếp theo (nhẹ, không dồn dập)**:
  - COD: nhắc thanh toán khi nhận hàng.
  - VNPAY/QR_TRANSFER: nếu còn `PENDING` thì chỉ hiển thị “đang chờ xác nhận thanh toán” + gợi ý “xem trạng thái trong mục đơn hàng” (sau này), không hiển thị QR hay nút “tôi đã chuyển khoản” ở trang final.
- **Thông tin trọng yếu luôn thấy** (above the fold trên mobile):
  - Trạng thái + orderNumber + tổng thanh toán
  - CTA phù hợp (tiếp tục mua, xem đơn, liên hệ hỗ trợ)
- **Receipt-like**: breakdown giá (tạm tính, giảm giá, giảm ship, phí ship sau giảm, tổng).
- **Hỗ trợ 3 payment modes** (theo hệ thống hiện tại):
  - COD
  - VNPAY
  - QR_TRANSFER (VietQR)

---

## 3) Kiến trúc trang (layout)

### 3.1 Skeleton layout

**Desktop / tablet**: 2 cột.

- **Cột trái (main)**:
  - Hero card: Cảm ơn + trạng thái + chips meta
  - Card: Danh sách sản phẩm
  - Card: Địa chỉ giao hàng
- 1 card “Thông tin thanh toán” (ngắn gọn, final; không QR/không retry flow)
- **Cột phải (aside)**:
  - Receipt summary: breakdown + tổng
  - CTA stack
  - Trust/support box

**Mobile**: 1 cột, ưu tiên:
1) Hero
2) Receipt summary
3) Thông tin thanh toán (ngắn gọn)
4) Items
5) Address

### 3.2 Thành phần UI (component map)

> Đây là mapping “thiết kế → component” để sau này implement dễ.

- `SuccessHeroCard`
  - Title, subtitle
  - Order number + copy
  - Status chip(s)
  - CTA row (continue shopping, view order)
- `PaymentInfoCard` (final, ngắn gọn)
  - COD: “Thanh toán khi nhận hàng” + ghi chú.
  - VNPAY: “Thanh toán VNPAY” + trạng thái hiện tại (PENDING/PAID/FAILED) và hướng dẫn mềm.
  - QR_TRANSFER: “Chuyển khoản VietQR” + trạng thái hiện tại (PENDING/PAID) và hướng dẫn mềm.
- `OrderItemsCard`
  - List items (thumb, name, qty, unitPrice, line subtotal)
- `ShippingAddressCard`
  - fullName, phone, address lines, district/province
- `ReceiptSummaryCard`
  - Tạm tính
  - Giảm giá
  - Giảm phí ship (nếu có)
  - Phí ship (gạch giá gốc nếu có giảm)
  - Tổng thanh toán
- `SupportCard`
  - Hotline, Zalo, giờ làm việc, link support

---

## 4) Dữ liệu cần hiển thị (data contract)

### 4.1 Query param

- `orderId?: string` từ URL.
  - Nếu không có `orderId`: hiển thị state “Không tìm thấy đơn hàng” + CTA về trang `/products` và `/checkout` (hoặc `/cart`).

### 4.2 API đề xuất để load chi tiết đơn (sẽ implement sau)

Để trang success hiển thị đúng, cần API:

```
GET /api/shop/orders/[orderId]
```

Response đề xuất (khớp với schema & nhu cầu UI):

- `orderId`, `orderNumber`, `createdAt`
- `status`, `paymentStatus`, `paymentProvider`
- `subtotal` (hoặc derive từ items), `discountAmount`, `shippingDiscount`, `shippingFeeOriginal`, `shippingFeeFinal`, `totalAmount`
- `items[]`: `productName`, `productImageUrl`, `quantity`, `unitPrice`, `subtotalItem`
- `shippingAddress`: `fullName`, `phone`, `line1`, `ward`, `district`, `province`
- `vietQr`: `qrImageUrl`, `qrExpiresAt`, `transferNote` (nếu có)

Ghi chú:
- Hiện tại backend mới có `POST /api/shop/orders`. Chưa có route `GET /orders/[id]` trong `src/app/api/shop`.

---

## 5) Hero card (card đầu trang)

### 5.1 Nội dung

- **Icon trạng thái** (tuỳ status):
  - Success: check circle (green)
  - Pending: hourglass/spinner (primary)
  - Failed/cancelled: warning/error (red)
- **Title (H1)** (final, không gây áp lực):
  - Mặc định: `Cảm ơn bạn đã đặt hàng`
  - Nếu `paymentStatus = PAID`: thêm dòng phụ “Thanh toán đã được xác nhận.”
  - Nếu `paymentStatus = PENDING`: thêm dòng phụ “Đơn hàng đang chờ xác nhận thanh toán.”
- **Subtitle**:
  - `Cảm ơn bạn đã tin tưởng Đức Uy Audio.`
- **Chips meta** (dạng pill):
  - `Mã đơn: <orderNumber>` + nút Copy
  - `Thanh toán: <COD|VNPAY|VietQR>`
  - `Trạng thái: <PENDING|PAID|...>`
  - `Ngày đặt: <dd/mm/yyyy hh:mm>`

### 5.2 Trạng thái hiển thị theo `paymentProvider` và `paymentStatus`

| paymentProvider | paymentStatus | Hero tone | Copy guideline |
|---|---|---|---|
| COD | PENDING | calm-success | “Đơn hàng đã ghi nhận. Bạn thanh toán khi nhận hàng.” |
| VNPAY | PAID | strong-success | “Thanh toán thành công. Đơn hàng đang được xử lý.” |
| VNPAY | PENDING | neutral | “Đang chờ xác nhận thanh toán.” |
| VNPAY | FAILED | error | “Thanh toán thất bại. Bạn có thể thử lại hoặc đổi phương thức.” |
| QR_TRANSFER | PENDING | neutral | “Đơn hàng đang chờ xác nhận thanh toán.” |
| QR_TRANSFER | PAID | strong-success | “Đã nhận thanh toán. Đơn đang xử lý.” |

---

## 6) Payment info card (final, không phải trang thanh toán)

### 6.1 COD (Thanh toán khi nhận hàng)

**Mục tiêu**: trấn an + hướng dẫn.

- Title: `Thanh toán khi nhận hàng`
- Nội dung:
  - Bullet 1: `Vui lòng chuẩn bị số tiền đúng để thanh toán cho nhân viên giao hàng.`
  - Bullet 2: `Bạn có thể kiểm tra sản phẩm trước khi thanh toán.`
  - Bullet 3: `Nếu cần hỗ trợ đổi giờ nhận hàng, liên hệ Đức Uy Audio.`
- CTA đề xuất:
  - Primary: `Tiếp tục mua sắm` → `/products`
  - Secondary: `Liên hệ hỗ trợ` → `/support`

### 6.2 VNPAY (final)

**2 case:**

1) `paymentStatus = PAID`:
- Title: `Thanh toán VNPAY thành công`
- Nội dung: “Đơn hàng đang được chuẩn bị…”
- CTA: `Tiếp tục mua sắm`

2) `paymentStatus = FAILED` hoặc `PENDING`:
- Title: `Thanh toán VNPAY đang chờ xác nhận`
- Nội dung (final, không retry flow):
  - “Nếu bạn đã thanh toán, hệ thống sẽ tự cập nhật khi nhận xác nhận.”
  - “Nếu chưa thanh toán, bạn có thể liên hệ Đức Uy Audio để được hỗ trợ.”
- CTA:
  - Primary: `Liên hệ hỗ trợ` → `/support`

### 6.3 Chuyển khoản VietQR (QR_TRANSFER, final)

**Mục tiêu**: final receipt, chỉ thông báo trạng thái + gợi ý hỗ trợ. Không hiển thị QR/đếm ngược ở trang này.

- Title: `Chuyển khoản VietQR`
- Nếu `paymentStatus = PAID`:
  - “Đã nhận thanh toán. Đức Uy Audio đang xử lý đơn hàng.”
- Nếu `paymentStatus = PENDING`:
  - “Đơn hàng đang chờ xác nhận thanh toán.”
  - “Nếu bạn đã chuyển khoản, hệ thống sẽ tự cập nhật khi nhận xác nhận.”
  - “Nếu cần hỗ trợ, vui lòng liên hệ Đức Uy Audio.”
- CTA: `Liên hệ hỗ trợ` → `/support`

---

## 7) Receipt summary (tường minh giảm giá vs freeship)

Hiển thị breakdown theo “tường minh” (đã áp dụng trong checkout page):

- Tạm tính: `subtotal`
- Giảm giá: `discountAmount`
- Giảm phí vận chuyển: `shippingDiscount` (nếu > 0)
- Phí vận chuyển (GHN):
  - Nếu có `shippingDiscount`:
    - Giá gốc gạch: `shippingFeeOriginal`
    - Giá sau giảm: `shippingFeeFinal`
  - Nếu không: `shippingFeeOriginal`
- Tổng thanh toán: `totalAmount`

Ghi chú: `Order.couponDiscount` đang là tổng tiết kiệm; nên API GET nên trả tách bạch 2 phần để UI đúng.

---

## 8) Danh sách sản phẩm

Mỗi item:
- Thumbnail 56x56
- Tên (ellipsis)
- Meta row: `Số lượng`, `Đơn giá`
- Giá line: `subtotalItem` (hoặc `unitPrice * qty`)

Phần này nên cho phép:
- Link tới product detail (optional)

---

## 9) Địa chỉ giao hàng

Hiển thị:
- `Người nhận`: fullName + phone
- `Địa chỉ`: line1, ward (nếu có), district, province
- `Ghi chú`: nếu `metadata.note` tồn tại

---

## 10) Empty / error states

### 10.1 Không có orderId

Card:
- Title: `Không tìm thấy đơn hàng`
- Desc: “Vui lòng kiểm tra lại đường dẫn hoặc xem lịch sử đơn hàng.”
- CTA:
  - Primary: `Về trang sản phẩm` → `/products`
  - Secondary: `Quay lại giỏ hàng` → `/cart`

### 10.2 orderId không hợp lệ hoặc không thuộc user

Card:
- Title: `Bạn không có quyền xem đơn hàng này`
- CTA: `/products`, `/support`

### 10.3 Đang tải

Skeleton:
- Hero skeleton
- 2–3 card skeleton (items + summary)

---

## 11) CTA & điều hướng

CTA chuẩn:
- Primary: `Tiếp tục mua sắm` → `/products`
- Secondary: `Xem đơn hàng` → (sau này) `/account/orders/<orderId>`
- Tertiary: `Liên hệ hỗ trợ` → `/support`

---

## 12) Gợi ý tham khảo UX (research)

Các best-practices thường gặp cho trang receipt/thank-you:
- Headline xác nhận + order number (có copy)
- Breakdown giá rõ ràng
- ETA giao hàng (nếu có)
- Trang receipt tốt thường tránh nhồi “flow thanh toán” vào trang cảm ơn; chỉ hiển thị trạng thái, biên nhận và CTA hỗ trợ
- CTA tiếp tục mua sắm + hỗ trợ

Nguồn tham khảo chung:
- Baymard (receipt patterns)
- Các bài tổng hợp best-practices order confirmation pages

---

## 13) Checklist chi tiết để khi implement (tóm tắt)

- [ ] Route `src/app/checkout/success/page.tsx` (chưa có, mới có CSS)
- [ ] API `GET /api/shop/orders/[orderId]` để load đầy đủ
- [ ] UI final: tách theo paymentProvider & paymentStatus nhưng chỉ là “payment info” ngắn gọn
- [ ] Không hiển thị QR / countdown / retry flow trong trang final
- [ ] Receipt summary: tách `discountAmount` vs `shippingDiscount`, phí ship gạch giá khi có freeship
- [ ] Mobile-first: hero + payment instruction hiển thị trước

