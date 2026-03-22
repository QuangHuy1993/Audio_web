## Workflow: Thiết kế giao diện Trang chủ Đức Uy Audio

Tài liệu này lên ý tưởng **siêu chi tiết** cho giao diện trang chủ (home) của Đức Uy Audio, bám theo định hướng dự án Audio AI Shop: hiện đại, tập trung vào thiết bị âm thanh, có tích hợp AI tư vấn, tối ưu UX trên desktop và mobile.

Mục tiêu: sau này khi implement trong `src/app/(shop)/page.tsx` (hoặc cấu trúc tương đương), chỉ cần bám theo tài liệu này là ra đúng layout và trải nghiệm mong muốn.

---

## 1. Mục tiêu UX tổng thể của trang chủ

- **Giới thiệu nhanh thương hiệu**: Người dùng vào là hiểu ngay Đức Uy Audio chuyên về audio, không bị chung chung như một shop tổng hợp.
- **Đưa user đến sản phẩm phù hợp càng sớm càng tốt**:
  - Theo **danh mục** (loa, ampli, tai nghe…).
  - Theo **ngân sách**.
  - Theo **use case** (xem phim, nghe nhạc, phòng khách, phòng ngủ, studio…).
- **Làm nổi bật AI tư vấn**:
  - Ngay trên hero (entry chính).
  - Thêm 1–2 entry phụ (floating button / section riêng) để user thấy “có AI hỗ trợ”.
- **Trưng bày khôn ngoan**:
  - Sản phẩm nổi bật / best-seller.
  - Combo / bộ dàn đề xuất.
  - Khuyến mãi hiện tại (kết nối với hệ thống coupon/promotion).
- **Tạo cảm giác tin cậy**:
  - Social proof: đánh giá, review, logo thương hiệu audio uy tín.
  - Các đoạn microcopy về bảo hành, đổi trả, hỗ trợ kỹ thuật.
- **Đảm bảo responsive**:
  - Mobile-first, layout 1 cột trên mobile, 2–4 cột trên desktop tùy khu vực.

---

## 2. Khung layout tổng quát

### 2.1. Thanh điều hướng trên cùng (Header / Navbar)

- **Vị trí**: Fixed top hoặc sticky khi scroll (tùy sau này); chiều cao ~64–72px desktop, ~56–60px mobile.
- **Cấu trúc (trái → phải, desktop)**:
  - Logo Đức Uy Audio (icon sóng âm + chữ).
  - Menu chính:
    - Sản phẩm
    - Thương hiệu
    - Khuyến mãi
    - Hỗ trợ
  - Ô tìm kiếm:
    - Placeholder: “Tìm loa, tai nghe, ampli…”
    - Icon search bên trái, nút enter hoặc icon search bên phải.
  - Nhóm icon chức năng:
    - Nút truy cập AI (icon tia sáng / tai nghe).
    - Icon tài khoản (login/register hoặc avatar).
    - Icon giỏ hàng (kèm badge số lượng).
- **Mobile**:
  - Hàng trên: Logo + nhóm icon (AI, cart, account).
  - Menu gói trong nút hamburger (mở ra panel full screen/bottom sheet).

### 2.2. Hero section (đầu trang)

- **Mục tiêu**:
  - Gây ấn tượng mạnh về thương hiệu audio cao cấp.
  - Cho user entry ngay vào **AI tư vấn** hoặc **danh mục chính**.
- **Layout desktop**:
  - Grid 2 cột:
    - Cột trái: text + nút.
    - Cột phải: hình ảnh thiết bị audio (loa đứng, loa bookshelf, tai nghe, ampli…), có hiệu ứng nhẹ (shadow, gradient).
- **Nội dung cột trái**:
  - Label nhỏ: “Đức Uy Audio – Tư vấn âm thanh thông minh”.
  - Tiêu đề lớn (H1): 
    - Ví dụ: “Nâng tầm trải nghiệm âm thanh trong không gian của bạn”.
  - Đoạn mô tả 2–3 dòng:
    - Nêu rõ: chuyên loa, tai nghe, dàn xem phim; có AI hỗ trợ chọn thiết bị theo phòng & ngân sách.
  - Nhóm 2 nút chính:
    - Nút 1 (primary): “Bắt đầu tư vấn cùng AI”
      - Rõ ràng đây là luồng AI chính (sau chuyển đến trang/section AI).
    - Nút 2 (secondary outline): “Xem dàn sản phẩm nổi bật”
      - Cuộn xuống section Sản phẩm nổi bật.
- **Nội dung cột phải**:
  - Card ảnh thiết bị:
    - Hình loa + ampli trên nền gradient nhẹ (tông tối + primary).
    - Thêm label nhỏ “Đã tư vấn cho hơn 1.000 khách hàng yêu âm thanh”.

### 2.3. Dải thông tin tin cậy (Trust bar)

- **Ngay dưới hero**, là dải ngang 3–4 cột icon-text:
  - “Bảo hành chính hãng 100%”
  - “Tư vấn setup phòng nghe miễn phí”
  - “Giao hàng toàn quốc, đóng gói an toàn”
  - “Hỗ trợ kỹ thuật trọn đời”
- Desktop: 3–4 cột, icon + text; Mobile: slider ngang hoặc 2 dòng 2 cột.

---

## 3. Khu vực “AI tư vấn nhanh” trên trang chủ

Mục tiêu: từ ngay trang chủ, user có thể gửi một câu hỏi và nhận gợi ý; đồng thời giới thiệu tính năng AI.

### 3.1. Vị trí & layout

- Block riêng ngay sau Trust bar hoặc sau 1 section sản phẩm:
  - Tiêu đề: “Để AI gợi ý dàn audio phù hợp cho bạn”.
  - 2 cột/stack:
    - Bên trái: form nhập thông tin nhanh.
    - Bên phải: preview UI của kết quả (wireframe card).

### 3.2. Form AI (input phía user)

- Các field (gợi ý, không nhất thiết 100% bắt buộc):
  - Ngân sách dự kiến:
    - Input số + đơn vị VND (dùng slider + input text).
    - Label: “Ngân sách dự kiến cho hệ thống âm thanh”.
  - Loại không gian:
    - Dropdown:
      - Phòng khách nhỏ (<20m²).
      - Phòng khách lớn (20–35m²).
      - Phòng ngủ.
      - Phòng phim gia đình.
      - Phòng thu / studio.
  - Mục đích chính:
    - Checkbox / pill chọn nhiều:
      - Nghe nhạc.
      - Xem phim.
      - Chơi game.
      - Làm việc / call.
  - Câu hỏi mở:
    - Textarea ngắn: “Mô tả thêm về sở thích hoặc không gian của bạn”.
- Nút:
  - Primary: “Nhờ AI tư vấn ngay”.
  - Phụ: Link nhỏ “Xem chi tiết cách AI hoạt động”.

### 3.3. Preview kết quả (bên phải)

- Card giả lập kết quả AI:
  - Tiêu đề: “Gợi ý của Đức Uy AI”.
  - 2–3 bullet:
    - “Bộ loa bookshelf phù hợp phòng 15–20m²”.
    - “Amply tích hợp DAC để giảm số lượng thiết bị”.
    - “Gợi ý combo loa + ampli tối ưu ngân sách”.
  - Nút “Xem các sản phẩm gợi ý” (sau này link đến trang kết quả AI + shop).

---

## 4. Khu vực sản phẩm nổi bật (Featured products)

### 4.1. Mục tiêu

- Đưa ra vài sản phẩm nổi bật nhất để user thấy ngay chất lượng và mức giá.
- Kết hợp visual mạnh: ảnh đẹp, tên rõ ràng, giá, badge.

### 4.2. Layout

- Tiêu đề section:
  - “Sản phẩm nổi bật”.
  - Subtitle: “Lựa chọn hàng đầu được khách hàng yêu thích”.
- Desktop:
  - Grid 4 cột (1200px+), 3 cột (≥992px), 2 cột (tablet), 1 cột (mobile).
- Mỗi card sản phẩm:
  - Ảnh:
    - Tỷ lệ 4:3 hoặc vuông, phủ gần hết chiều ngang, bo góc, shadow nhẹ.
  - Tên sản phẩm:
    - 1–2 dòng, font đậm, dễ đọc.
  - Giá:
    - Giá hiện tại.
    - Nếu có giảm giá: hiển thị giá cũ (gạch ngang) + badge “-20%”.
  - Badge:
    - “Best-seller”.
    - “Mới”.
    - “Hi-end”.
  - Mini tags:
    - “Nghe nhạc”, “Xem phim”, “Phòng khách”.
  - CTA:
    - Nút nhỏ “Xem chi tiết”.
    - Icon giỏ hàng + tooltip “Thêm vào giỏ”.

### 4.3. Trạng thái & tương tác

- Hover card:
  - Nâng nhẹ lên (translateY -4px), shadow tăng, viền primary subtle.
- Mobile:
  - Card full-width, stack vertical, nút CTA dễ bấm.

---

## 5. Khu vực danh mục theo use case (Theo nhu cầu / Theo không gian)

### 5.1. Mục tiêu

- Hướng user không rành kỹ thuật đi theo **nhu cầu** thay vì theo tên thiết bị.

### 5.2. Layout

- Tiêu đề: “Chọn theo không gian & nhu cầu”.
- 2 hàng (hoặc slider):
  - Card “Phòng khách xem phim”.
  - Card “Phòng ngủ nghe nhạc nhẹ”.
  - Card “Phòng phim gia đình”.
  - Card “Góc làm việc & call”.
- Mỗi card:
  - Ảnh minh họa không gian (phòng khách, phòng ngủ…).
  - Tiêu đề ngắn.
  - 1–2 dòng mô tả.
  - Badge “Được tư vấn nhiều”.
  - Nút/link “Xem gợi ý dàn phù hợp”.

### 5.3. Kết nối với AI / filter

- Khi user click:
  - Có thể:
    - Chuyển sang trang list sản phẩm đã pre-filter.
    - Hoặc mở modal nhỏ giới thiệu AI, kèm nút “Đưa thông tin này cho AI tư vấn chi tiết”.

---

## 6. Khu vực khuyến mãi & combo (Promotions)

### 6.1. Mục tiêu

- Kết nối với hệ thống promotion/coupon đã thiết kế.
- Cho thấy rõ những ưu đãi hiện hành, khuyến khích hành động.

### 6.2. Layout

- Tiêu đề: “Ưu đãi hiện tại”.
- Dải card ngang (carousel) hoặc grid 3 cột:
  - Mỗi card:
    - Label nhỏ: “Coupon”, “Combo dàn xem phim”, “Flash sale cuối tuần”.
    - Tiêu đề: “Giảm 15% cho loa bookshelf chọn lọc”.
    - Mô tả 1–2 dòng.
    - Thông tin thời gian: “Áp dụng đến 31/07”.
    - Mini pill: “Áp dụng với đơn từ 10.000.000đ”.
    - Nút: “Xem chi tiết” hoặc “Áp dụng ngay”.

### 6.3. Liên kết với coupon

- Sau này có thể đồng bộ:
  - Card hiển thị tên/code coupon (vd: “SUMMER2024”) + nút copy.
  - Khi user click “Áp dụng ngay” nếu đã có giỏ → đẩy code vào giỏ, gọi API validate.

---

## 7. Social proof: Đánh giá, thương hiệu

### 7.1. Logo thương hiệu audio

- Section “Đối tác & thương hiệu”:
  - Logo các hãng: Yamaha, Denon, Marantz, Klipsch, KEF… (biểu tượng nền xám nhẹ).
  - Desktop: dải ngang nhiều logo; Mobile: slider ngang với snap.

### 7.2. Testimonial / Đánh giá khách hàng

- 2–3 card testimonial:
  - Tên khách hàng (ẩn bớt: “Anh Minh • Hà Nội”).
  - Rating 5 sao.
  - Đoạn review 2–3 câu:
    - Nhấn mạnh vào trải nghiệm tư vấn và setup.
  - Tag: “Dàn xem phim phòng 20m²”.

---

## 8. Khu vực nội dung / blog / hướng dẫn

- Tiêu đề: “Hướng dẫn & kinh nghiệm chọn audio”.
- List 3–4 bài viết:
  - Ảnh preview nhỏ.
  - Tiêu đề: “5 lưu ý khi chọn loa cho phòng khách”.
  - Mô tả ngắn 1–2 dòng.
  - Link “Xem chi tiết”.

---

## 9. Footer

- 3–4 cột:
  - Cột 1: Logo + mô tả ngắn Đức Uy Audio.
  - Cột 2: Links:
    - Sản phẩm.
    - Khuyến mãi.
    - Hỗ trợ.
  - Cột 3: Thông tin liên hệ:
    - Địa chỉ showroom.
    - Số điện thoại.
    - Email hỗ trợ.
  - Cột 4: Đăng ký nhận tin:
    - Input email + nút “Đăng ký”.
- Dưới cùng:
  - Dòng bản quyền.
  - Link chính sách bảo mật, điều khoản sử dụng.

---

## 10. Responsive & trạng thái đặc biệt

### 10.1. Responsive

- **Mobile (≤640px)**:
  - Layout 1 cột, padding ngang ~16px.
  - Hero: stack text → nút → ảnh.
  - Grid sản phẩm 2 cột hoặc 1 cột tùy độ rộng.
  - Navigation: hamburger menu.
- **Tablet (641–1024px)**:
  - Có thể giữ 2 cột hero, 2–3 cột sản phẩm.
- **Desktop (≥1024px)**:
  - 2 cột hero, 3–4 cột sản phẩm.

### 10.2. Trạng thái loading / empty / error

- **Section sản phẩm nổi bật**:
  - Loading: skeleton card (ảnh xám + thanh text).
  - Empty: text “Chưa có sản phẩm nổi bật để hiển thị”.
- **Section khuyến mãi**:
  - Nếu không có promotion: ẩn section hoặc hiển thị block “Hiện chưa có ưu đãi, vui lòng quay lại sau”.

---

## 11. Checklist triển khai sau này

- [ ] Tạo route trang chủ (vd `src/app/(shop)/page.tsx` hoặc `src/app/page.tsx` nếu là trang gốc).
- [ ] Implement header với navigation, search, icon AI/cart/user.
- [ ] Implement hero (2 cột, nút entry AI, nền gradient/hình ảnh).
- [ ] Implement trust bar (3–4 icon + text).
- [ ] Implement khối “AI tư vấn nhanh” (form + preview).
- [ ] Implement section sản phẩm nổi bật (gọi API sản phẩm, dùng DataLoadingOverlay hoặc skeleton).
- [ ] Implement section “Chọn theo không gian & nhu cầu”.
- [ ] Implement section khuyến mãi & combo (hook vào hệ thống promotion/coupon).
- [ ] Implement logo thương hiệu & testimonial.
- [ ] Implement section bài viết/hướng dẫn (sau có blog).
- [ ] Implement footer đầy đủ.
- [ ] Đảm bảo responsive tốt trên mobile/tablet/desktop.
- [ ] Kiểm tra trạng thái loading/empty/error cho từng section.

