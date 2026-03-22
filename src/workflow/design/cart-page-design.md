# Thiết kế Trang Giỏ hàng – Đức Uy Audio

## 1. Mục tiêu & bối cảnh

### 1.1. Mục tiêu trang

Trang giỏ hàng (`/cart`) là **cầu nối quan trọng** giữa hành trình khám phá sản phẩm và quyết định thanh toán. Trung bình 70% người dùng bỏ giỏ hàng trước khi thanh toán – trang này phải giải quyết vấn đề đó bằng thiết kế rõ ràng, tin cậy và thúc đẩy hành động.

Nhiệm vụ cụ thể:
- **Tổng hợp đơn hàng rõ ràng**: hiển thị ảnh sản phẩm, tên, giá, số lượng và thành tiền một cách trực quan.
- **Tạo sự tự tin**: trust badges, chính sách đổi trả, bảo hành, freeship progress bar.
- **Thúc đẩy hành động**: nút "Tiến hành thanh toán" nổi bật, sticky trên mobile.
- **Giảm rào cản**: chỉnh sửa số lượng, xóa sản phẩm, nhập mã giảm giá ngay trên trang.
- **Cross-sell thông minh**: gợi ý sản phẩm liên quan bên dưới giỏ hàng.
- **Xử lý trạng thái**: loading skeleton, empty state có CTA, error state với retry.

### 1.2. Bối cảnh dự án

**Hệ màu** (từ `globals.css`):

| Biến | Mã màu | Dùng cho |
|---|---|---|
| `--primary` | #1DB954 | Nút CTA chính, border active, badge |
| `--primary-light` | #1ED760 | Hover state nút chính |
| `--primary-dark` | #169C46 | Active/pressed state |
| `--primary-darker` | #117A37 | Text đậm trên nền primary |
| `--secondary` | #191414 | Nền sidebar tổng kết, overlay |
| `--secondary-light` | #2A2424 | Card nền tối |
| `--accent` | #FFD700 | Badge giảm giá, highlight |
| `--accent-dark` | #D4AF37 | Text badge giảm giá |
| `--background` | #FAFAFA | Nền chính toàn trang |
| `--background-secondary` | #F5F5F5 | Nền card sản phẩm |
| `--background-tertiary` | #EEEEEE | Nền hover, separator |
| `--background-dark` | #E0E0E0 | Divider |
| `--text` | #121212 | Text chính |
| `--text-secondary` | #424242 | Text phụ (tên danh mục, thương hiệu) |
| `--text-tertiary` | #757575 | Label, placeholder |
| `--text-light` | #FFFFFF | Text trên nền tối |
| `--success` | #4CAF50 | Trạng thái áp mã thành công |
| `--error` | #F44336 | Lỗi, cảnh báo |
| `--warning` | #FF9800 | Cảnh báo tồn kho thấp |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.12)` | Card rest |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Card hover |
| `--shadow-lg` | `0 10px 25px rgba(0,0,0,0.15)` | Panel order summary |
| `--shadow-primary` | `0 4px 14px rgba(29,185,84,0.4)` | Nút checkout |
| `--gradient-primary` | `linear-gradient(135deg, #1DB954 0%, #169C46 100%)` | Nút CTA chính |
| `--gradient-secondary` | `linear-gradient(135deg, #2A2424 0%, #191414 100%)` | Sidebar tối |
| `--gradient-accent` | `linear-gradient(135deg, #FFE54C 0%, #FFD700 100%)` | Badge giảm giá |
| `--border-radius-sm` | 4px | Input, badge nhỏ |
| `--border-radius-md` | 8px | Card, button |
| `--border-radius-lg` | 12px | Panel, modal |
| `--border-radius-xl` | 16px | Section chính |
| `--border-radius-full` | 9999px | Pill badge, avatar |

**Nền trang**: `var(--background-homepage)` (`rgb(18 32 23)`) – nền tối sang trọng, nhất quán với trang sản phẩm.

**Component đã có**:
- `ShopHeader` – header chung có search, cart icon, AI panel, user menu.
- `ShopFooter` – footer chung.
- `PageTransitionOverlay` – overlay chuyển trang (1100ms).
- `DataLoadingOverlay` – overlay loading cho vùng data.
- Icons: `react-icons/md`, `react-icons/fa`.
- Toast: `sonner`.
- Animation: `framer-motion`.

---

## 2. URL & File

```
Route:  /cart
File:   src/app/cart/page.tsx          (Client Component)
API:    GET    /api/shop/cart
        PATCH  /api/shop/cart/items/:id
        DELETE /api/shop/cart/items/:id
```

**DTO liên quan** (từ `src/types/shop.ts`):

```typescript
CartItemDto {
  id, productId, productName, productSlug,
  productImageUrl, unitPrice, quantity, subtotal
}

CartResponseDto {
  cartId, items: CartItemDto[],
  itemCount, totalQuantity, subtotal
}
```

---

## 3. Cấu trúc tổng thể & BEM

### 3.1. Block BEM chính

Block root: `cart-page`

| BEM Class | Phần tử |
|---|---|
| `cart-page` | Wrapper toàn trang |
| `cart-page__inner` | Vùng nội dung chính (max-width: 1280px) |
| `cart-page__header` | Khu vực breadcrumb + tiêu đề trang |
| `cart-page__back` | Nút "Tiếp tục mua sắm" |
| `cart-page__title` | Tiêu đề "Giỏ hàng của bạn" |
| `cart-page__badge` | Badge hiển thị số lượng item |
| `cart-page__content` | Khu vực 2 cột: items + summary |
| `cart-page__items` | Danh sách sản phẩm (cột trái) |
| `cart-page__item` | Row một sản phẩm |
| `cart-page__item--updating` | Modifier: đang cập nhật |
| `cart-page__item-image-wrap` | Wrapper ảnh sản phẩm |
| `cart-page__item-image` | Thẻ img sản phẩm |
| `cart-page__item-info` | Tên, brand, đơn giá |
| `cart-page__item-name` | Tên sản phẩm |
| `cart-page__item-brand` | Tên thương hiệu |
| `cart-page__item-unit-price` | Đơn giá |
| `cart-page__item-actions` | Khu vực số lượng + xóa |
| `cart-page__qty` | Control số lượng (- / số / +) |
| `cart-page__qty-btn` | Nút trừ / cộng |
| `cart-page__qty-btn--disabled` | Trạng thái disabled |
| `cart-page__qty-value` | Số lượng hiện tại |
| `cart-page__item-subtotal` | Thành tiền của item |
| `cart-page__item-remove` | Nút xóa |
| `cart-page__freeship-bar` | Progress bar freeship |
| `cart-page__freeship-track` | Track bar nền |
| `cart-page__freeship-fill` | Fill bar tỉ lệ |
| `cart-page__freeship-label` | Text mô tả freeship |
| `cart-page__coupon` | Section mã giảm giá |
| `cart-page__coupon-form` | Form nhập mã |
| `cart-page__coupon-input` | Input mã |
| `cart-page__coupon-apply` | Nút áp dụng |
| `cart-page__coupon-applied` | Badge mã đã áp dụng |
| `cart-page__summary` | Panel tổng kết đơn hàng (cột phải) |
| `cart-page__summary-title` | Tiêu đề "Tổng kết đơn hàng" |
| `cart-page__summary-row` | Hàng tính tiền |
| `cart-page__summary-row--total` | Modifier: hàng tổng cuối |
| `cart-page__summary-label` | Nhãn (Tạm tính, Phí ship...) |
| `cart-page__summary-value` | Giá trị |
| `cart-page__summary-divider` | Đường kẻ ngang |
| `cart-page__checkout` | Nút "Tiến hành thanh toán" |
| `cart-page__trust` | Khu vực trust badges |
| `cart-page__trust-item` | Một badge (ví dụ: freeship, đổi trả...) |
| `cart-page__loading` | Skeleton loading state |
| `cart-page__empty` | Empty state |
| `cart-page__empty-icon` | Icon minh họa empty |
| `cart-page__empty-title` | Tiêu đề empty |
| `cart-page__empty-desc` | Mô tả phụ |
| `cart-page__empty-cta` | Nút "Khám phá sản phẩm" |
| `cart-page__error` | Error state |
| `cart-page__retry` | Nút "Thử lại" |
| `cart-page__related` | Section sản phẩm gợi ý |

---

## 4. Layout tổng thể

### 4.1. Nền và khung trang

```css
.cart-page {
  min-height: 100vh;
  background: var(--background-homepage);
  color: var(--text-light);
}

.cart-page__inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

/* Tablet */
@media (min-width: 640px) {
  .cart-page__inner {
    padding: 28px 20px 56px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .cart-page__inner {
    padding: 36px 32px 64px;
  }
}
```

### 4.2. Layout 2 cột (items + summary)

```css
.cart-page__content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: start;
}

/* Desktop: 2 cột cố định */
@media (min-width: 1024px) {
  .cart-page__content {
    grid-template-columns: 1fr 380px;
    gap: 32px;
  }
}
```

---

## 5. Header trang

### 5.1. Cấu trúc

```
[<- Tiếp tục mua sắm]         Giỏ hàng của bạn  [badge: 3 sản phẩm]
```

### 5.2. Style chi tiết

**Wrapper**:
```css
.cart-page__header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 28px;
}

@media (min-width: 768px) {
  .cart-page__header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 36px;
  }
}
```

**Nút "Tiếp tục mua sắm"**:
```css
.cart-page__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  background: none;
  border: none;
  padding: 6px 0;
  transition: color 0.2s ease, transform 0.2s ease;
}

.cart-page__back:hover {
  color: var(--primary-light);
  transform: translateX(-3px);
}

.cart-page__back svg {
  font-size: 18px;
  flex-shrink: 0;
}
```

**Tiêu đề + badge**:
```css
.cart-page__title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cart-page__title {
  font-size: 26px;
  font-weight: 800;
  line-height: 1.2;
  color: var(--text-light);
  letter-spacing: -0.02em;
}

@media (min-width: 768px) {
  .cart-page__title {
    font-size: 30px;
  }
}

.cart-page__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-light);
  background: var(--gradient-primary);
  border-radius: var(--border-radius-full);
  box-shadow: var(--shadow-primary);
  letter-spacing: 0.01em;
}
```

---

## 6. Freeship Progress Bar

Đây là **conversion nudge** quan trọng. Hiển thị tiến độ tiến đến ngưỡng miễn phí vận chuyển (ví dụ: 500.000đ).

### 6.1. Vị trí

Đặt **ngay trên danh sách sản phẩm**, nổi bật trong một card riêng.

### 6.2. Thiết kế

```
+--------------------------------------------------------------+
|  [icon truck]  Còn 120.000đ nữa để được MIỄN PHÍ VẬN CHUYỂN |
|  [====================================----------] 72%         |
+--------------------------------------------------------------+
```

**States**:
- **Chưa đạt ngưỡng**: nền `rgba(255,255,255,0.04)`, border `rgba(255,255,255,0.08)`, fill bar màu `var(--primary)`.
- **Đã đạt ngưỡng**: nền `rgba(29,185,84,0.08)`, border `var(--border-primary)`, icon check thay truck, text "Bạn đã được MIỄN PHÍ VẬN CHUYỂN!" màu `var(--primary-light)`.

```css
.cart-page__freeship-bar {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--border-radius-lg);
  padding: 14px 20px;
  margin-bottom: 16px;
}

.cart-page__freeship-bar--reached {
  background: rgba(29, 185, 84, 0.08);
  border-color: var(--border-primary);
}

.cart-page__freeship-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.75);
  margin-bottom: 10px;
}

.cart-page__freeship-label strong {
  color: var(--primary-light);
}

.cart-page__freeship-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--border-radius-full);
  overflow: hidden;
}

.cart-page__freeship-fill {
  height: 100%;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-full);
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 8px rgba(29, 185, 84, 0.5);
}
```

---

## 7. Danh sách sản phẩm (Cart Items)

### 7.1. Container danh sách

```css
.cart-page__items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```

### 7.2. Item card – thiết kế chi tiết

Mỗi sản phẩm hiển thị dạng card ngang với ảnh lớn, thông tin rõ ràng và control số lượng.

**Bố cục desktop**:
```
+------------------------------------------------------------------+
| [Ảnh 100x100]  Sony WH-1000XM5                      [×]         |
|                Thương hiệu: Sony  |  Tai nghe                   |
|                Đơn giá: 8.490.000đ                               |
|                                        [–] [2] [+]  16.980.000đ |
+------------------------------------------------------------------+
```

**Bố cục mobile** (stack dọc ảnh + info, actions ở dưới):
```
+---------------------------------+
| [Ảnh 80x80]  Sony WH-1000XM5  [×]|
|              Sony | Tai nghe     |
|              8.490.000đ/cái      |
|  [–] [2] [+]        16.980.000đ  |
+---------------------------------+
```

```css
.cart-page__item {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--border-radius-lg);
  padding: 16px;
  transition: border-color 0.2s ease, background 0.2s ease,
              box-shadow 0.2s ease, opacity 0.2s ease;
  position: relative;
  overflow: hidden;
}

.cart-page__item:hover {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  box-shadow: var(--shadow-md);
}

.cart-page__item--updating {
  opacity: 0.55;
  pointer-events: none;
}

/* Shimmer khi updating */
.cart-page__item--updating::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.04) 50%,
    transparent 100%
  );
  animation: item-shimmer 1.2s ease infinite;
}

@keyframes item-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@media (min-width: 640px) {
  .cart-page__item {
    flex-direction: row;
    align-items: center;
    gap: 20px;
    padding: 20px;
  }
}
```

**Khu vực ảnh sản phẩm**:
```css
.cart-page__item-image-wrap {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: var(--border-radius-md);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: transform 0.2s ease;
}

.cart-page__item-image-wrap:hover {
  transform: scale(1.04);
}

@media (min-width: 640px) {
  .cart-page__item-image-wrap {
    width: 96px;
    height: 96px;
  }
}

.cart-page__item-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

**Thông tin sản phẩm**:
```css
.cart-page__item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.cart-page__item-info {
  flex: 1;
  min-width: 0;
}

.cart-page__item-name {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--text-light);
  cursor: pointer;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  transition: color 0.15s ease;
}

.cart-page__item-name:hover {
  color: var(--primary-light);
}

@media (min-width: 768px) {
  .cart-page__item-name {
    font-size: 16px;
  }
}

.cart-page__item-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.cart-page__item-brand {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--border-radius-sm);
  padding: 2px 8px;
}

.cart-page__item-unit-price {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 8px;
}
```

**Actions (số lượng + xóa + thành tiền)**:

```css
.cart-page__item-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

@media (min-width: 640px) {
  .cart-page__item-actions {
    flex-direction: column;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
  }
}
```

**Control số lượng**:
```css
.cart-page__qty {
  display: inline-flex;
  align-items: center;
  gap: 0;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--border-radius-md);
  overflow: hidden;
  height: 36px;
}

.cart-page__qty-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.65);
  font-size: 18px;
  transition: background 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.cart-page__qty-btn:hover:not(:disabled) {
  background: rgba(29, 185, 84, 0.15);
  color: var(--primary-light);
}

.cart-page__qty-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.cart-page__qty-value {
  min-width: 36px;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-light);
  user-select: none;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  line-height: 36px;
}
```

**Thành tiền và nút xóa**:
```css
.cart-page__item-summary {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cart-page__item-subtotal {
  font-size: 16px;
  font-weight: 800;
  color: var(--primary-light);
  letter-spacing: -0.01em;
  white-space: nowrap;
}

@media (min-width: 640px) {
  .cart-page__item-subtotal {
    font-size: 17px;
  }
}

.cart-page__item-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--border-radius-md);
  background: none;
  border: 1px solid rgba(244, 67, 54, 0.2);
  color: rgba(244, 67, 54, 0.5);
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s ease, color 0.2s ease,
              border-color 0.2s ease, transform 0.15s ease;
  flex-shrink: 0;
}

.cart-page__item-remove:hover:not(:disabled) {
  background: rgba(244, 67, 54, 0.1);
  border-color: var(--error);
  color: var(--error);
  transform: scale(1.08);
}

.cart-page__item-remove:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
```

---

## 8. Section Mã giảm giá (Coupon)

### 8.1. Thiết kế

```
+-----------------------------------------------+
|  [tag icon]  Mã giảm giá                       |
|  [_________________________]  [Áp dụng]        |
|  [x] SALE50 – Giảm 50.000đ                     |
+-----------------------------------------------+
```

**States**:
- **Default**: input + nút "Áp dụng", placeholder "Nhập mã giảm giá".
- **Loading**: spinner trong nút, input disabled.
- **Success**: input biến mất, hiển thị badge mã đã áp với nút xóa `[×]`, border xanh `var(--border-primary)`.
- **Error**: border đỏ, text lỗi nhỏ bên dưới.

```css
.cart-page__coupon {
  margin-top: 20px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--border-radius-lg);
  transition: border-color 0.2s ease;
}

.cart-page__coupon:focus-within {
  border-color: rgba(29, 185, 84, 0.3);
}

.cart-page__coupon-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cart-page__coupon-label svg {
  color: var(--accent);
  font-size: 15px;
}

.cart-page__coupon-form {
  display: flex;
  gap: 10px;
}

.cart-page__coupon-input {
  flex: 1;
  height: 40px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-light);
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--border-radius-md);
  outline: none;
  transition: border-color 0.2s ease, background 0.2s ease;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.cart-page__coupon-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
  text-transform: none;
  letter-spacing: 0;
}

.cart-page__coupon-input:focus {
  border-color: var(--border-primary);
  background: rgba(29, 185, 84, 0.05);
}

.cart-page__coupon-input--error {
  border-color: var(--error);
  background: rgba(244, 67, 54, 0.05);
}

.cart-page__coupon-apply {
  height: 40px;
  padding: 0 18px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-light);
  background: rgba(29, 185, 84, 0.15);
  border: 1px solid var(--border-primary);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.cart-page__coupon-apply:hover:not(:disabled) {
  background: rgba(29, 185, 84, 0.25);
  box-shadow: 0 0 12px rgba(29, 185, 84, 0.2);
}

.cart-page__coupon-apply:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cart-page__coupon-error {
  font-size: 12px;
  color: var(--error);
  margin-top: 8px;
}

.cart-page__coupon-applied {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(29, 185, 84, 0.08);
  border: 1px solid rgba(29, 185, 84, 0.3);
  border-radius: var(--border-radius-md);
}

.cart-page__coupon-applied-code {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-light);
  letter-spacing: 0.04em;
}

.cart-page__coupon-applied-desc {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.cart-page__coupon-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.2);
  border-radius: var(--border-radius-full);
  color: var(--error-light);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
  flex-shrink: 0;
}

.cart-page__coupon-remove:hover {
  background: rgba(244, 67, 54, 0.2);
}
```

---

## 9. Panel Tổng kết đơn hàng (Order Summary)

### 9.1. Thiết kế tổng quan

Panel cố định bên phải trên desktop, xuất hiện dưới items trên mobile. Nền tối sang trọng, nổi bật bằng shadow.

```
+----------------------------+
|  Tổng kết đơn hàng         |
+----------------------------+
|  Tạm tính (3 sản phẩm)     |
|                 25.470.000đ|
|  Giảm giá (SALE50)         |
|                    -50.000đ|
|  Phí vận chuyển            |
|                   Miễn phí |
|  ──────────────────────── |
|  Tổng thanh toán            |
|                 25.420.000đ|
|                            |
|  [  TIẾN HÀNH THANH TOÁN ] |
|                            |
|  [shield] Thanh toán bảo mật|
|  [return] Đổi trả 30 ngày  |
|  [phone]  Hỗ trợ 24/7      |
+----------------------------+
```

### 9.2. CSS chi tiết

```css
.cart-page__summary {
  background: var(--gradient-secondary);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--border-radius-xl);
  padding: 28px 24px;
  box-shadow: var(--shadow-lg);
  position: sticky;
  top: 24px;
}

.cart-page__summary-title {
  font-size: 17px;
  font-weight: 800;
  color: var(--text-light);
  margin-bottom: 24px;
  letter-spacing: -0.01em;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.cart-page__summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
}

.cart-page__summary-label {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.4;
}

.cart-page__summary-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-light);
  white-space: nowrap;
}

.cart-page__summary-value--discount {
  color: var(--primary-light);
}

.cart-page__summary-value--free {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-light);
  background: rgba(29, 185, 84, 0.1);
  border: 1px solid rgba(29, 185, 84, 0.2);
  border-radius: var(--border-radius-full);
  padding: 2px 10px;
}

.cart-page__summary-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 8px 0;
  border: none;
}

.cart-page__summary-row--total {
  padding-top: 16px;
  margin-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.cart-page__summary-row--total .cart-page__summary-label {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-light);
}

.cart-page__summary-row--total .cart-page__summary-value {
  font-size: 22px;
  font-weight: 900;
  color: var(--text-light);
  letter-spacing: -0.02em;
}
```

### 9.3. Nút Checkout

```css
.cart-page__checkout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 52px;
  margin-top: 24px;
  font-size: 15px;
  font-weight: 800;
  color: var(--text-light);
  background: var(--gradient-primary);
  border: none;
  border-radius: var(--border-radius-md);
  cursor: pointer;
  box-shadow: var(--shadow-primary);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: background 0.2s ease, box-shadow 0.2s ease,
              transform 0.15s ease, opacity 0.2s ease;
  position: relative;
  overflow: hidden;
}

/* Shimmer effect trên nút */
.cart-page__checkout::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.15),
    transparent
  );
  transition: left 0.5s ease;
}

.cart-page__checkout:hover:not(:disabled)::before {
  left: 150%;
}

.cart-page__checkout:hover:not(:disabled) {
  background: var(--gradient-primary-hover);
  box-shadow: 0 6px 20px rgba(29, 185, 84, 0.55);
  transform: translateY(-1px);
}

.cart-page__checkout:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: var(--shadow-primary);
}

.cart-page__checkout:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}
```

### 9.4. Trust Badges

Trust badges đặt bên dưới nút checkout trong panel summary.

```
+---------------------------------+
|  [shield icon]  Thanh toán bảo mật |
|  [return icon]  Đổi trả miễn phí 30 ngày |
|  [headset icon] Hỗ trợ 24/7 qua hotline |
+---------------------------------+
```

```css
.cart-page__trust {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cart-page__trust-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.4;
}

.cart-page__trust-item svg {
  font-size: 15px;
  color: var(--primary);
  flex-shrink: 0;
}
```

---

## 10. Loading Skeleton State

### 10.1. Thiết kế

Khi đang tải, hiển thị skeleton giả lập 3 item và panel summary.

```css
.cart-page__loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Skeleton base animation */
@keyframes skeleton-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}

.cart-page__skeleton-item {
  height: 110px;
  border-radius: var(--border-radius-lg);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 25%,
    rgba(255, 255, 255, 0.09) 37%,
    rgba(255, 255, 255, 0.05) 63%
  );
  background-size: 800px 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
```

---

## 11. Empty State

### 11.1. Thiết kế

Trống giỏ hàng cần có minh họa, tiêu đề thân thiện và CTA rõ ràng.

```
         [icon: shopping-cart rỗng lớn]

         Giỏ hàng của bạn đang trống

      Khám phá thiết bị âm thanh hi-fi
       được tuyển chọn từ Đức Uy Audio

         [  Khám phá sản phẩm  ]
         [  Xem danh sách yêu thích  ]
```

```css
.cart-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 72px 24px 80px;
  gap: 16px;
}

.cart-page__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  border-radius: var(--border-radius-full);
  background: rgba(255, 255, 255, 0.04);
  border: 2px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.2);
  font-size: 40px;
  margin-bottom: 8px;
}

.cart-page__empty-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-light);
  line-height: 1.3;
  letter-spacing: -0.02em;
}

@media (min-width: 768px) {
  .cart-page__empty-title {
    font-size: 26px;
  }
}

.cart-page__empty-desc {
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.45);
  max-width: 320px;
}

.cart-page__empty-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
  width: 100%;
  max-width: 280px;
}

.cart-page__empty-cta {
  height: 48px;
  padding: 0 28px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-light);
  background: var(--gradient-primary);
  border: none;
  border-radius: var(--border-radius-md);
  cursor: pointer;
  box-shadow: var(--shadow-primary);
  letter-spacing: 0.03em;
  transition: background 0.2s ease, box-shadow 0.2s ease,
              transform 0.15s ease;
}

.cart-page__empty-cta:hover {
  background: var(--gradient-primary-hover);
  box-shadow: 0 6px 20px rgba(29, 185, 84, 0.55);
  transform: translateY(-1px);
}

.cart-page__empty-cta--secondary {
  height: 44px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}

.cart-page__empty-cta--secondary:hover {
  border-color: rgba(255, 255, 255, 0.28);
  color: var(--text-light);
  background: rgba(255, 255, 255, 0.04);
}
```

---

## 12. Error State

```css
.cart-page__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 56px 24px 64px;
  gap: 16px;
}

.cart-page__error-icon {
  font-size: 44px;
  color: var(--error-light);
  opacity: 0.7;
}

.cart-page__error-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-light);
}

.cart-page__error-desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.45);
  max-width: 300px;
  line-height: 1.6;
}

.cart-page__retry {
  height: 44px;
  padding: 0 24px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-light);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.cart-page__retry:hover {
  background: rgba(255, 255, 255, 0.13);
  border-color: rgba(255, 255, 255, 0.25);
}
```

---

## 13. Section Sản phẩm gợi ý (Related)

Đặt bên dưới toàn bộ nội dung giỏ hàng, chỉ hiển thị khi có items trong cart.

```
Có thể bạn cũng thích

[ Card 1 ]  [ Card 2 ]  [ Card 3 ]  [ Card 4 ]
```

```css
.cart-page__related {
  margin-top: 56px;
  padding-top: 40px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.cart-page__related-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-light);
  margin-bottom: 24px;
  letter-spacing: -0.01em;
}

.cart-page__related-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

@media (min-width: 640px) {
  .cart-page__related-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .cart-page__related-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

---

## 14. Sticky Checkout Bar (Mobile)

Trên mobile, khi user scroll xuống, hiển thị thanh sticky ở bottom với tổng tiền và nút checkout.

```
+-----------------------------------------+
|  25.420.000đ        [THANH TOÁN NGAY]   |
+-----------------------------------------+
```

```css
.cart-page__sticky-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: rgba(18, 20, 18, 0.92);
  backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  /* Chỉ hiển thị trên mobile */
  display: none;
}

@media (max-width: 1023px) {
  .cart-page__sticky-bar {
    display: flex;
  }
}

.cart-page__sticky-total {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cart-page__sticky-total-label {
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cart-page__sticky-total-value {
  font-size: 18px;
  font-weight: 900;
  color: var(--text-light);
  letter-spacing: -0.02em;
  line-height: 1;
}

.cart-page__sticky-checkout {
  height: 44px;
  padding: 0 24px;
  font-size: 14px;
  font-weight: 800;
  color: var(--text-light);
  background: var(--gradient-primary);
  border: none;
  border-radius: var(--border-radius-md);
  cursor: pointer;
  box-shadow: var(--shadow-primary);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: background 0.2s ease, box-shadow 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.cart-page__sticky-checkout:hover:not(:disabled) {
  background: var(--gradient-primary-hover);
  box-shadow: 0 4px 16px rgba(29, 185, 84, 0.5);
}
```

---

## 15. Trạng thái login cần thiết (Unauthenticated)

Khi user chưa đăng nhập, trang cart hiển thị trạng thái đặc biệt thay vì empty state:

```
       [avatar icon lớn]

    Đăng nhập để xem giỏ hàng

   Giỏ hàng của bạn được lưu an toàn
    khi bạn đăng nhập vào tài khoản.

      [  Đăng nhập ngay  ]
      [  Tạo tài khoản   ]
```

---

## 16. Animations (Framer Motion)

### 16.1. Fade-in danh sách items

```typescript
// Container stagger animation
const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

// Item slide-up + fade-in
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    x: -32,
    transition: { duration: 0.25 },
  },
};
```

### 16.2. Remove item – AnimatePresence

Khi xóa item, dùng `AnimatePresence` + `exit` animation (slide-left + fade-out).

### 16.3. Freeship bar

Fill thanh freeship dùng `motion.div` với `animate={{ width: `${percent}%` }}` và `transition={{ duration: 0.6, ease: "easeOut" }}`.

### 16.4. Summary panel

Panel summary slide-in từ phải trên desktop, slide-up từ dưới trên mobile khi trang mount.

---

## 17. Responsive Summary

| Màn hình | Behavior |
|---|---|
| Mobile `< 640px` | 1 cột, items trên; summary card dưới; sticky bar cố định bottom |
| Tablet `640–1023px` | 1 cột, items + summary stack; sticky bar vẫn có |
| Desktop `>= 1024px` | 2 cột (items 1fr + summary 380px); không có sticky bar; summary sticky top-24px |

### Padding thêm dưới cùng trên mobile (để không bị sticky bar che khuất)

```css
@media (max-width: 1023px) {
  .cart-page__inner {
    padding-bottom: 100px;
  }
}
```

---

## 18. Màu sắc & Token tóm tắt sử dụng

| Vùng | Background | Border | Text | Accent |
|---|---|---|---|---|
| Nền trang | `--background-homepage` (rgb 18 32 23) | – | `--text-light` | – |
| Item card | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.07)` | `--text-light` | – |
| Item card hover | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.14)` | – | – |
| Thành tiền item | – | – | `--primary-light` | – |
| Control số lượng | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.12)` | `--text-light` | `--primary-light` (hover) |
| Nút xóa | none | `rgba(244,67,54,0.2)` | `rgba(244,67,54,0.5)` | `--error` (hover) |
| Coupon section | `rgba(255,255,255,0.03)` | `rgba(255,255,255,0.07)` | `--text-light` | `--accent` (icon) |
| Coupon applied | `rgba(29,185,84,0.08)` | `rgba(29,185,84,0.3)` | `--primary-light` | – |
| Freeship bar | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.75)` | `--primary-light` |
| Summary panel | `--gradient-secondary` | `rgba(255,255,255,0.08)` | `--text-light` | – |
| Tổng thanh toán | – | – | `--text-light` (900 weight) | – |
| Nút checkout | `--gradient-primary` | none | `--text-light` | `--shadow-primary` |
| Sticky bar | `rgba(18,20,18,0.92)` blur | `rgba(255,255,255,0.1)` | `--text-light` | – |
| Trust badges | – | – | `rgba(255,255,255,0.45)` | `--primary` (icon) |
| Empty state | – | `rgba(255,255,255,0.08)` | `--text-light` | – |

---

## 19. Inspiration đã nghiên cứu

| Nguồn | Điểm học hỏi |
|---|---|
| **Di Bruno Bros** | Freeship progress bar phía trên bảng giá – conversion nudge hiệu quả |
| **Warby Parker** | Thiết kế sleek minimal, hiển thị savings nổi bật |
| **Urban Outfitters** | Low-stock alert, save-for-later / wishlist nudge |
| **Dollar Shave Club** | Cost breakdown chi tiết, free shipping highlighted |
| **Louis Vuitton** | Image hover zoom, không vội vàng – không gian để cân nhắc |
| **Crate & Barrel** | Shipping info ở nhiều điểm, rõ ràng từ sớm |
| **Burton** | Single relevant product recommendation – không lạm dụng cross-sell |
| **Mytek Audio / Argon Audio** | Premium audio dark theme, trust signals (30-day return, 3-year warranty) |
| **Baymard Institute 2025** | Sticky CTA, guest checkout, hiển thị total price sớm |

---

## 20. Checklist triển khai

- [ ] `PageTransitionOverlay` active 1100ms khi trang mount.
- [ ] Fetch cart ngay khi session `authenticated`.
- [ ] Skeleton 3 items trong lúc loading (không dùng spinner đơn thuần).
- [ ] Item `--updating` modifier + shimmer khi đang PATCH/DELETE.
- [ ] `AnimatePresence` wrap danh sách items để exit animation đẹp khi xóa.
- [ ] Freeship progress bar với `motion.div` animated fill.
- [ ] Số lượng min = 1; nút `-` disabled khi `quantity === 1`.
- [ ] Panel summary sticky trên desktop (`position: sticky; top: 24px`).
- [ ] Sticky checkout bar trên mobile (ẩn trên desktop `>= 1024px`).
- [ ] Empty state với 2 CTA: "Khám phá sản phẩm" và "Danh sách yêu thích".
- [ ] Unauthenticated state riêng, không nhầm với empty cart.
- [ ] Toast success khi xóa item (sonner).
- [ ] Section sản phẩm gợi ý (Related) bên dưới.
- [ ] Responsive đầy đủ: mobile / tablet / desktop.
- [ ] Padding bottom `100px` trên mobile để không bị sticky bar che.
- [ ] `ReadLints` kiểm tra sau khi hoàn thiện file `.tsx` và `.module.css`.
