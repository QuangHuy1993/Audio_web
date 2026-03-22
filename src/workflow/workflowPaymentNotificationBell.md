# Workflow: Payment Notification Bell & Auto-Expire CheckoutSession

**Phiên bản:** 1.0  
**Ngày tạo:** 2026-03-14  
**Scope:** ShopHeader — Bell Button + CheckoutSession auto-expire sau 30 phút

---

## 1. Phân tích hiện trạng

### 1.1 Schema CheckoutSession (prisma/schema.prisma)

```
model CheckoutSession {
  id               String           @id @default(cuid())
  userId           String
  provider         CheckoutProvider   // VNPAY | VIETQR
  status           CheckoutStatus     // PENDING | SUCCEEDED | FAILED | EXPIRED | CANCELLED
  expiresAt        DateTime
  amount           Decimal
  currency         String
  cartSnapshot     Json
  shippingSnapshot Json
  couponSnapshot   Json?
  note             String?
  providerRef      String?          @unique
  paymentUrl       String?
  providerPayload  Json?
  providerCode     String?
  orderId          String?          @unique
  createdAt        DateTime
  updatedAt        DateTime
}
```

### 1.2 TTL hiện tại

- **VIETQR**: `expiresAt = now + 30 phút`
- **VNPAY**: `expiresAt = now + 10 phút`
- Định nghĩa trong `src/services/checkout-session-service.ts` dòng 192.

### 1.3 Điều chưa có

| Thiếu | Hậu quả |
|---|---|
| Không có cron job / endpoint expire | Session `PENDING` tồn tại mãi trong DB sau khi hết hạn; chỉ bị lọc ra nhờ `expiresAt > now` ở truy vấn |
| Không có bell notification ở header | Người dùng quên hoặc không biết còn session chờ |
| Không có "lazy expiry" khi đọc | Status trong DB vẫn là PENDING dù `expiresAt` đã qua |

### 1.4 Endpoint liên quan hiện có

| Endpoint | Mục đích |
|---|---|
| `GET /api/shop/payments/sessions/active` | Trả session PENDING chưa hết hạn (cả hai provider) |
| `GET /api/shop/payments/pending` | Chỉ trả VNPAY PENDING, dùng cho checkout/processing page |
| `POST /api/shop/payments/sessions/[id]/cancel` | Huỷ session theo id |

---

## 2. Yêu cầu tính năng

### 2.1 Auto-expire CheckoutSession

- Bất kỳ session nào có `status = PENDING` và `expiresAt < now()` phải được đánh dấu `EXPIRED`.
- Cơ chế thực hiện: **Lazy expiry + Cron API endpoint**:
  - **Lazy expiry**: Mỗi khi API đọc pending session, đồng thời update EXPIRED nếu cần.
  - **Cron endpoint**: `POST /api/cron/expire-checkout-sessions` — được gọi định kỳ (Vercel Cron, external scheduler, hoặc manual).
- Kết quả: giải phóng kho hàng đã lock và coupon đã dùng (nếu có).

### 2.2 Bell Notification Button

- Vị trí: Header, nằm giữa button "Tư vấn AI" và wishlist icon.
- Style: **cùng kiểu viền tròn** với cart/wishlist button (`36×36px`, nền tối, icon trắng).
- Badge: **Dấu chấm xanh nhỏ** (pulsing) khi có session đang chờ.
- Chỉ render khi user đã đăng nhập.
- Polling: fetch mỗi 60s để cập nhật trạng thái badge.

### 2.3 Payment Notification Popup

Khi bấm vào bell:
- Gọi `GET /api/shop/payments/sessions/active` để lấy session.
- Hiển thị popup modal với:
  - Thông tin đơn chờ: Provider, số tiền, thời gian còn lại.
  - **Nút "Tiếp tục thanh toán"** → Redirect đến trang phù hợp.
  - **Nút "Huỷ đơn này"** → Gọi `POST /api/shop/payments/sessions/[id]/cancel` → đóng popup → clear badge.
- Nếu không có session nào: popup thông báo "Không có đơn hàng nào đang chờ thanh toán."

---

## 3. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────┐
│                   ShopHeader.tsx                    │
│  [AI btn] [Bell btn 🔔 + badge] [Wishlist] [Cart]   │
│                     │                               │
│             onClick bell                            │
│                     ▼                               │
│           PaymentNotificationPopup.tsx              │
│           ┌──────────────────────────┐              │
│           │  "Còn đơn chờ thanh toán"│              │
│           │  Provider + Số tiền + TTL │              │
│           │  [Tiếp tục] [Huỷ đơn]    │              │
│           └──────────────────────────┘              │
└─────────────────────────────────────────────────────┘
              │                    │
     "Tiếp tục"                  "Huỷ"
              │                    │
  VNPAY → /checkout/processing     │
  VietQR → /checkout/qr-debug      │
              │          POST /api/shop/payments/
              │          sessions/[id]/cancel
              │                    │
              ▼                    ▼
     (redirect + resume)   status=CANCELLED, close popup

┌──────────────────────────────────────────────────────┐
│             Auto-Expire Layer                        │
│                                                      │
│  POST /api/cron/expire-checkout-sessions             │
│  → UPDATE CheckoutSession                            │
│    SET status = 'EXPIRED'                            │
│    WHERE status = 'PENDING' AND expiresAt < now()    │
│                                                      │
│  GET /api/shop/payments/sessions/active (lazy)       │
│  → Trước khi trả về: sweep expired sessions          │
└──────────────────────────────────────────────────────┘
```

---

## 4. Danh sách file cần tạo / chỉnh sửa

| File | Loại | Mô tả |
|---|---|---|
| `src/app/api/cron/expire-checkout-sessions/route.ts` | NEW | Cron endpoint sweep EXPIRED sessions |
| `src/app/api/shop/payments/sessions/active/route.ts` | MODIFY | Thêm lazy-expire sweep trước khi trả về |
| `src/components/shared/PaymentNotificationPopup.tsx` | NEW | Popup component |
| `src/components/shared/PaymentNotificationPopup.module.css` | NEW | CSS BEM cho popup |
| `src/components/layout/ShopHeader.tsx` | MODIFY | Thêm bell button + state + polling |
| `src/components/layout/ShopHeader.module.css` | MODIFY | CSS cho bell button + badge + popup |

---

## 5. Chi tiết implementation

### 5.1 Cron endpoint — `POST /api/cron/expire-checkout-sessions`

**Mục đích:** Được gọi định kỳ (mỗi 5–15 phút) để sweep tất cả session PENDING đã quá hạn.

**Luồng:**
1. Xác thực `Authorization: Bearer ${CRON_SECRET}` từ header → trả `403` nếu sai.
2. `UPDATE CheckoutSession SET status = 'EXPIRED' WHERE status = 'PENDING' AND expiresAt < NOW()`.
3. Log số lượng session đã expire.
4. Trả về `{ expired: count }`.

**Bảo mật:**
- Env var: `CRON_SECRET` (ngẫu nhiên, không public).
- Nếu không có `CRON_SECRET` env: log warning và vẫn cho phép (dev mode).

```typescript
// src/app/api/cron/expire-checkout-sessions/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization") ?? "";
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const now = new Date();

  const result = await prisma.checkoutSession.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  console.info(
    `[Cron][ExpireCheckoutSessions] Expired ${result.count} sessions at ${now.toISOString()}`,
  );

  return NextResponse.json({ expired: result.count });
}
```

**Cấu hình Vercel Cron (vercel.json):**
```json
{
  "crons": [
    {
      "path": "/api/cron/expire-checkout-sessions",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

---

### 5.2 Lazy-expire trong `GET /api/shop/payments/sessions/active`

**Thêm sweep TRƯỚC khi findFirst:**

```typescript
// Lazy sweep — mark expired sessions trước khi query
await prisma.checkoutSession.updateMany({
  where: {
    userId: session.user.id,
    status: "PENDING",
    expiresAt: { lt: new Date() },
  },
  data: { status: "EXPIRED" },
});

// Sau đó mới findFirst như cũ
const activeSession = await prisma.checkoutSession.findFirst({
  where: {
    userId: session.user.id,
    status: "PENDING",
    expiresAt: { gt: new Date() },
  },
  ...
});
```

**Response shape bổ sung** (cần thêm để popup render đầy đủ):

```typescript
{
  id: string;
  provider: "VNPAY" | "VIETQR";
  status: "PENDING";
  expiresAt: string;           // ISO string
  amount: number;
  currency: string;
  paymentUrl: string | null;   // VNPAY redirect URL
}
```

---

### 5.3 PaymentNotificationPopup component

**File:** `src/components/shared/PaymentNotificationPopup.tsx`

**Props:**
```typescript
type PaymentNotificationPopupProps = {
  session: {
    id: string;
    provider: "VNPAY" | "VIETQR";
    expiresAt: string;
    amount: number;
    currency: string;
    paymentUrl: string | null;
  } | null;
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onContinue: () => void;
  onCancel: () => Promise<void>;
};
```

**Logic countdown:** `useEffect` với `setInterval(1s)` tính `timeLeft` từ `expiresAt`.

**UI states:**
1. `isLoading=true` → skeleton / spinner
2. `session=null && !isLoading` → "Không có đơn chờ thanh toán"
3. `session != null` → hiển thị chi tiết + nút

**Xử lý "Tiếp tục thanh toán":**
- VNPAY: `window.location.href = session.paymentUrl` (nếu còn paymentUrl) hoặc `router.push("/checkout/processing?sessionId=...")`
- VietQR: `router.push("/checkout/qr-debug?sessionId=...")`

**Xử lý "Huỷ đơn":**
1. Set `isCancelling = true`
2. `POST /api/shop/payments/sessions/${session.id}/cancel`
3. Nếu thành công: `onCancel()` → clear badge → đóng popup
4. Nếu lỗi: `toast.error(...)`, không đóng popup

---

### 5.4 Thêm Bell Button vào ShopHeader

**State mới cần thêm vào ShopHeader.tsx:**

```typescript
const [hasPendingPayment, setHasPendingPayment] = useState(false);
const [isNotifOpen, setIsNotifOpen] = useState(false);
const [pendingSession, setPendingSession] = useState<PendingSessionDto | null>(null);
const [isLoadingNotif, setIsLoadingNotif] = useState(false);
const notifRef = useRef<HTMLDivElement>(null);
```

**Type cần định nghĩa:**
```typescript
type PendingSessionDto = {
  id: string;
  provider: "VNPAY" | "VIETQR";
  expiresAt: string;
  amount: number;
  currency: string;
  paymentUrl: string | null;
};
```

**Polling effect:**
```typescript
useEffect(() => {
  if (!isAuthenticated) return;

  const checkPending = async () => {
    try {
      const res = await fetch("/api/shop/payments/sessions/active");
      if (!res.ok) return;
      const data = await res.json() as PendingSessionDto | null;
      setHasPendingPayment(data !== null);
    } catch {
      // silent fail
    }
  };

  void checkPending();
  const interval = setInterval(() => void checkPending(), 60_000);
  return () => clearInterval(interval);
}, [isAuthenticated]);
```

**fetchNotifDetails (gọi khi bấm bell):**
```typescript
const handleBellClick = async () => {
  setIsNotifOpen(true);
  setIsLoadingNotif(true);
  try {
    const res = await fetch("/api/shop/payments/sessions/active");
    if (!res.ok) { setPendingSession(null); return; }
    const data = await res.json() as PendingSessionDto | null;
    setPendingSession(data);
    setHasPendingPayment(data !== null);
  } catch {
    setPendingSession(null);
  } finally {
    setIsLoadingNotif(false);
  }
};
```

**JSX — Bell Button (chèn sau AI button, trước wishlist):**
```jsx
{isAuthenticated && (
  <div className={styles["shop-header-header__notif-wrapper"]} ref={notifRef}>
    <button
      type="button"
      className={clsx(
        styles["shop-header-header__notif-button"],
        hasPendingPayment && styles["shop-header-header__notif-button--active"],
      )}
      onClick={handleBellClick}
      aria-label="Thông báo thanh toán"
    >
      <MdNotifications aria-hidden="true" />
      {hasPendingPayment && (
        <span className={styles["shop-header-header__notif-badge"]} />
      )}
    </button>

    {isNotifOpen && (
      <PaymentNotificationPopup
        session={pendingSession}
        isOpen={isNotifOpen}
        isLoading={isLoadingNotif}
        onClose={() => setIsNotifOpen(false)}
        onContinue={() => setIsNotifOpen(false)}
        onCancel={async () => {
          setHasPendingPayment(false);
          setPendingSession(null);
          setIsNotifOpen(false);
        }}
      />
    )}
  </div>
)}
```

**Import cần thêm:**
```typescript
import { MdNotifications } from "react-icons/md";
import PaymentNotificationPopup from "@/components/shared/PaymentNotificationPopup";
```

---

### 5.5 CSS — Bell Button & Badge

**Thêm vào `ShopHeader.module.css`:**

```css
/* Bell notification wrapper */
.shop-header-header__notif-wrapper {
  position: relative;
}

/* Bell button — cùng style với cart/wishlist */
.shop-header-header__notif-button {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  transition: background-color 0.16s ease, transform 0.1s ease;
}

.shop-header-header__notif-button:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: translateY(-1px);
}

/* Active state when there's a pending payment */
.shop-header-header__notif-button--active {
  background: rgba(29, 185, 84, 0.2);
  border: 1px solid rgba(29, 185, 84, 0.4);
  color: var(--primary);
}

/* Pulsing badge dot */
.shop-header-header__notif-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--primary);
  border: 1.5px solid #0f1115;
  animation: shop-header-notif-pulse 2s infinite;
}

@keyframes shop-header-notif-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(29, 185, 84, 0.7); }
  70%  { box-shadow: 0 0 0 6px rgba(29, 185, 84, 0); }
  100% { box-shadow: 0 0 0 0 rgba(29, 185, 84, 0); }
}
```

---

### 5.6 CSS — PaymentNotificationPopup (BEM)

**Block:** `payment-notif-popup`

```css
/* Overlay */
.payment-notif-popup__overlay { ... }

/* Container */
.payment-notif-popup__container {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 320px;
  background: var(--background-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
  z-index: 1200;
  overflow: hidden;
}

/* Header */
.payment-notif-popup__header { ... }
.payment-notif-popup__title { font-weight: 700; font-size: 14px; }
.payment-notif-popup__close-btn { ... }

/* Body */
.payment-notif-popup__body { padding: 16px; }
.payment-notif-popup__empty { text-align: center; color: var(--text-tertiary); font-size: 13px; }
.payment-notif-popup__session-card { ... }
.payment-notif-popup__provider-badge { ... }  /* "VietQR" / "VNPAY" */
.payment-notif-popup__amount { font-size: 20px; font-weight: 700; color: var(--primary); }
.payment-notif-popup__countdown { font-size: 12px; color: var(--text-secondary); }
.payment-notif-popup__countdown--urgent { color: var(--error); font-weight: 600; }

/* Actions */
.payment-notif-popup__actions { display: flex; gap: 8px; padding: 12px 16px; }
.payment-notif-popup__btn-continue { flex: 1; background: var(--primary); ... }
.payment-notif-popup__btn-cancel { flex: 1; background: transparent; border: 1px solid var(--border-color); ... }
.payment-notif-popup__btn-cancel--loading { opacity: 0.6; cursor: not-allowed; }

/* Skeleton */
.payment-notif-popup__skeleton { ... }
```

---

## 6. Validate & Error Handling

### 6.1 API `POST /api/cron/expire-checkout-sessions`

| Case | Behaviour |
|---|---|
| Không có `CRON_SECRET` env | Cho phép (dev fallback), log warning |
| Header `Authorization` sai | `403 Forbidden` |
| Prisma error | `500` + console.error |
| Không có session nào cần expire | `{ expired: 0 }` — OK |

### 6.2 API `GET /api/shop/payments/sessions/active`

| Case | Behaviour |
|---|---|
| Chưa đăng nhập | `401` |
| Lazy-expire updateMany fail | Log error, tiếp tục query (không block) |
| Không có session active | `null` response (200) |
| Nhiều session PENDING (edge case) | Lấy `createdAt: desc` → cái mới nhất |

### 6.3 Frontend PaymentNotificationPopup

| Case | Behaviour |
|---|---|
| Fetch active session lỗi | Close popup, toast.error |
| Cancel session lỗi 400 ("not pending") | Toast: "Đơn này không còn ở trạng thái chờ. Vui lòng tải lại trang." |
| Cancel session lỗi 404 | Toast: "Không tìm thấy đơn hàng." |
| Session expired trước khi user bấm "Tiếp tục" | Redirect về checkout → page tự xử lý session expired |
| `paymentUrl` null khi VNPAY | Redirect `/checkout/processing?sessionId=...` thay vì dùng paymentUrl |
| Countdown về 0 | Hiển thị "Phiên đã hết hạn", ẩn nút "Tiếp tục", chỉ còn "Đóng" |
| isLoading | Skeleton 3 dòng trong popup body |

### 6.4 Bell Badge Polling

| Case | Behaviour |
|---|---|
| Fetch lỗi (network) | Silent fail — giữ state cũ |
| User đăng xuất | `clearInterval`, reset `hasPendingPayment = false` |
| Session vừa cancel | Polling tiếp theo (≤60s) tự clear badge |
| Immediate update | Sau khi cancel thành công, cập nhật state ngay (không chờ polling) |

---

## 7. Test Cases

### 7.1 Unit / Integration Tests

#### TC-001: Cron expire endpoint — bảo mật

```
Input: POST /api/cron/expire-checkout-sessions
  Headers: Authorization: Bearer wrong-secret
Expected: 403 Forbidden
```

```
Input: POST /api/cron/expire-checkout-sessions
  Headers: Authorization: Bearer correct-secret
  DB: 0 sessions cần expire
Expected: 200 { expired: 0 }
```

#### TC-002: Cron expire — logic

```
Setup:
  - Session A: status=PENDING, expiresAt = now - 1h
  - Session B: status=PENDING, expiresAt = now + 30min
  - Session C: status=SUCCEEDED, expiresAt = now - 2h

Input: POST /api/cron/expire-checkout-sessions

Expected:
  - Session A: status = EXPIRED
  - Session B: status = PENDING (không đổi)
  - Session C: status = SUCCEEDED (không đổi)
  - Response: { expired: 1 }
```

#### TC-003: GET /api/shop/payments/sessions/active — lazy expire

```
Setup:
  - User đăng nhập userId=U1
  - Session A: userId=U1, status=PENDING, expiresAt = now - 5min (đã hết hạn)
  - Session B: userId=U1, status=PENDING, expiresAt = now + 20min (còn hạn)

Input: GET /api/shop/payments/sessions/active (authed as U1)

Expected:
  - Session A: status → EXPIRED trong DB (lazy sweep)
  - Response: { id: B.id, provider: ..., expiresAt: ..., amount: ..., ... }
  - HTTP 200
```

```
Setup:
  - User U1 không có session PENDING nào còn hạn

Input: GET /api/shop/payments/sessions/active

Expected:
  - Response: null
  - HTTP 200
```

#### TC-004: POST cancel — guard check

```
Setup: Session A: status=SUCCEEDED

Input: POST /api/shop/payments/sessions/A.id/cancel (authed as owner)

Expected: 400 { error: "Session is not pending" }
```

```
Input: POST /api/shop/payments/sessions/fake-id/cancel (authed)

Expected: 404 { error: "Session not found" }
```

```
Input: POST /api/shop/payments/sessions/A.id/cancel (authed as DIFFERENT user)

Expected: 404 { error: "Session not found" } (không lộ session của người khác)
```

#### TC-005: Cancel giải phóng trạng thái

```
Setup:
  - Session A: status=PENDING, userId=U1
  - DB có locked stock liên quan

Input: POST /api/shop/payments/sessions/A.id/cancel

Expected:
  - Session A: status = CANCELLED
  - Response: { success: true }
  - (optional) stock restoration nếu có
```

### 7.2 Frontend Component Tests (Jest + React Testing Library)

#### TC-101: Bell button render

```
Condition: User đăng nhập, hasPendingPayment = false
Expected: Bell button render, KHÔNG có badge dot, aria-label = "Thông báo thanh toán"
```

```
Condition: User đăng nhập, hasPendingPayment = true
Expected: Bell button render CÓ badge dot pulsing (class --active)
```

```
Condition: User CHƯA đăng nhập
Expected: Bell button KHÔNG render
```

#### TC-102: PopupNotification — loading state

```
Condition: isLoading = true
Expected: Skeleton hiển thị, các nút bị disable
```

#### TC-103: PopupNotification — no pending session

```
Condition: isLoading = false, session = null
Expected: Hiển thị "Không có đơn hàng nào đang chờ thanh toán"
  Nút "Tiếp tục" và "Huỷ đơn" KHÔNG hiển thị
```

#### TC-104: PopupNotification — has pending session

```
Condition: session = { provider: "VIETQR", amount: 2500000, expiresAt: +20min }
Expected:
  - Hiển thị "VietQR" badge
  - Hiển thị "2.500.000 ₫"
  - Countdown đang chạy (e.g. "Còn 19:59")
  - Nút "Tiếp tục thanh toán" và "Huỷ đơn này" đều visible
```

#### TC-105: Countdown — urgent state

```
Condition: expiresAt = now + 2min
Expected: Countdown text có class "--urgent" (màu đỏ)
```

#### TC-106: Countdown về 0

```
Condition: expiresAt = now - 1s (đã hết hạn khi popup mở)
Expected:
  - Countdown hiển thị "Phiên đã hết hạn"
  - Nút "Tiếp tục" bị ẩn / disabled
  - Chỉ còn nút "Đóng"
```

#### TC-107: Cancel flow — success

```
Condition: session tồn tại, fetch mock trả 200 { success: true }
Action: Bấm "Huỷ đơn này"
Expected:
  - Button vào trạng thái loading (spinner)
  - Sau khi resolve: popup đóng, badge biến mất
  - toast.success hiển thị
```

#### TC-108: Cancel flow — error

```
Condition: fetch mock trả 400 { error: "Session is not pending" }
Action: Bấm "Huỷ đơn này"
Expected:
  - Button ra khỏi loading
  - Popup vẫn mở
  - toast.error với message phù hợp
```

#### TC-109: Continue — VNPAY

```
Condition: session = { provider: "VNPAY", paymentUrl: "https://sandbox.vnpayment.vn/..." }
Action: Bấm "Tiếp tục thanh toán"
Expected: window.location.href = paymentUrl
```

#### TC-110: Continue — VietQR

```
Condition: session = { provider: "VIETQR", id: "sess_abc" }
Action: Bấm "Tiếp tục thanh toán"
Expected: router.push("/checkout/qr-debug?sessionId=sess_abc")
```

#### TC-111: Close button

```
Action: Bấm nút × ở góc popup
Expected: onClose() gọi, popup unmount
```

#### TC-112: Polling interval

```
Setup: useEffect với interval 60s
Action: mount component, wait 61s
Expected: fetch được gọi lần 2
Action: unmount
Expected: clearInterval (no leak)
```

### 7.3 E2E Test Cases (Playwright / manual)

#### E2E-001: Toàn bộ flow VietQR + Bell

```
1. Đăng nhập
2. Thêm sản phẩm vào giỏ
3. Checkout chọn VietQR → tạo session (expiresAt = +30min)
4. Thoát trang (không thanh toán)
5. Quay về trang chủ
6. Quan sát bell icon → có badge dot xanh
7. Bấm bell → popup xuất hiện
8. Xác nhận thông tin đúng (VietQR, số tiền, countdown)
9. Bấm "Tiếp tục" → redirect /checkout/qr-debug?sessionId=...
```

#### E2E-002: Huỷ từ bell popup

```
1. Session PENDING đang tồn tại (từ E2E-001 step 1–4)
2. Bấm bell → popup
3. Bấm "Huỷ đơn này" → confirm
4. Popup đóng
5. Badge biến mất
6. Polling 60s sau → vẫn không có badge
7. Kiểm tra DB: status = CANCELLED
```

#### E2E-003: Auto-expire sau thời gian thực

```
1. Tạo session với expiresAt = now + 1min (test env)
2. Chờ 1 phút + buffer
3. Call GET /api/shop/payments/sessions/active
4. Expected: null (lazy sweep đã mark EXPIRED)
5. Bell badge không hiển thị
```

#### E2E-004: Cron expire — Vercel Cron hoặc manual call

```
1. Tạo nhiều session PENDING với expiresAt đã qua
2. POST /api/cron/expire-checkout-sessions với Bearer secret
3. Kiểm tra DB: tất cả session đó status = EXPIRED
4. Response: { expired: N }
```

---

## 8. Thứ tự implement

```
Phase 1 — Backend (không ảnh hưởng UI)
  [x] 1. Cron endpoint expire-checkout-sessions
  [x] 2. Lazy-expire trong GET /api/shop/payments/sessions/active
       (thêm select paymentUrl vào response)

Phase 2 — Component
  [x] 3. PaymentNotificationPopup.tsx + module.css

Phase 3 — Header
  [x] 4. Thêm bell button state + polling vào ShopHeader.tsx
  [x] 5. CSS bell button + badge trong ShopHeader.module.css
  [x] 6. Mount PopupNotification trong ShopHeader

Phase 4 — Polish & Testing
  [x] 7. Close popup khi click outside (useEffect + clickOutside)
  [x] 8. ReadLints tất cả file đã chỉnh
  [x] 9. Manual test E2E-001 → E2E-004
```

---

## 9. Môi trường & Biến môi trường cần thêm

| Biến | Giá trị mẫu | Bắt buộc |
|---|---|---|
| `CRON_SECRET` | `some-random-32char-string` | Optional (dev bỏ qua) |

---

## 10. Ghi chú kiến trúc

- **Không dùng WebSocket / SSE** cho bell notification — polling 60s là đủ với UX này, tránh phức tạp hoá infra.
- **Không block response** với lazy-expire: nếu `updateMany` fail, vẫn trả về dữ liệu cho user.
- **Popup là positioned absolute** (xuất hiện dưới bell button), KHÔNG phải full-screen modal — phù hợp UX nhanh như notification tray.
- **Cancel không restore stock/coupon** trong scope hiện tại — checkout-session-service hiện chưa lock stock khi tạo session (stock bị trừ khi `SUCCEEDED`). Nếu sau này có lock, cần thêm restore logic vào cancel handler.
- **Bell chỉ hiện cho authenticated user** — không fetch gì khi chưa đăng nhập.
- **Polling dừng khi unmount** — `clearInterval` trong cleanup của `useEffect`.
