# Thiết kế Trang Checkout – Đức Uy Audio

## 1. Mục tiêu & bối cảnh

### 1.1. Mục tiêu trang

Trang checkout (`/checkout`) là bước chuyển đổi cuối cùng trước khi tạo đơn hàng. Thiết kế phải:

- **Giảm ma sát**: nhập/chọn địa chỉ nhanh, ít lỗi, ít “điền lại”.
- **Tăng tin cậy**: hiển thị rõ tổng tiền, phí vận chuyển (GHN), chính sách, bảo mật thanh toán.
- **Giữ nhịp thao tác**: trạng thái tải dữ liệu, tính phí ship, validate coupon… phải “mượt”, không giật layout.
- **Chống sai sót**: cảnh báo thiếu địa chỉ, hết hàng, sai mã giảm giá, lỗi tính phí GHN, lỗi VNPAY.
- **Tối ưu mobile-first**: thao tác một tay, CTA rõ ràng, summary sticky phù hợp.

### 1.2. Tham chiếu workflow

Workflow bắt buộc bám theo: `src/workflow/workflowDatHangCheckout.md`:

- Địa chỉ dùng **API địa lý Việt Nam** `provinces.open-api.vn` (proxy qua `/api/shop/location/*`).
- Tính phí vận chuyển dùng **GHN** (proxy qua `/api/shop/shipping/calculate-fee`).
- Thanh toán: **COD**, **VNPAY**, **QR_TRANSFER (VietQR)**.
- Mã giảm giá: validate qua `POST /api/shop/coupons/validate` (server là nguồn sự thật).

### 1.3. Hệ màu & tokens (từ `globals.css`)

Các token quan trọng dùng trong checkout:

- **CTA chính**: `--primary`, `--primary-light`, `--shadow-primary`, `--gradient-primary`
- **Nền tối premium**: `--secondary`, `--secondary-light`, `--gradient-secondary`
- **Accent**: `--accent`, `--gradient-accent` (badge, highlight)
- **Nền**: `--background-homepage` (nền tổng), `--background-secondary` (card), `--background-tertiary` (divider/hover)
- **Text**: `--text-light` trên nền tối, `--text`/`--text-secondary` trên card sáng
- **Trạng thái**: `--success`, `--warning`, `--error`
- **Bo góc**: `--border-radius-lg` / `--border-radius-xl` cho panel

### 1.4. Pattern UI có sẵn trong dự án

- `ShopHeader`, `ShopFooter`
- `PageTransitionOverlay` (dùng khi chuyển trang quan trọng, ~1100ms trước `router.push`)
- Toast `sonner`
- Animation `framer-motion` (dùng tiết chế)
- Quy tắc BEM theo `audio-ai-shop-core.mdc`

---

## 2. URL & File

```
Route:  /checkout
File:   src/app/checkout/page.tsx                  (Server wrapper hoặc Client page)
        src/features/shop/components/checkout/*     (UI components)
Styles: src/app/checkout/page.module.css           (layout shell)
        src/features/shop/components/checkout/*.module.css
API:    GET  /api/shop/cart
        GET  /api/shop/addresses
        GET  /api/shop/location/provinces
        GET  /api/shop/location/districts?provinceCode=
        GET  /api/shop/location/wards?districtCode=
        POST /api/shop/shipping/calculate-fee
        POST /api/shop/coupons/validate
        POST /api/shop/orders
```

---

## 3. Kiến trúc trang (Information Architecture)

### 3.1. Bố cục tổng thể (desktop)

Grid 2 cột, trái là form, phải là order summary:

- **Cột trái** (main):
  - Stepper + tiêu đề
  - Khối “Địa chỉ giao hàng”
  - Khối “Dịch vụ vận chuyển”
  - Khối “Phương thức thanh toán”
  - Khối “Mã giảm giá”
  - Khối “Ghi chú”
- **Cột phải** (sidebar, sticky):
  - Tóm tắt đơn: list item mini, subtotal, discount, shipping, total
  - CTA “Đặt hàng”
  - Trust: bảo hành, hỗ trợ, hoàn trả (tối giản)

### 3.2. Bố cục mobile

- Một cột cuộn dọc.
- Sidebar summary chuyển thành:
  - Summary card gọn nằm sau phần form **hoặc**
  - Sticky bottom bar hiển thị Total + CTA (khuyến nghị).

---

## 4. Quy ước BEM & CSS Modules

### 4.1. Block chính

- `checkout-page` (file `src/app/checkout/page.module.css`)
- `checkout-address` (Address section component)
- `checkout-shipping` (Shipping service section)
- `checkout-payment` (Payment section)
- `checkout-coupon` (Coupon section)
- `checkout-summary` (Order summary panel)
- `checkout-stepper` (Stepper)

### 4.2. Modifier tiêu chuẩn

- `--disabled`, `--active`, `--error`, `--success`, `--loading`, `--selected`, `--sticky`

---

## 5. Header, Stepper, và Context “Đang Checkout”

### 5.1. Header

Hành vi:
- Hiển thị `ShopHeader`.
- Nếu user bấm back: quay lại `/cart`.

### 5.2. Stepper

Stepper 4 bước theo workflow:

1. **Địa chỉ**
2. **Vận chuyển**
3. **Thanh toán**
4. **Xác nhận**

UI:
- Trên desktop: stepper ngang.
- Trên mobile: stepper rút gọn (ví dụ chỉ hiển thị “Bước 2/4 – Vận chuyển”).

BEM gợi ý:
- `.checkout-stepper`
- `.checkout-stepper__item`
- `.checkout-stepper__item--active`
- `.checkout-stepper__item--done`
- `.checkout-stepper__connector`

---

## 6. Section: Địa chỉ giao hàng (Address)

### 6.1. Trạng thái dữ liệu

- **Loading**: skeleton list 2-3 thẻ địa chỉ + skeleton form.
- **Có địa chỉ**:
  - List radio card.
  - Tự chọn địa chỉ `isDefault`.
  - Có “Thêm địa chỉ mới” (expand).
- **Chưa có địa chỉ**:
  - Auto mở form tạo mới, ẩn list.
- **Error load**: hiển thị message + nút “Thử lại”.

### 6.2. UI list địa chỉ (radio cards)

Mỗi item là 1 card:

Nội dung:
- Tên người nhận + số điện thoại (đậm)
- Địa chỉ dòng 1 + phường/xã + quận/huyện + tỉnh
- Badge “Mặc định” (nếu isDefault)
- Action nhỏ: “Sửa”, “Xóa” (ẩn trên mobile nếu chật; thay bằng menu)

Tương tác:
- Click card hoặc radio → chọn.
- Khi chọn xong và có đủ `ghnDistrictId/ghnWardCode` (hoặc có thể tra cứu) → trigger tính phí ship.

BEM:
- `.checkout-address`
- `.checkout-address__saved`
- `.checkout-address__card`
- `.checkout-address__card--selected`
- `.checkout-address__badge-default`
- `.checkout-address__actions`
- `.checkout-address__action`

### 6.3. UI form “Thêm địa chỉ mới”

Form expand inline, layout 2 cột trên desktop:

- Cột trái: Họ tên, SĐT
- Cột phải: Số nhà/đường, dòng 2 (optional)
- Dòng tiếp: Tỉnh/TP → Quận/Huyện → Phường/Xã (3 select)

Field:
- `fullName*`
- `phone*`
- `line1*`
- `line2`
- `provinceCode*` (select)
- `districtCode*` (select)
- `wardCode*` (select)
- `isDefault` (checkbox)
- `saveAddress` (checkbox) – nếu dự án muốn cho phép “không lưu” thì hiển thị, còn v1 có thể luôn lưu.

UX chi tiết:
- Select tỉnh → loading districts (spinner inline trong select).
- Select huyện → loading wards.
- Khi chưa chọn tỉnh/huyện: disable select bên dưới + placeholder “Vui lòng chọn…”.
- Validate lỗi hiển thị ngay dưới field, màu `--error`.

BEM:
- `.checkout-address__new`
- `.checkout-address__form`
- `.checkout-address__row`
- `.checkout-address__field`
- `.checkout-address__label`
- `.checkout-address__input`
- `.checkout-address__select`
- `.checkout-address__hint`
- `.checkout-address__error`
- `.checkout-address__toggle-new`

### 6.4. Microcopy gợi ý

- Tiêu đề: “Địa chỉ giao hàng”
- Mô tả nhỏ: “Chọn địa chỉ đã lưu hoặc tạo địa chỉ mới để tính phí vận chuyển chính xác.”
- Placeholder:
  - SĐT: “Ví dụ: 0901234567”
  - line1: “Số nhà, tên đường…”

---

## 7. Section: Dịch vụ vận chuyển (GHN)

### 7.1. Trạng thái

- **Chưa đủ địa chỉ**: hiển thị card nhắc “Vui lòng chọn đầy đủ tỉnh/quận/phường để tính phí”.
- **Đang tính phí**: shimmer/skeleton 2 options.
- **Thành công**: hiển thị 2 option (tiết kiệm/nhanh) với:
  - Giá
  - ETA (1-2 ngày / 3-5 ngày – theo workflow)
  - Badge “Khuyến nghị” (tiết kiệm) nếu muốn.
- **Lỗi GHN**: hiển thị fallback 30,000 + note “Phí vận chuyển ước tính…”.

### 7.2. UI shipping options

Card radio dạng 2 cột:

Option card:
- Icon xe giao hàng (tối giản)
- Tên dịch vụ
- Giá (đậm)
- ETA (nhỏ)
- Subtext: “GHN”

BEM:
- `.checkout-shipping`
- `.checkout-shipping__options`
- `.checkout-shipping__option`
- `.checkout-shipping__option--selected`
- `.checkout-shipping__price`
- `.checkout-shipping__eta`
- `.checkout-shipping__note`
- `.checkout-shipping__error`

---

## 8. Section: Phương thức thanh toán (COD / VNPAY / QR)

### 8.1. Payment cards

3 card selectable:

1. COD
2. VNPAY (hiển thị logo text “VNPAY”)
3. QR Chuyển khoản (hiển thị “VietQR”/“QR ngân hàng”)

Card content:
- Title
- Subtitle 1 dòng
- Badge nhỏ: “Phổ biến” cho COD hoặc VNPAY (tuỳ chiến lược)

### 8.2. Nội dung mở rộng theo lựa chọn

- **COD**: note ngắn + tổng tiền cần chuẩn bị.
- **VNPAY**: note “Bạn sẽ được chuyển sang cổng VNPAY để hoàn tất thanh toán.”
- **QR_TRANSFER**: note “Mã QR sẽ hiển thị sau khi bạn tạo đơn hàng.”

BEM:
- `.checkout-payment`
- `.checkout-payment__grid`
- `.checkout-payment__method`
- `.checkout-payment__method--selected`
- `.checkout-payment__detail`
- `.checkout-payment__note`

---

## 9. Section: Mã giảm giá (Coupon)

### 9.1. Vị trí và hành vi

- Hiển thị input + nút “Áp dụng”.
- Nếu đã có mã từ giỏ hàng: hiển thị trạng thái “Đã áp dụng” + nút “Xóa”.
- Khi shipping fee thay đổi (do đổi địa chỉ/dịch vụ), coupon `FREE_SHIPPING` phải recalc.

### 9.2. States

- Loading validate: disable input + button, show spinner.
- Success: show badge xanh `--success`.
- Error: show message đỏ `--error`, giữ lại input để user sửa.

BEM:
- `.checkout-coupon`
- `.checkout-coupon__row`
- `.checkout-coupon__input`
- `.checkout-coupon__apply`
- `.checkout-coupon__status`
- `.checkout-coupon__status--success`
- `.checkout-coupon__status--error`
- `.checkout-coupon__remove`

Microcopy:
- Label: “Mã giảm giá”
- CTA phụ: “Mở ví voucher” (nếu muốn đồng bộ với cart)

---

## 10. Section: Ghi chú đơn hàng

- Textarea tối giản.
- Limit 500 ký tự (hiển thị counter).

BEM:
- `.checkout-page__note`
- `.checkout-page__note-input`
- `.checkout-page__note-counter`

---

## 11. Sidebar: Order Summary

### 11.1. Nội dung

- List item mini (ảnh 40-48px, tên 1 dòng, qty, giá).
- Subtotal
- Discount (nếu có)
- Shipping fee:
  - Hiển thị tên dịch vụ + ETA nhỏ
  - Nếu coupon FREE_SHIPPING: show “Miễn phí”
- Total (font lớn)

### 11.2. CTA “Đặt hàng”

Nút CTA dùng `--gradient-primary` + `--shadow-primary`.

Disable khi:
- chưa có địa chỉ hợp lệ
- chưa có shipping fee (chưa tính xong)
- chưa chọn payment method
- đang submit

BEM:
- `.checkout-summary`
- `.checkout-summary__card`
- `.checkout-summary__items`
- `.checkout-summary__item`
- `.checkout-summary__totals`
- `.checkout-summary__row`
- `.checkout-summary__row--total`
- `.checkout-summary__cta`
- `.checkout-summary__cta--disabled`
- `.checkout-summary__trust`

### 11.3. Sticky behavior

- Desktop: sticky sidebar (top offset dưới header).
- Mobile: sticky bottom bar:
  - Left: “Thanh toán: 1.180.000đ”
  - Right: button “Đặt hàng”

BEM:
- `.checkout-summary__mobile-bar`
- `.checkout-summary__mobile-total`
- `.checkout-summary__mobile-cta`

---

## 12. Trạng thái toàn trang (Page States)

### 12.1. Loading initial (cart + addresses)

Skeleton layout giữ nguyên grid để tránh giật:
- Cột trái: 3 section skeleton.
- Cột phải: summary skeleton (list 3 item).

### 12.2. Unauthenticated

Hiển thị card:
- Title: “Bạn cần đăng nhập để thanh toán”
- CTA: “Đăng nhập”
- Link phụ: “Tiếp tục mua sắm”

### 12.3. Cart empty

Card với icon + message:
- “Giỏ hàng đang trống”
- CTA: “Xem sản phẩm”

### 12.4. Out of stock / validation server error

Khi `POST /api/shop/orders` trả lỗi:
- Toast lỗi ngắn.
- Trong form, highlight section liên quan:
  - Hết hàng: highlight item list + đề xuất quay về cart.
  - Địa chỉ: focus vào field lỗi.
  - Coupon: show message.

---

## 13. Animation & Motion (Framer Motion)

Nguyên tắc: ít nhưng “đáng tiền”.

- Expand/collapse form “Thêm địa chỉ mới”: height + opacity, 180–240ms.
- Shipping fee recalculation: skeleton shimmer, không animate mạnh.
- CTA hover: shadow tăng nhẹ, translateY -1px.

Không dùng animation cho mọi input/focus.

---

## 14. Accessibility checklist

- Tất cả input/select có `label` rõ.
- Radio cards phải clickable bằng keyboard:
  - `role="radio"` và `aria-checked` nếu custom.
- Màu lỗi: kết hợp icon + text, không chỉ dựa vào màu.
- Focus ring rõ (outline `--primary-light`).
- Button disabled có aria-disabled.

---

## 15. Nội dung hiển thị theo PaymentMethod trên trang Success (liên quan UI checkout)

Thiết kế trang success nên nhận biết payment method và hiển thị:

- **COD**: “Đơn hàng đã được tạo. Chúng tôi sẽ liên hệ xác nhận trước khi giao.”
- **VNPAY**:
  - Nếu PAID: “Thanh toán thành công.”
  - Nếu FAILED: điều hướng sang `/checkout/failed` (thiết kế page riêng).
- **QR_TRANSFER**:
  - Hiển thị QR lớn
  - Box “Thông tin chuyển khoản” + nút copy số tiền / nội dung
  - Countdown “Hết hạn trong 30 phút”

---

## 16. Spec spacing & kích thước gợi ý (để implement CSS)

- Page max width: 1200–1280px
- Grid gap: 24–32px
- Section card padding: 16px mobile, 20–24px desktop
- Border radius: 12–16px
- Input height: 44px
- CTA height: 48–52px
- Sticky bottom bar height: 72–84px

---

## 17. Checklist hoàn thiện UI trước khi implement

- Có đủ skeleton cho: addresses, location dropdown, GHN fee, coupon validate, submit order.
- Có các empty/error state: unauthenticated, cart empty, GHN fail fallback, coupon invalid, out-of-stock.
- Mobile sticky bar hoạt động, không che content.
- Text nhất quán giọng “Đức Uy Audio”, không dùng emoji.
- BEM class rõ ràng, không selector rộng.

