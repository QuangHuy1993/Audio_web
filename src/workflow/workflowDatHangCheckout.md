# Workflow: Checkout / Dat hang / Xac nhan – Duc Uy Audio (Cap nhat: dia chi, van chuyen GHN, thanh toan, coupon)

Tai lieu thiet ke luong nghiep vu **dat hang** cho du an Audio AI Shop, bao gom:
tat ca buoc tu checkout, validate du lieu, kiem tra ton kho, tao don hang,
tru kho, xu ly thanh toan, xac nhan don, gui email, huy don va hoan kho.

---

## 1. Bo cuc Schema lien quan (tu prisma/schema.prisma)

### 1.1. Cac model chinh

```
model Order {
  id                String        @id @default(cuid())
  orderNumber       String        @unique              // VD: "DUA-20260227-XXXX"
  userId            String?
  status            OrderStatus   @default(PENDING)
  totalAmount       Decimal       @db.Decimal(12, 2)
  currency          String        @default("VND")

  paymentStatus     PaymentStatus @default(PENDING)
  paymentProvider   String?       // "COD" | "VNPAY" | "QR_TRANSFER"
  paymentIntentId   String?       // voi VNPAY: vnp_TransactionNo; voi QR: null

  couponId          String?
  couponDiscount    Decimal?      @db.Decimal(12, 2)
  shippingAddressId String?
  shippingFee       Decimal?      @db.Decimal(12, 2)
  shippingProvider  String?
  shippingService   String?

  metadata          Json?         // luu them: ip, user agent, note cua khach

  user              User?
  coupon            Coupon?
  shippingAddress   Address?
  items             OrderItem[]
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
}

enum OrderStatus {
  PENDING     // vua dat, chua xac nhan / chua thanh toan
  PAID        // da thanh toan (stripe/chuyen khoan) hoac ADMIN xac nhan COD
  FAILED      // thanh toan that bai
  CANCELLED   // da huy
  SHIPPED     // dang giao hang
  COMPLETED   // giao hang thanh cong
}

enum PaymentStatus {
  PENDING     // chua thanh toan
  PAID        // da thanh toan
  REFUNDED    // da hoan tien
}

model OrderItem {
  id          String   @id @default(cuid())
  orderId     String
  productId   String
  quantity    Int
  unitPrice   Decimal  @db.Decimal(12, 2)
  productName String   // snapshot ten san pham tai thoi diem dat
}

model Address {
  id          String
  userId      String?
  fullName    String
  phone       String
  line1       String
  line2       String?
  ward        String?
  district    String?
  province    String?
  country     String   @default("VN")
  postalCode  String?
  isDefault   Boolean  @default(false)
}

model InventoryLog {
  productId   String
  change      Int      // am = xuat kho, duong = nhap kho
  reason      String?
  source      String?  // "ORDER_PLACED" | "ORDER_CANCELLED" | ...
  referenceId String?  // orderId
}
```

### 1.2. Enum InventorySource da co trong inventory-service.ts

```typescript
export type InventorySource =
  | "ADMIN_CREATE_PRODUCT"
  | "ADMIN_STOCK_IMPORT"
  | "ADMIN_STOCK_ADJUST"
  | "ORDER_PLACED"      // tru kho khi dat hang
  | "ORDER_CANCELLED";  // hoan kho khi huy don
```

---

## 2. Tong quan luong Checkout (state machine)

```
[Gio hang] -> [Trang Checkout] -> [Nhap dia chi + phuong thuc TT]
     -> [Xac nhan don] -> POST /api/shop/orders
          -> [Validate] -> [Kiem tra ton kho] -> [Tao Order (PENDING)]
          -> [Tru kho] -> [Cart → CONVERTED] -> [Tang coupon.usedCount]
          -> [Gui email xac nhan]
          -> [Trang xac nhan don]
                |
                +-- [COD] -> status = PENDING -> Admin doi PAID -> SHIPPED -> COMPLETED
                +-- [Bank Transfer] -> status = PENDING -> Admin xac nhan chuyen khoan -> PAID -> SHIPPED -> COMPLETED
                +-- [Stripe] -> webhook PAID -> status = PAID -> SHIPPED -> COMPLETED
```

---

## 3. Buoc 1 – Trang Checkout (route: /checkout)

### 3.1. Dieu kien vao trang

- User phai dang nhap (session required).
- Gio hang phai co it nhat 1 san pham (redirect ve /cart neu trong).
- Neu trang thai session = "loading" → hien skeleton.
- Neu session = "unauthenticated" → redirect ve /login?callbackUrl=/checkout.

### 3.2. Du lieu trang can load

Khi mount trang, goi song song:
1. `GET /api/shop/cart` – lay gio hang hien tai.
2. `GET /api/shop/addresses` (can tao) – lay danh sach dia chi da luu cua user.

### 3.3. Cac section UI tren trang Checkout

```
[Header – ShopHeader]

[Checkout content]
  +-----------------------+  +-------------------+
  | THONG TIN GIAO HANG   |  | TOM TAT DON HANG  |
  | (Left / main column)  |  | (Right / sidebar) |
  |                       |  |                   |
  | Section A:            |  | Danh sach sp      |
  |   Chon dia chi cu     |  | Subtotal          |
  |   hoac nhap moi       |  | Giam gia (coupon) |
  |                       |  | Phi ship          |
  | Section B:            |  | Tong tien         |
  |   Phuong thuc TT      |  |                   |
  |   (COD / Bank / Stripe)|  | [Dat hang ngay]  |
  |                       |  +-------------------+
  | Section C:
  |   Ghi chu don hang
  +-----------------------+
```

### 3.4. Section A – Dia chi giao hang

**Truong hop user da co dia chi:**
- Hien danh sach dia chi da luu.
- Cho phep chon 1 dia chi (radio button).
- Co nut "Them dia chi moi" mo modal/expand form.

**Truong hop user chua co dia chi:**
- Hien thang form nhap moi.

**Cac truong bat buoc:**
```
fullName*      : string    (min 2 ky tu)
phone*         : string    (10-11 so, bat dau 0 hoac 84)
line1*         : string    (so nha, ten duong)
ward           : string    (phuong/xa – khong bat buoc nhung khuyen khich)
district*      : string    (quan/huyen)
province*      : string    (tinh/thanh pho)
```

**Validate o client (react-hook-form + zod):**
```typescript
const shippingSchema = z.object({
  fullName: z.string().min(2, "Ho ten toi thieu 2 ky tu"),
  phone: z.string().regex(/^(0|\+84)[0-9]{9,10}$/, "So dien thoai khong hop le"),
  line1: z.string().min(5, "Dia chi qua ngan"),
  district: z.string().min(1, "Vui long nhap quan/huyen"),
  province: z.string().min(1, "Vui long chon tinh/thanh pho"),
});
```

### 3.5. Section B – Phuong thuc thanh toan

Hien tai ho tro 3 phuong thuc:

| ID              | Hien thi UI              | Mo ta                                        |
|-----------------|--------------------------|----------------------------------------------|
| COD             | Thanh toan khi nhan hang | Shipper thu tien, sau do admin xac nhan      |
| BANK_TRANSFER   | Chuyen khoan ngan hang   | Hien so tai khoan, admin doi xac nhan        |
| STRIPE          | Thanh toan the (demo)    | Stripe Elements, webhook xu ly ket qua       |

Khi chon BANK_TRANSFER:
- Hien thong tin tai khoan sau khi chon (ten ngan hang, so TK, chu TK, noi dung CK).
- Noi dung chuyen khoan goi y: `DUA [ma don hang] [ten user]`.

Khi chon STRIPE (demo):
- Hien Stripe Card Element de nhap the.
- Khi submit, goi Stripe createPaymentMethod truoc, neu thanh cong moi goi API dat hang.

### 3.6. Section C – Ghi chu

- Textarea "Ghi chu cho don hang" (tuy chon, max 500 ky tu).
- VD: "Giao buoi chieu, goi toi truoc khi den".

### 3.7. Section OrderSummary (sidebar phai)

Hien thi:
- Danh sach san pham (anh nho, ten, so luong, gia).
- Subtotal (tong gia san pham).
- Coupon da ap dung tu trang gio hang (neu co) – hien thi ma va so tien giam.
- Phi giao hang.
- Tong thanh toan.
- Nut "Dat hang ngay" (submit).

**Luu y truyen coupon tu cart sang checkout:**
- Coupon da validate o trang /cart, luu vao localStorage hoac URL state.
- Trang checkout doc lai va hien thi; re-validate luc submit de dam bao van hop le.

---

## 4. Buoc 2 – Validate truoc khi goi API

### 4.1. Validate o client (truoc submit)

```typescript
// 1. Dia chi: chay zodResolver
// 2. Phuong thuc thanh toan: da chon
// 3. Stripe: neu chon Stripe, phai co paymentMethodId tu Stripe SDK
// 4. Gio hang: items.length > 0
```

### 4.2. Validate o server (API handler)

Khi nhan request `POST /api/shop/orders`, server phai kiem tra:

| STT | Dieu kien                         | Loi tra ve                                      |
|-----|-----------------------------------|-------------------------------------------------|
| 1   | session hop le, userId ton tai     | 401 Unauthorized                                |
| 2   | body du cac truong bat buoc        | 400 "Thieu truong X"                            |
| 3   | shippingAddress hop le             | 400 "Dia chi giao hang khong hop le"            |
| 4   | paymentMethod thuoc danh sach hop le | 400 "Phuong thuc thanh toan khong ho tro"     |
| 5   | gio hang ton tai va co san pham   | 400 "Gio hang trong hoac khong tim thay"        |
| 6   | couponCode (neu co) con hieu luc  | 400 "Ma giam gia het han hoac khong hop le"     |
| 7   | Tung san pham: stock >= quantity  | 400 "San pham X het hang hoac khong du so luong"|

---

## 5. Buoc 3 – API Dat hang

### 5.1. Route

```
POST /api/shop/orders
Authorization: session (next-auth)
```

### 5.2. Request DTO

```typescript
export type CreateOrderRequestDto = {
  shippingAddress: {
    // Neu dung dia chi da luu:
    addressId?: string;
    // Hoac dia chi moi (khi nhan dia chi moi thi server se tao Address moi):
    fullName?: string;
    phone?: string;
    line1?: string;
    line2?: string;
    ward?: string;
    district?: string;
    province?: string;
    postalCode?: string;
  };
  paymentMethod: "COD" | "VNPAY" | "QR_TRANSFER";
  couponCode?: string;            // ma giam gia (re-validate o server)
  note?: string;                  // ghi chu don hang
};
```

### 5.3. Response DTO (thanh cong)

```typescript
export type CreateOrderResponseDto = {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  // Chi co khi paymentMethod = "VNPAY":
  vnpayUrl?: string;
  // Chi co khi paymentMethod = "QR_TRANSFER":
  qrImageUrl?: string;
  qrExpiresAt?: string;   // ISO string
  bankInfo?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    transferNote: string; // VD: "DUA DUA-20260227-X3K9 Nguyen Van A"
  };
};
```

---

## 6. Buoc 4 – Xu ly dat hang trong Transaction

Day la phan kho nhat, phai dam bao toan ven du lieu bang Prisma transaction.

### 6.1. Chuoi thao tac trong 1 transaction

```
prisma.$transaction(async (tx) => {
  // --- A. Lay cart va validate ---
  1. Lay cart cua userId (includeItems + product.stock)
  2. Kiem tra cart.items.length > 0
  3. Kiem tra tung item: product.status === ACTIVE va product.stock >= item.quantity

  // --- B. Xu ly coupon (neu co) ---
  4. Neu co couponCode:
     a. Goi getActiveCouponByCode(code)     // kiem tra con hieu luc
     b. Kiem tra usageLimit vs usedCount    // kiem tra con luot
     c. Tinh discountAmount = computeCouponDiscount(coupon, subtotal, shippingFee)
     d. Neu khong hop le → throw Error("COUPON_INVALID")

  // --- C. Tinh toan gia tri don hang ---
  5. subtotal = sum(item.unitPrice * item.quantity)
  6. shippingFee = tinh theo quy tac (xem muc 7)
  7. couponDiscount = discountAmount tu buoc 4 (hoac 0)
  8. totalAmount = subtotal - couponDiscount + shippingFee

  // --- D. Xu ly dia chi giao hang ---
  9. Neu addressId co san → validate la cua userId
  10. Neu nhap moi → tao Address moi lien ket userId

  // --- E. Tao Order + OrderItems ---
  11. Tao orderNumber (xem muc 6.2)
  12. Tao Order voi status PENDING, paymentStatus PENDING
  13. Tao OrderItem cho tung item trong cart (snapshot productName, unitPrice, quantity)

  // --- F. Tru ton kho ---
  14. Goi adjustProductStockWithTx(tx, { productId, delta: -quantity, source: ORDER_PLACED, referenceId: orderId })
      cho tung san pham trong don

  // --- G. Cap nhat Cart ---
  15. Cart.status = CONVERTED (ghi dau gio hang da tao don)
  16. Xoa CartItems cua cart (hoac giu lai cho lich su - tuy chinh sach)

  // --- H. Cap nhat Coupon ---
  17. Neu co coupon: tang coupon.usedCount += 1 (UPDATE trong cung transaction)

  // --- I. Xu ly thanh toan ---
  // COD/BANK_TRANSFER: khong lam gi them, order.status = PENDING
  // STRIPE: goi stripe.paymentIntents.create, luu paymentIntentId vao Order
  //         (Stripe webhook sau do se cap nhat paymentStatus)

  return { orderId, orderNumber, totalAmount, ... }
})
```

### 6.2. Tao orderNumber

Format: `DUA-YYYYMMDD-[4 ky tu random in hoa]`

```typescript
function generateOrderNumber(createdAt: Date): string {
  const date = createdAt.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `DUA-${date}-${suffix}`;
}
// VD: "DUA-20260227-X3K9"
```

De tranh trung lap: sau khi tao, check `prisma.order.findUnique({ where: { orderNumber } })`.
Neu trung (xac suat rat thap) → sinh lai. Neu van trung 3 lan → throw Error.

### 6.3. Tinh phi giao hang

Logic hien tai trang gio hang:
- `freeShippingThreshold = 500,000 VND`
- `shippingBaseFee = 30,000 VND`
- Neu `subtotal >= 500,000` → `shippingFee = 0` (mien phi ship)
- Nguoc lai → `shippingFee = 30,000`

**Server phai tinh lai doc lap** (khong tin vao client truyen len) theo cung logic.

### 6.4. Xu ly loi trong transaction

| Loi throw                   | HTTP code | Thong bao hien thi                             |
|-----------------------------|-----------|------------------------------------------------|
| CART_EMPTY                  | 400       | "Gio hang trong, vui long them san pham."      |
| PRODUCT_NOT_FOUND           | 400       | "San pham X khong con ton tai."                |
| PRODUCT_INACTIVE            | 400       | "San pham X hien khong ban."                   |
| INSUFFICIENT_STOCK          | 400       | "San pham X chi con Y chiec, ban yeu cau Z."   |
| COUPON_INVALID              | 400       | "Ma giam gia het han hoac khong con hop le."   |
| COUPON_USAGE_EXCEEDED       | 400       | "Ma giam gia da het luot su dung."             |
| ADDRESS_NOT_FOUND           | 400       | "Dia chi giao hang khong tim thay."            |
| STRIPE_ERROR                | 402       | "Thanh toan that bai: [stripe.error.message]." |
| Loi ngoai y muon (DB, ...)  | 500       | "He thong loi, vui long thu lai."              |

---

## 7. Buoc 5 – Trang xac nhan don hang (route: /checkout/success)

### 7.1. URL

```
/checkout/success?orderId=xxx
```

### 7.2. API lay thong tin don

```
GET /api/shop/orders/[orderId]
```

Tra ve:
- `orderNumber`, `status`, `paymentStatus`
- `totalAmount`, `shippingFee`, `couponDiscount`
- `items[]: { productName, quantity, unitPrice }`
- `shippingAddress: { fullName, phone, line1, district, province }`
- `paymentProvider`
- `createdAt`

### 7.3. Noi dung hien thi

- Bieu tuong thanh cong va thong bao "Dat hang thanh cong!".
- Ma don hang (orderNumber) ro rang, co nut copy.
- Tom tat cac san pham da dat.
- Dia chi giao hang.
- Phuong thuc thanh toan + huong dan (neu BANK_TRANSFER: hien so TK).
- Tong thanh toan.
- Nut "Tiep tuc mua sam" → /products.
- Nut "Xem don hang cua toi" → /account/orders (can tao sau).

---

## 8. Buoc 6 – Gui email xac nhan don hang

### 8.1. Thoi diem gui

Sau khi transaction dat hang thanh cong (buoc 6), goi khong dong bo (fire-and-forget):

```typescript
// Trong API handler, sau khi co orderId
sendOrderConfirmationEmail({
  toEmail: user.email,
  fullName: user.name ?? "Quy khach",
  orderNumber,
  items: orderItems,
  totalAmount,
  shippingAddress,
  paymentMethod,
}).catch((err) => console.error("[order-email] Failed:", err));
```

### 8.2. Noi dung email

```
Subject: "Xac nhan don hang #DUA-20260227-X3K9 – Duc Uy Audio"

- Loi cam on
- Ma don hang + link xem chi tiet
- Danh sach san pham (ten, so luong, gia)
- Tong tien
- Dia chi giao hang
- Huong dan thanh toan (neu BANK_TRANSFER)
- Luu y COD (neu COD)
- SLA giao hang uoc tinh
```

### 8.3. Function can them trong email-resend-service.ts

```typescript
type SendOrderConfirmationEmailParams = {
  toEmail: string;
  fullName: string;
  orderNumber: string;
  items: { productName: string; quantity: number; unitPrice: number }[];
  totalAmount: number;
  shippingFee: number;
  couponDiscount: number;
  shippingAddress: { fullName: string; phone: string; line1: string; district: string; province: string };
  paymentMethod: "COD" | "BANK_TRANSFER" | "STRIPE";
};

export async function sendOrderConfirmationEmail(
  params: SendOrderConfirmationEmailParams,
): Promise<void>
```

---

## 9. Trang thai don hang – State Machine

### 9.1. Chuyen doi trang thai (OrderStatus)

```
PENDING
  |-- [COD/BANK_TRANSFER] Admin xac nhan thanh toan --> PAID
  |-- [STRIPE] Webhook payment_intent.succeeded     --> PAID
  |-- [User huy - trong 24h] Huy don               --> CANCELLED
  |-- [Het han thanh toan BANK_TRANSFER - 48h]      --> CANCELLED
  |-- [Admin huy]                                   --> CANCELLED
  |-- [Stripe webhook failed]                       --> FAILED

PAID
  |-- Admin xac nhan giao hang                      --> SHIPPED
  |-- Admin huy (cho hoan tien)                     --> CANCELLED (can hoan tien thu cong)

SHIPPED
  |-- Admin xac nhan da giao                        --> COMPLETED
  |-- Khach bao khong nhan duoc (sau SLA)           --> xu ly thu cong

FAILED
  |-- Chi log, khong hoan kho (vi kho chua bi tru)

CANCELLED
  |-- Trang thai cuoi, khong chuyen tiep
```

### 9.2. Luu y quan trong

- Kho **chi bi tru** tai thoi diem `status = PENDING` (khi tao don).
- Neu don chuyen sang `CANCELLED` va kho da bi tru → **phai hoan kho**.
- Neu don `FAILED` (Stripe tu choi the) → kho **chua bi tru** → khong can hoan kho.
  (Vi trang thai FAILED chi xay ra khi Stripe tra loi that bai truoc khi tao order hoan chinh,
   hoac webhook bao that bai sau khi da tao order PENDING chua tru kho.)

---

## 10. Huy don hang

### 10.1. Quy tac huy

| Trang thai hien tai | Nguoi huy    | Dieu kien                        | Hoan kho? |
|---------------------|--------------|----------------------------------|-----------|
| PENDING             | User         | Trong vong 24 gio ke tu dat hang | Co        |
| PENDING             | Admin        | Bat ky luc nao                   | Co        |
| PAID                | Admin        | Truoc khi SHIPPED (cho hoan tien)| Co        |
| SHIPPED             | Admin        | Ngoai le, xu ly thu cong         | Thu cong  |
| COMPLETED           | Khong ai     | Khong duoc huy                   | Khong     |
| CANCELLED           | Khong ai     | Da huy roi                       | Khong     |
| FAILED              | Khong ai     | Khong can huy                    | Khong     |

### 10.2. Window huy danh cho user

- Cho phep huy trong `CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000` (24 gio).
- Kiem tra: `Date.now() - order.createdAt.getTime() <= CANCEL_WINDOW_MS`.
- Chi huy duoc khi `order.status === "PENDING"`.
- Hien thi countdown tren trang chi tiet don hang: "Con X gio Y phut de huy don".

### 10.3. API Huy don

```
PATCH /api/shop/orders/[orderId]/cancel
Authorization: session (user)
Body: { reason?: string }
```

**Luon xu ly trong 1 transaction:**

```
prisma.$transaction(async (tx) => {
  // 1. Lay order va kiem tra quyen
  const order = await tx.order.findUnique({ where: { id: orderId } })
  if (!order || order.userId !== userId) throw Error("FORBIDDEN")

  // 2. Kiem tra co the huy
  if (order.status !== "PENDING") throw Error("CANNOT_CANCEL: order not PENDING")
  const withinWindow = Date.now() - order.createdAt.getTime() <= CANCEL_WINDOW_MS
  if (!withinWindow) throw Error("CANNOT_CANCEL: cancel window expired")

  // 3. Cap nhat trang thai don
  await tx.order.update({
    where: { id: orderId },
    data: {
      status: "CANCELLED",
      metadata: { ...order.metadata, cancelledBy: "USER", cancelReason: reason }
    }
  })

  // 4. Hoan kho tung san pham (goi adjustProductStockWithTx)
  for (const item of order.items) {
    await adjustProductStockWithTx(tx, {
      productId: item.productId,
      delta: +item.quantity,
      reason: `Hoan kho don hang #${order.orderNumber} (khach huy)`,
      source: "ORDER_CANCELLED",
      referenceId: orderId
    })
  }

  // 5. Giam coupon.usedCount neu don co coupon
  if (order.couponId) {
    await tx.coupon.update({
      where: { id: order.couponId },
      data: { usedCount: { decrement: 1 } }
    })
  }
})
```

### 10.4. API Huy don phia Admin

```
PATCH /api/admin/orders/[orderId]/cancel
Authorization: ADMIN session
Body: { reason: string }
```

Logic tuong tu nhung:
- Khong kiem tra CANCEL_WINDOW.
- Co the huy ca don PAID (truoc khi SHIPPED).
- Ghi log voi `cancelledBy: "ADMIN"`.

---

## 11. Phuong thuc thanh toan – Chi tiet xu ly

### 11.1. COD (Thanh toan khi nhan hang)

```
User dat hang → tao Order:
  status = PENDING
  paymentStatus = PENDING
  paymentProvider = "COD"
  → tru kho ngay

Admin giao hang, thu tien xong:
  PATCH /api/admin/orders/[id]/status { status: "PAID" }
  → paymentStatus = PAID → sau do: SHIPPED → COMPLETED
```

Kho bi tru ngay luc tao don (status = PENDING).
Neu user huy trong 24h → hoan kho.

### 11.2. VNPAY

```
Server tao Order (PENDING, paymentProvider = "VNPAY")
→ Tru kho
→ Sinh vnpayUrl (ky checksum HMAC_SHA512)
→ Tra ve { orderId, vnpayUrl }

Client redirect → window.location.href = vnpayUrl

[User thanh toan xong] VNPAY redirect ve:
  GET /api/shop/payments/vnpay/return?vnp_ResponseCode=00&vnp_TxnRef=DUA-xxx&...
  Server:
    1. Verify SecureHash
    2. "00" → Order.paymentStatus = PAID, status = PAID
             luu paymentIntentId = vnp_TransactionNo
             → redirect /checkout/success
    3. Khac → Order.status = FAILED
             → revertOrderStockDeduction (hoan kho)
             → redirect /checkout/failed

[VNPAY IPN] POST /api/shop/payments/vnpay/ipn (server-to-server, an toan hon)
  → Xu ly giong return, tra ve {"RspCode":"00","Message":"Confirm Success"}
```

Luon uu tien cap nhat qua IPN (server-to-server) vi an toan hon return URL.

### 11.3. QR Chuyen khoan (VietQR)

```
Server tao Order (PENDING, paymentProvider = "QR_TRANSFER")
→ Tru kho
→ Sinh qrImageUrl tu img.vietqr.io:
  https://img.vietqr.io/image/{QR_BANK_ID}-{QR_ACCOUNT_NO}-compact2.png
    ?amount={totalAmount}
    &addInfo=DUA%20{orderNumber}%20{userName}
    &accountName={QR_ACCOUNT_NAME}
→ Luu qrImageUrl, qrExpiresAt = now + 30 phut vao Order.metadata
→ Tra ve { orderId, qrImageUrl, bankInfo, transferNote, expiresAt }

[Trang /checkout/success – QR mode]
→ Hien anh QR lon (img src = qrImageUrl)
→ Hien thong tin ngan hang, so tien, noi dung chuyen khoan
→ Countdown 30 phut
→ Nut "Toi da chuyen khoan" → POST /api/shop/orders/{id}/confirm-transfer (chi ghi log)

[Admin xac nhan]
→ PATCH /api/admin/orders/[id]/status { status: "PAID" }
→ paymentStatus = PAID

[Neu qua 30 phut, chua PAID]
→ Cron hoac admin huy don → CANCELLED → hoan kho
```

---

## 12. Danh sach API can tao

### 12.1. Shop (user-facing)

| Method | Route                              | Mo ta                                          |
|--------|------------------------------------|------------------------------------------------|
| POST   | /api/shop/orders                   | Tao don hang moi                               |
| GET    | /api/shop/orders                   | Lay danh sach don hang cua user                |
| GET    | /api/shop/orders/[orderId]         | Lay chi tiet 1 don hang                        |
| PATCH  | /api/shop/orders/[orderId]/cancel  | User huy don (trong window 24h, PENDING)       |
| GET    | /api/shop/addresses                | Lay danh sach dia chi cua user                 |
| POST   | /api/shop/addresses                | Them dia chi moi                               |
| PUT    | /api/shop/addresses/[id]           | Cap nhat dia chi                               |
| DELETE | /api/shop/addresses/[id]           | Xoa dia chi                                    |

### 12.2. Admin

| Method | Route                              | Mo ta                                          |
|--------|------------------------------------|------------------------------------------------|
| GET    | /api/admin/orders                  | Danh sach don hang (co filter, phan trang)     |
| GET    | /api/admin/orders/[orderId]        | Chi tiet don hang                              |
| PATCH  | /api/admin/orders/[orderId]/status | Chuyen trang thai don                          |
| PATCH  | /api/admin/orders/[orderId]/cancel | Admin huy don                                  |

### 12.3. Payment callbacks

| Method | Route                                   | Mo ta                                       |
|--------|-----------------------------------------|---------------------------------------------|
| GET    | /api/shop/payments/vnpay/return         | VNPAY redirect ve sau thanh toan            |
| POST   | /api/shop/payments/vnpay/ipn            | VNPAY IPN (server-to-server, an toan hon)   |
| POST   | /api/shop/orders/[orderId]/confirm-transfer | User bao da chuyen khoan QR (ghi log)  |

---

## 13. DTOs va Types can tao

### 13.1. File: src/types/order.ts (tao moi)

```typescript
export type OrderStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "SHIPPED" | "COMPLETED";
export type PaymentStatus = "PENDING" | "PAID" | "REFUNDED";
export type PaymentMethod = "COD" | "VNPAY" | "QR_TRANSFER";

// --- Request ---
export type CreateOrderRequestDto = {
  shippingAddress: ShippingAddressInput;
  paymentMethod: PaymentMethod;
  stripePaymentMethodId?: string;
  couponCode?: string;
  note?: string;
};

export type ShippingAddressInput = {
  addressId?: string;       // dung dia chi da luu
  fullName?: string;        // nhap moi
  phone?: string;
  line1?: string;
  line2?: string;
  ward?: string;
  district?: string;
  province?: string;
  postalCode?: string;
};

export type CancelOrderRequestDto = {
  reason?: string;
};

// --- Response ---
export type CreateOrderResponseDto = {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  shippingFee: number;
  couponDiscount: number;
  paymentMethod: PaymentMethod;
  stripeClientSecret?: string;
  bankTransferInfo?: BankTransferInfo;
};

export type BankTransferInfo = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  transferNote: string;
};

export type OrderItemSummaryDto = {
  productId: string;
  productName: string;
  productImageUrl: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type OrderDetailDto = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider: string | null;
  totalAmount: number;
  shippingFee: number;
  couponDiscount: number;
  currency: string;
  note: string | null;
  items: OrderItemSummaryDto[];
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    ward: string | null;
    district: string;
    province: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  cancelDeadlineAt: string | null; // ISO string hoac null
};

export type OrderListItemDto = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
};

export type OrderListResponseDto = {
  data: OrderListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// --- Address DTOs ---
export type AddressDto = {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  ward: string | null;
  district: string;
  province: string;
  country: string;
  postalCode: string | null;
  isDefault: boolean;
};

export type UpsertAddressRequestDto = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  ward?: string;
  district: string;
  province: string;
  postalCode?: string;
  isDefault?: boolean;
};
```

### 13.2. Service can tao: src/services/order-service.ts

Cac ham chinh:
```typescript
createOrder(userId, dto): Promise<CreateOrderResponseDto>
cancelOrder(orderId, userId, reason): Promise<void>        // user huy
adminCancelOrder(orderId, adminId, reason): Promise<void>  // admin huy
updateOrderStatus(orderId, newStatus): Promise<void>       // admin doi trang thai
getOrderDetail(orderId, userId): Promise<OrderDetailDto>
getOrderListByUser(userId, page, pageSize): Promise<OrderListResponseDto>
```

---

## 14. Cau truc thu muc (can tao them)

```
src/
  app/
    checkout/
      page.tsx              <- Trang checkout chinh
      page.module.css
    checkout/
      success/
        page.tsx            <- Trang xac nhan don thanh cong
        page.module.css
    account/
      orders/
        page.tsx            <- Lich su don hang
        page.module.css
      orders/[id]/
        page.tsx            <- Chi tiet don hang
        page.module.css
    api/
      shop/
        orders/
          route.ts          <- GET (list), POST (create)
          [orderId]/
            route.ts        <- GET (detail)
            cancel/
              route.ts      <- PATCH (user cancel)
        addresses/
          route.ts          <- GET, POST
          [id]/
            route.ts        <- PUT, DELETE
      payments/
        vnpay/
          return/
            route.ts        <- GET (VNPAY redirect callback)
          ipn/
            route.ts        <- POST (VNPAY IPN server-to-server)
      location/
        provinces/
          route.ts          <- GET, proxy provinces.open-api.vn (cache 7 ngay)
        districts/
          route.ts          <- GET ?provinceCode=xxx
        wards/
          route.ts          <- GET ?districtCode=xxx
      admin/
        orders/
          route.ts          <- GET (list)
          [orderId]/
            route.ts        <- GET, PATCH status
            cancel/
              route.ts      <- PATCH (admin cancel)

  features/
    shop/
      components/
        checkout/
          CheckoutPage.tsx
          CheckoutPage.module.css
          ShippingAddressForm.tsx
          ShippingAddressForm.module.css
          PaymentMethodSelector.tsx
          PaymentMethodSelector.module.css
          OrderSummaryPanel.tsx
          OrderSummaryPanel.module.css
        order-success/
          OrderSuccessPage.tsx
          OrderSuccessPage.module.css
        order-history/
          OrderHistoryPage.tsx
          OrderHistoryPage.module.css
          OrderDetailPage.tsx
          OrderDetailPage.module.css

  services/
    order-service.ts      <- tao order, huy order, lay danh sach, chi tiet
    address-service.ts    <- CRUD dia chi

  types/
    order.ts              <- tat ca DTOs cho order (PaymentMethod: COD/VNPAY/QR_TRANSFER)
    location.ts           <- ProvinceOption, DistrictOption, WardOption
```

---

## 15. Thu tu trien khai de xuet

Thuc hien theo thu tu sau de giam rui ro:

1. **Tao types/order.ts** – Dinh nghia tat ca DTOs truoc.
2. **Tao order-service.ts** – Ham `createOrder` voi transaction day du.
3. **Tao POST /api/shop/orders** – API dat hang, su dung order-service.
4. **Them sendOrderConfirmationEmail** vao email-resend-service.ts.
5. **Tao GET + POST /api/shop/addresses** – CRUD dia chi.
6. **Tao trang /checkout/page.tsx** – UI voi form dia chi, phuong thuc TT.
7. **Tao trang /checkout/success/page.tsx** – Man hinh xac nhan.
8. **Tao PATCH /api/shop/orders/[orderId]/cancel** – User huy don.
9. **Tao trang /account/orders** – Lich su don hang.
10. **Tao trang /account/orders/[id]** – Chi tiet + nut huy (neu con trong window).
11. **Tao API admin** – Quan ly don hang, doi trang thai, huy.
12. **Tao trang admin/orders** – UI admin quan ly don hang.
13. **Tich hop Stripe** (neu muon demo thanh toan the).

---

## 16. Cac diem ky thuat dac biet can chu y

### 16.1. Anti double-submit

- Frontend: disable nut "Dat hang" sau lan click dau.
- Backend: khong co co che idempotency key rieng, nhung transaction dam bao nhat quan.
- Neu user refresh trang thanh cong → khong tao them order, vi cartStatus = CONVERTED.

### 16.2. Dong bo coupon trang cart -> checkout

- Trang /cart: user nhap coupon, goi POST /api/shop/coupons/validate de preview discount.
  `validateCoupon` khong tang usedCount.
- Khi chuyen sang /checkout: truyen couponCode qua state hoac localStorage.
- Khi dat hang: server re-validate coupon lan nua trong transaction.
  Neu coupon het luot giua 2 buoc → tra loi loi 400.

### 16.3. Stock race condition

- Neu 2 user cung dat hang san pham cuoi cung: giao dich nao commit truoc se thang.
- Giao dich sau se gap `INSUFFICIENT_STOCK` va tra ve loi 400.
- Khong dung lock optimistic (vi Prisma/Postgres transaction da xu ly qua SERIALIZABLE).

### 16.4. Cart status sau khi dat hang

- Sau khi dat hang thanh cong: `Cart.status = CONVERTED`.
- `GET /api/shop/cart` nen tra ve cart rong (hoac tao cart ACTIVE moi) cho user.
  De khi user muon mua them, gio hang bat dau sach tu dau.

### 16.5. San pham bi xoa sau khi dat hang

- `OrderItem.productName` va `OrderItem.unitPrice` la **snapshot** tai thoi diem dat.
- Khi lay chi tiet don hang, hien thi tu OrderItem (khong phu thuoc Product con ton tai).
- `OrderItem.productId` co the tro den san pham da bi xoa → can xem xet khi hien anh
  (nen luu them `productImageUrl` vao OrderItem hoac dung anh tu snapshot).

### 16.6. Vat biet: them truong productImageUrl vao OrderItem

Hien tai schema `OrderItem` khong co `productImageUrl`.
Khuyen nghi them truong nay de dam bao hien thi dung ca sau khi san pham bi xoa/sua anh:

```prisma
model OrderItem {
  ...
  productImageUrl String?   // snapshot URL anh chinh tai thoi diem dat
}
```

Khi tao OrderItem, lay `product.images[0].url` va luu vao `productImageUrl`.

---

*Tai lieu nay chi la thiet ke workflow; chua trien khai bat ky dong code nao.*
*Buoc tiep theo: trien khai theo thu tu muc 15.*

---
---

# PHAN MO RONG: Dia chi – Van chuyen GHN – Thanh toan – Coupon

## A. Luong chon dia chi giao hang

### A.1. Khi nao hoi dia chi?

Ngay sau khi user bam "Dat hang" tren trang gio hang, trang /checkout duoc mo ra.
Day la diem **dau tien** trang checkout load: uu tien load dia chi ngay.

**Luong uu tien:**
```
1. Load trang /checkout
2. Song song:
   a. GET /api/shop/cart         -> kiem tra cart co hang
   b. GET /api/shop/addresses    -> lay danh sach dia chi da luu
3. Neu co dia chi:
   -> Hien danh sach, tu dong chon address isDefault = true
4. Neu khong co dia chi:
   -> Hien thang form nhap dia chi moi
5. User co the:
   - Chon 1 dia chi cu (radio button)
   - Mo form "Them dia chi moi" (expand inline, khong phai modal rieng)
   - Danh dau dia chi moi lam mac dinh
```

### A.2. UI Address Selector

```
[===== BUOC 1: DIA CHI GIAO HANG =====]

[Dia chi da luu]               [+ Them dia chi moi v]
 ( ) Nguyen Van A               fullName: [          ]
     0901234567                 phone:    [          ]
     123 Nguyen Hue, P1         tinh/tp:  [dropdown  ]
     Q1, TP.HCM                 quan/huy: [dropdown  ]
     [Sua] [Xoa]                phuong/xa:[dropdown  ]
                                so nha:   [          ]
 (*) Le Thi B      [Mac dinh]  [x] Luu dia chi nay
     0912345678                 [x] Dat lam mac dinh
     456 Le Loi, P.Ben Nghe
     Q1, TP.HCM
     [Sua] [Xoa]
```

**Luu y UX:**
- Hien toi da 3-4 dia chi, neu nhieu hon co nut "Xem them".
- Dia chi mac dinh hien bieu hieu "Mac dinh" mau `--primary`.
- Khi chon dia chi → trigger tinh phi ship ngay (xem muc B).
- Form "Them moi" expand inline (khong redirect, khong modal full-screen).

### A.3. Cascading Dropdown tinh/huyen/xa – Dung API dia ly Viet Nam (provinces.open-api.vn)

**Quyet dinh thiet ke quan trong:**
Dung **provinces.open-api.vn** (API dia ly cong khai, mien phi, khong can dang ky, co CORS)
de hien thi dropdown tinh/huyen/xa cho nguoi dung nhap dia chi.
Day la API chuan nhat cho don vi hanh chinh Viet Nam (cap nhat sau sap nhap tinh 07/2025).

**Ly do KHONG dung master-data cua GHN de hien dropdown:**
- GHN dung ma rieng cua GHN (ghnDistrictId, ghnWardCode), khac voi ma hanh chinh Viet Nam.
- Neu dung GHN de hien dropdown: khi GHN thay doi co so du lieu → dropdown bi hong.
- Tach biet 2 muc dich:
  - Hien dropdown (ten dep, ma hanh chinh VN) → dung provinces.open-api.vn.
  - Tinh phi van chuyen                         → tra cuu ma GHN tuong ung khi can.

#### A.3.1. Cac endpoint provinces.open-api.vn se dung

```
# Lay danh sach tat ca tinh/thanh pho
GET https://provinces.open-api.vn/api/v2/p/
Response: [{ code: 1, name: "Thanh pho Ha Noi", codename: "thanh_pho_ha_noi" }, ...]

# Lay danh sach quan/huyen theo tinh
GET https://provinces.open-api.vn/api/v2/p/{provinceCode}?depth=2
Response: { code: 1, name: "...", districts: [{ code: 1, name: "Quan Ba Dinh" }, ...] }

# Lay danh sach phuong/xa theo quan
GET https://provinces.open-api.vn/api/v2/d/{districtCode}?depth=2
Response: { code: 1, name: "...", wards: [{ code: 1, name: "Phuong Phuc Xa" }, ...] }
```

**Luong cascade:**
1. Mount form → goi GET /api/v2/p/ → populate dropdown tinh.
2. User chon tinh → goi GET /api/v2/p/{provinceCode}?depth=2 → populate dropdown huyen.
3. User chon huyen → goi GET /api/v2/d/{districtCode}?depth=2 → populate dropdown xa.
4. User chon xa → form co du bo tinh/huyen/xa ten day du.

#### A.3.2. Chien luoc goi API – Proxy hay Direct?

API provinces.open-api.vn ho tro CORS → **client co the goi thang**, khong can proxy.
Tuy nhien nen proxy qua server route cua minh de:
- Cache lau (danh sach tinh rat it thay doi), tranh goi lan lai.
- Khong phu thuoc vao uptime cua dich vu ben thu 3 truc tiep tu browser.

**Cac route proxy can tao:**
```
GET /api/shop/location/provinces
  -> Cache: 7 ngay (Next.js revalidate 604800)
  -> Proxy: https://provinces.open-api.vn/api/v2/p/

GET /api/shop/location/districts?provinceCode=xxx
  -> Cache: 7 ngay
  -> Proxy: https://provinces.open-api.vn/api/v2/p/{provinceCode}?depth=2
  -> Response: tra ve mang districts

GET /api/shop/location/wards?districtCode=xxx
  -> Cache: 7 ngay
  -> Proxy: https://provinces.open-api.vn/api/v2/d/{districtCode}?depth=2
  -> Response: tra ve mang wards
```

**Next.js cache pattern:**
```typescript
// Trong API route handler
const res = await fetch("https://provinces.open-api.vn/api/v2/p/", {
  next: { revalidate: 604800 }, // cache 7 ngay
});
```

#### A.3.3. Luu gi vao DB (model Address)?

Luu ca ten (de hien thi) va code (de tra cuu GHN sau nay):

```prisma
model Address {
  // ... cac truong hien co: fullName, phone, line1, line2 ...
  ward          String?   // Ten phuong/xa (hien thi)
  district      String?   // Ten quan/huyen (hien thi)
  province      String?   // Ten tinh/thanh pho (hien thi)

  // Ma hanh chinh Viet Nam (tu provinces.open-api.vn)
  provinceCode  Int?      // Ma tinh (VD: 79 = TP.HCM)
  districtCode  Int?      // Ma quan/huyen (VD: 760 = Quan 1)
  wardCode      Int?      // Ma phuong/xa

  // Ma GHN (de tinh phi van chuyen – tra cuu bang mapping table hoac API GHN)
  ghnDistrictId Int?      // GHN District ID (khac voi districtCode VN)
  ghnWardCode   String?   // GHN Ward Code
}
```

#### A.3.4. Mapping tu ma VN sang ma GHN

Khi user luu dia chi (POST /api/shop/addresses), server se:
1. Nhan `provinceCode`, `districtCode`, `wardCode` (ma VN).
2. Goi API GHN master data de tra cuu ID/code tuong ung:
   ```
   GET https://online-gateway.ghn.vn/shiip/public-api/master-data/district?province_id={ghnProvinceId}
   ```
   Tim quan/huyen co ten trung voi ten VN → lay `DistrictID`.
   Tuong tu voi ward.
3. Luu `ghnDistrictId` va `ghnWardCode` vao Address.

**Hoac don gian hon (khuyen nghi cho v1):**
Giu mapping nay la "lazy" – chi tinh khi can:
- Khi user submit checkout → server tra cuu GHN ID tu ten dia chi luc do.
- Tranh phu thuoc vao mapping ngay luc luu dia chi.

#### A.3.5. DTOs cho dropdown

```typescript
// src/types/location.ts (tao moi)
export type ProvinceOption = {
  code: number;
  name: string;
  codename: string;
};

export type DistrictOption = {
  code: number;
  name: string;
  codename: string;
  division_type: string; // "quan" | "huyen" | "thi xa"
};

export type WardOption = {
  code: number;
  name: string;
  codename: string;
  division_type: string; // "phuong" | "xa" | "thi tran"
};
```

---

## B. Luong tinh phi van chuyen (Tich hop GHN)

### B.1. Khi nao tinh phi?

Phi ship duoc tinh/cap nhat lai moi khi:
1. User chon xong phuong xa (ghnWardCode co gia tri).
2. User chon 1 dia chi cu tu danh sach.
3. User chon dich vu van chuyen khac (xem B.4).

**Khong tinh phi khi:** Chua chon du tinh/huyen/xa.

### B.2. API proxy tinh phi ship

```
POST /api/shop/shipping/calculate-fee
Authorization: session (user hoac anonymous)
Body:
{
  toDistrictId: number,   // GHN district ID dich
  toWardCode: string,     // GHN ward code dich
  weight: number,         // gram (default: 500g cho hang am thanh nho)
  serviceTypeId?: number  // 2 = E-Commerce (default), 5 = Express
}
Response:
{
  fee: number,            // tong phi (VND)
  serviceName: string,    // "Giao hang tiet kiem" | "Giao hang nhanh"
  estimatedDays: string,  // "2-3 ngay" (tu metadata GHN hoac config cung)
  breakdown?: {
    mainService: number,
    insurance: number,
    cod: number,
    remote: number
  }
}
```

**Server proxy (de khong lo GHN_TOKEN phia client):**

```typescript
// POST /api/shop/shipping/calculate-fee handler
const ghnRes = await fetch(
  "https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/fee",
  {
    method: "POST",
    headers: {
      "Token": process.env.GHN_API_TOKEN!,
      "ShopId": process.env.GHN_SHOP_ID!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      service_type_id: serviceTypeId,
      to_district_id: toDistrictId,
      to_ward_code: toWardCode,
      weight: weight,
      insurance_value: Math.min(orderValue, 5_000_000), // GHN cap 5tr
    }),
  }
);
const ghnData = await ghnRes.json();
// ghnData.data.total = tong phi
```

### B.3. Tham so trong luong cho hang am thanh

Vi hang am thanh (loa, amplifier, headphone) co trong luong va kich thuoc khac nhau,
co 2 phuong an:

**Phuong an 1 (Don gian – De implement):**
- Dung trong luong mac dinh theo category:
  ```
  Headphone / IEM    : 300g
  Loa co nho         : 1000g
  Amplifier / DAC    : 2000g
  Loa lon / Sub      : 5000g
  Phu kien           : 200g
  ```
- Luu `weightGrams` vao model `Product` (truong moi).
- Khi tinh phi: lay `sum(item.product.weightGrams * item.quantity)`.
- Neu khong co weightGrams → fallback = 500g.

**Phuong an 2 (Chuan xac – Them cong):**
- Them cac truong vao model `Product`:
  ```prisma
  weightGrams Int?   // trong luong (gram)
  lengthCm    Int?   // dai (cm)
  widthCm     Int?   // rong (cm)
  heightCm    Int?   // cao (cm)
  ```
- GHN tu tinh trong luong quy doi: `max(weightGrams, length*width*height/6000 * 1000)`.

**Khuyen nghi: Bat dau voi Phuong an 1**, sau nay nang cap len Phuong an 2 khi co du lieu.

### B.4. Chon dich vu van chuyen

Hien 2 lua chon phia UI:

| Dich vu         | service_type_id | Mo ta               | Ui hien thi                  |
|-----------------|-----------------|---------------------|------------------------------|
| Tiet kiem       | 2               | 3-5 ngay            | Radio + phi tinh tu GHN      |
| Nhanh           | 5               | 1-2 ngay            | Radio + phi tinh tu GHN      |

Khi user choi dich vu → goi lai `/api/shop/shipping/calculate-fee` voi serviceTypeId moi → cap nhat phi hien thi.

### B.5. Xu ly GHN that bai / fallback

```
Neu goi GHN API that bai (timeout, loi mang, token het han):
  -> Log loi server
  -> Tra ve phi mac dinh = 30,000 VND (fee_type: "FLAT_RATE_FALLBACK")
  -> Hien thong bao nho phia client: "Phi van chuyen uoc tinh, co the thay doi sau xac nhan don."
  -> Van cho phep dat hang
```

---

## C. Luong chon phuong thuc thanh toan

### C.1. Cac phuong thuc ho tro

Thay Stripe bang VNPAY va QR ngan hang noi dia:

| ID           | Hien thi                  | Mo ta                                               |
|--------------|---------------------------|-----------------------------------------------------|
| COD          | Thanh toan khi nhan hang  | Shipper thu tien, admin xac nhan                    |
| VNPAY        | VNPAY (ATM / QR / Visa)  | Redirect sang cong VNPAY, webhook cap nhat don hang  |
| QR_TRANSFER  | Ma QR chuyen khoan nhanh  | Sinh ma QR VietQR, khach quet chuyen khoan tuc thi  |

### C.2. Vi tri trong UI

Phuong thuc thanh toan hien o **Buoc 2** (sau dia chi), 3 card click-to-select:

```
[===== BUOC 2: PHUONG THUC THANH TOAN =====]

[ COD                 ]  [ VNPAY              ]  [ QR CHUYEN KHOAN    ]
[ Thanh toan khi nhan ]  [ ATM / QR / The     ]  [ VietQR – Tuc thi   ]
[ (*)                 ]  [  o                  ]  [  o                  ]
```

### C.3. Chi tiet tung phuong thuc

---

#### C.3.1. COD (Thanh toan khi nhan hang)

**Luong:**
```
User chon COD → submit → tao Order (status=PENDING, paymentStatus=PENDING)
→ Redirect /checkout/success
→ Admin xac nhan giao hang va thu tien → cap nhat PAID → SHIPPED → COMPLETED
```

**UI sau khi chon:**
- Note: "Shipper se thu tien khi giao hang. Vui long chuan bi dung so tien."
- Hien so tien can chuan bi (total).
- Khong can them truong gi.

---

#### C.3.2. VNPAY

**Tong quan:**
- VNPAY la cong thanh toan lon nhat Viet Nam, ho tro: ATM noi dia, VNPAY-QR, Visa/Master.
- Sandbox: `https://sandbox.vnpayment.vn`
- Production: `https://pay.vnpay.vn`
- Luong: **Redirect** (dieu huong sang trang VNPAY, sau do callback ve).

**Tham so can co (luu vao .env):**
```env
VNPAY_TMN_CODE=your_tmn_code          # Ma dinh danh merchant
VNPAY_HASH_SECRET=your_hash_secret    # Khoa bi mat ky checksum
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://your-domain.com/api/shop/payments/vnpay/return
```

**Luong VNPAY chi tiet:**

```
[Checkout] User chon VNPAY → bam "Dat hang"
     ↓
[Server] POST /api/shop/orders
  → Tao Order (status=PENDING, paymentMethod=VNPAY, paymentStatus=PENDING)
  → Tru kho ngay
  → Sinh URL thanh toan VNPAY:
      vnp_Amount     = totalAmount * 100  (VNPAY nhan don vi x100)
      vnp_Command    = "pay"
      vnp_CreateDate = now() format yyyyMMddHHmmss (UTC+7)
      vnp_CurrCode   = "VND"
      vnp_IpAddr     = req.ip
      vnp_Locale     = "vn"
      vnp_OrderInfo  = "Thanh toan don hang #DUA-20260227-X3K9"
      vnp_OrderType  = "other"
      vnp_ReturnUrl  = VNPAY_RETURN_URL
      vnp_TmnCode    = VNPAY_TMN_CODE
      vnp_TxnRef     = orderNumber         ← ma nay la unique reference
      vnp_Version    = "2.1.0"
      vnp_SecureHash = HMAC_SHA512(sortedParams, VNPAY_HASH_SECRET)
  → Tra ve { orderId, vnpayUrl }
     ↓
[Client] Nhan vnpayUrl → window.location.href = vnpayUrl (redirect sang VNPAY)
     ↓
[User] Thanh toan tren trang VNPAY (chon ATM / QR / Visa)
     ↓
[VNPAY] Redirect ve VNPAY_RETURN_URL sau khi thanh toan:
  GET /api/shop/payments/vnpay/return?vnp_TxnRef=DUA-xxx&vnp_ResponseCode=00&...
     ↓
[Server] GET /api/shop/payments/vnpay/return handler:
  1. Verify checksum: tinh lai SecureHash, so sanh voi vnp_SecureHash trong callback
  2. Neu hop le va vnp_ResponseCode == "00":
     → cap nhat Order.paymentStatus = PAID, Order.status = PAID
     → luu vnp_TransactionNo vao Order.paymentIntentId
     → redirect /checkout/success?orderId=xxx
  3. Neu ResponseCode != "00" (huy, het gio, loi the):
     → cap nhat Order.status = FAILED
     → Hoan kho (revertOrderStockDeduction)
     → redirect /checkout/failed?orderId=xxx&reason=vnp_ResponseCode
```

**Cac ma ResponseCode quan trong:**
```
"00" → Thanh cong
"07" → Tru tien thanh cong, nghi van (gian lan)
"09" → The / TK chua dang ky dich vu Internet Banking
"10" → Xac thuc sai qua 3 lan
"11" → Het gio cho thanh toan
"24" → Khach huy giao dich
"51" → TK khong du so du
"65" → Da vuot qua han muc giao dich trong ngay
"75" → Ngan hang thanh toan dang bao tri
"99" → Loi khong xac dinh
```

**Luu y bao mat:**
- **Luon verify SecureHash phia server** truoc khi cap nhat trang thai don.
- Khong cap nhat trang thai don chi dua vao redirect URL (co the bi tamper).
- Dung `vnp_TxnRef = orderNumber` (unique) de map lai don hang.

---

#### C.3.3. QR Chuyen khoan (VietQR)

**Tong quan:**
- VietQR la chuan QR lien ngan hang cua NAPAS, ho tro 40+ ngan hang VN.
- Khach quet QR bang app ngan hang → chuyen khoan tuc thi.
- **Khong can tich hop SDK** – chi can sinh URL anh QR theo chuan VietQR.
- Xac nhan don hang: admin kiem tra thu cong hoac (nang cao) dung webhook ngan hang.

**Cach sinh ma QR VietQR:**

Dung API cong khai cua VietQR:
```
https://img.vietqr.io/image/{BANK_ID}-{ACCOUNT_NO}-{TEMPLATE}.png
  ?amount={so_tien}
  &addInfo={noi_dung_chuyen_khoan}
  &accountName={chu_tai_khoan}
```

Vi du:
```
https://img.vietqr.io/image/VCB-0123456789-compact2.png
  ?amount=1180000
  &addInfo=DUA%20DUA-20260227-X3K9%20Nguyen%20Van%20A
  &accountName=CONG%20TY%20TNHH%20DUC%20UY%20AUDIO
```

Cac template: `compact`, `compact2`, `print`, `qr_only`.

**Luu vao .env:**
```env
QR_BANK_ID=VCB                         # Ma ngan hang (VCB=Vietcombank, TCB=Techcombank,...)
QR_ACCOUNT_NO=0123456789               # So tai khoan
QR_ACCOUNT_NAME=CONG TY TNHH DUC UY AUDIO
```

**Luong QR Chuyen khoan:**

```
[Checkout] User chon QR Chuyen khoan → bam "Dat hang"
     ↓
[Server] POST /api/shop/orders
  → Tao Order (status=PENDING, paymentMethod=QR_TRANSFER, paymentStatus=PENDING)
  → Tru kho
  → Sinh noi dung chuyen khoan: "DUA {orderNumber} {user.name}"
  → Sinh URL QR: https://img.vietqr.io/image/...?amount={total}&addInfo={note}
  → Tra ve { orderId, orderNumber, qrImageUrl, bankInfo }
     ↓
[Client] Redirect /checkout/success?orderId=xxx
     ↓
[Trang success – QR_TRANSFER] Hien:
  - Anh QR lon (img tag tu qrImageUrl)
  - Thong tin ngan hang (so TK, chu TK, ngan hang)
  - Noi dung chuyen khoan (bold, de copy)
  - So tien can chuyen (bold, de copy)
  - Countdown 30 phut: "Don hang se tu dong huy neu khong chuyen khoan trong 30 phut"
  - Nut "Toi da chuyen khoan" (goi API bao hieu, admin xac nhan sau)
     ↓
[Admin] Kiem tra lich su giao dich ngan hang
  → Xac nhan thu cong: PATCH /api/admin/orders/{id}/status { status: "PAID" }
  → paymentStatus = PAID, status = PAID
```

**Hieu ung countdown va tu dong huy (optional nang cao):**
- Luu `qrExpiresAt = createdAt + 30 phut` vao `Order.metadata`.
- Cron job (hoac Next.js cron route) quet cac don `QR_TRANSFER / PENDING / het han` → huy va hoan kho.
- Hoac admin huy thu cong.

### C.4. Rang buoc giua phuong thuc va dich vu van chuyen

Hien tai khong rang buoc cung – ca 3 phuong thuc dung duoc voi moi dich vu van chuyen.
Tuong lai co the: COD chi ap dung voi mot so tinh/thanh pho nhat dinh.

---

## D. Luong Apply ma giam gia tren trang Checkout

### D.1. Cau hoi thiet ke: Gio hang hay Checkout?

**Quyet dinh:** Cho phep nhap ma o **ca hai** noi, nhung theo nguyen tac:
- Trang gio hang: nhap ma de **preview** (hien thi so tien giam, finalTotal).
  → Goi `POST /api/shop/coupons/validate`, khong tang usedCount.
- Trang checkout: ma da nhap o gio hang duoc **truyen sang** va hien san.
  → User co the doi/xoa ma ngay tren checkout.
  → Khi submit dat hang: server **validate lai lan cuoi** trong transaction.

### D.2. Truyen ma tu gio hang sang checkout

**Option A – URL param (don gian):**
```
/checkout?coupon=SALE50
```
Trang checkout doc `searchParams.coupon`, hien thi san.

**Option B – localStorage (kiem ben vung hon neu user reload):**
```javascript
localStorage.setItem("duc_uy_pending_coupon", couponCode)
// Checkout doc lai khi mount
const pending = localStorage.getItem("duc_uy_pending_coupon")
```

**Khuyen nghi: Dung ca 2** – URL param la primary, localStorage la fallback khi user navigate back.

### D.3. Hien thi ma tren trang Checkout

```
[===== BUOC 3: MA GIAM GIA =====]

[Nhap ma giam gia       ] [Ap dung]

// Neu co ma tu gio hang:
[v] Ma SALE50 da ap dung – Giam 50,000d    [x Xoa]
```

Khi bam "Ap dung" tren checkout:
- Goi lai `POST /api/shop/coupons/validate` voi `orderSubtotal` hien tai va `shippingFee` da tinh.
- Neu hop le → cap nhat OrderSummary (subtotal - discount - ship = total moi).
- Neu het han giua 2 buoc → hien loi, xoa ma.

### D.4. Ma FREE_SHIPPING + GHN

Khi coupon type = `FREE_SHIPPING`:
- `computeCouponDiscount` tra ve `appliedShippingDiscount`.
- Tren UI: go dong phi ship, hien "Mien phi van chuyen (ap dung ma FREESHIP)".
- Khi submit: server tinh lai, neu coupon van hop le → `shippingFee` trong Order = 0.

---

## E. OrderSummary Panel – Tinh toan tong hop

### E.1. Cac dong hien thi

```
Tong hang:          1,200,000d
Giam gia (SALE50):   - 50,000d
Phi van chuyen:        30,000d   [GHN Tiet kiem – 3-5 ngay]
                       --------
Thanh toan:         1,180,000d
```

Neu FREE_SHIPPING coupon:
```
Phi van chuyen:     Mien phi
  (GHN Tiet kiem – 3-5 ngay)
```

### E.2. Khi nao recalculate panel?

Trigger tinh lai client-side khi:
- User chon/doi dia chi (phi ship thay doi).
- User chon dich vu van chuyen khac (phi thay doi).
- User ap dung / xoa coupon (discount thay doi).
- Cart thay doi (neu cho phep chinh sua gio hang ngay tren checkout).

### E.3. Nut "Dat hang ngay"

Disable khi:
- Chua chon dia chi.
- Chua chon phuong thuc thanh toan.
- Dang goi API tinh phi (loading).
- Dang submit (after click, de tranh double-submit).

---

## F. Bien moi truong (env) can them

```env
# GHN (Giao Hang Nhanh) – van chuyen
GHN_API_TOKEN=your_ghn_token_here
GHN_SHOP_ID=your_ghn_shop_id_here
GHN_FROM_DISTRICT_ID=1454        # GHN District ID noi shop dat hang
GHN_FROM_WARD_CODE=21012         # GHN Ward Code noi shop dat hang

# VNPAY – cong thanh toan
VNPAY_TMN_CODE=your_tmn_code
VNPAY_HASH_SECRET=your_hash_secret
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://your-domain.com/api/shop/payments/vnpay/return

# VietQR – ma QR chuyen khoan
QR_BANK_ID=VCB
QR_ACCOUNT_NO=0123456789
QR_ACCOUNT_NAME=CONG TY TNHH DUC UY AUDIO
```

---

## G. Tong the luong nguoi dung tren trang /checkout

```
[Mount trang /checkout]
     |
     +-- Load song song: GET /api/shop/cart, GET /api/shop/addresses
     |                   GET /api/shop/location/provinces (cho dropdown tinh)
     |
     |-- Cart trong? → redirect /cart
     |-- Chua dang nhap? → redirect /login?callbackUrl=/checkout
     |
     v
[BUOC 1: DIA CHI GIAO HANG]
     |
     |-- Co dia chi? → hien danh sach dang radio, tu chon isDefault
     |-- Khong co? → hien thang form nhap moi
     |
     |-- Form moi:
     |   [Chon tinh]   → GET /api/shop/location/districts?provinceCode=xxx
     |   [Chon huyen]  → GET /api/shop/location/wards?districtCode=xxx
     |   [Chon xa]     → done (co du du lieu)
     |
     |-- Khi co dia chi day du → trigger calculateFee (GHN)
     v
[BUOC 2: DICH VU VAN CHUYEN]
     |
     |-- Hien phi GHN: [Tiet kiem X.000d – 3-5 ngay] [Nhanh Y.000d – 1-2 ngay]
     |-- Chon dich vu → goi lai calculateFee → cap nhat panel
     v
[BUOC 3: PHUONG THUC THANH TOAN]
     |
     |-- [COD] → khong them gi
     |-- [VNPAY] → hien logo VNPAY, note "Chuyen sang cong VNPAY sau khi dat"
     |-- [QR Chuyen khoan] → hien preview ngan hang, note "Ma QR hien sau khi dat"
     v
[BUOC 4: MA GIAM GIA] (optional)
     |
     |-- Neu co ma tu gio hang → hien san
     |-- Validate lai (goi /api/shop/coupons/validate) → hien discount
     v
[ORDER SUMMARY PANEL] (hien song song, cap nhat real-time)
     |
     +-- Subtotal, discount, ship (GHN), total
     +-- Nut "Dat hang ngay" (disabled cho den khi du buoc 1+2+3)
     |
     v
[SUBMIT → POST /api/shop/orders]
     |
     +-- Server validate: cart, dia chi, coupon, ton kho
     +-- Tao order trong transaction (tru kho, doi cart, tang coupon.usedCount)
     |
     +-- [COD]          → redirect /checkout/success?orderId=xxx
     +-- [VNPAY]        → tra ve vnpayUrl → client redirect sang VNPAY
     +-- [QR_TRANSFER]  → redirect /checkout/success?orderId=xxx (hien QR tren trang success)

[VNPAY callback]
     |
     GET /api/shop/payments/vnpay/return?vnp_ResponseCode=00&...
     +-- Verify checksum
     +-- "00" → Order PAID → redirect /checkout/success?orderId=xxx
     +-- Khac → Order FAILED + hoan kho → redirect /checkout/failed?orderId=xxx
```

---

## H. Schema Prisma can update

```prisma
// Them vao model Address:
model Address {
  // ... hien co: fullName, phone, line1, line2, ward, district, province, country ...

  // Ma hanh chinh Viet Nam (tu provinces.open-api.vn) – de hien thi va cascading
  provinceCode  Int?      // Ma tinh (VD: 79 = TP.HCM, 1 = Ha Noi)
  districtCode  Int?      // Ma quan/huyen
  wardCode      Int?      // Ma phuong/xa

  // Ma GHN tuong ung – de goi fee API GHN (lazy lookup khi can)
  ghnDistrictId Int?
  ghnWardCode   String?
}

// Them vao model Product:
model Product {
  // ... hien co ...
  weightGrams    Int?   // trong luong (gram), fallback 500g neu null
}

// Them vao model OrderItem:
model OrderItem {
  // ... hien co ...
  productImageUrl String?  // snapshot URL anh tai thoi diem dat
}

// Them vao model Order:
model Order {
  // ... hien co ...
  shippingServiceTypeId Int?     // GHN service_type_id (2=tiet kiem, 5=nhanh)
  ghnOrderCode          String?  // Ma van don GHN (khi tao don GHN)
  estimatedDeliveryDays String?  // VD: "3-5 ngay"

  // Thay doi paymentProvider enum mo rong cho VNPAY va QR:
  // paymentProvider: "COD" | "VNPAY" | "QR_TRANSFER"
  // paymentIntentId: voi VNPAY = vnp_TransactionNo; voi QR = null (xac nhan thu cong)

  // Them cac truong ho tro QR:
  qrImageUrl    String?   // URL anh QR VietQR da sinh
  qrExpiresAt   DateTime? // Thoi han chuyen khoan (createdAt + 30 phut)
}
```

---

## I. API can tao them (bo sung cho muc 12)

### I.1. API dia ly (provinces.open-api.vn proxy)

| Method | Route                                          | Mo ta                                               |
|--------|------------------------------------------------|-----------------------------------------------------|
| GET    | /api/shop/location/provinces                   | Proxy → lay danh sach 63 tinh/thanh pho             |
| GET    | /api/shop/location/districts?provinceCode=xxx  | Proxy → lay quan/huyen theo ma tinh                 |
| GET    | /api/shop/location/wards?districtCode=xxx       | Proxy → lay phuong/xa theo ma quan                  |

Cache: `revalidate: 604800` (7 ngay) vi du lieu hau nhu khong thay doi.

### I.2. API van chuyen (GHN proxy)

| Method | Route                                   | Mo ta                                       |
|--------|-----------------------------------------|---------------------------------------------|
| POST   | /api/shop/shipping/calculate-fee        | Proxy GHN → tinh phi van chuyen            |

### I.3. API thanh toan

| Method | Route                                     | Mo ta                                          |
|--------|-------------------------------------------|------------------------------------------------|
| GET    | /api/shop/payments/vnpay/return           | Callback sau khi thanh toan VNPAY (redirect)   |
| POST   | /api/shop/payments/vnpay/ipn             | IPN (Instant Payment Notification) tu VNPAY    |

**Luu y VNPAY IPN:**
VNPAY gui POST toi IPN URL sau moi giao dich (doc lap voi redirect).
Day la luong an toan hon de cap nhat trang thai don hang:
- IPN duoc VNPAY gui toi server (khong qua browser cua user).
- Server verify checksum → cap nhat Order → tra ve `{"RspCode":"00","Message":"Confirm Success"}`.
- Luon ap dung ca IPN lan return URL de dam bao khong mat cap nhat.

```env
# Them vao .env:
VNPAY_IPN_URL=https://your-domain.com/api/shop/payments/vnpay/ipn
```

---

*Cap nhat lan 2: Bo sung API dia ly Viet Nam (provinces.open-api.vn), phuong thuc VNPAY + VietQR, xoa Stripe/BANK_TRANSFER.*
