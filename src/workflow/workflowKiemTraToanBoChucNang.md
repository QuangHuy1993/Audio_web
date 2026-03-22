# Báo cáo tổng hợp: Các chức năng chưa làm / cần bổ sung

**Ngày kiểm tra:** 2026-03-14  
**Scope:** Toàn bộ dự án `/Users/quanghuy/Desktop/audio-ai-web`

---

## Tóm tắt mức độ ưu tiên

| Mức | Ký hiệu | Ý nghĩa |
|-----|---------|---------|
| Cao | [P1] | Ảnh hưởng đến trải nghiệm người dùng chính hoặc tính toàn vẹn dữ liệu |
| Trung | [P2] | Tính năng còn thiếu nhưng không chặn luồng chính |
| Thấp | [P3] | Cải thiện UX/code quality, không ảnh hưởng nghiệp vụ |

---

## 1. SHOP — PHÍA NGƯỜI DÙNG

### 1.1 Auth (Xác thực)

| STT | Vấn đề | Mức |
|-----|--------|-----|
| A1 | **"Ghi nhớ đăng nhập 30 ngày"** ở trang login: checkbox có state nhưng không được truyền vào `signIn` — hoàn toàn không có tác dụng | [P2] |
| A2 | **Đăng ký — liên kết "Điều khoản dịch vụ" / "Chính sách bảo mật"** là `<button>` rỗng, không có onClick cũng không có href — không dẫn đến đâu | [P2] |


---

### 1.2 Trang chủ (`/`)

| STT | Vấn đề | Mức |
|-----|--------|-----|
| H1 | **Combo/bundle system** — workflow mô tả section "hệ thống combo" nhưng schema không có model `Combo` hay `ProductSet`, hiện chỉ là UI tĩnh | [P2] |
| H2 | **Smart filter CTA** (nút lọc nhanh theo phong cách nghe, không gian) — workflow mô tả nhưng không có feature tương ứng | [P3] |

---

### 1.3 Sản phẩm (`/products`, `/products/[id]`)

| STT | Vấn đề | Mức |
|-----|--------|-----|
| PR1 | **Nút "Bộ lọc nâng cao"** — có trên UI nhưng không có `onClick`, không có modal/panel lọc nâng cao thực sự | [P2] |
| PR2 | **Price range filter tag "20-50tr"** hardcode tĩnh — click vào nút X không làm gì (state không reset) | [P2] |
| PR3 | **Brand filter sidebar** — state `activeBrandId` tồn tại và được gửi lên API nhưng không có UI chọn thương hiệu ở sidebar sản phẩm | [P2] |
| PR4 | **Bug giá trị option AI** — `<option value=" jazz">` có khoảng trắng thừa ở đầu, sẽ gửi ` jazz` (sai) lên API | [P1] |
| PR5 | **Skeleton loading cho lưới sản phẩm** chưa có — hiển thị trống khi đang tải | [P2] |
| PR6 | **Review delete dùng `window.confirm()`** — không đồng nhất với pattern `ConfirmActionDialog` của dự án | [P3] |
| PR7 | **Trang chi tiết đơn hàng từ checkout success** — nút "Xem chi tiết đơn hàng" redirect về `/support` vì `/account/orders/[orderId]` chưa implement (xem mục OD1) | [P1] |

---

### 1.4 Giỏ hàng (`/cart`)

| STT | Vấn đề | Mức |
|-----|--------|-----|
| CT1 | **Tên thương hiệu sản phẩm** trong giỏ luôn hiển thị hardcode `"Đức Uy Audio"` thay vì `item.brandName` thực tế | [P2] |
| CT2 | **"Sản phẩm liên quan"** dùng `shuffle` ngẫu nhiên — không thực sự liên quan theo danh mục/thương hiệu | [P3] |
| CT3 | **Không có ô nhập mã giảm giá trong giỏ** — coupon chỉ áp dụng được ở bước checkout | [P2] |

---

### 1.5 Checkout & Thanh toán

| STT | Vấn đề | Mức |
|-----|--------|-----|
| CK1 | **Email xác nhận đơn hàng** — sau khi `commitOrderFromSession` thành công không gửi email thông báo cho khách hàng | [P1] |
| CK2 | **Trang `/debug/vietqr`** còn tồn tại trong codebase — trang debug test nên xóa trước khi deploy production | [P2] |
| CK3 | **Không có luồng COD (Thanh toán khi nhận hàng)** — toàn bộ đặt hàng đi qua `CheckoutSession`, không có route trực tiếp tạo đơn COD | [P2] |

---

### 1.6 Wishlist (`/wishlist`)

| STT | Vấn đề | Mức |
|-----|--------|-----|
| WL1 | **Trang `/wishlist` (trang riêng)** thiếu ảnh sản phẩm, không có skeleton, không có phân trang, empty state nghèo nàn | [P2] |
| WL2 | **Wishlist count trong header** không tự refresh sau khi thêm/xóa item từ trang khác (cần reload mới cập nhật) | [P2] |

---

### 1.7 Trang tư vấn AI (`/tu-van-ai`)

| STT | Vấn đề | Mức |
|-----|--------|-----|
| AI1 | **Câu hỏi phổ biến (pills)** là `<span>` tĩnh — click không pre-fill ô chat hay gửi message | [P2] |
| AI2 | **Welcome banner** luôn hiển thị — không tự ẩn sau khi user gửi tin nhắn đầu tiên | [P3] |
| AI3 | **Không có luồng AI So sánh sản phẩm** — `AiSessionType.COMPARISON` tồn tại trong schema nhưng không có API route, không có UI | [P2] |
| AI4 | **Rate limit AI không được enforce** — config `ai_rate_limit_enabled` / `ai_rate_limit_per_user_per_day` định nghĩa trong `ai-config.ts` nhưng không được đọc/kiểm tra trong bất kỳ AI route nào | [P1] |
| AI5 | **SEARCH type không log AiSession** — quick search là DB search thường, không liên kết AI session, thống kê admin sẽ luôn = 0 cho loại này | [P3] |

---

### 1.8 Trang Hỗ trợ (`/support`)

| STT | Vấn đề | Mức |
|-----|--------|-----|
| SP1 | **Form gửi yêu cầu hỗ trợ** — có validate đúng nhưng chưa có API thực sự nhận và lưu ticket, chỉ mô phỏng | [P2] |

---

## 2. ACCOUNT — QUẢN LÝ TÀI KHOẢN

### 2.1 Hồ sơ cá nhân (`/account/profile`)

| STT | Vấn đề | Mức |
|-----|--------|-----|
| AC1 | **Upload ảnh đại diện** — nút `MdCameraAlt` không có `onClick`, chức năng upload hoàn toàn không hoạt động | [P1] |
| AC2 | **Hạng thành viên** hardcode `"Hạng Vàng"` — không có hệ thống loyalty/tier thực sự | [P2] |
| AC3 | **Badge "Đã xác minh"** trên email luôn hiển thị bất kể `emailVerified` trong DB | [P3] |
| AC4 | **Số điện thoại** lấy từ `defaultAddress.phone` thay vì field phone riêng trên profile | [P2] |

### 2.2 Bảo mật (`/account/security`)

| STT | Vấn đề | Mức |
|-----|--------|-----|
| SEC1 | **Toggle 2FA** hoàn toàn không hoạt động — không có state, không có onClick, không có API, chỉ là decoration | [P2] |

### 2.3 Đơn hàng

| STT | Vấn đề | Mức |
|-----|--------|-----|
| OD1 | **Trang chi tiết đơn hàng `/account/orders/[orderId]` chưa được implement** — nút "Xem chi tiết" từ checkout success và từ danh sách đơn đều không dẫn đến đâu | [P1] |

### 2.4 Đánh giá & Địa chỉ

| STT | Vấn đề | Mức |
|-----|--------|-----|
| RV1 | **Xóa review dùng `window.confirm()`** — không đồng nhất với pattern `ConfirmActionDialog` | [P3] |
| AD1 | **Xóa địa chỉ dùng `window.confirm()`** — cần dùng `ConfirmActionDialog` | [P3] |

### 2.5 Vouchers

| STT | Vấn đề | Mức |
|-----|--------|-----|
| VO1 | **Badge voucher** luôn "Sẵn sàng" dù voucher có thể đã hết hạn/đã dùng | [P2] |
| VO2 | **Không có nút "Copy code"** để copy mã voucher | [P3] |

---

## 3. ADMIN

### 3.1 Trang chưa có

| STT | Trang | Mức |
|-----|-------|-----|
| ADM1 | **`/admin/reviews`** — Quản trị đánh giá người dùng: xem, duyệt, ẩn, xóa review. Không có UI lẫn API (`/api/admin/reviews`) | [P1] |

### 3.2 Chức năng thiếu trong trang đã có

| STT | Vấn đề | Mức |
|-----|--------|-----|
| ADM2 | **`/admin/settings`** — chưa có tab cấu hình Email/SMTP, chưa có feature toggle, chưa có cấu hình mạng xã hội | [P2] |
| ADM3 | **`/admin/orders`** — PATCH order chỉ đổi status, không gửi email thông báo khách, không restore stock khi admin hủy đơn | [P1] |
| ADM4 | **`/admin/orders`** — không có bulk action (chọn nhiều đơn để cập nhật hàng loạt) | [P2] |
| ADM5 | **`/admin/reports`** — không có date range picker, luôn hiển thị 12 tháng cố định; thiếu báo cáo coupon usage, refund | [P2] |
| ADM6 | **Quản lý coupon user** — không có admin tool để cấp phát / thu hồi coupon cho từng user cụ thể | [P2] |
| ADM7 | **`/admin/users/[id]`** — không có action ban/suspend user | [P2] |

### 3.3 API Admin còn thiếu / lỗi âm thầm

| STT | Vấn đề | Mức |
|-----|--------|-----|
| API1 | **Filter `noAiContent`/`hasAiContent`** được gửi từ `AdminAiBatchPage` và `AdminAiContentPage` nhưng không được xử lý trong routes `/api/admin/products`, `/api/admin/brands`, `/api/admin/categories` — filter không có tác dụng | [P2] |
| API2 | **`limit=200` trong batch AI** bị cap tại 50 bởi `pageSize` max trong route — silent data loss | [P1] |
| API3 | **Không có `/api/admin/reviews`** route | [P1] |

---

## 4. AI — CÁC TÍNH NĂNG CHƯA TRIỂN KHAI

| STT | Vấn đề | Mức |
|-----|--------|-----|
| AIF1 | **So sánh sản phẩm bằng AI** — `AiSessionType.COMPARISON` tồn tại trong schema nhưng không có API route `/api/shop/ai/compare`, không có UI component | [P2] |
| AIF2 | **AI Search (tìm kiếm thông minh)** — `AiSessionType.SEARCH` tồn tại nhưng quick search là DB text search, không dùng AI, không log session | [P2] |
| AIF3 | **Rate limiting AI** — đã có config nhưng không được enforce ở bất kỳ route AI nào | [P1] |

---

## 5. EMAIL TRANSACTIONAL

| STT | Vấn đề | Mức |
|-----|--------|-----|
| EM1 | **Email xác nhận đơn hàng** chưa có — sau khi tạo đơn thành công không gửi gì cho khách | [P1] |
| EM2 | **Email cập nhật trạng thái đơn** (khi admin chuyển đơn sang SHIPPED/COMPLETED) chưa có | [P2] |
| EM3 | **Email mời viết đánh giá** sau khi đơn hàng hoàn thành chưa có | [P3] |
| EM4 | **`@sendgrid/mail` đã cài nhưng không được dùng** — toàn bộ đã chuyển sang `resend`, có thể xóa khỏi package.json | [P3] |

---

## 6. DATA LAYER / SCHEMA

| STT | Vấn đề | Mức |
|-----|--------|-----|
| DB1 | **Không có Prisma model `Promotion`** — `PromotionSummaryDto` có type `PRODUCT_SET` nhưng schema không có model tương ứng, UI là dead code path | [P2] |
| DB2 | **`stripeClientSecret` trong `CreateOrderResponseDto`** — Stripe không cài trong dự án, trường này là vestige có thể xóa | [P3] |
| DB3 | **`@next-auth/prisma-adapter` đã cài nhưng không dùng** — chỉ cần `@auth/prisma-adapter`, package cũ là redundant | [P3] |
| DB4 | **`order-service.ts` dùng `Math.random()` cho order number** — không an toàn dưới high concurrency, có thể tạo trùng số đơn hàng | [P2] |
| DB5 | **`checkout-session-service.ts` typed `any`** — bypass TypeScript safety cho luồng thanh toán quan trọng | [P2] |

---

## 7. CODE QUALITY & TECHNICAL DEBT

| STT | Vấn đề | Mức |
|-----|--------|-----|
| TQ1 | **`any` rải rác trong account pages** — `profile: any`, `addresses: any[]`, `order: any`, v.v. | [P3] |
| TQ2 | **Account layout import từ `@/app/page.module.css`** — import nhầm CSS module của trang chủ vào account layout | [P3] |
| TQ3 | **`ProfileSidebar` có `ChangePasswordModal` không bao giờ mở** — dead code | [P3] |
| TQ4 | **Wishlist page dùng `className="spinner"`** — class global, không dùng CSS module | [P3] |
| TQ5 | **`/debug/vietqr/page.tsx`** — debug page còn tồn tại trong production code | [P2] |

---

## 8. CÁC WORKFLOW ĐÃ VIẾT NHƯNG CODE CHƯA THEO KỊP

| Workflow | Tình trạng |
|----------|------------|
| `workflowDangNhapGoogle.md` | Mô tả conflict handling OAuth + credentials — cần verify config `GOOGLE_CLIENT_ID/SECRET` và logic xử lý trong `src/lib/auth.ts` |
| `workflowTrangChu.md` | Mô tả combo system, smart filter CTA — chưa implement |
| `workflowHoTro.md` + `workflowSupportPageModals.md` | Ticket system, AI assistant integration — form chưa có API thực |
| `workflowMaGiamGia.md` | Có mô tả admin cấp/thu hồi coupon user — chưa có admin UI/API cho phần này |

---

## Tổng hợp danh sách việc cần làm (by priority)

### P1 — Cần làm sớm nhất
1. Fix bug `<option value=" jazz">` — khoảng trắng thừa (PR4)
2. Trang chi tiết đơn hàng `/account/orders/[orderId]` (OD1, PR7)
3. Upload ảnh đại diện người dùng (AC1)
4. Email xác nhận đơn hàng sau checkout thành công (EM1, CK1)
5. Rate limiting AI routes không được enforce (AI4, AIF3)
6. Admin order PATCH: restore stock khi hủy + gửi email (ADM3)
7. Trang & API `/admin/reviews` (ADM1, API3)
8. Batch AI `limit=200` bị cap ngầm tại 50 (API2)

### P2 — Làm trong sprint tiếp theo
1. Bộ lọc nâng cao sản phẩm (PR1, PR2, PR3)
2. Skeleton loading lưới sản phẩm (PR5)
3. COD checkout flow (CK3)
4. Cải thiện trang `/wishlist` (WL1, WL2)
5. AI So sánh sản phẩm (AIF1)
6. Luồng thay đổi email (A4)
7. Admin: date range trong báo cáo (ADM5)
8. Admin: bulk action đơn hàng (ADM4)
9. Admin: cấp/thu hồi coupon user (ADM6)
10. Email cập nhật trạng thái đơn (EM2)
11. Xóa `debug/vietqr` page (TQ5, CK2)
12. Đồng bộ Google OAuth (A5)
13. Filter AI content trong batch không có tác dụng (API1)
14. Voucher badge hiển thị sai trạng thái (VO1)
15. Ghi nhớ đăng nhập 30 ngày thực sự hoạt động (A1)
16. Trang register thêm Google OAuth (A3) ( Bỏ qua)
17. Fix `PromotionSummaryDto.PRODUCT_SET` — cần Prisma model (DB1)
18. `order-service.ts` order number collision safe (DB4)
19. `checkout-session-service.ts` typed `any` (DB5)
20. Ticket form support có API thực (SP1)
21. AI quick-question pills có onClick (AI1)
22. Thương hiệu trong giỏ hàng hardcode (CT1)
23. 2FA toggle thực sự hoạt động (SEC1) ( bỏ qua)
24. Combo/bundle system home page (H1)
25. Ban/suspend user trong admin (ADM7)

### P3 — Cải thiện & dọn dẹp
1. Thay `window.confirm()` → `ConfirmActionDialog` cho reviews/address xóa (RV1, AD1)
2. Xóa `@sendgrid/mail` và `@next-auth/prisma-adapter` (EM4, DB3)
3. Xóa `stripeClientSecret` trong types (DB2)
4. Fix account layout import sai CSS module (TQ2)
5. `ProfileSidebar` dead code modal (TQ3)
6. Wishlist spinner class global (TQ4)
7. Typing `any` trong account pages (TQ1)
8. Copy code button cho voucher (VO2)
9. Remove hardcode avatar URLs (A6)
10. Welcome banner ẩn khi chat (AI2)
11. AiSession SEARCH log (AI5)
12. Đổi email invitation sau hoàn thành đơn (EM3)
13. Badge xác minh email dynamic (AC3)

---

## Chi tiết implementation các task P1

### Task P1-1: Fix `<option value=" jazz">`
**File:** `src/app/products/page.tsx`  
**Thay:** `<option value=" jazz">` → `<option value="jazz">`

---

### Task P1-2: Trang chi tiết đơn hàng `/account/orders/[orderId]`
**Files cần tạo:**
- `src/app/account/orders/[orderId]/page.tsx`
- `src/app/api/shop/orders/[orderId]/route.ts` (đã tồn tại, kiểm tra đủ field chưa)

**Giao diện cần hiển thị:**
- Thông tin đơn hàng (mã, ngày đặt, trạng thái)
- Danh sách sản phẩm trong đơn (ảnh, tên, số lượng, giá)
- Địa chỉ giao hàng
- Phương thức thanh toán / trạng thái thanh toán
- Tổng tiền, phí ship, discount
- Nút hủy đơn (nếu còn trong trạng thái hủy được)

**Flow:**
- `GET /api/shop/orders/[orderId]` trả về full order detail
- Nếu order không thuộc về user hiện tại → 403
- Link đến từ: checkout success, `/account/orders` list

---

### Task P1-3: Upload ảnh đại diện
**Files liên quan:**
- `src/app/account/profile/page.tsx` — thêm `onClick` vào nút camera
- `src/app/api/admin/upload/image/route.ts` — kiểm tra có thể tái dùng hay cần route riêng cho user
- `src/app/api/shop/profile/route.ts` — thêm PATCH avatar URL

**Flow:**
1. User click nút camera → mở file input (accept image/*)
2. File được upload lên Cloudinary qua `/api/shop/profile/upload-avatar` (tạo mới)
3. URL trả về được PATCH vào `user.image` qua `/api/shop/profile`
4. UI cập nhật preview ngay lập tức

---

### Task P1-4: Email xác nhận đơn hàng
**Files cần cập nhật:**
- `src/services/email-resend-service.ts` — thêm hàm `sendOrderConfirmationEmail`
- `src/services/checkout-session-service.ts` — gọi `sendOrderConfirmationEmail` sau khi `commitOrderFromSession` thành công

**Nội dung email:**
- Mã đơn hàng
- Danh sách sản phẩm + giá
- Địa chỉ giao hàng
- Tổng thanh toán
- Link xem chi tiết đơn: `/account/orders/[orderId]`

---

### Task P1-5: Enforce AI Rate Limiting
**Files cần cập nhật:**
- `src/app/api/shop/ai/product-advice/route.ts`
- `src/app/api/shop/ai/recommend/route.ts`

**Logic:**
1. Đọc `ai_rate_limit_enabled`, `ai_rate_limit_per_user_per_day`, `ai_rate_limit_anonymous_per_ip` từ `getAiConfig()`
2. Nếu `ai_rate_limit_enabled = false` → skip
3. Dùng user ID (authenticated) hoặc IP (anonymous) làm key
4. Đếm số request hôm nay từ `AiSession` table (hoặc cache)
5. Nếu vượt limit → trả 429 với message phù hợp

---

### Task P1-6: Admin order PATCH — stock restore + email
**Files cần cập nhật:**
- `src/app/api/admin/orders/[id]/route.ts`

**Logic:**
- Khi `status` chuyển sang `CANCELLED`:
  - Restore stock cho từng `OrderItem` của đơn hàng đó
  - Ghi `InventoryLog` với `source: "ORDER_CANCELLED"`
- Khi `status` chuyển sang `SHIPPED` hoặc `COMPLETED`:
  - Gửi email thông báo cho khách hàng (cần thêm `sendOrderStatusUpdateEmail`)

---

### Task P1-7: Admin Reviews page + API
**Files cần tạo:**
- `src/app/admin/reviews/page.tsx` (entry point)
- `src/features/admin/components/reviews/AdminReviewsPage.tsx` + `.module.css`
- `src/app/api/admin/reviews/route.ts` (GET list + DELETE)
- `src/app/api/admin/reviews/[id]/route.ts` (PATCH status, DELETE)

**Chức năng:**
- Danh sách review (lọc theo rating, status, product)
- Phân trang, search
- Duyệt review (ẩn/hiện)
- Xóa review
- Xem review kèm tên sản phẩm, tên người dùng

---

### Task P1-8: Fix batch AI `limit=200` cap
**Files cần cập nhật:**
- `src/app/api/admin/products/route.ts`
- `src/app/api/admin/brands/route.ts`  
- `src/app/api/admin/categories/route.ts`

**Thay đổi:**
1. Tăng `DEFAULT_PAGE_SIZE` max lên 200 khi có query param `mode=ai-batch` hoặc tương đương
2. Implement các filter `noAiContent=true` / `hasAiContent=true` thực sự tại WHERE clause trong Prisma query
