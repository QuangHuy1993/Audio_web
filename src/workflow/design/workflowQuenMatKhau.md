## Workflow: Thiết kế trang Quên mật khẩu – Đức Uy Audio

Tài liệu này mô tả **thiết kế UI/UX, màu sắc và logic luồng** cho tính năng Quên mật khẩu, bao gồm:

- Trang gửi yêu cầu đặt lại mật khẩu (nhập email).
- Trang/khối nhập OTP + mật khẩu mới (nếu tách ra).
- Cách kết nối với DB (`User`, `OtpCode`) và flow email OTP SendGrid.

Designer dựa vào đây để làm giao diện; dev dựa vào flow logic để implement chuẩn.

---

## 1. Bối cảnh & mục tiêu UX

- **Bối cảnh**:
  - User quên mật khẩu và muốn lấy lại quyền truy cập vào tài khoản Đức Uy Audio.
  - Tài khoản đã tồn tại trong DB (`User.email` không null).
  - Hệ thống sử dụng model `OtpCode` với `type = PASSWORD_RESET`, TTL 10 phút.
- **Mục tiêu**:
  - Giải thích rõ ràng, bước-by-bước, tránh gây hoang mang.
  - Giao diện kỹ lưỡng nhưng không quá “nặng”, nhẹ nhàng, tin cậy.
  - Bảo mật:
    - Không tiết lộ email có tồn tại hay không.
    - Rõ ràng về OTP chỉ dùng một lần và hết hạn sau 10 phút.

---

## 2. Vị trí trong kiến trúc & route

### 2.1. Đề xuất route

- **Bước 1 – Nhập email**:
  - `src/app/(auth)/forgot-password/page.tsx`.
  - Form đơn: chỉ cần email.
- **Bước 2 – Nhập OTP + mật khẩu mới**:
  - `src/app/(auth)/reset-password/page.tsx` (hoặc `[token]` nếu dùng token).
  - Đối với design, coi như một trang mới, nhưng có thể reuse layout từ bước 1.

### 2.2. Kết nối backend (tóm tắt để designer hiểu flow)

- Bước 1:
  - User nhập email → API `POST /api/auth/forgot-password`.
  - Backend:
    - Nếu email tồn tại:
      - Gọi `createOtp({ email, userId, type: "PASSWORD_RESET", ttlMinutes: 10 })`.
      - Gửi email SendGrid template OTP (dùng màu sắc thương hiệu).
    - Nếu email không tồn tại:
      - Vẫn trả response “Nếu email tồn tại, chúng tôi đã gửi hướng dẫn”.
- Bước 2:
  - User mở trang reset (thông qua link trong email hoặc luồng OTP + form).
  - Nhập OTP + mật khẩu mới → API `POST /api/auth/reset-password-with-otp`.
  - Backend:
    - `verifyOtp(email, "PASSWORD_RESET", otpCode, userId?)`.
    - Nếu success → cập nhật `passwordHash` mới.

---

## 3. Bảng màu & style tổng thể (theo `globals.css`)

- **Tông màu**:
  - Nền trang: tông tối hiện đại, reuse từ auth:
    - Nền tổng thể: `--background-homepage` hoặc gần `#121212`.
    - Nền card: `--secondary` (#191414).
  - Nút chính:
    - Dùng `--primary` (#1DB954) / `--gradient-primary`.
  - Điểm nhấn / cảnh báo:
    - Thông tin nhắc về bảo mật: `--accent` (#FFD700) / nền vàng nhạt.
    - Lỗi: `--error` (#F44336).
  - Text:
    - Tiêu đề: gần `--text-light` (#FFFFFF).
    - Mô tả: `--text-secondary` (#424242) hoặc `rgba(226,232,240,0.85)` trên nền tối.
- **Card / border**:
  - Card bo góc lớn `--border-radius-xl` (16px–20px).
  - Viền mỏng: `--border-color-dark` (#BDBDBD) hoặc overlay ánh xanh.
  - Shadow: `--shadow-lg` hoặc `--shadow-secondary`.

---

## 4. Trang Bước 1 – Nhập email quên mật khẩu

### 4.1. Layout chung

- Gợi ý reuse layout auth:
  - Block: `auth-forgot-password-page`.
  - Hai cột:
    - Trái: hình ảnh/brand (giống hoặc đơn giản hơn `AuthRegisterPage`).
    - Phải: card form quên mật khẩu.
  - Mobile: stack dọc, card form hiển thị trước.

### 4.2. Nội dung cột trái (brand)

- Logo `Đức Uy Audio` + tagline:
  - “Khôi phục truy cập vào thế giới âm thanh của bạn.”
- Hình minh hoạ:
  - Người dùng đang nghe nhạc với headphone, tone ấm/trung tính.
- Thông điệp tin cậy:
  - “Chúng tôi bảo vệ thông tin của bạn. Quy trình đặt lại mật khẩu được mã hoá và an toàn.”

### 4.3. Card form bên phải

- **Header card**:
  - Tiêu đề (H1):
    - “Quên mật khẩu”.
  - Subtext:
    - “Nhập email bạn đã dùng để đăng ký. Chúng tôi sẽ gửi mã xác thực để giúp bạn đặt lại mật khẩu.”

- **Form**:
  - Một trường `Email`:
    - Label: “Địa chỉ email”.
    - Placeholder: “tenban@vidu.com”.
    - Validation text (nếu cần): định dạng email hợp lệ.
  - Nút gửi:
    - Text: “Gửi mã đặt lại mật khẩu”.
    - Nút màu `--primary`, dạng full-width.
    - Hover nhẹ với gradient `--gradient-primary-hover`.

- **Thông tin bảo mật dưới form**:
  - Đoạn text nhỏ (~12px), màu `--text-tertiary`:
    - “Vì lý do bảo mật, chúng tôi sẽ **không cho biết** email này có tồn tại hay không trong hệ thống. Nếu email khớp, bạn sẽ nhận được hướng dẫn trong vài phút.”

- **Link điều hướng**:
  - “Nhớ lại mật khẩu? Đăng nhập ngay” → `/login`.
  - “Chưa có tài khoản? Đăng ký mới” → `/register`.

### 4.4. Trạng thái hệ thống

- **Loading**:
  - Nút đổi text “Đang gửi…” + spinner nhỏ.
- **Thành công (email hợp lệ hoặc không, luôn hiển thị giống nhau)**:
  - Banner màu xanh `--success-light`:
    - “Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến hộp thư của bạn.”
- **Lỗi kỹ thuật (server lỗi, API fail)**:
  - Banner đỏ `--error-light`:
    - “Hệ thống đang bận, vui lòng thử lại sau vài phút.”

---

## 5. Trang/Bước 2 – Nhập OTP và mật khẩu mới

> Có thể được mở từ link trong email hoặc điều hướng nội bộ. Designer cần thiết kế như một card/bước rõ ràng, không bị lẫn với đăng ký/đăng nhập.

### 5.1. Layout & cấu trúc

- Có thể:
  - **Phương án 1**: Trang riêng tương tự bước 1:
    - Bên trái: brand (reuse).
    - Bên phải: card “Đặt lại mật khẩu”.
  - **Phương án 2**: Stepper trong cùng trang:
    - Step 1: Nhập email.
    - Step 2: OTP + mật khẩu mới (ẩn hiện theo state).
  - Khuyến nghị: **Phương án 1** cho clear, dễ code và đơn giản UX.

### 5.2. Card “Đặt lại mật khẩu”

- **Header**:
  - Tiêu đề:
    - “Đặt lại mật khẩu”.
  - Subtext:
    - “Chúng tôi đã gửi mã xác thực đến email: **{{email}}**. Nhập mã OTP và mật khẩu mới để hoàn tất.”

- **Trường nội dung**:
  1. **OTP**:
     - Gợi ý sử dụng cùng style phân ô nhỏ như trang Kích hoạt tài khoản:
       - 8 ô input hoặc một ô input với letter-spacing.
       - Label: “Mã xác thực OTP”.
       - Hướng dẫn: “Mã gồm 8 ký tự, xen kẽ số và chữ in hoa.”
  2. **Mật khẩu mới**:
     - Label: “Mật khẩu mới”.
     - Input password với nút show/hide, style giống `AuthRegisterPage`.
     - Gợi ý text nhỏ:
       - “Ít nhất 8 ký tự, nên bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt.”
  3. **Xác nhận mật khẩu mới**:
     - Label: “Xác nhận mật khẩu mới”.
     - Input second, check khớp.

- **Nút hành động**:
  - Nút primary: “Cập nhật mật khẩu”.
  - Khi loading: “Đang cập nhật…” + spinner.

### 5.3. Trạng thái & thông báo

- **OTP sai / hết hạn / quá số lần thử**:
  - Dùng chung style lỗi với trang Kích hoạt tài khoản:
    - Text lỗi đỏ ngay dưới vùng OTP.
    - Nếu hết hạn: highlight link “Gửi lại mã mới”.
  - Countdown thời hạn mã: “Mã OTP sẽ hết hạn trong 09:58” (tương tự bên kia).

- **Password validation lỗi**:
  - Gạch chân input, text lỗi đỏ nhỏ dưới từng trường:
    - “Mật khẩu phải có ít nhất 8 ký tự.”
    - “Mật khẩu xác nhận không khớp.”

- **Thành công**:
  - Banner hoặc inline message:
    - “Mật khẩu của bạn đã được cập nhật thành công.”
  - Kích hoạt `PageTransitionOverlay`:
    - `title`: “Đăng nhập với mật khẩu mới”.
    - `subtitle`: “Chúng tôi đang đưa bạn trở lại hành trình âm thanh của mình…”.
  - Sau ~1100ms:
    - Redirect về `/login`.

---

## 6. Gửi lại OTP trong flow quên mật khẩu

- **Vị trí**:
  - Ngay trong trang nhập OTP + mật khẩu mới.
- **Text**:
  - “Không nhận được mã?” + link “Gửi lại mã”.
- **Logic UX**:
  - Khi vừa gửi mail lần đầu, disable nút gửi lại ít nhất 30–60 giây.
  - Khi gửi lại thành công:
    - Banner `--success-light`:
      - “Chúng tôi vừa gửi một mã OTP mới đến {{email}}. Mã cũ sẽ không còn hiệu lực.”
    - Reset countdown TTL 10 phút.

---

## 7. Edge cases & điều hướng phụ

- **User không còn nhớ email**:
  - Trong trang bước 1, có link nhỏ:
    - “Không nhớ email đã dùng? Liên hệ đội ngũ hỗ trợ.”
  - Link dẫn về `/support` (dựa trên `workflowHoTro.md`).

- **User đang đăng nhập mà vào trang quên mật khẩu**:
  - Có thể hiển thị banner:
    - “Bạn đang đăng nhập với tài khoản {{email}}.” kèm CTA “Đổi mật khẩu trong tài khoản của tôi” (flow khác).

- **User nhập OTP đúng nhưng backend báo user không tồn tại (trường hợp rất hiếm)**:
  - Hiển thị lỗi chung:
    - “Có lỗi xảy ra với tài khoản của bạn. Vui lòng liên hệ đội ngũ hỗ trợ để được giúp đỡ.”
  - Link tới `/support`.

---

## 8. Gợi ý BEM & component

- **Block quên mật khẩu – bước 1**: `auth-forgot-password-page`.
  - Wrapper: `auth-forgot-password-page`.
  - Container: `auth-forgot-password-page__container`.
  - Left: `auth-forgot-password-page__left`.
  - Right: `auth-forgot-password-page__right`.
  - Card: `auth-forgot-password-page__card`.
  - Field email: `auth-forgot-password-page__field`.
  - Error: `auth-forgot-password-page__error`.
  - Success banner: `auth-forgot-password-page__success`.

- **Block đặt lại mật khẩu – bước 2**: `auth-reset-password-page`.
  - Wrapper: `auth-reset-password-page`.
  - Container: `auth-reset-password-page__container`.
  - Card: `auth-reset-password-page__card`.
  - OTP wrapper/input: `auth-reset-password-page__otp-wrapper`, `auth-reset-password-page__otp-cell` / `__otp-input`.
  - Field password: `auth-reset-password-page__field`.
  - Error text: `auth-reset-password-page__error`.
  - Countdown: `auth-reset-password-page__countdown`.
  - Resend link: `auth-reset-password-page__resend`.

Giữ phong cách chung với auth hiện tại (gradient nền, card tối, nút primary xanh, góc bo lớn, khoảng trắng đủ rộng) để user cảm nhận đây là một phần liền mạch của hệ thống Đức Uy Audio.

