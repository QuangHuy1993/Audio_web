## Workflow: Thiết kế trang Kích hoạt tài khoản (nhập OTP) – Đức Uy Audio

Tài liệu này mô tả **layout, màu sắc, trải nghiệm người dùng và logic luồng** cho trang Kích hoạt tài khoản sau khi người dùng đăng ký thành công. Designer có thể dựa vào đây để thiết kế UI chi tiết; dev chỉ cần bám theo để implement đúng logic.

---

## 1. Bối cảnh & mục tiêu UX

- **Bối cảnh**:
  - User vừa hoàn thành form đăng ký ở `AuthRegisterPage` (đã có UX đẹp sẵn).
  - Hệ thống đã:
    - Tạo bản ghi `User` trong DB (Prisma model `User`).
    - Sinh OTP qua service `createOtp` (model `OtpCode`, `type = ACCOUNT_ACTIVATION`, TTL 10 phút).
    - Gửi email OTP qua SendGrid (template thương hiệu Đức Uy Audio).
  - User được **redirect sang trang Kích hoạt tài khoản** để nhập OTP.
- **Mục tiêu**:
  - Giải thích rõ ràng: tài khoản đã tạo nhưng cần xác thực email.
  - Giao diện tập trung, dễ đọc, tối ưu cho mobile.
  - Thể hiện rõ **thương hiệu âm thanh cao cấp** (màu chủ đạo từ `globals.css`).
  - Hỗ trợ trạng thái:
    - Nhập OTP lần đầu.
    - Sai OTP / hết hạn.
    - Gửi lại OTP (có giới hạn, kèm countdown).

---

## 2. Vị trí trong kiến trúc & route

- **Route đề xuất**:
  - `src/app/(auth)/verify-account/page.tsx`.
  - Có thể dùng `AuthPageTransitionLayout` hoặc pattern tương tự `AuthRegisterPage` để đồng bộ trải nghiệm.
- **Luồng điều hướng**:
  1. User submit form đăng ký (`/register`).
  2. Backend đăng ký:
     - Tạo user + OTP + gửi email.
     - Trả về response ok kèm `email` (và có thể `userName`).
  3. Frontend điều hướng sang `/verify-account?email=...` hoặc dùng state.
  4. Trang này hiển thị form OTP + thông tin tóm tắt: “Đã gửi mã đến địa chỉ…”.

---

## 3. Bảng màu & tone thiết kế (theo `globals.css`)

- **Màu chính** (brand audio cao cấp):
  - Nền khu vực chính: gần với `--background-homepage` (tông tối xanh đậm).
  - Nền card: gần `#191414` / `--secondary` với opacity nhẹ, tạo cảm giác premium.
  - Nút chính (Confirm OTP): `--gradient-primary` / `--primary` (#1DB954).
  - Màu nhấn cho OTP / trạng thái đếm ngược: `--accent` (#FFD700).
- **Text**:
  - Tiêu đề: màu gần `--text-light` (#FFFFFF).
  - Mô tả: `rgba(226,232,240,0.85)` hoặc tương đương `--text-secondary` trên nền tối.
  - Cảnh báo lỗi: `--error` (#F44336) + icon nhỏ.
- **Card / border / shadow**:
  - Card chính bo góc: dùng `--border-radius-xl` (16px) hoặc lớn hơn (20–24px) cho cảm giác mềm.
  - Viền card: `rgba(148,163,184,0.35)` hoặc `--border-color-dark`.
  - Shadow: `--shadow-lg` với chút `--shadow-primary` để tạo glow nhẹ quanh nút.

---

## 4. Layout tổng thể trang Kích hoạt tài khoản

### 4.1. Khung toàn trang

- **Tỷ lệ**:
  - Desktop: trang chia 2 cột tương tự `AuthRegisterPage`:
    - Bên trái: khối brand / visual trải nghiệm âm thanh.
    - Bên phải: card nhập OTP.
  - Mobile: stack dọc, ưu tiên card OTP lên trên, brand xuống dưới hoặc rút gọn.
- **Nền trang**:
  - Dùng gradient tương tự trang đăng ký:
    - Ví dụ: `--gradient-hero` hoặc biến thể: nền `#121212` chuyển sang `--primary`.
  - Có thể thêm overlay noise nhẹ hoặc pattern waveform mờ.

### 4.2. Cột trái – Brand & thông điệp

- **Nội dung**:
  - Logo `Đức Uy Audio` (reuse từ `AuthRegisterPage`).
  - Headline ngắn:
    - Ví dụ: “Chỉ còn một bước nữa để hoàn tất tài khoản của bạn.”
  - Subtext:
    - “Xác thực email giúp bảo vệ tài khoản và giữ kết nối với những trải nghiệm âm thanh mới nhất.”
  - Hình minh hoạ:
    - Card loa / ampli với ánh sáng từ phía sau (giữ style đang dùng ở auth).
  - Có thể tái sử dụng class BEM của `AuthRegisterPage` cho layout chung để tiết kiệm thời gian design.

### 4.3. Cột phải – Card nhập OTP

**Card chính** (trọng tâm):

- **Header**:
  - Tiêu đề (H1):
    - “Kích hoạt tài khoản của bạn”.
  - Đoạn mô tả:
    - “Chúng tôi đã gửi mã xác thực đến email: **{{email}}**”.
    - “Nhập mã gồm 8 ký tự để xác nhận đây là bạn.”
- **Thông tin email**:
  - Hiển thị địa chỉ dạng che bớt: `nguy***@gmail.com` (logic che do dev xử lý; designer chỉ cần thể hiện).
  - Icon phong bì nhỏ (ẩn/hiện tuỳ độ tối giản).

---

## 5. Thiết kế vùng nhập OTP

### 5.1. Kiểu OTP (đồng bộ với backend)

- Backend đã quy định:
  - OTP dài **8 ký tự**.
  - Xen kẽ **số và chữ cái in hoa** (pattern `D L D L D L D L`).
  - Mỗi mã sống **10 phút** (TTL).

### 5.2. Hai phương án UI cho designer

**Phương án A – 8 ô input riêng biệt (đề xuất)**:

- 8 ô hình chữ nhật nhỏ, bo góc, đều nhau:
  - 4 ô cho vị trí số, 4 ô cho chữ.
  - Có thể đổi màu border xen kẽ:
    - Ô số: border `--border-primary`.
    - Ô chữ: border `--border-accent`.
- Focus:
  - Khi user nhập một ký tự, tự động chuyển focus sang ô tiếp theo.
  - Hỗ trợ dán (paste) full 8 ký tự: front-end sẽ tự phân bổ; designer chỉ cần note.
- Màu sắc:
  - Nền ô: `#191414` / `--secondary`.
  - Border default: `#3D3535` (`--secondary-lighter`).
  - Border focus: `--primary`.
  - Text: `--text-light`.

**Phương án B – Một input duy nhất**:

- Input rộng toàn dòng, font monospace, letter-spacing tăng (~ 4–6px).
- Border & background giống input auth:
  - Nền tối, border mỏng, glow nhẹ khi focus.
- Placeholder: `Ví dụ: 1A2B3C4D`.

> Designer có thể chọn một trong hai, nhưng **Phương án A** trực quan hơn với OTP 8 ký tự cố định.

### 5.3. Nhãn & hướng dẫn

- Label bên trên vùng OTP:
  - “Mã xác thực OTP”.
- Hướng dẫn nhỏ bên dưới:
  - “Mã gồm **8 ký tự**, xen kẽ số và chữ cái in hoa (ví dụ: 1A2B3C4D).”
  - Màu chữ nhạt (`--text-tertiary`).

---

## 6. Trạng thái hệ thống & thông báo

### 6.1. Trạng thái mặc định

- Nút chính: “Xác nhận & kích hoạt”.
  - Màu nền: gradient `--gradient-primary`.
  - Hover: `--gradient-primary-hover`.
  - Text: `--text-light`.
- Bên dưới nút:
  - Dòng chữ:
    - “Bạn chưa nhận được mã?”
    - Link “Gửi lại mã mới” (màu `--primary-light`, underline nhẹ).

### 6.2. Trạng thái loading

- Khi gửi OTP lên server:
  - Nút chuyển sang trạng thái loading:
    - Icon nhỏ xoay.
    - Text đổi thành “Đang xác thực…”.
  - Vô hiệu hóa input OTP & nút gửi lại.

### 6.3. Thông báo lỗi

- **Sai OTP**:
  - Text lỗi đỏ ngay dưới vùng OTP:
    - “Mã OTP không chính xác. Vui lòng kiểm tra lại.”
  - Có thể kèm thông tin số lần thử còn lại (được tính từ `attempts` / `maxAttempts` của `OtpCode`).
- **Hết hạn**:
  - Lỗi:
    - “Mã OTP này đã hết hạn sau 10 phút. Hãy yêu cầu gửi mã mới.”
  - CTA:
    - Nổi bật hơn link thường, ví dụ button secondary “Gửi lại mã”.
- **Quá số lần thử**:
  - Lỗi:
    - “Bạn đã thử quá số lần cho phép. Vui lòng nhận mã OTP mới.”
  - Tự động disable nút submit cho OTP hiện tại.

### 6.4. Thông báo thành công

- Sau khi OTP hợp lệ:
  - Toast / inline message:
    - “Kích hoạt tài khoản thành công.”
  - Kích hoạt `PageTransitionOverlay`:
    - `title`: “Chào mừng bạn đến với Đức Uy Audio”.
    - `subtitle`: “Chúng tôi đang chuẩn bị không gian âm thanh dành riêng cho bạn…”.
    - `bottomText`: “Đang chuyển bạn tới trang trải nghiệm chính…”.
  - Sau ~1100ms, redirect sang:
    - `/` hoặc `/account` tùy thiết kế luồng chính.

---

## 7. Khu vực gửi lại OTP & countdown

### 7.1. Hiển thị thời gian sống còn lại

- Dòng text nhỏ dưới vùng OTP:
  - “Mã OTP sẽ hết hạn trong **09:58**.”
  - Format `MM:SS`.
  - Màu sắc:
    - > 5 phút: `--text-tertiary`.
    - 5–2 phút: `--warning` (#FF9800).
    - < 2 phút: `--error` (#F44336).

### 7.2. Nút gửi lại mã

- Logic:
  - Khi vừa gửi OTP lần đầu:
    - Nút “Gửi lại mã” bị disable trong 30–60 giây đầu (limit spam).
  - Text:
    - Khi disable: “Bạn có thể yêu cầu mã mới sau 00:45”.
    - Khi enable: “Gửi lại mã mới”.
- UI:
  - Dạng link có icon refresh nhỏ hoặc button text-only.
  - Màu: `--primary` khi enable, `--text-tertiary` khi disable.

### 7.3. Khi bấm gửi lại

- Hiệu ứng:
  - Nút chuyển loading ngắn (1–2 giây).
  - Banner nhỏ màu xanh `--success-light` có thể hiện:
    - “Chúng tôi đã gửi một mã OTP mới đến {{email}}.”
  - Countdown TTL reset về 10:00.

---

## 8. Navigation phụ & edge cases

- **Link quay lại đăng ký**:
  - Text: “Sai email? Quay lại bước đăng ký.”
  - Dẫn về `/register`, có thể prefill lại form.
- **Link tới đăng nhập**:
  - Nếu user đã kích hoạt nhưng quên, khi nhập OTP một lần nữa có thể bị báo đã kích hoạt:
    - Hiển thị link “Đăng nhập ngay”.
- **Trường hợp user refresh trang**:
  - UI vẫn cần hiển thị được email đang kích hoạt (dùng query param/email trong URL).
  - Nếu không có email (user mở trực tiếp URL), hiển thị:
    - Nhắc user nhập email để gửi lại OTP, hoặc redirect về `/register`.

---

## 9. Gợi ý BEM & component cho designer / dev

- **Block gợi ý**: `auth-verify-account-page`.
  - Page wrapper: `auth-verify-account-page`.
  - Container 2 cột: `auth-verify-account-page__container`.
  - Cột trái: `auth-verify-account-page__left`.
  - Cột phải: `auth-verify-account-page__right`.
  - Card OTP: `auth-verify-account-page__card`.
  - Vùng OTP:
    - Wrapper: `auth-verify-account-page__otp-wrapper`.
    - Ô OTP: `auth-verify-account-page__otp-cell`.
    - Input đơn: `auth-verify-account-page__otp-input`.
  - Text lỗi: `auth-verify-account-page__error`.
  - Text countdown: `auth-verify-account-page__countdown`.
  - Link resend: `auth-verify-account-page__resend`.

Designer có thể tham chiếu style của `AuthRegisterPage` để giữ sự đồng nhất về font, khoảng cách, border-radius, độ mờ overlay và hiệu ứng gradient nền.

