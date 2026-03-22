## Thiết kế trang "Tất cả sản phẩm" – Đức Uy Audio

### 1. Mục tiêu & bối cảnh

- **Mục tiêu trang**: Hiển thị toàn bộ danh mục sản phẩm âm thanh (loa, ampli, tai nghe, turntable, phụ kiện…) của Đức Uy Audio theo dạng lưới hiện đại, giúp người dùng:
  - Dễ dàng **quét nhanh** danh sách, so sánh các lựa chọn.
  - **Lọc & sắp xếp** theo nhu cầu thực tế (giá, thương hiệu, loại, gu nghe, cấu hình…).
  - Nhận được **gợi ý từ AI** và gợi ý combo/upsell phù hợp.
- **Bối cảnh dự án**:
  - Tuân thủ hệ màu, shadow, radius trong `globals.css`:
    - Màu chính: `var(--primary)` (#1DB954), `var(--primary-light)`, `var(--primary-dark)`.
    - Nền: `var(--background)`, `var(--background-secondary)`, `var(--background-tertiary)`.
    - Text: `var(--text)`, `var(--text-secondary)`, `var(--text-tertiary)`, `var(--text-light)`.
    - Accent: `var(--accent)` và dải gradient `var(--gradient-primary)`, `var(--gradient-secondary)`.
    - Shadow: `var(--shadow-sm)`, `var(--shadow-md)`, `var(--shadow-primary)`.
    - Border radius: `var(--border-radius-md)` (8px), `var(--border-radius-lg)` (12px), `var(--border-radius-xl)` (16px), `var(--border-radius-full)` (9999px).
  - Giao diện kế thừa cảm hứng từ trang chủ (`HomePage`) với phong cách:
    - Nền hơi tối sang trọng, khối nội dung nổi nhẹ với shadow.
    - Sử dụng nhiều card có bo góc, overlay gradient, badge nhỏ.
    - Bố cục có **header**, nội dung chính, **footer**, overlay transition (`PageTransitionOverlay`).

### 2. Cấu trúc tổng thể & BEM

- **File đề xuất**:
  - Component: `AllProductsPage.tsx` (server component hoặc client component tùy nhu cầu filter phía client).
  - CSS Module: `AllProductsPage.module.css`.
- **Block BEM chính**:
  - Block: `all-products-page-page`.
  - Ví dụ class:
    - Wrapper gốc: `all-products-page-page`.
    - Inner content: `all-products-page-page__inner`.
    - Thanh breadcrumb / heading: `all-products-page-page__header`.
    - Thanh filter: `all-products-page-page__filters`.
    - Grid sản phẩm: `all-products-page-page__grid`.
    - Card sản phẩm: `all-products-page-page__product-card`.
    - Panel AI gợi ý: `all-products-page-page__ai-panel`.
    - Thanh phân trang: `all-products-page-page__pagination`.

#### 2.1. Layout khung trang

- **Layout khung**:
  - Chiều rộng tối đa nội dung: `max-width: 1200px` – 1280px, canh giữa.
  - Padding ngang:
    - Desktop: `padding-inline: 24px`.
    - Tablet: `padding-inline: 20px`.
    - Mobile: `padding-inline: 16px`.
  - Padding dọc:
    - Từ header xuống nội dung: `padding-top: 24px` (mobile), 32px (desktop).
    - Giữa các section: `margin-block: 24px` (mobile), 32–40px (desktop).
  - Nền:
    - Toàn trang: `background: var(--background-homepage)` hoặc `var(--background-secondary)` để giữ tông trầm như trang chủ.
    - Khối content chính: nền `var(--background)` với bo góc 16px, shadow `var(--shadow-md)`.

- **Class gợi ý**:
  - `all-products-page-page`:
    - Display: `min-height: 100vh; background: var(--background-homepage); color: var(--text);`.
  - `all-products-page-page__inner`:
    - `max-width: 1200px; margin: 0 auto; padding: 24px 16px 32px;`
    - Desktop (`@media (min-width: 1024px)`): `padding: 32px 24px 40px;`

### 3. Header trang & breadcrumb

#### 3.1. Header nội dung

- **Thành phần**:
  - Tiêu đề: “Tất cả sản phẩm”.
  - Subtitle: mô tả ngắn, ví dụ: “Khám phá toàn bộ thiết bị âm thanh hi-end được Đức Uy Audio tuyển chọn theo tiêu chuẩn phòng nghe thực tế.”
  - Badge nhỏ hiển thị số lượng sản phẩm, ví dụ: “240+ sản phẩm”.
- **Bố cục**:
  - Desktop:
    - `display: flex; justify-content: space-between; align-items: center; gap: 16px;`
  - Mobile:
    - Stack dọc: `flex-direction: column; align-items: flex-start; gap: 12px;`
- **Style chi tiết**:
  - Tiêu đề:
    - Font-size desktop: 28px–32px (`font-size: 28px; line-height: 1.2; font-weight: 700; color: var(--text);`).
    - Mobile: 22px–24px.
  - Subtitle:
    - `font-size: 14px–15px; line-height: 1.5; color: var(--text-secondary); max-width: 520px;`
  - Badge tổng số sản phẩm:
    - Kết hợp màu `var(--primary)` với nền nhạt:
      - `background: var(--overlay-primary);`
      - `color: var(--primary-dark);`
      - `border: 1px solid var(--border-primary);`
      - `border-radius: var(--border-radius-full);`
      - Padding: `4px 12px` (mobile), `4px 14px` (desktop).
      - Font-size: 12px–13px; `font-weight: 600; letter-spacing: 0.02em;`

#### 3.2. Breadcrumb (nếu dùng)

- Nội dung: “Trang chủ / Sản phẩm / Tất cả sản phẩm”.
- Vị trí: phía trên tiêu đề, căn trái.
- Style:
  - Font-size: 12px–13px, `color: var(--text-tertiary);`
  - Các phần phân tách bằng ký tự `"/"` với spacing ngang `4px–8px`.
  - Hover lên đoạn link (`Trang chủ`, `Sản phẩm`):
    - `color: var(--primary-dark); text-decoration: underline;`

### 4. Thanh filter & sort

#### 4.1. Bố cục tổng quan

- **Vị trí**: bên dưới header, trước grid sản phẩm.
- **Desktop** (>= 1024px):
  - Thanh filter sticky nhẹ ở phía trên grid (nếu cuộn không quá dài):
    - `position: sticky; top: 72px; z-index: 10;`
  - Bố cục:
    - Trái: cụm filter chính (loại, thương hiệu, khoảng giá, gu nghe).
    - Phải: sort dropdown + toggle chế độ hiển thị (grid 3 cột / 4 cột nếu cần).
  - `display: flex; justify-content: space-between; align-items: center; gap: 16px;`
- **Tablet/Mobile**:
  - Dùng 2 hàng:
    - Hàng 1: nút “Bộ lọc” (mở offcanvas/mobile sheet) + “Sắp xếp”.
    - Hàng 2 (optional): tag các filter đang áp dụng.
  - `gap: 12px–16px;`

#### 4.2. Filter tags & nút mở filter chi tiết

- **Nút “Bộ lọc nâng cao”**:
  - Kích thước:
    - Chiều cao: 36px (mobile), 40px (desktop).
    - Padding: `0 14px` (mobile), `0 16px` (desktop).
  - Màu:
    - Nền: `var(--background-secondary);`
    - Border: `1px solid var(--border-color);`
    - Radius: `var(--border-radius-full);`
    - Text: `var(--text-secondary); font-size: 13px–14px; font-weight: 500;`
    - Icon filter (nếu có): `font-size: 16px; color: var(--primary); margin-right: 6px;`
  - Hover:
    - `background: var(--background-tertiary); border-color: var(--border-primary);`
    - `box-shadow: var(--shadow-sm);`

- **Filter tag nhỏ** (ví dụ: “Giá: 20–50 triệu”, “Loại: Bookshelf”, “Thương hiệu: Klipsch”):
  - Nền: `var(--overlay-primary);`
  - Border: `1px solid var(--border-primary);`
  - Radius: `var(--border-radius-full);`
  - Padding: `4px 10px;`
  - Font-size: 12px; `color: var(--text-secondary);`
  - Có icon “X” nhỏ bên phải (12px–14px) để xóa filter:
    - Icon màu `var(--text-tertiary);` hover `var(--error);`

#### 4.3. Sort dropdown

- **Options ví dụ**:
  - “Mặc định”
  - “Giá tăng dần”, “Giá giảm dần”
  - “Mới nhất”
  - “Bán chạy”
- **Style**:
  - Chiều cao: 36px–40px.
  - Width: 150px–180px trên desktop, 100% trên mobile nếu để hàng riêng.
  - Nền: `var(--background);`
  - Border: `1px solid var(--border-color-dark);`
  - Radius: `var(--border-radius-full);`
  - Padding nội: `0 12px 0 12px;`
  - Font-size: 13px–14px, `color: var(--text-secondary);`
  - Icon dropdown tam giác nhỏ hoặc sử dụng icon từ `react-icons`, màu `var(--text-tertiary)`.

### 5. Lưới sản phẩm (product grid)

#### 5.1. Grid responsive

- **Breakpoints đề xuất**:
  - Mobile nhỏ (< 600px): 1–2 cột (ưu tiên 2 cột).
    - `grid-template-columns: repeat(2, minmax(0, 1fr));`
    - Gap: `12px–14px`.
  - Tablet (600px–1023px): 2–3 cột.
    - Ưu tiên: `grid-template-columns: repeat(3, minmax(0, 1fr));` nếu đủ không gian, nếu không thì 2 cột.
    - Gap: `16px`.
  - Desktop (>= 1024px): 3–4 cột.
    - Đề xuất: 3 cột để card thông tin rộng, dễ đọc.
    - `grid-template-columns: repeat(3, minmax(0, 1fr));`
    - Gap: `20px–24px`.

- **Class**:
  - `all-products-page-page__grid`:
    - `display: grid;`
    - `grid-template-columns: repeat(2, minmax(0, 1fr));`
    - `gap: 14px; margin-top: 20px;`
    - Desktop:
      - `@media (min-width: 768px) { gap: 18px; }`
      - `@media (min-width: 1024px) { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }`

#### 5.2. Card sản phẩm

- **Kích thước & cấu trúc**:
  - Chiều cao tổng: linh hoạt, tối thiểu ~280–320px.
  - Bố cục:
    - Phần ảnh chiếm 55–60% chiều cao card.
    - Phần text (tên, loại, giá, spec tóm tắt) chiếm 40–45%.
  - Card:
    - Nền: `var(--background);`
    - Border-radius: `var(--border-radius-lg);` (12px).
    - Border: `1px solid rgba(255, 255, 255, 0.02)` hoặc `var(--border-color)` tùy nền.
    - Shadow:
      - Mặc định: `box-shadow: var(--shadow-sm);`
      - Hover: `box-shadow: var(--shadow-md), var(--shadow-primary);`
    - Padding dưới (phần content): `12px 12px 14px;` (mobile),  `14px 14px 16px;` (desktop).
  - Hover toàn card:
    - `transform: translateY(-4px); transition: transform 0.18s ease-out, box-shadow 0.18s ease-out;`

- **Ảnh sản phẩm**:
  - Dùng `div` với `background-image` giống `home-page-page__product-image`.
  - Kích thước:
    - Tỷ lệ: 4:3 hoặc vuông.
    - Chiều cao: `160px` (mobile), `180px` (desktop).
  - Style:
    - `background-size: cover; background-position: center;`
    - `border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;`
    - Overlay gradient nhẹ phía dưới để text đọc tốt nếu có thông tin overlay.
  - Badge góc trái trên:
    - Class: `all-products-page-page__product-badge`.
    - Vị trí: `position: absolute; top: 10px; left: 10px;`
    - Nền:
      - Discount: `background: var(--gradient-accent); color: #000000;`
      - New: `background: var(--gradient-primary); color: var(--text-light);`
    - Padding: `3px 10px;` radius `var(--border-radius-full);`
    - Font-size: 11px–12px; `font-weight: 600;`

- **Nút thêm giỏ/mua nhanh**:
  - Vị trí:
    - Góc phải dưới của ảnh, float trên ảnh.
    - `position: absolute; bottom: 10px; right: 10px;`
  - Style:
    - Hình tròn: `width: 34px; height: 34px; border-radius: var(--border-radius-full);`
    - Nền: `var(--overlay-dark);`
    - Border: `1px solid rgba(255, 255, 255, 0.16);`
    - Icon giỏ (`MdAddShoppingCart`): `font-size: 18px; color: var(--accent);`
    - Hover:
      - `background: var(--gradient-primary-hover); border-color: var(--border-primary);`
      - Icon: `color: var(--text-light);`

- **Khối nội dung dưới (category, title, price, spec)**:
  - Category:
    - Font-size: 11px–12px, all caps hoặc small-caps.
    - `color: var(--text-tertiary); letter-spacing: 0.06em; margin-bottom: 4px;`
  - Title:
    - Font-size: 14px–15px (mobile), 15px–16px (desktop).
    - `font-weight: 600; color: var(--text); margin-bottom: 6px;`
    - Giới hạn 2 dòng: `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;`
  - Giá:
    - Hàng 1: giá hiện tại.
      - `font-size: 14px–15px; font-weight: 700; color: var(--accent-dark);`
    - Hàng 2: giá cũ (nếu có).
      - `font-size: 12px–13px; color: var(--text-tertiary); text-decoration: line-through; margin-left: 6px;`
  - Spec tóm tắt (2–3 bullet ngắn):
    - Ví dụ: “Công suất 100W / Bluetooth 5.3 / Hỗ trợ Hi-Res”.
    - Font-size: 12px; `color: var(--text-secondary); line-height: 1.4; margin-top: 6px;`

### 6. Sidebar / Panel AI gợi ý (desktop)

- **Mục tiêu**: Tận dụng thế mạnh AI của dự án, giúp người dùng không bị “lạc” trong danh sách dài.
- **Bố cục**:
  - Với desktop, chia layout chính thành 2 cột:
    - Cột trái (70–75%): grid sản phẩm.
    - Cột phải (25–30%): panel AI gợi ý.
  - Class gợi ý:
    - Wrapper 2 cột: `all-products-page-page__content-layout`:
      - `display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.9fr); gap: 24px; align-items: flex-start;`
    - Mobile/Tablet:
      - Chuyển về một cột, panel AI xuống dưới grid hoặc ẩn bớt và dùng nút “Nhờ AI gợi ý combo”.

- **Panel AI**:
  - Nền: `var(--background-secondary);`
  - Border-radius: `var(--border-radius-xl);`
  - Border: `1px solid var(--border-color-dark);`
  - Shadow: `var(--shadow-md);`
  - Padding: `16px 16px 18px;` (mobile `14px`).
  - Nội dung:
    - Tiêu đề: “AI gợi ý cho bạn”.
      - Font-size: 16px–17px; `font-weight: 600; color: var(--text-light);`
    - Subtitle: “Chọn khoảng giá, loại phòng và gu nghe để AI lọc sẵn sản phẩm phù hợp.”
      - Font-size: 13px; `color: var(--text-tertiary);`
    - Bộ slider giá (tối ưu reuse pattern từ `HomePage`):
      - `input[type="range"]` full width, track dùng màu `var(--primary)` với thumb tròn 16px.
    - Dropdown “Loại phòng” & “Gu âm nhạc”:
      - Reuse pattern class từ AI section trang chủ, đổi tên BEM theo block mới.
    - Nút call-to-action:
      - Button full-width:
        - `height: 40px–44px;`
        - Nền: `var(--gradient-primary);`
        - Border-radius: `var(--border-radius-full);`
        - Text: `color: var(--text-light); font-weight: 600; font-size: 14px;`
        - Icon `MdAutoAwesome` phía trái, size `18px`, margin-right `8px`.
        - Hover: `background: var(--gradient-primary-hover); box-shadow: var(--shadow-primary); transform: translateY(-1px);`

### 7. Thanh phân trang (pagination)

- **Vị trí**:
  - Bên dưới grid sản phẩm, cách grid ~24px–32px.
- **Bố cục**:
  - Trung tâm ngang: `display: flex; justify-content: center; align-items: center; gap: 8px–10px;`
  - Mobile: cho phép scroll ngang nhẹ nếu quá nhiều trang hoặc rút gọn.
- **Style nút**:
  - Button số trang:
    - Kích thước: `width: 32px; height: 32px;` (mobile), `width: 34px; height: 34px;` (desktop).
    - Radius: `var(--border-radius-full);`
    - Nền:
      - Trang hiện tại: `background: var(--primary); color: var(--text-light);`
      - Trang khác: `background: var(--background); color: var(--text-secondary); border: 1px solid var(--border-color-dark);`
    - Font-size: 13px; `font-weight: 500;`
    - Hover trang khác:
      - `background: var(--overlay-primary); border-color: var(--border-primary);`
  - Nút “Trước” / “Sau”:
    - Dạng pill:
      - `padding: 0 14px; height: 32px–34px;`
      - Nền: `var(--background-secondary);`
      - Text: `var(--text-secondary); font-size: 13px;`
      - Icon mũi tên nhỏ trái/phải, color `var(--text-tertiary);`
      - Hover: `background: var(--background-tertiary); color: var(--primary-dark);`

### 8. Trạng thái đặc biệt (loading, empty, error)

#### 8.1. Loading

- Dùng `DataLoadingOverlay` khi:
  - Lần đầu load danh sách sản phẩm.
  - Thay đổi filter nặng (đa điều kiện).
- Overlay:
  - Chỉ phủ vùng grid (wrapper có `position: relative;`).
  - `title`: “Đang tải danh sách sản phẩm…”
  - `subtitle`: “Đức Uy Audio đang lọc các thiết bị phù hợp với không gian nghe của bạn.”
  - `bottomText`: “Vui lòng chờ trong giây lát.”

#### 8.2. Empty state

- Khi không tìm thấy sản phẩm:
  - Hiển thị khối centered trong vùng grid:
    - Nền: `var(--background-secondary);`
    - Border-radius: `var(--border-radius-lg);`
    - Padding: `24px 16px;`
  - Text:
    - Title: “Không tìm thấy sản phẩm phù hợp.”
      - Font-size: 16px; `font-weight: 600; color: var(--text);`
    - Subtitle: “Hãy thử nới rộng khoảng giá, thay đổi loại thiết bị hoặc nhờ AI gợi ý lại.”
      - Font-size: 13px–14px; `color: var(--text-secondary); margin-top: 6px;`
  - Button:
    - “Đặt câu hỏi cho AI”:
      - Nền: `var(--gradient-primary);`
      - Radius: `var(--border-radius-full);`
      - Padding: `0 16px; height: 36px–40px;`
      - Text: `color: var(--text-light); font-weight: 600; font-size: 13px–14px;`

#### 8.3. Error

- Khi lỗi server hoặc kết nối:
  - Card nhỏ trong vùng grid:
    - Icon cảnh báo (ví dụ từ `MdWarning` nếu dùng) màu `var(--warning);` size `24px`.
    - Title: “Có lỗi xảy ra khi tải sản phẩm.”
    - Subtitle: “Vui lòng thử lại sau hoặc liên hệ hỗ trợ Đức Uy Audio.”
  - Button:
    - “Thử lại”:
      - Nút outline:
        - `background: transparent; border: 1px solid var(--border-color-dark);`
        - Hover: `border-color: var(--primary); background: var(--overlay-primary);`

### 9. Mobile-first & responsive

- **Mobile**:
  - Ưu tiên 2 cột grid, text ngắn gọn, tránh quá nhiều filter mở rộng.
  - Panel AI gợi ý:
    - Thu gọn thành 1 nút ở thanh filter: “Nhờ AI gợi ý”.
    - Click => mở bottom sheet / full-screen panel với form AI đơn giản (reuse pattern từ trang chủ).
  - Giảm padding:
    - Header: `padding-top: 16px;`
    - Section: `margin-block: 16px–20px;`
- **Tablet**:
  - Giữ panel AI phía dưới grid hoặc bên cạnh nếu đủ rộng.
  - Filter có thể là hàng ngang scrollable tag.
- **Desktop**:
  - Layout 2 cột với panel AI cố định, grid 3 cột, nhiều nội dung more/hover.

### 10. Hành vi & vi mô tương tác (micro interactions)

- **Hover card sản phẩm**:
  - Scale nhẹ ảnh:
    - `transform: scale(1.02); transition: transform 0.18s ease-out;`
  - Shadow tăng lên `var(--shadow-md)` kết hợp `var(--shadow-primary)`.
  - Title chuyển màu nhẹ:
    - `color: var(--primary-dark);`
- **Hover nút chính** (CTA thêm giỏ, AI gợi ý, áp dụng filter):
  - Tăng sáng gradient:
    - Dùng `var(--gradient-primary-hover)`.
  - Shadow: `var(--shadow-primary);`
  - Giảm `transform` nhẹ: `translateY(-1px);`
- **Focus state**:
  - Border:
    - `outline: 2px solid rgba(29, 185, 84, 0.6); outline-offset: 2px;`
  - Áp dụng cho input, select, button để tăng accessibility.

### 11. Tích hợp với hệ thống hiện tại

- **Header & Footer**:
  - Dùng `ShopHeader` và `ShopFooter` giống `HomePage` để đảm bảo trải nghiệm nhất quán.
  - `cartCount` có thể lấy từ context hoặc prop.
- **PageTransitionOverlay**:
  - Khi từ trang khác chuyển sang “Tất cả sản phẩm”:
    - Kích hoạt overlay trong ~1100ms với message riêng:
      - `subtitle`: “Đang tải bộ sưu tập sản phẩm dành riêng cho bạn…”
      - `bottomText`: “Đức Uy Audio đang sắp xếp lại các cấu hình hi-end phù hợp.”
- **BEM & CSS module**:
  - Đặt toàn bộ class trong `AllProductsPage.module.css` theo block `all-products-page-page`.
  - Tránh override global, tuyệt đối không dùng selector kiểu `section h2` cho riêng trang này.

### 12. Tóm tắt ngắn

- Trang “Tất cả sản phẩm” sử dụng:
  - **Block BEM**: `all-products-page-page` với grid 2–3–3 cột tùy breakpoint.
  - **Filter & sort** hiện đại, dễ dùng, có tag filter đang áp dụng.
  - **Card sản phẩm** bo góc 12px, shadow mềm, CTA nổi trên ảnh, sử dụng màu `var(--primary)` và `var(--accent)` làm điểm nhấn.
  - **Panel AI gợi ý** bên phải (desktop) hoặc dạng sheet (mobile), kết hợp slider giá & chọn gu nghe.
  - **Pagination** dạng pill tròn, nhất quán với brand, cùng đầy đủ trạng thái loading/empty/error được xử lý UX mượt mà.

