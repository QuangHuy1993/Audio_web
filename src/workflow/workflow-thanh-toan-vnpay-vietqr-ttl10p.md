# Workflow: Thanh toán VNPAY + VietQR với TTL 10 phút (không tạo Order trước)

Tài liệu này mô tả workflow thanh toán online theo nguyên tắc:

- Không tạo `Order` “thật” trước khi thanh toán thành công (tránh kẹt trừ kho / coupon / clear cart).
- Tạo thực thể trung gian `CheckoutSession`/`PaymentAttempt` có TTL 10 phút.
- Chỉ khi nhận **kết quả thanh toán hợp lệ** (VNPAY IPN/callback server-to-server, hoặc xác nhận VietQR) thì mới **commit**:
  - Tạo `Order`, `OrderItem`
  - Trừ kho
  - Chuyển `Cart` → `CONVERTED` (và clear items)
  - Tăng `coupon.usedCount`

> Ghi chú: Code hiện tại đang tạo `Order` + trừ kho + clear cart ngay trong `createOrder()` cho cả `"VNPAY"`. Workflow này đề xuất thay đổi kiến trúc để hỗ trợ thanh toán online đúng chuẩn và dễ mở rộng.

---

## 1) Mục tiêu và yêu cầu

### 1.1. Mục tiêu nghiệp vụ

- Cho phép người dùng chọn thanh toán **VNPAY** hoặc **VietQR**.
- Khi người dùng redirect sang trang VNPAY rồi **đóng tab/tắt web**, hệ thống vẫn xử lý đúng:
  - Nếu VNPAY báo thanh toán thành công qua **IPN**, đơn sẽ được commit.
  - Nếu không có IPN và quá 10 phút, phiên thanh toán hết hạn và không tạo đơn.
- Cho phép người dùng **tiếp tục thanh toán trong vòng 10 phút**:
  - Có API để “resume” (lấy URL thanh toán lại).
  - UI có thể nhắc “Bạn có một thanh toán đang dang dở”.

### 1.2. Non-functional

- **Idempotency**: IPN/return có thể gọi nhiều lần, phải commit một lần.
- **Chống double-click**: user bấm “Thanh toán” nhiều lần chỉ tạo 1 phiên active.
- **Không giữ hàng bằng cách trừ kho thật** trước khi thanh toán (trừ khi có cơ chế reservation riêng).
- **Audit/logging**: lưu raw payload từ provider để debug tranh chấp.

---

## 2) Định nghĩa thực thể trung gian: `CheckoutSession`

### 2.1. Model đề xuất (Prisma)

Tạo model mới (tên có thể đổi) để lưu “phiên thanh toán”.

```prisma
enum CheckoutProvider {
  VNPAY
  VIETQR
}

enum CheckoutStatus {
  PENDING     // mới tạo, đang chờ thanh toán / xác nhận
  SUCCEEDED   // đã thanh toán thành công (đã commit order)
  FAILED      // thanh toán thất bại
  EXPIRED     // quá TTL 10 phút, không còn cho tiếp tục
  CANCELLED   // user chủ động huỷ (nếu có)
}

model CheckoutSession {
  id          String          @id @default(cuid())
  userId      String
  provider    CheckoutProvider
  status      CheckoutStatus  @default(PENDING)

  // TTL
  expiresAt   DateTime

  // Giá trị thanh toán (snapshot)
  amount      Decimal         @db.Decimal(12,2)
  currency    String          @default("VND")

  // Snapshot checkout để commit về sau (tránh lệ thuộc cart thay đổi)
  cartSnapshot     Json
  shippingSnapshot Json
  couponSnapshot   Json?
  note             String?

  // Provider refs
  providerRef     String?   @unique // VNPAY: vnp_TxnRef
  paymentUrl      String?   // VNPAY: URL redirect đã tạo

  // Kết quả thanh toán (audit)
  providerPayload Json?     // raw IPN/return payload
  providerCode    String?   // vnp_ResponseCode, vnp_TransactionStatus, ...

  // Mapping tới order sau khi commit
  orderId     String?       @unique

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  order       Order?        @relation(fields: [orderId], references: [id])

  @@index([userId, status, expiresAt])
  @@index([provider, status, createdAt])
}
```

### 2.2. Snapshot nên chứa gì?

- **cartSnapshot**:
  - items: `{ productId, quantity, unitPriceSnapshot, productNameSnapshot, imageUrlSnapshot? }`
  - subtotal
  - tổng quantity, tổng weight (nếu dùng GHN)
- **shippingSnapshot**:
  - address (fullName/phone/line1/ward/district/province + GHN district/ward code nếu có)
  - shipping service type id (GHN 2/5)
  - shipping fee đã tính
- **couponSnapshot**:
  - mã coupon dùng, loại, số tiền giảm áp dụng, ids (nếu cần)

> Nguyên tắc: snapshot đủ để tạo `Order` về sau mà **không cần** đọc cart hiện tại.

---

## 3) State machine (CheckoutSession)

### 3.1. Trạng thái chính

```
PENDING  --(paid ok)-->  SUCCEEDED
PENDING  --(provider fail / user cancel)--> FAILED / CANCELLED
PENDING  --(now > expiresAt)--> EXPIRED
```

### 3.2. Quy tắc TTL 10 phút

- Khi tạo session: `expiresAt = now + 10 phút`.
- Khi user “resume” trong TTL:
  - Không gia hạn TTL (khuyến nghị) để hạn chế giữ phiên quá lâu.
  - Có thể regenerate paymentUrl (tuỳ VNPAY policy), nhưng `expiresAt` giữ nguyên.
- Khi hết TTL:
  - Chuyển `status = EXPIRED`.
  - Không tạo/không huỷ `Order` vì **chưa có order**.

---

## 4) API đề xuất

### 4.1. Tạo session và bắt đầu thanh toán

**POST `/api/shop/payments/sessions`**

- Input: tương tự `CreateOrderRequestDto` nhưng mục tiêu là tạo `CheckoutSession`.
  - shippingAddress, paymentMethod (`VNPAY` | `QR_TRANSFER`), shippingServiceTypeId, coupon codes, note.
- Output:
  - `sessionId`, `provider`, `expiresAt`
  - nếu VNPAY: `paymentUrl`
  - nếu VietQR: `qrImageUrl` (hoặc token để fetch QR), `expiresAt`

**Logic server (pseudocode):**

1. Auth required.
2. Dùng `pg_advisory_xact_lock(hashtext(userId))` để chặn double-click concurrent.
3. Kiểm tra có session `PENDING` còn hạn cho user/provider không:
   - Nếu có: trả session đó (hoặc tạo mới theo policy).
4. Tải cart, validate stock/product ACTIVE.
5. Tính phí ship + discount (như createOrder hiện tại) nhưng **chưa trừ kho, chưa update coupon.usedCount, chưa clear cart**.
6. Tạo `CheckoutSession` với snapshot + `expiresAt`.
7. Nếu provider VNPAY:
   - Sinh `providerRef` (vnp_TxnRef) unique gắn với sessionId/orderNumber-like.
   - Gọi hàm build VNPAY redirect URL (kèm chữ ký).
   - Lưu `paymentUrl`.
8. Return response cho client.

### 4.2. Lấy session pending để “nhắc tiếp tục”

**GET `/api/shop/payments/pending`**

- Auth required.
- Trả về session `PENDING` gần nhất có `expiresAt > now`.
- Output: `sessionId`, `provider`, `expiresAt`, `paymentUrl` (nếu VNPAY), `qrImageUrl` (nếu VietQR) + các summary cần cho UI.

### 4.3. Resume session

**POST `/api/shop/payments/sessions/:id/resume`**

- Auth required và session phải thuộc user.
- Validate:
  - status = PENDING
  - `expiresAt > now`
- Nếu VNPAY:
  - Nếu `paymentUrl` còn hợp lệ thì trả lại.
  - Hoặc regenerate URL và update `paymentUrl` (không đổi `providerRef` nếu VNPAY yêu cầu stable ref; nếu đổi ref thì phải đảm bảo mapping lại).
- Nếu VietQR:
  - Trả lại `qrImageUrl`/info.

### 4.4. VNPAY return URL (front-channel)

**GET `/api/payments/vnpay/return`** (hoặc route page `/checkout/return/vnpay`)

- Đây là đường user được redirect về, **không đảm bảo** xảy ra.
- Mục tiêu:
  - Hiển thị UI “Đang xác nhận thanh toán…”
  - Gọi API `GET /api/shop/payments/sessions/:id` hoặc poll để xem session đã `SUCCEEDED` chưa.
- Không dùng return URL làm nguồn xác nhận cuối cùng.

### 4.5. VNPAY IPN (server-to-server)

**GET/POST `/api/payments/vnpay/ipn`** (tuỳ VNPAY spec)

**Quy tắc xử lý:**

1. Verify chữ ký (HMAC) và validate dữ liệu bắt buộc.
2. Parse `vnp_TxnRef` để tìm `CheckoutSession` theo `providerRef`.
3. Kiểm tra:
   - session tồn tại
   - status hiện tại
   - amount khớp (chống spoof)
   - chưa hết hạn (nếu hết hạn mà VNPAY báo paid vẫn cần policy: thường vẫn commit nếu paid thật; nhưng cần rõ ràng)
4. Idempotency:
   - Nếu session đã `SUCCEEDED` → trả `OK` ngay.
5. Nếu thanh toán thành công:
   - Gọi `commitOrderFromSession(sessionId)` trong 1 transaction:
     - lock theo userId (advisory lock)
     - recheck stock (vì giữa lúc chờ, stock có thể thay đổi)
     - tạo `Order`, `OrderItem`
     - trừ kho
     - update `coupon.usedCount`
     - clear cart + set cart CONVERTED (nếu policy: chỉ clear nếu cart vẫn match snapshot; nếu cart đã đổi thì vẫn commit theo snapshot và giữ cart? cần quyết định)
     - set session `SUCCEEDED`, set `orderId`, store payload
6. Nếu thanh toán fail/cancel:
   - set session `FAILED` (hoặc `CANCELLED`) + store payload.

---

## 5) Hàm commit: `commitOrderFromSession(sessionId)`

### 5.1. Mục tiêu

- Dùng snapshot trong `CheckoutSession` để tạo order 1 lần duy nhất.
- Chống race-condition + đảm bảo toàn vẹn.

### 5.2. Transaction outline

Trong 1 `prisma.$transaction`:

1. `SELECT ... FOR UPDATE` session row (hoặc update with where status=PENDING).
2. Nếu `status != PENDING` → return (idempotent).
3. Validate snapshot:
   - items non-empty, amount > 0, address ok
4. Recheck stock:
   - Nếu thiếu stock: set session `FAILED` (reason: out_of_stock) và return.
5. Create `Order`:
   - `status = PENDING` (hoặc `PAID` nếu đã chắc chắn paid)
   - `paymentStatus = PAID` nếu IPN success
   - `paymentProvider = "VNPAY"` / `"QR_TRANSFER"`
   - `paymentIntentId` = `vnp_TransactionNo` (nếu có) / bank ref (nếu có)
6. Create `OrderItem` từ snapshot.
7. Trừ kho (`InventoryLog` source `ORDER_PLACED`).
8. Update coupons:
   - chỉ increment `usedCount` tại đây (commit-time).
9. Cart handling:
   - Option A (đơn giản): clear cart và set CONVERTED.
   - Option B (an toàn hơn): chỉ clear nếu cart vẫn giống snapshot; nếu cart đã thay đổi, không clear (để tránh “mất” giỏ của user). Khi đó cần UI thông báo.
10. Update session:
   - `status = SUCCEEDED`
   - `orderId = createdOrder.id`
   - store payload + provider code

---

## 6) Workflow UI (Shop)

### 6.1. Khi user bấm “Thanh toán VNPAY”

1. `POST /api/shop/payments/sessions` (provider=VNPAY)
2. Server trả `paymentUrl` + `expiresAt`.
3. UI redirect `window.location.href = paymentUrl`.

### 6.2. User đóng tab khi đang ở VNPAY

- Không có return URL, nhưng IPN vẫn có thể commit.
- Khi user quay lại website (trong 10 phút):
  - `GET /api/shop/payments/pending` → thấy session `PENDING` còn hạn.
  - UI hiển thị banner “Bạn có thanh toán đang dang dở…”
  - “Tiếp tục” → redirect `paymentUrl` hoặc `resume`.

### 6.3. Trang “Return/Result”

- Khi VNPAY redirect về return URL:
  - UI hiển thị “Đang xác nhận thanh toán…”
  - Poll session status mỗi 1-2s trong tối đa 15-20s:
    - nếu `SUCCEEDED` → chuyển `/checkout/success?orderId=...`
    - nếu `FAILED` → hiển thị thất bại + CTA “thử lại”
    - nếu `PENDING` → cho user “Quay lại” và hệ thống vẫn chờ IPN

---

## 7) Workflow VietQR (QR_TRANSFER) với TTL 10 phút

### 7.1. Tạo session VietQR

1. `POST /api/shop/payments/sessions` (provider=VIETQR)
2. Server tạo `CheckoutSession` + sinh `qrImageUrl` (nếu tích hợp generator) và trả về.
3. UI hiển thị QR + countdown theo `expiresAt`.

### 7.2. Xác nhận thanh toán VietQR

Có 2 hướng:

- **Manual admin verify**:
  - Admin vào trang quản trị, nhìn sao kê, chọn session → “Đánh dấu đã nhận tiền”.
  - Gọi API admin `POST /api/admin/payments/sessions/:id/mark-paid` → commit order.
- **Webhook/auto verify** (nâng cao):
  - Khi nhận webhook từ đối tác/bank, map về session bằng `transferNote`/ref → commit.

### 7.3. Hết hạn 10 phút

- UI đổi trạng thái “Phiên thanh toán đã hết hạn”.
- Session set `EXPIRED` (có thể lazy-update khi user refresh/resume, hoặc cron).

---

## 8) Expire session: cron vs lazy

### 8.1. Lazy expire (đơn giản)

- Mọi API đọc/resume/pending luôn check:
  - nếu `status=PENDING` và `expiresAt <= now` → update `EXPIRED`.

### 8.2. Cron expire (chuẩn hơn)

- Tạo cron (Vercel Cron / server cron) chạy mỗi 1-2 phút:
  - `updateMany where status=PENDING and expiresAt < now set status=EXPIRED`
- Không có rollback order/coupon/cart vì chưa commit.

---

## 9) Quy tắc chống double session / double pay

- Per-user lock khi tạo session (advisory lock).
- Policy khuyến nghị:
  - Mỗi user mỗi provider chỉ có tối đa 1 session `PENDING` chưa hết hạn.
  - Nếu user bấm lại, trả session cũ để resume.

---

## 10) Các quyết định quan trọng (cần chốt trước khi code)

### 10.1. Khi commit order có cần clear cart không?

- **Option A (đơn giản, nhất quán order)**: luôn clear cart.
  - Nhược: nếu user đã sửa cart trong lúc chờ thanh toán, có thể “mất” thay đổi.
- **Option B (thân thiện UX)**: chỉ clear nếu cart vẫn match snapshot.
  - Nhược: cần so sánh snapshot vs cart.

Khuyến nghị: **Option B** nếu bạn ưu tiên UX, Option A nếu ưu tiên đơn giản triển khai.

### 10.2. Nếu IPN tới sau khi session EXPIRED thì sao?

Khuyến nghị:
- Nếu VNPAY báo `paid ok` và chữ ký hợp lệ, **vẫn commit** (vì tiền đã thu) và set session `SUCCEEDED` (kèm flag “late_payment” trong metadata).
- Sau đó UI/CSKH xử lý bình thường.

---

## 11) Mapping sang code hiện tại

Hiện tại:
- `PaymentMethod` đã có `"VNPAY"` và `"QR_TRANSFER"` trong `src/types/order.ts`.
- `createOrder()` trong `src/services/order-service.ts` đang:
  - tạo order ngay
  - trừ kho
  - clear cart
  - tăng `coupon.usedCount`

Để áp dụng workflow mới:
- Tách logic:
  - `prepareCheckoutSession()` (validate cart, tính phí ship/coupon, snapshot)
  - `commitOrderFromSession()` (tạo order + trừ kho + clear cart + update coupon)
- Tạo API payment routes cho session + VNPAY IPN/return.

---

## 12) Checklist triển khai VNPAY (hiện tại)

- [x] Thêm enum `CheckoutProvider`, `CheckoutStatus` và model `CheckoutSession` trong `prisma/schema.prisma`.
- [x] Tạo DTO payment: `CreatePaymentSessionRequestDto`, `CreatePaymentSessionResponseDto`, `CheckoutSessionStatusDto` trong `src/types/payment.ts`.
- [x] Tạo `src/lib/vnpay.ts` với `buildVnpayUrl()` và `verifyVnpaySignature()` dùng HMAC-SHA512.
- [x] Tạo service `src/services/checkout-session-service.ts` với:
  - `prepareCheckoutSession()` – tạo `CheckoutSession` cho VNPAY từ cart hiện tại (không tạo Order).
  - `commitOrderFromSession()` – dùng snapshot để tạo `Order` + `OrderItem`, trừ kho, clear cart, update coupon.
- [x] Tạo API:
  - `POST /api/shop/payments/sessions` – khởi tạo phiên VNPAY.
  - `GET /api/shop/payments/sessions/:id` – lấy trạng thái phiên.
  - `GET /api/shop/payments/pending` – lấy phiên `PENDING` còn hiệu lực gần nhất.
  - `GET /api/payments/vnpay/ipn` – IPN handler, xác minh chữ ký, gọi `commitOrderFromSession`.
  - `GET /api/payments/vnpay/return` – redirect sang trang `/checkout/processing`.
- [x] Tạo trang xử lý trung gian:
  - `src/app/checkout/processing/page.tsx` – poll trạng thái phiên và điều hướng sang `/checkout/success`.
  - `src/app/checkout/processing/page.module.css` – UI trạng thái “Đang xử lý thanh toán”.
- [x] Cập nhật `CheckoutPage.tsx`:
  - Khi chọn `paymentMethod = "VNPAY"` → gọi `POST /api/shop/payments/sessions`, nhận `paymentUrl` + `sessionId`, redirect sang VNPAY (kèm `sessionId`).
  - Giữ nguyên luồng cũ cho COD và các phương thức khác.
- [ ] Bổ sung UI “nhắc tiếp tục thanh toán” (sử dụng `GET /api/shop/payments/pending`) trên trang shop (ví dụ khi user quay lại `checkout` hoặc `home`).
- [ ] Thiết kế và triển khai workflow VietQR (QR_TRANSFER) dựa trên cùng `CheckoutSession` (tích hợp sau với Sepay).

