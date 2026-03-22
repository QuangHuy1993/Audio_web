## Workflow: Thiết kế giao diện Trang Hỗ trợ (Support) Đức Uy Audio

Tài liệu này mô tả chi tiết **giao diện và trải nghiệm** cho trang Hỗ trợ của Đức Uy Audio, tương thích với kiến trúc hiện tại (Next.js App Router, Prisma, các service AI, coupon, kho, v.v.).

Mục tiêu: sau này khi implement route `/support` (đã có link trong `ShopHeader`), chỉ cần bám theo tài liệu này để:

- Có một **trung tâm hỗ trợ** rõ ràng cho khách hàng.
- Kết nối hợp lý với các tính năng đã có: AI tư vấn, mã giảm giá, đơn hàng, bảo hành, kho hàng (tình trạng sản phẩm), v.v.
- Giữ phong cách UI **đồng bộ** với trang chủ: tông xanh đậm, nhấn primary, có yếu tố “AI thông minh”.

---

## 1. Mục tiêu UX của Trang Hỗ trợ

- **Trả lời nhanh các câu hỏi phổ biến**:
  - Chính sách bảo hành / đổi trả.
  - Hướng dẫn đặt hàng, thanh toán.
  - Cách áp dụng mã giảm giá.
  - Hỗ trợ kỹ thuật khi gặp lỗi thiết bị.
- **Giảm tải cho nhân sự hỗ trợ**:
  - Dùng **AI trợ lý hỗ trợ** để trả lời câu hỏi tự nhiên (kết hợp với `AiSession` nếu cần log).
  - Hướng user tới các bài viết hướng dẫn / FAQ trước khi cần liên hệ trực tiếp.
- **Tập trung vào hành động rõ ràng**:
  - “Liên hệ ngay” (kênh trực tiếp: hotline, Zalo, email).
  - “Gửi yêu cầu hỗ trợ” (form ticket đơn giản – có thể làm sau).
  - “Nhờ AI gợi ý / giải đáp”.
- **Đảm bảo cảm giác tin cậy**:
  - Nêu rõ thời gian phản hồi, giờ làm việc.
  - Thể hiện chuyên môn trong audio Hi-end, không quá chung chung.

---

## 2. Vị trí trong cấu trúc và route

- **Route dự kiến**: `src/app/support/page.tsx` (thuộc nhóm `(shop)` nếu sau này tách).
- **Entry chính**:
  - Link “Hỗ trợ” trong `ShopHeader` (`navItems` hiện có).
  - Một số CTA khác có thể dẫn về `/support`:
    - Trong footer (Hỗ trợ → Liên hệ, Chính sách bảo hành…).
    - Trong email hoặc trang đơn hàng.

Khi user click “Hỗ trợ”:

- Hiển thị `PageTransitionOverlay` (như trang chủ / auth) nếu điều hướng từ trang quan trọng.
- Sau 1100ms, trang Hỗ trợ xuất hiện với layout rõ ràng, nhẹ nhàng.

---

## 3. Khung layout tổng quát của Trang Hỗ trợ

### 3.1. Hero Hỗ trợ (đầu trang)

- **Mục tiêu**:
  - Cho user cảm giác “được chăm sóc”, không phải “bị bỏ rơi”.
  - Tóm tắt rõ ràng cách Đức Uy hỗ trợ khách hàng.
- **Layout**:
  - Nền gradient xanh đậm, tông gần với hero trang chủ nhưng nhẹ hơn.
  - Bên trái:
    - Tiêu đề (H1):  
      - Ví dụ: “Trung tâm Hỗ trợ Đức Uy Audio”.
    - Đoạn mô tả 2–3 dòng:
      - “Giải đáp mọi thắc mắc về sản phẩm, bảo hành, đơn hàng và trải nghiệm âm thanh Hi-end của bạn.”
    - Nhóm 2 nút:
      - Nút primary: “Nhờ AI hỗ trợ ngay”.
      - Nút secondary: “Liên hệ trực tiếp với chúng tôi”.
  - Bên phải:
    - Minh hoạ: icon headphone + hình người tư vấn / waveform.
    - Có thể reuse style từ hero trang chủ (card có shadow, glow).

### 3.2. Thanh truy cập nhanh (Quick actions)

Ngay bên dưới hero, một dải **4–6 nút hành động nhanh**:

- “Câu hỏi thường gặp (FAQ)”.
- “Chính sách bảo hành & đổi trả”.
- “Hướng dẫn mua hàng & thanh toán”.
- “Mã giảm giá & khuyến mãi”.
- “Tư vấn kỹ thuật thiết bị”.
- “Liên hệ / Gửi ticket”.

Trên desktop: 3–4 nút mỗi hàng; trên mobile: slider ngang hoặc 2 cột.

Mỗi nút scroll xuống section tương ứng bên dưới bằng anchor (id trong page).

---

## 4. Khu vực “Trợ lý AI Hỗ trợ”

Trang Hỗ trợ là nơi lý tưởng để **tái sử dụng AI** (kết hợp với `AiSession`):

### 4.1. Vị trí & layout

- Block xuất hiện sớm (ngay sau hero hoặc sau quick actions).
- Card nền tối với border primary nhẹ, tách hẳn khỏi phần còn lại.

Layout:

- Bên trái:
  - Tiêu đề: “Trợ lý AI Hỗ trợ Đức Uy”.
  - Mô tả ngắn:  
    “Đặt câu hỏi về bảo hành, lựa chọn thiết bị, cách setup phòng nghe… Đức Uy AI sẽ trả lời ngay trong vài giây.”
  - Gợi ý câu hỏi (chip/pill):
    - “Làm sao để bảo quản loa đúng cách?”
    - “Tôi nên chọn ampli nào cho loa Klipsch R-620F?”
    - “Chính sách bảo hành sản phẩm như thế nào?”
- Bên phải:
  - Ô input:
    - Textarea 2–3 dòng.
    - Placeholder: “Mô tả vấn đề hoặc câu hỏi của bạn…”.
    - Nút primary: “Hỏi AI ngay”.
  - Vùng hiển thị câu trả lời (conversation preview đơn giản):
    - Bubble “Bạn” + bubble “Đức Uy AI”.

### 4.2. Kết nối backend (sau này)

- API gợi ý:
  - `POST /api/shop/ai/support` hoặc gộp chung route AI tư vấn hiện có với type mới.
- Ghi log:
  - Dùng `AiSession` với `type = ADVICE` hoặc `SEARCH` + `metadata.context = "support"`.
- Bảo vệ:
  - Giới hạn độ dài input.
  - Timeout hợp lý, message fallback nếu AI lỗi.

---

## 5. Khu vực “FAQ – Câu hỏi thường gặp”

Đây là khu vực tĩnh nhưng rất quan trọng, nên tổ chức tốt để giảm số ticket.

### 5.1. Nhóm chủ đề FAQ

Chia FAQ thành các **category** (accordion lớn), mỗi category có 4–8 câu:

1. **Đơn hàng & thanh toán**
   - “Làm sao để đặt hàng tại Đức Uy Audio?”
   - “Tôi có thể thanh toán qua những hình thức nào?”
   - “Làm sao kiểm tra trạng thái đơn hàng?”
   - “Tôi có thể hủy đơn sau khi đã đặt không?”

2. **Giao hàng & lắp đặt**
   - “Thời gian giao hàng dự kiến là bao lâu?”
   - “Đức Uy có hỗ trợ lắp đặt tại nhà không?”
   - “Phí vận chuyển được tính như thế nào?”

3. **Bảo hành & đổi trả**
   - “Thời gian bảo hành cho loa / ampli / tai nghe là bao lâu?”
   - “Tôi cần làm gì khi sản phẩm gặp sự cố?”
   - “Điều kiện đổi trả sản phẩm là gì?”

4. **Mã giảm giá & khuyến mãi**
   - “Cách nhập mã giảm giá khi thanh toán?”
   - “Tại sao mã giảm giá của tôi không áp dụng được?”
   - “Mã giảm giá có thể áp dụng nhiều lần không?”

5. **Tư vấn âm thanh & setup phòng**
   - “Tôi nên chọn loa loại nào cho phòng 20m²?”
   - “Khác biệt giữa loa bookshelf và loa floorstanding là gì?”
   - “Có cần xử lý âm học phòng nghe không?”

### 5.2. UI chi tiết câu hỏi

- Mỗi câu là một **accordion nhỏ**:
  - Header: câu hỏi.
  - Body: câu trả lời 2–4 đoạn, kèm bullet nếu cần.
- Có ô search nhỏ “Tìm trong trợ giúp” lọc theo từ khóa (client-side).

---

## 6. Khu vực “Chính sách & Hướng dẫn”

Trang Hỗ trợ nên tóm tắt và link tới các chính sách quan trọng:

### 6.1. Card chính sách

3–4 card lớn, mỗi card có:

- Icon minh họa.
- Tiêu đề:
  - “Chính sách bảo hành”.
  - “Chính sách đổi trả & hoàn tiền”.
  - “Điều khoản sử dụng”.
  - “Chính sách bảo mật”.
- Mô tả ngắn (2–3 dòng).
- Link “Xem chi tiết”:
  - Có thể dẫn tới route `/support/warranty`, `/support/returns`, hoặc đơn giản là anchor trong cùng trang (nếu nội dung đặt cuối).

### 6.2. Hướng dẫn thao tác trên website

Một section nhỏ kiểu “Hướng dẫn nhanh”:

- “Các bước đặt hàng trên Đức Uy Audio”.
- “Cách áp dụng mã giảm giá”.
- “Cách theo dõi & quản lý đơn hàng”.

Có thể hiển thị dạng **timeline** hoặc list có số thứ tự.

---

## 7. Khu vực “Liên hệ trực tiếp”

Cho những user thích gọi điện / nhắn tin hơn dùng AI.

### 7.1. Thông tin liên hệ chính

Card rõ ràng, dễ đọc:

- Hotline: `0xxx xxx xxx` (placeholder).
- Email: `support@ducuyaudio.vn` (placeholder).
- Zalo / Messenger: text + icon.
- Giờ làm việc: “08:30 – 21:00 (T2 – CN)”.
- Địa chỉ showroom chính (nếu có).

### 7.2. Form gửi yêu cầu hỗ trợ (optional – có thể làm sau)

Một form đơn giản:

- Họ tên.
- Email / Số điện thoại.
- Loại yêu cầu (select):
  - Hỏi về đơn hàng.
  - Hỏi về sản phẩm.
  - Bảo hành / sửa chữa.
  - Góp ý / phản hồi.
- Nội dung chi tiết (textarea).
- Checkbox: “Đính kèm mã đơn hàng / serial thiết bị” (chỉ là nhắc nhở, chưa cần file upload).
- Nút gửi: “Gửi yêu cầu hỗ trợ”.

Backend sau này:

- Route gợi ý: `POST /api/support/tickets`.
- Lưu vào DB (model `SupportTicket` nếu tạo mới) hoặc gửi email tới team.

---

## 8. Khu vực “Tài nguyên & Hướng dẫn chuyên sâu”

Để khẳng định vai trò “chuyên gia audio Hi-end”, hỗ trợ nên trỏ tới tài nguyên hữu ích:

- Bài viết / blog:
  - “Cách chọn loa cho phòng khách 20–30m²”.
  - “Hiểu đúng về công suất ampli & loa”.
  - “Hướng dẫn setup dàn xem phim 5.1”.
- Video / playlist:
  - Embed danh sách video YouTube (nếu có).

UI gợi ý:

- Grid 3 card bài viết:
  - Ảnh preview.
  - Tiêu đề.
  - Mô tả ngắn.
  - Tag: “Hướng dẫn”, “Setup”, “Hi-end”.

---

## 9. Kết nối với các hệ thống hiện có

### 9.1. Hệ thống đơn hàng / tài khoản

Trong tương lai, trang Hỗ trợ có thể:

- Khi user đăng nhập:
  - Show block “Đơn hàng gần đây”:
    - Link nhanh đến trang chi tiết đơn (`/orders/[id]`).
  - CTA “Cần hỗ trợ về đơn #1234?” → scroll đến form liên hệ kèm pre-fill.

### 9.2. Mã giảm giá (coupon)

Trong section “Mã giảm giá & khuyến mãi”:

- Link tới trang khuyến mãi `/promotions`.
- Một mini-block giải thích:
  - Cách nhập mã.
  - Các lỗi thường gặp khi dùng mã (hết hạn, không đủ điều kiện, hết lượt).
- Có thể reuse kết quả từ `CouponValidateResult` để hiển thị ví dụ / copy snippet hướng dẫn.

### 9.3. AI & AiSession

- Mọi câu hỏi user gửi cho “Trợ lý AI Hỗ trợ” có thể:
  - Ghi dưới dạng `AiSession` với `metadata.context = "support"`.
  - Dùng cho analytic / cải thiện mẫu FAQ sau này.

---

## 10. Style & UX guideline dành cho designer

- **Tông màu**:
  - Nền chính: `--background-homepage` (rgb(18 32 23 / ...)) để đồng bộ với trang chủ.
  - Card: dùng `rgba(15, 23, 42, 0.96)` và border `rgba(148, 163, 184, 0.35)` như card AI / sản phẩm nổi bật.
  - Điểm nhấn: dùng `--primary` và `--accent` tiết chế (icon, border, nút).
- **Typography**:
  - H1 (hero): cỡ gần với hero trang chủ nhưng “dịu” hơn (ít negative letter-spacing hơn).
  - H2/H3: sử dụng rõ ràng để phân tầng (FAQ, Chính sách, Liên hệ…).
  - Body: ~14px, màu `rgba(226,232,240,0.85)` cho readability.
- **Component pattern**:
  - Reuse pattern card BEM hiện có (bo góc 18–24px, shadow vừa phải).
  - Giữ khoảng trắng đủ rộng giữa các section (56–80px) để trang không bị dày đặc chữ.
- **Animation**:
  - Có thể dùng framer-motion nhẹ:
    - Fade/slide cho card AI.
    - Accordion mượt cho FAQ.
  - Tránh animation quá nhiều gây phân tâm.

---

## 11. Checklist triển khai sau này

- [x] Tạo route `src/app/support/page.tsx` (server component kết hợp client nếu cần).
- [x] Thiết kế container layout chung (giống trang chủ, reuse `ShopHeader` + `ShopFooter`).
- [x] Implement hero Hỗ trợ (2 cột: text + visual).
- [x] Implement dải quick actions và anchor đến các section bên dưới.
- [x] Implement block Trợ lý AI Hỗ trợ (UI + call API AI sau này).
- [x] Implement section FAQ với accordion, search nội bộ.
- [x] Implement section Chính sách & Hướng dẫn (card + link).
- [x] Implement block Liên hệ trực tiếp (hotline, email, giờ làm việc).
- [ ] (Tuỳ chọn) Implement form gửi yêu cầu hỗ trợ và API `/api/support/tickets`.
- [x] Implement section Tài nguyên & Hướng dẫn chuyên sâu (bài viết/video).
- [x] Tối ưu responsive cho mobile/tablet/desktop.
- [x] Kết hợp `PageTransitionOverlay` nếu cần transition khi điều hướng tới `/support`.

