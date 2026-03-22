# Workflow: Tích hợp SePay Webhook – Thanh toán QR tự động xác nhận đơn hàng

## Tổng quan

Workflow này mô tả luồng tích hợp **SePay Webhook** để tự động xác nhận đơn hàng khi khách hàng quét mã QR và chuyển khoản thành công.

**Nguyên tắc hoạt động đơn giản:**
1. User chọn "Chuyển khoản VietQR" → hệ thống tạo `CheckoutSession` (provider=`VIETQR`) với `providerRef` là mã nội dung chuyển khoản duy nhất.
2. UI hiển thị QR code (đã điền sẵn số tiền + nội dung CK).
3. Khách quét QR bằng app ngân hàng → chuyển khoản.
4. **SePay tự bắn Webhook POST** về server khi phát hiện có tiền vào.
5. Server chỉ cần **lọc nội dung chuyển khoản** → tìm `CheckoutSession` khớp với `providerRef` → commit Order.
6. Client đang poll trạng thái session → thấy `SUCCEEDED` → redirect tới `/checkout/success`.

> **Tài liệu SePay:**
> - https://docs.sepay.vn/tich-hop-webhooks.html
> - https://docs.sepay.vn/lap-trinh-webhooks.html

---

## 1) Cấu trúc hiện tại của dự án

### 1.1. Model `CheckoutSession` (đã có trong Prisma)

```prisma
model CheckoutSession {
  id               String           @id @default(cuid())
  userId           String
  provider         CheckoutProvider  // VNPAY | VIETQR
  status           CheckoutStatus    // PENDING | SUCCEEDED | FAILED | EXPIRED | CANCELLED
  expiresAt        DateTime
  amount           Decimal           @db.Decimal(12, 2)
  currency         String            @default("VND")
  cartSnapshot     Json
  shippingSnapshot Json
  couponSnapshot   Json?
  note             String?
  providerRef      String?           @unique   // ← mã nội dung chuyển khoản để match webhook
  paymentUrl       String?
  providerPayload  Json?             // raw webhook payload lưu để audit
  providerCode     String?
  orderId          String?           @unique
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@index([userId, status, expiresAt])
  @@index([providerRef])              // ← INDEX QUAN TRỌNG để tìm nhanh theo mã CK
}
```

### 1.2. Flow QR_TRANSFER hiện tại (cần thay thế)

Hiện tại khi user chọn `QR_TRANSFER`:
- Gọi `POST /api/shop/orders` → `createOrder()` → **tạo Order ngay + trừ kho + clear cart**.
- Trả về `qrImageUrl`, `bankTransferInfo`.
- UI hiển thị QR → user chuyển khoản → **không có auto-confirm** (phải admin xác nhận tay).

### 1.3. Mục tiêu sau khi tích hợp SePay

- Khi user chọn `QR_TRANSFER` → **KHÔNG tạo Order ngay** giống VNPAY.
- Tạo `CheckoutSession` (provider=`VIETQR`) với `providerRef` = mã nội dung CK.
- SePay bắn webhook khi tiền vào → server parse nội dung → match `providerRef` → commit Order.
- Dùng chung `commitOrderFromSession()` với luồng VNPAY.

---

## 2) SePay Webhook – Tài liệu kỹ thuật

### 2.1. Payload SePay gửi về server (POST JSON)

```json
{
  "id": 92704,
  "gateway": "Vietcombank",
  "transactionDate": "2023-03-25 14:02:37",
  "accountNumber": "1016625868",
  "code": "DUA20240310234512ABCD",
  "content": "DUA20240310234512ABCD Nguyen Van A",
  "transferType": "in",
  "transferAmount": 1500000,
  "accumulated": 19077000,
  "subAccount": null,
  "referenceCode": "MBVCB.3278907687",
  "description": ""
}
```

**Các field cần dùng:**

| Field | Ý nghĩa | Cách dùng |
|-------|---------|-----------|
| `id` | ID giao dịch SePay | Chống xử lý trùng lặp (duplicate) |
| `transferType` | `"in"` hoặc `"out"` | Chỉ xử lý nếu `=== "in"` |
| `transferAmount` | Số tiền chuyển (VND) | Validate khớp với `session.amount` |
| `code` | Mã SePay tự nhận diện từ nội dung | Dùng để match `providerRef` trước |
| `content` | Toàn bộ nội dung chuyển khoản | Fallback nếu `code` null: dùng regex tìm `providerRef` |
| `accountNumber` | STK nhận tiền | Validate đúng STK của shop |

### 2.2. Response trả về để SePay không retry

```json
{ "success": true }
```

- HTTP Status: `200`
- Body: JSON có `success: true`
- Nếu trả về status khác 200–299 → SePay retry theo Fibonacci (1, 1, 2, 3, 5, 8, 13 phút), tối đa 7 lần trong 5 giờ.
- SePay timeout: connect 5 giây, response 8 giây.

---

## 3) Format `providerRef` – mã nội dung chuyển khoản

### 3.1. Cấu trúc mã

```
DUA{TIMESTAMP_14_DIGITS}{RANDOM_4_ALPHANUM}
Ví dụ: DUA20240310234512ABCD
```

- Timestamp 14 chữ số: `yyyyMMddHHmmss`
- Random 4 ký tự: `[A-Z0-9]`
- Tổng: 22 ký tự, đủ unique trong thực tế

### 3.2. QR image từ `img.vietqr.io` – điền sẵn nội dung

```typescript
const qrImageUrl = generateVietQRUrl({
  bankId: "VCB",            // từ env QR_BANK_ID
  accountNo: "1016625868",  // từ env QR_ACCOUNT_NO
  accountName: "Ngo Duc Uy",// từ env QR_ACCOUNT_NAME
  amount: 1500000,
  description: "DUA20240310234512ABCD",  // ← providerRef điền sẵn vào QR
});
```

Khách chỉ cần quét QR → nội dung CK tự điền → không cần gõ tay.

### 3.3. Logic match webhook → CheckoutSession

SePay có thể nhận diện mã trong `content` và đặt vào field `code` (nếu đã cấu hình SePay dashboard).
Nếu không có `code`, dùng regex parse `content`:

```typescript
// Ưu tiên field "code" (SePay đã nhận diện sẵn)
let matchRef: string | null = payload.code?.trim()?.toUpperCase() ?? null;

// Fallback: regex tìm trong "content"
if (!matchRef && payload.content) {
  // Tìm chuỗi DUA + 14 số + 4 alphanum = 22 ký tự
  const found = payload.content.match(/\bDUA[0-9]{14}[A-Z0-9]{4}\b/i);
  matchRef = found?.[0]?.toUpperCase() ?? null;
}
```

---

## 4) Những thay đổi cần thực hiện trong codebase

### 4.1. Biến môi trường (`.env`)

Không cần thêm biến mới cho SePay (không dùng API key).
Các biến ngân hàng đã có:

```env
# Bank account (đã có sẵn)
QR_BANK_ID=VCB
QR_ACCOUNT_NO=1016625868
QR_ACCOUNT_NAME=Ngo Duc Uy
```

### 4.2. Cập nhật `prepareCheckoutSession()` – thêm nhánh VIETQR

**File:** `src/services/checkout-session-service.ts`

Hiện tại có guard `if (dto.provider !== "VNPAY") throw error`. Cần bỏ guard đó và thêm nhánh VIETQR:

```typescript
// Bỏ guard này:
// if (dto.provider !== "VNPAY") {
//   throw new CheckoutSessionError("UNSUPPORTED_PROVIDER", "...");
// }

// Thêm nhánh VIETQR vào sau nhánh VNPAY:
if (dto.provider === "VIETQR") {
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 phút

  // Reuse session PENDING còn hạn (chống double-click)
  const existing = await client.checkoutSession.findFirst({
    where: {
      userId,
      provider: "VIETQR",
      status: "PENDING",
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, provider: true, status: true, expiresAt: true, amount: true, currency: true, paymentUrl: true, providerRef: true },
  });

  if (existing) {
    return {
      sessionId: existing.id,
      provider: existing.provider,
      status: existing.status,
      expiresAt: existing.expiresAt.toISOString(),
      amount: Number(existing.amount),
      currency: existing.currency,
      paymentUrl: existing.paymentUrl ?? undefined,
      providerRef: existing.providerRef ?? undefined,
    } satisfies CreatePaymentSessionResponseDto;
  }

  // Sinh providerRef = mã nội dung chuyển khoản
  const timestampRef = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const providerRef = `DUA${timestampRef}${randomSuffix}`;

  // Sinh QR image URL (nội dung CK đã điền sẵn providerRef)
  const qrImageUrl = generateVietQRUrl({
    bankId: process.env.QR_BANK_ID?.trim() ?? "VCB",
    accountNo: process.env.QR_ACCOUNT_NO?.trim() ?? "",
    accountName: process.env.QR_ACCOUNT_NAME?.trim() ?? "",
    amount: Math.round(totalAmount),
    description: providerRef,   // ← nội dung CK = providerRef
  });

  const createdSession = await client.checkoutSession.create({
    data: {
      userId,
      provider: "VIETQR",
      status: "PENDING",
      expiresAt,
      amount: totalAmount,
      currency: "VND",
      cartSnapshot,
      shippingSnapshot,
      couponSnapshot,
      note: dto.note ?? null,
      providerRef,      // ← mã dùng để match webhook
      paymentUrl: qrImageUrl,
    },
  });

  return {
    sessionId: createdSession.id,
    provider: createdSession.provider,
    status: createdSession.status,
    expiresAt: createdSession.expiresAt.toISOString(),
    amount: Number(createdSession.amount),
    currency: createdSession.currency,
    paymentUrl: createdSession.paymentUrl ?? undefined,
    providerRef: createdSession.providerRef ?? undefined,
  } satisfies CreatePaymentSessionResponseDto;
}
```

> **Lưu ý:** Cần import `generateVietQRUrl` từ `@/lib/vietqr` vào `checkout-session-service.ts`.

### 4.3. Cập nhật `buildOrderRequestFromSession()` – hỗ trợ VIETQR

**File:** `src/services/checkout-session-service.ts`

Hiện tại hardcode `paymentMethod: "VNPAY"`. Sửa lại:

```typescript
function buildOrderRequestFromSession(session: CheckoutSessionWithRelations): CreateOrderRequestDto {
  const shippingSnapshot = session.shippingSnapshot as { ... };
  const couponSnapshot = session.couponSnapshot as { ... } | null;

  return {
    shippingAddress: { ... },
    // Sửa: map provider sang paymentMethod đúng
    paymentMethod: session.provider === "VNPAY" ? "VNPAY" : "QR_TRANSFER",
    shippingServiceTypeId: shippingSnapshot.shippingServiceTypeId,
    discountCouponCode: couponSnapshot?.discountCouponCode,
    shippingCouponCode: couponSnapshot?.shippingCouponCode,
    note: session.note ?? undefined,
  };
}
```

### 4.4. Tạo Webhook Handler – `POST /api/payments/sepay/webhook`

**File mới:** `src/app/api/payments/sepay/webhook/route.ts`

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { commitOrderFromSession } from "@/services/checkout-session-service";

export const runtime = "nodejs";

// Kiểu dữ liệu SePay webhook gửi về
interface SePayWebhookPayload {
  id: number;             // ID giao dịch SePay – dùng chống duplicate
  gateway: string;        // Tên ngân hàng
  transactionDate: string;// Thời gian giao dịch
  accountNumber: string;  // STK nhận
  code: string | null;    // Mã SePay tự nhận diện
  content: string;        // Toàn bộ nội dung chuyển khoản
  transferType: string;   // "in" | "out"
  transferAmount: number; // Số tiền
  accumulated: number;    // Số dư lũy kế
  subAccount: string | null;
  referenceCode: string;  // Mã tham chiếu SMS ngân hàng
  description: string;
}

export async function POST(request: NextRequest) {
  // ── BƯỚC 1: Parse payload ──
  let payload: SePayWebhookPayload;
  try {
    payload = (await request.json()) as SePayWebhookPayload;
  } catch {
    // Không parse được → trả 200 để SePay không retry vô ích
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 200 });
  }

  // ── BƯỚC 2: Validate các field bắt buộc ──
  if (
    typeof payload.id !== "number" ||
    !payload.id ||
    typeof payload.transferAmount !== "number" ||
    payload.transferAmount <= 0 ||
    !payload.transferType ||
    !payload.accountNumber
  ) {
    console.warn("[SePay Webhook] Payload thiếu field bắt buộc:", JSON.stringify(payload).slice(0, 200));
    return NextResponse.json({ success: true, message: "Invalid payload – ignored" }, { status: 200 });
  }

  // ── BƯỚC 3: Chỉ xử lý giao dịch tiền VÀO ──
  if (payload.transferType !== "in") {
    return NextResponse.json({ success: true, message: "Outgoing transaction – ignored" }, { status: 200 });
  }

  // ── BƯỚC 4: Validate đúng STK của shop ──
  const expectedAccountNo = process.env.QR_ACCOUNT_NO?.trim();
  if (expectedAccountNo && payload.accountNumber !== expectedAccountNo) {
    // Không phải STK của shop – bỏ qua, không cần retry
    return NextResponse.json({ success: true, message: "Account not monitored" }, { status: 200 });
  }

  // ── BƯỚC 5: Tìm mã providerRef trong nội dung chuyển khoản ──
  // Ưu tiên field "code" (SePay đã nhận diện tự động từ content)
  let matchRef: string | null = payload.code?.trim()?.toUpperCase() ?? null;

  // Fallback: dùng regex tìm trong "content" nếu code null/empty
  if (!matchRef && payload.content) {
    // DUA + 14 chữ số (yyyyMMddHHmmss) + 4 ký tự [A-Z0-9] = 22 ký tự
    const found = payload.content.match(/\bDUA[0-9]{14}[A-Z0-9]{4}\b/i);
    matchRef = found?.[0]?.toUpperCase() ?? null;
  }

  if (!matchRef) {
    // Không phải giao dịch của hệ thống này – bỏ qua yên lặng
    console.log("[SePay Webhook] Bỏ qua: không tìm thấy mã DUA trong content:", payload.content?.slice(0, 100));
    return NextResponse.json({ success: true, message: "No matching payment code" }, { status: 200 });
  }

  // ── BƯỚC 6: Tìm CheckoutSession theo providerRef ──
  // findUnique vì providerRef có @unique index → O(1)
  const session = await prisma.checkoutSession.findUnique({
    where: { providerRef: matchRef },
    select: {
      id: true,
      status: true,
      amount: true,
      expiresAt: true,
      userId: true,
      orderId: true,
      providerPayload: true,
    },
  });

  if (!session) {
    // Mã DUA tìm thấy nhưng không có session tương ứng – bỏ qua
    console.log(`[SePay Webhook] Không tìm thấy session với providerRef=${matchRef}`);
    return NextResponse.json({ success: true, message: "Session not found" }, { status: 200 });
  }

  // ── BƯỚC 7: Idempotency – tránh xử lý 2 lần ──
  if (session.status === "SUCCEEDED") {
    console.log(`[SePay Webhook] Session ${session.id} đã SUCCEEDED, bỏ qua.`);
    return NextResponse.json({ success: true, message: "Already processed" }, { status: 200 });
  }

  if (session.status === "FAILED" || session.status === "CANCELLED") {
    console.log(`[SePay Webhook] Session ${session.id} status=${session.status}, bỏ qua.`);
    return NextResponse.json({ success: true, message: "Session not active" }, { status: 200 });
  }

  // Chống duplicate: kiểm tra sePayId đã được lưu trong providerPayload chưa
  const existingPayload = session.providerPayload as { sePayId?: number } | null;
  if (existingPayload?.sePayId === payload.id) {
    console.log(`[SePay Webhook] Duplicate sePayId=${payload.id} cho session ${session.id}`);
    return NextResponse.json({ success: true, message: "Duplicate transaction" }, { status: 200 });
  }

  // ── BƯỚC 8: Validate số tiền khớp ──
  // Cho phép sai lệch ≤ 1000 VND (do làm tròn)
  const expectedAmount = Number(session.amount);
  const receivedAmount = payload.transferAmount;
  const amountDiff = Math.abs(expectedAmount - receivedAmount);

  if (amountDiff > 1000) {
    console.warn(
      `[SePay Webhook] Amount mismatch: expected=${expectedAmount}, received=${receivedAmount}`,
      { sessionId: session.id, sePayId: payload.id }
    );
    // Ghi nhận để admin review, không retry SePay
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: {
        providerPayload: {
          sePayId: payload.id,
          receivedAmount,
          expectedAmount,
          error: "AMOUNT_MISMATCH",
          content: payload.content,
          referenceCode: payload.referenceCode,
          raw: payload,
        },
      },
    });
    return NextResponse.json({ success: true, message: "Amount mismatch – pending manual review" }, { status: 200 });
  }

  // ── BƯỚC 9: Xử lý trường hợp session EXPIRED nhưng tiền đã về ──
  const now = new Date();
  const isExpired = session.expiresAt < now;
  if (isExpired) {
    // Chính sách: vẫn commit nếu tiền về thật (tránh mất tiền khách)
    // Đánh dấu latePayment trong payload để admin biết
    console.warn(`[SePay Webhook] Late payment: session ${session.id} đã hết hạn nhưng tiền vẫn về – sẽ commit.`);
  }

  // ── BƯỚC 10: Lưu raw payload vào DB (audit trail) trước khi commit ──
  await prisma.checkoutSession.update({
    where: { id: session.id },
    data: {
      providerPayload: {
        sePayId: payload.id,
        gateway: payload.gateway,
        transactionDate: payload.transactionDate,
        transferAmount: payload.transferAmount,
        referenceCode: payload.referenceCode,
        content: payload.content,
        ...(isExpired ? { latePayment: true } : {}),
      },
    },
  });

  // ── BƯỚC 11: Commit Order từ CheckoutSession ──
  let result: { orderId: string } | null = null;
  try {
    result = await commitOrderFromSession(session.id);
  } catch (err) {
    console.error("[SePay Webhook] commitOrderFromSession thất bại:", err, { sessionId: session.id });
    // Trả 500 → SePay sẽ retry (lỗi server, không phải lỗi logic)
    return NextResponse.json(
      { success: false, message: "Server error during order commit" },
      { status: 500 }
    );
  }

  if (!result) {
    // Session đã FAILED (ví dụ hết stock) – trả 200 để SePay không retry
    console.warn(`[SePay Webhook] commitOrderFromSession null cho session ${session.id} – có thể hết stock`);
    return NextResponse.json({ success: true, message: "Commit failed – see session status" }, { status: 200 });
  }

  console.log(`[SePay Webhook] ✅ Thành công: Order ${result.orderId} từ session ${session.id}`);
  return NextResponse.json({ success: true }, { status: 200 });
}
```

### 4.5. Cập nhật `POST /api/shop/payments/sessions` – nhận provider VIETQR

**File:** `src/app/api/shop/payments/sessions/route.ts`

Endpoint hiện tại chỉ nhận `provider: "VNPAY"`. Cần cho phép `"VIETQR"`:

```typescript
// Bỏ validation cứng chỉ cho VNPAY
// Để prepareCheckoutSession() tự handle từng provider
const dto = body as CreatePaymentSessionRequestDto; // provider: "VNPAY" | "VIETQR"
```

### 4.6. Cập nhật `CheckoutPage.tsx` – nhánh QR_TRANSFER gọi sessions API

**File:** `src/features/shop/components/checkout/CheckoutPage.tsx`

Khi user bấm "Tiến hành đặt hàng" với `paymentMethod === "QR_TRANSFER"`:

```typescript
if (paymentMethod === "QR_TRANSFER") {
  // Tạo CheckoutSession (VIETQR) thay vì tạo Order ngay
  const res = await fetch("/api/shop/payments/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "VIETQR",
      shippingAddress: { addressId: addressIdToUse ?? undefined },
      shippingServiceTypeId,
      discountCouponCode: appliedDiscountCouponCode ?? undefined,
      shippingCouponCode: appliedShippingCouponCode ?? undefined,
      note: note || undefined,
    }),
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    const message = json?.error ?? "Không thể khởi tạo thanh toán QR. Vui lòng thử lại.";
    setSubmitError(message);
    toast.error(message);
    return;
  }

  const data = (await res.json()) as CreatePaymentSessionResponseDto & {
    providerRef?: string;
  };

  // Lưu sessionId để VietQRPaymentScreen poll trạng thái
  try {
    sessionStorage.setItem("checkout:sessionId", data.sessionId);
  } catch { /* ignore */ }

  setVietQrData({
    sessionId: data.sessionId,           // MỚI: để poll
    orderNumber: data.providerRef ?? "", // hiển thị mã CK
    amount: data.amount,
    qrImageUrl: data.paymentUrl ?? "",   // URL ảnh QR đã điền sẵn
    bankInfo: {
      bankName: process.env.NEXT_PUBLIC_QR_BANK_ID ?? "VCB",
      accountNumber: process.env.NEXT_PUBLIC_QR_ACCOUNT_NO ?? "",
      accountHolder: process.env.NEXT_PUBLIC_QR_ACCOUNT_NAME ?? "",
      transferNote: data.providerRef ?? "",  // nội dung CK khách cần ghi
    },
    expiresAt: data.expiresAt,
  });

  setIsSubmittingOrder(false);
  submitInFlightRef.current = false;
  return; // Không đặt keepLockedUntilNavigate = true (chờ polling)
}
```

Đồng thời cập nhật `vietQrData` state để thêm `sessionId`:

```typescript
const [vietQrData, setVietQrData] = useState<{
  sessionId: string;   // MỚI
  orderNumber: string;
  amount: number;
  qrImageUrl: string;
  bankInfo: { bankName: string; accountNumber: string; accountHolder: string; transferNote: string };
  expiresAt: string;
} | null>(null);
```

Cập nhật callback khi thanh toán thành công:

```typescript
// Thay onConfirm bằng onPaymentSuccess
<VietQRPaymentScreen
  sessionId={vietQrData.sessionId}     // MỚI
  orderNumber={vietQrData.orderNumber}
  amount={vietQrData.amount}
  qrImageUrl={vietQrData.qrImageUrl}
  bankInfo={vietQrData.bankInfo}
  expiresAt={vietQrData.expiresAt}
  onPaymentSuccess={(orderId) => {     // MỚI: nhận orderId từ polling
    try { sessionStorage.setItem("checkout:lastOrderId", orderId); } catch {}
    router.push(`/checkout/success?orderId=${orderId}`);
  }}
  onCancel={() => setVietQrData(null)}
/>
```

### 4.7. Cập nhật `VietQRPaymentScreen.tsx` – thêm polling tự động

**File:** `src/features/shop/components/checkout/VietQRPaymentScreen.tsx`

Thêm `sessionId` vào props và logic polling:

```typescript
interface VietQRPaymentScreenProps {
  sessionId: string;           // MỚI
  orderNumber: string;
  amount: number;
  qrImageUrl: string;
  bankInfo: BankInfo;
  expiresAt: string;
  onPaymentSuccess: (orderId: string) => void;  // MỚI (thay onConfirm)
  onCancel: () => void;
}

// Polling session status mỗi 3 giây
useEffect(() => {
  if (!sessionId) return;

  let stopped = false;
  let pollCount = 0;
  const MAX_POLLS = 600; // 600 × 3s = 30 phút

  const poll = async () => {
    if (stopped || pollCount >= MAX_POLLS) return;
    pollCount++;

    try {
      const res = await fetch(`/api/shop/payments/sessions/${sessionId}/status`);
      if (!res.ok) return; // network error, thử lại lần sau

      const data = await res.json() as { status: string; orderId?: string };

      if (data.status === "SUCCEEDED" && data.orderId) {
        stopped = true;
        toast.success("Thanh toán thành công! Đang chuyển hướng...");
        onPaymentSuccess(data.orderId);
        return;
      }

      if (["FAILED", "EXPIRED", "CANCELLED"].includes(data.status)) {
        stopped = true;
        toast.error("Phiên thanh toán đã kết thúc. Vui lòng thử lại.");
        onCancel();
      }
    } catch {
      // ignore, tiếp tục poll
    }
  };

  void poll(); // poll ngay lần đầu
  const timer = setInterval(() => void poll(), 3000);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}, [sessionId, onPaymentSuccess, onCancel]);
```

Bỏ nút "Tôi đã chuyển khoản" (đã có auto-confirm), hoặc giữ như fallback:

```tsx
{/* Gỡ bỏ hoặc ẩn nút này khi đã có SePay webhook */}
{/* <button onClick={onConfirm}>Tôi đã chuyển khoản</button> */}

{/* Thay bằng thông báo chờ auto-confirm */}
<div className={styles["auto-confirm-notice"]}>
  <span>Hệ thống sẽ tự động xác nhận sau khi nhận được tiền (thường trong vài giây).</span>
</div>
```

### 4.8. Tạo API endpoint – `GET /api/shop/payments/sessions/[id]/status`

**File mới:** `src/app/api/shop/payments/sessions/[id]/status/route.ts`

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Select tối thiểu – không lấy cartSnapshot/shippingSnapshot (nặng)
  const checkoutSession = await prisma.checkoutSession.findFirst({
    where: {
      id: params.id,
      userId: session.user.id, // chỉ xem session của mình
    },
    select: {
      id: true,
      status: true,
      orderId: true,
      expiresAt: true,
      amount: true,
    },
  });

  if (!checkoutSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: checkoutSession.id,
    status: checkoutSession.status,           // PENDING | SUCCEEDED | FAILED | EXPIRED | CANCELLED
    orderId: checkoutSession.orderId ?? null,  // có khi SUCCEEDED
    expiresAt: checkoutSession.expiresAt.toISOString(),
    amount: Number(checkoutSession.amount),
  });
}
```

---

## 5) Database – Index và tối ưu Query

### 5.1. Index đã có (đủ dùng, không cần thêm)

```prisma
@@index([userId, status, expiresAt])  // lookup pending session khi tạo mới
@@index([providerRef])                 // match webhook → session (O log n)
```

### 5.2. Dùng `findUnique` thay vì `findFirst` để tìm session theo `providerRef`

```typescript
// ✅ ĐÚNG – providerRef là @unique nên dùng findUnique (plan index seek)
await prisma.checkoutSession.findUnique({ where: { providerRef: matchRef } });

// ❌ TRÁNH – findFirst với where { providerRef } vẫn dùng index nhưng ít rõ ràng hơn
await prisma.checkoutSession.findFirst({ where: { providerRef: matchRef } });
```

### 5.3. Select tối thiểu trong webhook handler

```typescript
// Chỉ select đúng fields cần dùng – tránh kéo cartSnapshot/shippingSnapshot (JSON lớn)
select: {
  id: true,
  status: true,
  amount: true,
  expiresAt: true,
  userId: true,
  orderId: true,
  providerPayload: true,  // để check sePayId duplicate
}
```

### 5.4. `commitOrderFromSession` đã tối ưu sẵn

- Dùng `pg_advisory_xact_lock(hashtext(userId))` → serialized per user, chống race condition.
- Recheck stock bằng `findMany` một lần (không N+1).
- Toàn bộ write operations trong một `prisma.$transaction`.

---

## 6) Luồng hoàn chỉnh từ đầu đến cuối

```
User bấm "Tiến hành đặt hàng" (QR_TRANSFER)
        │
        ▼
POST /api/shop/payments/sessions
        { provider: "VIETQR", shippingAddress, shippingServiceTypeId, ... }
        │
        ▼
prepareCheckoutSession() [trong transaction]
  ├─ pg_advisory_xact_lock(userId) → chống double-click
  ├─ Reuse session PENDING còn hạn nếu có
  ├─ Load cart, validate stock + product ACTIVE
  ├─ Tính phí ship (GHN) + coupon discount
  ├─ Tạo providerRef = "DUA20240310234512ABCD"
  ├─ Sinh qrImageUrl = img.vietqr.io/...?addInfo=DUA20240310234512ABCD&amount=...
  └─ Tạo CheckoutSession {
        provider: VIETQR, status: PENDING,
        expiresAt: now+30min, amount: 1500000,
        providerRef: "DUA20240310234512ABCD",
        paymentUrl: "https://img.vietqr.io/..."
     }
        │
        ▼
Response: { sessionId, amount, paymentUrl (QR URL), providerRef, expiresAt }
        │
        ▼
UI hiển thị VietQRPaymentScreen
  ├─ <img src=qrImageUrl /> (quét = STK + số tiền + nội dung đã điền sẵn)
  ├─ Hiển thị: STK | Chủ TK | Nội dung CK (providerRef) | Đếm ngược 30 phút
  └─ Background: poll GET /api/shop/payments/sessions/{sessionId}/status mỗi 3 giây
        │
        ▼ [Khách quét QR → app ngân hàng tự điền → xác nhận chuyển khoản]
        │
SePay nhận biến động số dư từ ngân hàng
        │
        ▼
SePay POST /api/payments/sepay/webhook
  {
    id: 92704,
    transferType: "in",
    transferAmount: 1500000,
    accountNumber: "1016625868",
    code: "DUA20240310234512ABCD",   ← SePay tự nhận diện (nếu cấu hình)
    content: "DUA20240310234512ABCD Nguyen Van A",
    referenceCode: "MBVCB.3278907687"
  }
        │
        ▼
Webhook Handler:
  [1] Parse JSON payload
  [2] Validate: id số, transferAmount > 0, transferType, accountNumber present
  [3] transferType === "in" ? tiếp tục : return 200 bỏ qua
  [4] accountNumber === QR_ACCOUNT_NO ? tiếp tục : return 200 bỏ qua
  [5] Tìm matchRef:
        code?.trim()?.toUpperCase()
        ?? regex /\bDUA[0-9]{14}[A-Z0-9]{4}\b/i trong content
  [6] matchRef không tìm được ? return 200 bỏ qua
  [7] findUnique({ where: { providerRef: matchRef } })
  [8] session không tồn tại ? return 200 bỏ qua
  [9] session.status === "SUCCEEDED" ? return 200 "Already processed"
  [10] session đã có sePayId này trong providerPayload ? return 200 duplicate
  [11] |amount - session.amount| > 1000 ?
         → ghi AMOUNT_MISMATCH vào providerPayload, return 200
  [12] session.expiresAt < now ? ghi latePayment=true, vẫn commit
  [13] Update providerPayload với raw webhook data (audit)
  [14] commitOrderFromSession(session.id) [trong transaction]:
         ├─ pg_advisory_xact_lock(userId)
         ├─ Recheck: session vẫn PENDING?
         ├─ Recheck stock từ snapshot
         ├─ Tạo Order + OrderItem (paymentProvider="QR_TRANSFER", paymentStatus=PAID)
         ├─ Trừ kho → InventoryLog
         ├─ coupon.usedCount++ (nếu có)
         ├─ Cart items delete + cart.status = CONVERTED
         └─ CheckoutSession: status=SUCCEEDED, orderId=order.id
  [15] return { success: true } HTTP 200
        │
SePay nhận 200 → KHÔNG retry ✓
        │
Đồng thời: polling client
        │
        ▼
GET /api/shop/payments/sessions/{sessionId}/status
        → { status: "SUCCEEDED", orderId: "xxx" }
        │
        ▼
VietQRPaymentScreen.onPaymentSuccess("xxx")
        │
        ▼
router.push("/checkout/success?orderId=xxx")
```

---

## 7) Edge Cases và cách xử lý

### 7.1. Khách chuyển khoản sai số tiền (`amountDiff > 1000`)

- Ghi `error: "AMOUNT_MISMATCH"` vào `providerPayload`.
- Trả `200` để SePay không retry (đây là dữ liệu thật, không phải lỗi server).
- Admin kiểm tra log, hoàn tiền thủ công nếu cần.

### 7.2. Khách không ghi đúng nội dung / ghi sai mã

- `matchRef = null` → bỏ qua, trả `200`.
- Giảm thiểu rủi ro: QR image từ `img.vietqr.io` đã điền sẵn nội dung đúng, khách chỉ cần quét.
- Admin xem SePay logs và xử lý thủ công nếu có yêu cầu.

### 7.3. Session hết hạn 30 phút nhưng tiền vẫn về

- Vẫn commit Order (ghi `latePayment: true` trong `providerPayload`).
- Lý do: tiền đã thu thực sự, phải giao hàng.

### 7.4. SePay retry gửi cùng giao dịch 2 lần

- Lần 1: session `PENDING` → commit → session `SUCCEEDED`.
- Lần 2 (retry): `session.status === "SUCCEEDED"` → return `200 "Already processed"`.
- Hoặc nếu lần 1 chưa commit xong: `existingPayload.sePayId === payload.id` → return `200 "Duplicate"`.

### 7.5. SePay gửi cùng lúc 2 request (network duplicate)

- `pg_advisory_xact_lock(hashtext(userId))` trong `commitOrderFromSession` đảm bảo serialized.
- Lần 2 vào transaction, thấy session đã `SUCCEEDED` → return idempotent.

### 7.6. Hết stock tại thời điểm commit

- `commitOrderFromSession` set session `FAILED`, return `null`.
- Webhook handler trả `200` (không retry, vì đây là lỗi nghiệp vụ không phải lỗi server).
- Admin cần hoàn tiền với thông tin từ `providerPayload.referenceCode`.

### 7.7. Server timeout (phải trả trong 8 giây)

- SePay timeout response: **8 giây**.
- Toàn bộ webhook handler bao gồm `commitOrderFromSession` phải chạy trong < 8s.
- Nếu `commitOrderFromSession` chậm (> 7s): cân nhắc tách ra background job và trả `200 { success: true }` ngay, commit async.

---

## 8) Cấu hình SePay Dashboard

### 8.1. Tạo Webhook trong SePay

1. Đăng nhập [my.sepay.vn](https://my.sepay.vn)
2. Menu **WebHooks** → **+ Thêm webhooks**
3. Điền:

| Trường | Giá trị |
|--------|---------|
| Tên | DucUyAudio - Xác nhận thanh toán |
| Sự kiện | **Có tiền vào** |
| Tài khoản ngân hàng | Chọn STK shop |
| Bỏ qua nếu không có Code | **Không** (vẫn gửi dù không nhận diện được mã) |
| Gọi đến URL | `https://yourdomain.com/api/payments/sepay/webhook` |
| Là webhook xác thực thanh toán | **Đúng** |
| Gọi lại khi | HTTP Status không nằm trong 200–299 |
| Kiểu chứng thực | **Không cần chứng thực** |
| Request Content type | `application/json` |

### 8.2. Cấu hình nhận diện mã thanh toán (quan trọng)

Để field `code` trong webhook có giá trị (thay vì null):

1. Menu **Công ty** → **Cấu hình chung** → **Cấu trúc mã thanh toán**
2. Cấu hình prefix: `DUA`
3. Sau đó SePay tự trích mã `DUA...` từ nội dung và gán vào field `code`.
4. Nếu không cấu hình: code = null, webhook handler vẫn hoạt động qua regex fallback.

### 8.3. Test với tài khoản Demo SePay

1. Đăng nhập [my.dev.sepay.vn](https://my.dev.sepay.vn)
2. **Tạo một CheckoutSession VIETQR** thật qua UI checkout của dự án → lấy `providerRef`.
3. Menu **Giao dịch** → **Giả lập giao dịch**:

| Field | Giá trị |
|-------|---------|
| Tài khoản | STK đã cấu hình webhook |
| Loại | Tiền vào |
| Số tiền | Nhập ĐÚNG số tiền trong session |
| Nội dung | `DUA20240310234512ABCD` (copy providerRef từ DB) |

4. Submit → kiểm tra **Nhật ký Webhooks** xem kết quả gọi về server.
5. Kiểm tra DB: `CheckoutSession.status` đã `SUCCEEDED`, `Order` đã được tạo chưa.

---

## 9) Biến môi trường cần có

```env
# Bank account (đã có, không cần thêm cho SePay)
QR_BANK_ID=VCB
QR_ACCOUNT_NO=1016625868
QR_ACCOUNT_NAME=Ngo Duc Uy

# Để UI hiển thị thông tin ngân hàng (public)
NEXT_PUBLIC_QR_BANK_ID=Vietcombank
NEXT_PUBLIC_QR_ACCOUNT_NO=1016625868
NEXT_PUBLIC_QR_ACCOUNT_NAME=Ngo Duc Uy
```

> ✅ Không cần `SEPAY_WEBHOOK_SECRET` hay API key gì thêm – SePay gửi webhook không cần xác thực, ta chỉ validate bằng logic nghiệp vụ.

---

## 10) Checklist triển khai

### Phase 1: Backend

- [ ] `src/services/checkout-session-service.ts`:
  - [ ] Bỏ guard `provider !== "VNPAY"` → throw error
  - [ ] Thêm nhánh `VIETQR` trong `prepareCheckoutSession()`
  - [ ] Import `generateVietQRUrl` từ `@/lib/vietqr`
  - [ ] Sửa `buildOrderRequestFromSession()`: map `VIETQR` → `paymentMethod: "QR_TRANSFER"`
- [ ] Tạo `src/app/api/payments/sepay/webhook/route.ts`
- [ ] Tạo `src/app/api/shop/payments/sessions/[id]/status/route.ts`
- [ ] Cập nhật `src/app/api/shop/payments/sessions/route.ts`: cho phép `provider: "VIETQR"`
- [ ] Cập nhật `src/types/payment.ts`: thêm `providerRef?: string` vào `CreatePaymentSessionResponseDto`

### Phase 2: Frontend

- [ ] `CheckoutPage.tsx`:
  - [ ] Nhánh `QR_TRANSFER` gọi `POST /api/shop/payments/sessions` (thay cho `POST /api/shop/orders`)
  - [ ] Thêm `sessionId` vào `vietQrData` state
  - [ ] Đổi `onConfirm` → `onPaymentSuccess: (orderId: string) => void`
- [ ] `VietQRPaymentScreen.tsx`:
  - [ ] Thêm prop `sessionId: string`
  - [ ] Thêm prop `onPaymentSuccess: (orderId: string) => void`
  - [ ] Thêm polling `useEffect` mỗi 3 giây
  - [ ] Bỏ hoặc ẩn nút "Tôi đã chuyển khoản"
- [ ] Thêm biến `NEXT_PUBLIC_QR_*` vào `.env` để UI dùng

### Phase 3: Cấu hình & Test

- [ ] Cấu hình Webhook trong SePay Dashboard (URL, không cần auth)
- [ ] Cấu hình "Cấu trúc mã thanh toán" prefix `DUA` trong SePay
- [ ] Test với SePay Demo (giả lập giao dịch)
- [ ] Test edge cases:
  - [ ] Đúng mã, đúng tiền → Order tạo thành công
  - [ ] Đúng mã, sai tiền → ghi AMOUNT_MISMATCH, không tạo Order
  - [ ] Sai mã / không có mã → bỏ qua, không lỗi
  - [ ] Gửi 2 lần cùng payload → idempotent, Order vẫn chỉ tạo 1 lần
  - [ ] Session hết hạn, tiền về → vẫn commit với flag latePayment

### Phase 4: Production

- [ ] Deploy và cấu hình SePay Webhook URL sang domain production
- [ ] Theo dõi Nhật ký Webhooks trên SePay Dashboard
- [ ] Theo dõi logs server cho `[SePay Webhook]`

---

## 11) So sánh luồng VNPAY vs SePay (VietQR)

| Điểm | VNPAY | SePay QR |
|------|-------|----------|
| Khởi tạo | `POST /sessions` provider=VNPAY | `POST /sessions` provider=VIETQR |
| User action | Redirect tới VNPAY | Quét QR trên trang |
| Auto-confirm | VNPAY IPN (server→server) | SePay Webhook (server→server) |
| Match giao dịch | `vnp_TxnRef === providerRef` (exact) | `code` hoặc regex trong `content` |
| Xác thực webhook | HMAC-SHA512 signature | Không cần – validate bằng logic |
| Idempotency | `providerRef @unique` + session status | `sePayId` trong `providerPayload` + session status |
| Commit function | `commitOrderFromSession()` | `commitOrderFromSession()` (**dùng chung**) |
| Polling client | `GET /checkout/processing` | `GET /sessions/{id}/status` |
| Timeout | VNPAY spec riêng | SePay: 8 giây response |
