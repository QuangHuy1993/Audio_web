# Thiết kế Trang Chi tiết Sản phẩm – Đức Uy Audio

## 1. Mục tiêu & bối cảnh

### 1.1. Mục tiêu trang

Trang chi tiết sản phẩm (`/products/[slug]`) là trang **chuyển đổi quan trọng nhất** trong hành trình mua hàng. Nhiệm vụ của trang:

- Giúp người dùng **hiểu rõ sản phẩm** qua hình ảnh đa góc, mô tả marketing và thông số kỹ thuật.
- **Kích thích quyết định mua** qua giá, badge giảm giá, trạng thái tồn kho, đánh giá từ khách hàng.
- Cung cấp tính năng **AI tư vấn theo sản phẩm cụ thể** – hỏi AI về sản phẩm, so sánh với sản phẩm khác.
- Kết nối tự nhiên sang **thêm giỏ hàng**, **wishlist**, **chia sẻ** và **sản phẩm liên quan**.
- Tối ưu **SEO** với metadata từ `seoTitle`, `seoDescription` của sản phẩm.

### 1.2. Bối cảnh dự án

**Hệ màu** (từ `globals.css`):
- Màu chính: `var(--primary)` #1DB954 | `var(--primary-light)` #1ED760 | `var(--primary-dark)` #169C46
- Accent: `var(--accent)` #FFD700 | `var(--accent-dark)` #D4AF37
- Nền: `var(--background)` #FAFAFA | `var(--background-secondary)` #F5F5F5 | `var(--background-tertiary)` #EEEEEE
- Text: `var(--text)` #121212 | `var(--text-secondary)` #424242 | `var(--text-tertiary)` #757575
- Trạng thái: `var(--success)` #4CAF50 | `var(--warning)` #FF9800 | `var(--error)` #F44336
- Shadow: `var(--shadow-sm)` | `var(--shadow-md)` | `var(--shadow-lg)` | `var(--shadow-primary)`
- Gradient: `var(--gradient-primary)` | `var(--gradient-secondary)` | `var(--gradient-accent)`
- Border radius: sm 4px | md 8px | lg 12px | xl 16px | full 9999px

**Nguồn dữ liệu** (từ `prisma/schema.prisma`):
```
Product {
  id, name, slug, description, price, salePrice, currency,
  stock, status, seoTitle, seoDescription,
  aiDescription, aiTags[],
  category { name, slug, aiDescription, aiTags[] },
  brand { name, slug, logoUrl, aiDescription, aiTags[] },
  images[] { url, alt, isPrimary, sortOrder },
  reviews[] { rating, comment, user { name, image }, createdAt },
}
```

**Các component/pattern đã có**:
- `ShopHeader` – header chung có search, cart, AI, user menu.
- `ShopFooter` – footer chung.
- `PageTransitionOverlay` – overlay chuyển trang, dùng 1100ms trước khi tắt.
- `DataLoadingOverlay` – overlay loading cho bảng/vùng data.
- `ConfirmActionDialog` – dialog xác nhận hành động.
- Icons: `react-icons/md`, `react-icons/fa`.
- Toast: `sonner`.
- Animation: `framer-motion`.

**Inspiration từ các trang hi-fi audio hàng đầu**:
- **Status Audio (Between Pro)**: Hero image to + buy box nổi bật, trust badges (30 ngày hoàn tiền, 1 năm bảo hành), feature blocks hình + text xen kẽ, review section với bar chart rating, tech specs collapsible.
- **Audiolab D9**: Tab navigation (Reviews / Specifications / Downloads / Overview), color/finish selector, "Book a Demo" CTA, bảng thông số kỹ thuật dạng table.
- **Sonos Five**: Multi-angle gallery, lifestyle photography lớn, feature highlight với icon + text, color selector kèm giá từng variant.
- **B&W / ELAC**: Typography sắc nét premium, white space rộng, product comparison block.

---

## 2. URL & Data

```
Route: /products/[slug]
File:  src/app/products/[slug]/page.tsx   (Server Component – fetch metadata)
       src/features/shop/components/product-detail/ProductDetailPage.tsx  (Client Component)
API:   GET /api/shop/products/[slug]
```

### 2.1. DTO mở rộng cần thiết

```typescript
// src/types/shop.ts

export type ProductImageDto = {
  id: string;
  url: string;
  alt: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export type ReviewDto = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: {
    name: string | null;
    image: string | null;
  };
};

export type ProductDetailDto = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  salePrice: number | null;
  currency: string;
  stock: number;
  status: "ACTIVE" | "HIDDEN" | "DRAFT";
  seoTitle: string | null;
  seoDescription: string | null;
  aiDescription: string | null;
  aiTags: string[];
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  brand: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    aiDescription: string | null;
  } | null;
  images: ProductImageDto[];
  reviews: ReviewDto[];
  reviewStats: {
    avgRating: number;       // trung bình sao (1 chữ số thập phân)
    totalReviews: number;
    distribution: {          // phân bố: { 5: 120, 4: 30, 3: 5, 2: 2, 1: 1 }
      [star: number]: number;
    };
  };
};
```

---

## 3. Cấu trúc tổng thể trang

```
<ShopHeader />
<PageTransitionOverlay />         ← chạy 1100ms khi vào trang
│
├── [A] Breadcrumb
│
├── [B] Hero Section (2 cột desktop / 1 cột mobile)
│   ├── [B1] Image Gallery (cột trái)
│   └── [B2] Buy Box – Sticky (cột phải)
│
├── [C] Tab Navigation: Mô tả | Thông số | Đánh giá | AI Tư vấn
│   ├── [C1] Tab: Mô tả chi tiết
│   ├── [C2] Tab: Thông số kỹ thuật
│   ├── [C3] Tab: Đánh giá khách hàng
│   └── [C4] Tab: Hỏi AI về sản phẩm
│
├── [D] Brand Story Block
│
├── [E] Trust Badges (Chính sách mua hàng)
│
├── [F] Sản phẩm liên quan (Related Products)
│
<ShopFooter />
```

---

## 4. Chi tiết từng phần

---

### [A] Breadcrumb

**Vị trí**: Trên cùng, dưới header, nền `var(--background-secondary)`.

**Nội dung**:
```
Trang chủ  /  Sản phẩm  /  {Tên danh mục}  /  {Tên sản phẩm}
```

**Thiết kế**:
- Nền: `var(--background-secondary)` #F5F5F5.
- Padding: `12px 0` (section), inner max-width 1280px.
- Dấu phân tách: icon `MdChevronRight` màu `var(--text-tertiary)`.
- Link: `var(--text-tertiary)`, hover `var(--primary)`, transition 200ms.
- Link cuối (tên sản phẩm): `var(--text)`, font-weight 500, không có underline, `aria-current="page"`.
- Responsive: ẩn bớt các cấp giữa trên mobile, chỉ hiện `... / {Tên sản phẩm}`.

**BEM**: `product-detail-page__breadcrumb-section`, `__breadcrumb-nav`, `__breadcrumb-link`, `__breadcrumb-separator`, `__breadcrumb-current`.

---

### [B1] Image Gallery (cột trái – 55% desktop)

**Bố cục desktop**:
```
┌─────────────────────────────────────┐
│                                     │
│          Ảnh chính (1:1)            │   ← Click để zoom full màn hình
│          400px × 400px+             │
│                                     │
└─────────────────────────────────────┘
┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐              ← Thumbnails hàng ngang
│  │ │  │ │  │ │  │ │  │
└──┘ └──┘ └──┘ └──┘ └──┘
 72px × 72px, border-radius 8px
```

**Chi tiết ảnh chính**:
- Container: `position: relative`, `aspect-ratio: 1/1`, `border-radius: var(--border-radius-xl)`, `overflow: hidden`.
- Nền fallback khi chưa load: gradient `var(--background-dark)` → `var(--background-tertiary)`.
- Framer Motion: `AnimatePresence` + `motion.div` fade/slide khi chuyển ảnh (duration 0.3s, ease "easeOut").
- Badge "Sale -XX%": top-left, `var(--accent)` nền, `var(--secondary)` text, font-weight 700, border-radius full.
- Badge "Hết hàng": nếu `stock === 0`, overlay mờ 40% + text "Hết hàng" giữa ảnh.
- Nút zoom: bottom-right ảnh chính, icon `MdZoomIn`, nền `rgba(0,0,0,0.5)`, màu trắng.
- Prev/Next arrow (khi có > 1 ảnh): hover hiện ra ở 2 cạnh trái/phải.

**Chi tiết thumbnails**:
- Danh sách ngang, scroll ngang trên mobile.
- Kích thước: 72×72px, `object-fit: cover`.
- Border active: `2px solid var(--primary)` + `box-shadow: var(--shadow-primary)`.
- Border hover: `2px solid var(--border-color-dark)`.
- Gap: 8px.

**Lightbox (modal zoom)**:
- Khi click ảnh chính → mở full màn hình overlay `rgba(0,0,0,0.92)`.
- Hiển thị ảnh full-width/height tối đa, có thể scroll qua các ảnh.
- Nút đóng (X) top-right, esc để đóng.
- Swipe gesture trên mobile.

**Mobile** (< 768px):
- Ảnh chính full width, `aspect-ratio: 4/3`.
- Thumbnails: hàng ngang scroll dưới ảnh chính.

**BEM**: `product-detail-page__gallery`, `__gallery-main`, `__gallery-main-image`, `__gallery-badge`, `__gallery-zoom-btn`, `__gallery-thumbnails`, `__gallery-thumb`, `__gallery-thumb--active`, `__gallery-arrow`, `__gallery-lightbox`.

---

### [B2] Buy Box – Sticky (cột phải – 45% desktop)

**Định vị**: `position: sticky`, `top: 80px` (chiều cao header).

**Cấu trúc Buy Box từ trên xuống**:

#### B2.1. Brand & Category Pills
```
[Logo brand nhỏ 24px]  Tên Brand   •   Tên Danh mục
```
- Logo brand: `Image` 24×24px, `border-radius: 4px`.
- Tên brand: `var(--text-secondary)`, font-size 13px, link sang `/brands/[slug]`.
- Phân tách bằng `•` màu `var(--text-tertiary)`.
- Tên danh mục: link sang `/products?categoryId=...`.

#### B2.2. Tên sản phẩm
- `<h1>`: font-size `clamp(22px, 3vw, 32px)`, font-weight 700, line-height 1.2.
- Màu: `var(--text)`.
- Margin-bottom: 12px.

#### B2.3. Rating Summary (inline)
```
★★★★☆  4.3  (127 đánh giá)  →  cuộn xuống phần đánh giá
```
- Sao màu `var(--accent)` #FFD700, outline sao trống màu `var(--border-color-dark)`.
- Con số đánh giá: font-weight 600, `var(--text)`.
- Số lượt đánh giá: `var(--text-tertiary)`, font-size 13px.
- Cả dòng là `<a>` cuộn đến tab đánh giá (`#reviews-tab`).

#### B2.4. Giá
```
Giá gốc: 45.000.000đ     (gạch ngang, nếu có salePrice)
Giá ưu đãi: 38.000.000đ  (lớn, màu var(--primary), font-weight 800)
Tiết kiệm: 7.000.000đ    (badge nhỏ, nền var(--primary) 10%, màu var(--primary))
```
- Giá chính: font-size `clamp(24px, 3.5vw, 36px)`, font-weight 800.
- Khi có `salePrice`: giá gốc gạch ngang màu `var(--text-tertiary)`, font-size 16px.
- Badge "Tiết kiệm": pill `border-radius: 9999px`, padding 2px 10px.

#### B2.5. Trạng thái tồn kho
```
• Còn hàng (stock > 0)  /  Hết hàng  /  Đặt hàng trước
```
- Dot tròn 8px + text.
- Còn hàng: `var(--success)` + "Còn hàng sẵn".
- Sắp hết (1–5 cái): `var(--warning)` + "Chỉ còn {n} sản phẩm – đặt ngay!".
- Hết hàng: `var(--error)` + "Tạm hết hàng".
- Font-size 13px, font-weight 500.

#### B2.6. Lựa chọn số lượng
```
[−]  [  1  ]  [+]
```
- Nút trừ/cộng: 36×36px, border `1px solid var(--border-color)`, border-radius md.
- Input số: 52px rộng, canh giữa, không có spin button (mũi tên), `min: 1`, `max: stock`.
- Disable nút trừ khi quantity = 1.
- Disable nút cộng khi quantity = stock.

#### B2.7. Nút CTA chính
```
[  + Thêm vào giỏ hàng  ]    (full width, gradient primary, height 52px)
[  Mua ngay  ]               (full width, nền secondary, height 52px)
```
- "Thêm vào giỏ hàng": `background: var(--gradient-primary)`, màu trắng, font-weight 700, icon `MdAddShoppingCart`.
- "Mua ngay": `background: var(--secondary)`, màu `var(--text-light)`, font-weight 600, icon `MdBolt`.
- Cả 2 disabled + opacity 0.5 khi stock = 0.
- Hover: scale(1.01) + `box-shadow: var(--shadow-primary)`.
- Framer Motion: `whileHover`, `whileTap`.

#### B2.8. Wishlist & Chia sẻ
```
[♡ Yêu thích]   [↗ Chia sẻ]
```
- 2 button nhỏ ngang nhau, nền `var(--background-secondary)`, border `1px solid var(--border-color)`.
- Icon `MdFavoriteBorder` / `MdFavorite` (toggle khi đã thích).
- Chia sẻ: dropdown nhỏ với Copy Link, Facebook, Zalo.

#### B2.9. Mini Trust Badges (dạng icon + text)
```
[tick] Miễn phí vận chuyển toàn quốc
[clock] Bảo hành chính hãng 12 tháng
[refresh] Đổi trả trong 7 ngày
[headset] Hỗ trợ tư vấn 24/7
```
- Layout: 2×2 grid.
- Icon 20px màu `var(--primary)`.
- Text: font-size 12px, `var(--text-secondary)`.
- Nền `var(--background-secondary)`, border-radius lg, padding 16px.

#### B2.10. AI Quick Ask (thu gọn mặc định)
```
[sparkle] Hỏi AI về sản phẩm này
```
- Button nhỏ có gradient border từ `var(--primary)` → `var(--accent)`.
- Khi click → expand một ô chat mini (textarea + nút gửi).
- Placeholder: "Ví dụ: Loa này phù hợp phòng 25m² không? Kết hợp với ampli nào tốt?".
- Kết quả AI hiện bên dưới trong dạng bubble text.
- Link "Xem đầy đủ trong tab AI Tư vấn" → cuộn xuống tab C4.

**BEM**: `product-detail-page__buy-box`, `__buy-box-brand-row`, `__buy-box-title`, `__buy-box-rating`, `__buy-box-price`, `__buy-box-price-original`, `__buy-box-price-sale`, `__buy-box-price-badge`, `__buy-box-stock`, `__buy-box-qty`, `__buy-box-cta-add`, `__buy-box-cta-buy`, `__buy-box-actions`, `__buy-box-trust`, `__buy-box-ai`.

---

### [C] Tab Navigation

**Vị trí**: Bên dưới hero section, full width.

**Tab bar**:
- Sticky khi scroll: `position: sticky`, `top: 72px` (height header), `z-index: 10`.
- Nền: `var(--background)` với blur backdrop (`backdrop-filter: blur(8px)`).
- Border-bottom: `1px solid var(--border-color)`.
- 4 tab items: **Mô tả** | **Thông số kỹ thuật** | **Đánh giá (127)** | **AI Tư vấn**.
- Tab active: text `var(--primary)`, border-bottom `2px solid var(--primary)`, font-weight 600.
- Tab hover: text `var(--text)`, background subtle hover.
- Indicator animation: Framer Motion `layoutId="tab-indicator"` trượt ngang.
- Mobile: tab bar scroll ngang (overflow-x scroll, scrollbar ẩn).

---

### [C1] Tab: Mô tả chi tiết

**Nội dung**:
- Render `product.description` dạng rich text (markdown hoặc HTML safe).
- Typography sạch: `line-height: 1.8`, `font-size: 15px`, `var(--text-secondary)`.
- Heading trong mô tả: `var(--text)`, font-weight 700.
- Link trong mô tả: `var(--primary)`.

**Feature Highlights** (nếu `aiTags` có dữ liệu):
- Dạng grid 2-3 cột các pill/badge, mỗi pill 1 tag âm thanh: `home-cinema`, `hi-end`, `phong-30m2`, ...
- Nền pill: `rgba(29,185,84,0.1)`, text `var(--primary)`, border `1px solid rgba(29,185,84,0.25)`.

**Lifestyle image section** (nếu có ảnh phụ ngoài gallery):
- Block hình chữ nhật rộng, `aspect-ratio: 16/7`, ảnh thứ 2-3 của sản phẩm (không phải primary).
- Caption nhỏ bên dưới, font-size 12px, `var(--text-tertiary)`.

**Expand/Collapse**:
- Nếu mô tả dài > 400px: hiển thị 400px + gradient fade-out dưới.
- Nút "Xem thêm" / "Thu gọn".
- Framer Motion: `AnimateHeight` hoặc CSS `max-height` transition.

---

### [C2] Tab: Thông số kỹ thuật

> Lưu ý: Hiện tại schema Prisma chưa có bảng `ProductSpec` riêng. Thông số có thể được parse từ `description` theo pattern key:value, hoặc sẽ được bổ sung vào `Product` dưới dạng `Json specs` field. File thiết kế này đề xuất hướng hiển thị; developer sẽ quyết định cấu trúc data source.

**Dạng hiển thị**:
```
┌──────────────────────────────────────────────────────┐
│  Thông số kỹ thuật                                    │
├──────────────────┬───────────────────────────────────┤
│ Tổng trở         │ 4–8 Ohm                           │
├──────────────────┼───────────────────────────────────┤
│ Công suất        │ 100W RMS × 2 kênh                 │
├──────────────────┼───────────────────────────────────┤
│ Tần số đáp ứng   │ 20Hz – 20kHz (±3dB)              │
├──────────────────┼───────────────────────────────────┤
│ Kết nối          │ HDMI ARC, Optical, RCA, USB-B     │
├──────────────────┼───────────────────────────────────┤
│ Kích thước       │ 430 × 120 × 350mm                 │
├──────────────────┼───────────────────────────────────┤
│ Trọng lượng      │ 8.5kg                             │
└──────────────────┴───────────────────────────────────┘
```
- Table responsive: trên mobile chuyển thành 2 cột full width mỗi dòng.
- Row lẻ/chẵn: xen kẽ `var(--background)` và `var(--background-secondary)`.
- Header label: font-weight 600, `var(--text)`, 40% width.
- Value: `var(--text-secondary)`, 60% width.
- Border: `1px solid var(--border-color)`.

**Download tài liệu** (nếu có link PDF trong description/metadata):
- Block nhỏ dưới bảng:
  ```
  [pdf icon]  Hướng dẫn sử dụng (PDF, 2.4MB)  [Tải xuống ↓]
  ```
- Nền `var(--background-secondary)`, border-radius md.

---

### [C3] Tab: Đánh giá khách hàng

**Layout desktop**: 2 cột (Rating Summary bên trái, danh sách review bên phải).
**Layout mobile**: 1 cột (Rating Summary trên, danh sách review dưới).

#### C3.1. Rating Summary

```
         4.7                  5 ★  ████████████████░  87%
      ━━━━━━━━━               4 ★  ████░░░░░░░░░░░░░  10%
  ★★★★★  (2,326 đánh giá)     3 ★  ░░░░░░░░░░░░░░░░░   2%
                               2 ★  ░░░░░░░░░░░░░░░░░   1%
  95% khuyến nghị             1 ★  ░░░░░░░░░░░░░░░░░   0%
```

- Số điểm trung bình: font-size 56px, font-weight 800, `var(--text)`.
- Dải sao: 5 sao lớn, màu `var(--accent)`.
- Progress bar mỗi mức sao:
  - Nền track: `var(--background-dark)`.
  - Fill: `var(--accent)` gradient.
  - Hover: hiện tooltip số lượt đánh giá mức đó.
  - Animation fill khi tab active: Framer Motion `initial={{ width: 0 }}` → `animate`.
- Badge "95% khuyến nghị": pill xanh lá `var(--primary)`.

#### C3.2. Form viết đánh giá

```
[ Viết đánh giá của bạn ]   (button, hiện form bên dưới hoặc modal)
```
- Rating picker: 5 sao click được, hover highlight.
- Textarea: placeholder "Chia sẻ trải nghiệm của bạn...".
- Submit button: `var(--gradient-primary)`.
- Yêu cầu đăng nhập: nếu chưa login → redirect về `/login?callbackUrl=...`.

#### C3.3. Danh sách Reviews

```
┌──────────────────────────────────────────────────────┐
│ [Avatar]  Nguyễn Văn A  ·  Đã mua hàng              │
│           ★★★★★  ·  23 tháng 1, 2025                │
│                                                       │
│  "Âm thanh tuyệt vời, bass rất chắc và sâu..."       │
│                                                       │
│  [Hữu ích? 12 người] ▲ ▼                             │
└──────────────────────────────────────────────────────┘
```

- Avatar: 40×40px, border-radius full. Fallback: chữ cái đầu của tên, nền gradient.
- Tên user: font-weight 600. Badge "Đã mua hàng" nếu đã mua (từ order history).
- Sao: màu `var(--accent)`.
- Ngày: `var(--text-tertiary)`, format "DD tháng MM, YYYY".
- Comment: `line-height: 1.7`, `var(--text-secondary)`.
- Separator: `1px solid var(--border-color)`.
- Phân trang: "Tải thêm đánh giá" (load more button), không dùng pagination số trang.

**Sort & Filter bar**:
```
Sắp xếp: [Mới nhất ▼]     Lọc: [Tất cả ▼]  [Có ảnh]  [5 sao]  [1 sao]
```

---

### [C4] Tab: AI Tư vấn

**Mục đích**: Khai thác `aiDescription` và `aiTags` của sản phẩm, danh mục, thương hiệu để tư vấn chuyên sâu.

**Giao diện dạng chat-like**:
```
┌─────────────────────────────────────────────────────────────────┐
│  [sparkle] AI Tư vấn – Đức Uy Audio                            │
│  Hỏi tôi bất cứ điều gì về [Tên sản phẩm]                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Gợi ý câu hỏi nhanh:                                          │
│  [Phù hợp phòng nào?]  [Kết hợp thiết bị gì?]  [So sánh?]    │
│                                                                  │
│  ┌─ User ─────────────────────────────────────────────┐        │
│  │ Loa này phù hợp với phòng khách 25m² không?       │        │
│  └────────────────────────────────────────────────────┘        │
│                                                                  │
│  ┌─ AI ──────────────────────────────────────────────┐         │
│  │ [sparkle] Dựa trên thông số của [Tên sản phẩm]..│         │
│  │ ...                                               │         │
│  └────────────────────────────────────────────────────┘        │
│                                                                  │
│  ─────────────────────────────────────────────────────         │
│  [ Nhập câu hỏi của bạn...              ] [Gửi →]             │
└─────────────────────────────────────────────────────────────────┘
```

**Thiết kế chi tiết**:
- Header AI panel: gradient từ `var(--secondary)` → `var(--secondary-light)`, icon sparkle `var(--primary)`.
- Quick suggestion pills: nền `rgba(29,185,84,0.08)`, border `var(--primary)` 20% opacity, click để tự điền textarea.
- User bubble: align right, nền `var(--primary)`, text trắng, border-radius `12px 12px 0 12px`.
- AI bubble: align left, nền `var(--background-secondary)`, border-left `3px solid var(--primary)`, border-radius `12px 12px 12px 0`.
- Loading state AI: 3 chấm nhảy animation.
- Input: textarea 1 dòng (expand khi focus), border `var(--primary)` khi active.
- Nút Gửi: `var(--gradient-primary)`, icon `MdSend`.
- Disclaimer nhỏ: "Câu trả lời từ AI chỉ mang tính tham khảo. Liên hệ Đức Uy Audio để được tư vấn chuyên sâu."

**Context gửi lên AI**:
```json
{
  "productName": "...",
  "productDescription": "...",
  "aiDescription": "...",
  "aiTags": [...],
  "brandName": "...",
  "brandAiDescription": "...",
  "categoryName": "...",
  "userQuestion": "..."
}
```

---

### [D] Brand Story Block

**Vị trí**: Dưới tabs, full width section.

**Nội dung**:
```
┌────────────────────────────────────────────────────────────────┐
│   [Brand Logo 60px]                                            │
│   Tên Thương Hiệu                                              │
│   "Triết lý âm thanh & Câu chuyện của brand..."               │
│   (từ brand.aiDescription)                                     │
│   [Xem tất cả sản phẩm của Brand →]                           │
└────────────────────────────────────────────────────────────────┘
```

**Thiết kế**:
- Nền: `var(--secondary)` với pattern gradient nhẹ (overlay 5% transparent primary).
- Logo brand: `Image`, kích thước 60×60px, `object-fit: contain`, filter `brightness(0) invert(1)` nếu logo tối.
- Tên brand: font-size 24px, font-weight 700, text-light.
- Mô tả: font-size 15px, `rgba(255,255,255,0.75)`, line-height 1.7, max 3 dòng với ellipsis.
- CTA link: `var(--primary)` với arrow icon, hover underline.
- Padding: 48px 24px.
- Border-radius: `var(--border-radius-xl)` nếu không full width.

---

### [E] Trust Badges (Chính sách mua hàng)

**Vị trí**: Dưới Brand Story, trên Related Products.

**4 badge ngang nhau**:
```
[truck icon]         [shield icon]         [refresh icon]          [support icon]
Miễn phí vận         Bảo hành               Đổi trả                 Tư vấn
chuyển HCM           chính hãng             trong 7 ngày            24/7
Giao toàn quốc       12 tháng               Miễn phí                Đức Uy Audio
```

**Thiết kế**:
- Grid 4 cột desktop → 2×2 tablet → 2×2 mobile (với spacing hợp lý).
- Mỗi badge: card nhỏ, nền `var(--background-secondary)`, border `1px solid var(--border-color)`, border-radius lg.
- Icon 32px, màu `var(--primary)`, `background: rgba(29,185,84,0.1)`, padding 8px, border-radius full.
- Title: font-weight 700, `var(--text)`.
- Subtitle: font-size 12px, `var(--text-secondary)`.
- Hover: `box-shadow: var(--shadow-md)`, transform translateY(-2px).

---

### [F] Sản phẩm liên quan

**Vị trí**: Cuối trang, trên footer.

**Logic chọn sản phẩm**:
1. Ưu tiên cùng `categoryId`, khác `id`, `status: ACTIVE`.
2. Sort theo `createdAt DESC`.
3. Số lượng: 4–6 sản phẩm.

**Giao diện**:
- Header section:
  ```
  Sản phẩm liên quan
  [Tên danh mục – VD: Ampli đèn]    [Xem tất cả →]
  ```
- Grid card: tương tự ProductCard trên trang danh sách (`products/page.tsx`).
- Scroll ngang trên mobile thay vì wrap xuống dòng.
- Framer Motion `stagger` khi section scroll vào viewport.

**BEM**: `product-detail-page__related`, `__related-header`, `__related-title`, `__related-see-all`, `__related-grid`, `__related-card`.

---

## 5. Layout & Responsive

### 5.1. Layout desktop (>= 1024px)

```
max-width: 1280px, margin: 0 auto, padding-inline: 24px

Hero section:
  grid-template-columns: 55fr 45fr
  gap: 48px
  align-items: flex-start

Tab content:
  max-width: 900px
  margin: 0 auto
```

### 5.2. Layout tablet (768px – 1023px)

```
Hero section:
  grid-template-columns: 1fr 1fr
  gap: 32px

Buy Box: không sticky

Tab bar: scroll ngang
```

### 5.3. Layout mobile (< 768px)

```
Hero section:
  grid-template-columns: 1fr    ← 1 cột, gallery trên, buy box dưới
  gap: 0

Gallery: full width, aspect-ratio 4/3
Buy Box: margin-top 24px, không sticky
Tab bar: scroll ngang, snap scroll

[C] Tabs: full width
[D] Brand block: padding 32px 16px
[E] Trust: 2x2 grid
[F] Related: horizontal scroll
```

---

## 6. File structure đề xuất

```
src/
├── app/
│   └── products/
│       └── [slug]/
│           └── page.tsx                          ← Server Component (metadata + data fetch)
│
├── features/
│   └── shop/
│       └── components/
│           └── product-detail/
│               ├── ProductDetailPage.tsx          ← Client Component chính
│               ├── ProductDetailPage.module.css
│               ├── ProductImageGallery.tsx        ← Gallery + Lightbox
│               ├── ProductImageGallery.module.css
│               ├── ProductBuyBox.tsx              ← Buy box sticky
│               ├── ProductBuyBox.module.css
│               ├── ProductTabNav.tsx              ← Tab navigation
│               ├── ProductTabNav.module.css
│               ├── ProductDescriptionTab.tsx
│               ├── ProductSpecsTab.tsx
│               ├── ProductReviewsTab.tsx
│               ├── ProductReviewsTab.module.css
│               ├── ProductAiTab.tsx
│               ├── ProductAiTab.module.css
│               ├── ProductBrandBlock.tsx
│               ├── ProductBrandBlock.module.css
│               ├── ProductTrustBadges.tsx
│               ├── ProductTrustBadges.module.css
│               └── ProductRelated.tsx
│
├── types/
│   └── shop.ts                                    ← Thêm ProductDetailDto, ReviewDto, ProductImageDto
│
└── app/
    └── api/
        └── shop/
            └── products/
                └── [slug]/
                    └── route.ts                   ← GET /api/shop/products/[slug]
```

---

## 7. API Route – GET /api/shop/products/[slug]

**Mục đích**: Trả về toàn bộ data cần thiết cho trang chi tiết sản phẩm.

**Query Prisma**:
```typescript
prisma.product.findUnique({
  where: { slug, status: "ACTIVE" },
  select: {
    id: true, name: true, slug: true, description: true,
    price: true, salePrice: true, currency: true,
    stock: true, status: true,
    seoTitle: true, seoDescription: true,
    aiDescription: true, aiTags: true,
    category: {
      select: { id: true, name: true, slug: true }
    },
    brand: {
      select: { id: true, name: true, slug: true, logoUrl: true, aiDescription: true }
    },
    images: {
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
      select: { id: true, url: true, alt: true, isPrimary: true, sortOrder: true }
    },
    reviews: {
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, rating: true, comment: true, createdAt: true,
        user: { select: { name: true, image: true } }
      }
    },
    _count: { select: { reviews: true } }
  }
})
```

**Tính toán reviewStats** (trong service layer):
```typescript
// Aggregate rating distribution
const distribution = await prisma.review.groupBy({
  by: ["rating"],
  where: { productId: product.id },
  _count: { rating: true }
});
```

**Response 404**: Nếu không tìm thấy hoặc status !== ACTIVE, trả về `notFound()` trong server component.

---

## 8. SEO & Metadata

```typescript
// src/app/products/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const product = await fetchProductDetail(params.slug);
  return {
    title: product.seoTitle ?? `${product.name} | Đức Uy Audio`,
    description: product.seoDescription ?? product.description.slice(0, 160),
    openGraph: {
      title: product.seoTitle ?? product.name,
      description: product.seoDescription,
      images: [{ url: product.images[0]?.url }],
      type: "website"
    }
  };
}
```

---

## 9. Animation & Interaction Summary

| Element | Animation | Thư viện |
|---|---|---|
| Vào trang | PageTransitionOverlay 1100ms | CSS + setTimeout |
| Chuyển ảnh gallery | Fade/slide, 300ms | Framer Motion AnimatePresence |
| Lightbox mở/đóng | Scale + fade | Framer Motion |
| Tab indicator | Slide ngang | Framer Motion layoutId |
| Rating bars | Fill từ 0 khi tab active | Framer Motion |
| Buy box hover buttons | Scale 1.01 + shadow | Framer Motion whileHover |
| Related products | Stagger fade-in | Framer Motion |
| AI bubble xuất hiện | Fade + slide up | Framer Motion |
| Review "Tải thêm" | Fade-in từng item | Framer Motion stagger |

---

## 10. States cần xử lý

| State | Mô tả | UI |
|---|---|---|
| Loading trang | Fetch data ban đầu | PageTransitionOverlay + skeleton bones |
| Không tìm thấy slug | 404 | Redirect hoặc trang 404 đẹp |
| Product HIDDEN | Không public | 404 hoặc "Sản phẩm không còn được bán" |
| Hết hàng | stock = 0 | Disable CTA, badge đỏ, text "Tạm hết hàng" |
| Sắp hết | 1 ≤ stock ≤ 5 | Badge cam cảnh báo |
| Không có ảnh | images[] rỗng | Placeholder image gradient |
| Không có review | reviews[] rỗng | Empty state "Hãy là người đầu tiên đánh giá" |
| AI lỗi | API timeout/error | Toast lỗi + fallback text |
| Thêm giỏ hàng thành công | Toast "Đã thêm vào giỏ hàng" | Sonner toast success |
| Thêm giỏ hàng lỗi | Network/auth | Toast error |
| Wishlist toggle | Toggle trạng thái | Icon fill/outline, toast |

---

## 11. BEM Block tổng hợp

**Block chính**: `product-detail-page`

```
product-detail-page                          ← wrapper gốc
product-detail-page__breadcrumb-section
product-detail-page__breadcrumb-inner
product-detail-page__breadcrumb-nav
product-detail-page__breadcrumb-link
product-detail-page__breadcrumb-separator
product-detail-page__breadcrumb-current

product-detail-page__hero-section
product-detail-page__hero-inner
product-detail-page__hero-grid             ← 2 cột

product-detail-page__gallery               ← B1
product-detail-page__gallery-main
product-detail-page__gallery-main-image
product-detail-page__gallery-badge
product-detail-page__gallery-badge--sale
product-detail-page__gallery-badge--soldout
product-detail-page__gallery-overlay
product-detail-page__gallery-zoom-btn
product-detail-page__gallery-arrows
product-detail-page__gallery-arrow
product-detail-page__gallery-arrow--prev
product-detail-page__gallery-arrow--next
product-detail-page__gallery-thumbnails
product-detail-page__gallery-thumb
product-detail-page__gallery-thumb--active
product-detail-page__gallery-lightbox

product-detail-page__buy-box               ← B2
product-detail-page__buy-box-brand-row
product-detail-page__buy-box-brand-logo
product-detail-page__buy-box-brand-name
product-detail-page__buy-box-category
product-detail-page__buy-box-title
product-detail-page__buy-box-rating-row
product-detail-page__buy-box-stars
product-detail-page__buy-box-rating-score
product-detail-page__buy-box-rating-count
product-detail-page__buy-box-price-block
product-detail-page__buy-box-price-original
product-detail-page__buy-box-price-sale
product-detail-page__buy-box-price-main
product-detail-page__buy-box-price-badge
product-detail-page__buy-box-stock
product-detail-page__buy-box-stock--available
product-detail-page__buy-box-stock--low
product-detail-page__buy-box-stock--soldout
product-detail-page__buy-box-qty
product-detail-page__buy-box-qty-btn
product-detail-page__buy-box-qty-input
product-detail-page__buy-box-cta-group
product-detail-page__buy-box-cta-add
product-detail-page__buy-box-cta-buy
product-detail-page__buy-box-actions
product-detail-page__buy-box-wishlist-btn
product-detail-page__buy-box-share-btn
product-detail-page__buy-box-trust
product-detail-page__buy-box-trust-item
product-detail-page__buy-box-trust-icon
product-detail-page__buy-box-trust-text
product-detail-page__buy-box-ai
product-detail-page__buy-box-ai-trigger
product-detail-page__buy-box-ai-input-area

product-detail-page__tabs-section          ← C
product-detail-page__tabs-nav
product-detail-page__tabs-nav-item
product-detail-page__tabs-nav-item--active
product-detail-page__tabs-indicator
product-detail-page__tabs-content

product-detail-page__description-tab       ← C1
product-detail-page__description-body
product-detail-page__description-tags
product-detail-page__description-tag
product-detail-page__description-expand-btn

product-detail-page__specs-tab             ← C2
product-detail-page__specs-table
product-detail-page__specs-row
product-detail-page__specs-label
product-detail-page__specs-value
product-detail-page__specs-download

product-detail-page__reviews-tab           ← C3
product-detail-page__reviews-layout
product-detail-page__reviews-summary
product-detail-page__reviews-avg-score
product-detail-page__reviews-stars
product-detail-page__reviews-bars
product-detail-page__reviews-bar-row
product-detail-page__reviews-bar-fill
product-detail-page__reviews-recommend
product-detail-page__reviews-write-btn
product-detail-page__reviews-list
product-detail-page__reviews-item
product-detail-page__reviews-item-header
product-detail-page__reviews-item-avatar
product-detail-page__reviews-item-name
product-detail-page__reviews-item-verified
product-detail-page__reviews-item-stars
product-detail-page__reviews-item-date
product-detail-page__reviews-item-comment
product-detail-page__reviews-load-more

product-detail-page__ai-tab                ← C4
product-detail-page__ai-header
product-detail-page__ai-suggestions
product-detail-page__ai-suggestion-pill
product-detail-page__ai-chat
product-detail-page__ai-chat-user
product-detail-page__ai-chat-ai
product-detail-page__ai-input-row
product-detail-page__ai-input
product-detail-page__ai-send-btn
product-detail-page__ai-disclaimer

product-detail-page__brand-block           ← D
product-detail-page__brand-block-inner
product-detail-page__brand-block-logo
product-detail-page__brand-block-name
product-detail-page__brand-block-desc
product-detail-page__brand-block-link

product-detail-page__trust-section         ← E
product-detail-page__trust-grid
product-detail-page__trust-card
product-detail-page__trust-card-icon
product-detail-page__trust-card-title
product-detail-page__trust-card-subtitle

product-detail-page__related-section       ← F
product-detail-page__related-header
product-detail-page__related-title
product-detail-page__related-see-all
product-detail-page__related-grid
```

---

## 12. Checklist trước khi triển khai

- [ ] Định nghĩa `ProductDetailDto`, `ReviewDto`, `ProductImageDto` trong `src/types/shop.ts`.
- [ ] Tạo API route `GET /api/shop/products/[slug]/route.ts` với Prisma query đầy đủ.
- [ ] Server Component `src/app/products/[slug]/page.tsx` với `generateMetadata`.
- [ ] `ProductDetailPage.tsx` client component tổng hợp.
- [ ] `ProductImageGallery.tsx` với lightbox và thumbnail.
- [ ] `ProductBuyBox.tsx` với sticky, quantity, CTA.
- [ ] Tab navigation và 4 tab content component.
- [ ] `ProductReviewsTab.tsx` với rating bars (animated), danh sách, form viết review.
- [ ] `ProductAiTab.tsx` với chat UI, context injection vào AI call.
- [ ] `ProductBrandBlock.tsx` từ `brand.aiDescription`.
- [ ] `ProductTrustBadges.tsx` – 4 badge chính sách.
- [ ] `ProductRelated.tsx` – fetch cùng category.
- [ ] Responsive kiểm tra breakpoints: 320px, 375px, 768px, 1024px, 1280px.
- [ ] PageTransitionOverlay khi vào trang.
- [ ] Tất cả states: loading, 404, hết hàng, không có ảnh, không có review.
- [ ] ReadLints cho tất cả file sau khi tạo.
