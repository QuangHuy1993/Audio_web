## Workflow: Đăng ký tài khoản + Kích hoạt bằng OTP – Đức Uy Audio

Tài liệu này mô tả **chi tiết luồng fullstack** cho tính năng:

- Người dùng đăng ký tài khoản mới.
- Hệ thống lưu thông tin vào DB với trạng thái **chưa kích hoạt**.
- Tạo mã OTP `ACCOUNT_ACTIVATION`, gửi email qua SendGrid.
- Người dùng nhập OTP ở trang Kích hoạt tài khoản để xác nhận email.

Workflow này là “xương sống” cho toàn bộ auth cơ bản của Đức Uy Audio.

---

## 1. Bối cảnh & model liên quan

- **Model `User` (trong `schema.prisma`)**:
  - Trường chính:
    - `id: String @id @default(cuid())`
    - `name: String?`
    - `email: String? @unique`
    - `passwordHash: String?`
    - `role: UserRole @default(USER)`
    - `emailVerified: DateTime?`
  - **Cờ kích hoạt tài khoản**:
    - Tài khoản **chưa kích hoạt** khi `emailVerified` đang `null`.
    - Tài khoản **đã kích hoạt** khi `emailVerified` được set `DateTime` lúc xác minh OTP thành công.
- **Model `OtpCode` (trong `schema.prisma`)**:
  - Trường chính:
    - `email: String`
    - `userId: String?`
    - `type: OtpType`
    - `codeHash: String`
    - `expiresAt: DateTime`
    - `attempts: Int @default(0)`
    - `maxAttempts: Int @default(5)`
    - `verifiedAt: DateTime?`
    - `consumedAt: DateTime?`
  - Enum `OtpType`:
    - `ACCOUNT_ACTIVATION`
    - `PASSWORD_RESET`
- **Service OTP**: `src/services/otp-service.ts`
  - `generateOtpCode()`:
    - Sinh mã OTP **8 ký tự**, xen kẽ số và chữ in hoa (D–L–D–L…).
  - `createOtp({ email, userId, type, ttlMinutes })`:
    - Tự đánh dấu các OTP chưa dùng (`consumedAt: null`) cùng email + type là đã tiêu thụ.
    - Tạo bản ghi `OtpCode` mới, lưu `codeHash` (mã OTP đã hash), `expiresAt`.
    - Trả về `{ otpId, code, expiresAt }`.
  - `verifyOtp(email, type, code, userId?)`:
    - Kiểm tra record mới nhất theo email + type (+ userId nếu có).
    - Kiểm tra hết hạn, số lần thử.
    - So sánh `code` với `codeHash`.
    - Cập nhật `attempts`, `verifiedAt`, `consumedAt`.
    - Trả về `{ success: true }` hoặc `{ success: false, reason: "NOT_FOUND" | "EXPIRED" | "INVALID" | "TOO_MANY_ATTEMPTS" }`.

---

## 2. Biến môi trường & SendGrid

Trong `.env` đã cấu hình (ví dụ):

- `SENDGRID_API_KEY=...`
- `SENDGRID_FROM_EMAIL=...`
- `SENDGRID_FROM_NAME="Duc Uy Audio"`
- `SENDGRID_TEMPLATE_ACCOUNT_ACTIVATION=...`
- `SENDGRID_TEMPLATE_PASSWORD_RESET=...`

**Yêu cầu khi implement backend gửi mail**:

- Không log ra API key, token hoặc nội dung mail nhạy cảm.
- Gửi email bằng template `SENDGRID_TEMPLATE_ACCOUNT_ACTIVATION` cho luồng kích hoạt tài khoản.
- Biến trong template tối thiểu:
  - `{fullName}` hoặc `{name}`.
  - `{otpCode}`.
  - `{supportUrl}` hoặc `{supportEmail}` nếu có.

---

## 3. Luồng tổng quan end-to-end

1. **User mở trang đăng ký**: `/register` → render `AuthRegisterPage`.
2. User nhập:
   - Họ tên.
   - Email.
   - Mật khẩu & Xác nhận mật khẩu.
   - Tích chấp nhận điều khoản.
3. User bấm **Đăng ký**:
   - Frontend validate form (trống, khớp mật khẩu, đã tích điều khoản).
   - Gửi `POST /api/auth/register` với payload chứa dữ liệu form.
4. **Backend `/api/auth/register`**:
   - Validate dữ liệu, check email đã tồn tại hay chưa.
   - Hash mật khẩu.
   - Tạo bản ghi `User`:
     - `emailVerified` để `null` → **chưa kích hoạt**.
   - Gọi `createOtp({ email, userId, type: "ACCOUNT_ACTIVATION" })`.
   - Gửi email OTP kích hoạt qua SendGrid.
   - Trả response JSON `{ email, fullName }` (hoặc thông tin cần thiết).
5. **Frontend sau khi đăng ký thành công**:
   - Hiển thị toast thành công.
   - Kích hoạt `PageTransitionOverlay` (trạng thái “đang chuẩn bị tài khoản”).
   - Sau ~1100ms, `router.push("/verify-account?email=...")`.
6. User tới trang **Kích hoạt tài khoản**: `/verify-account` → `AuthVerifyAccountPage`.
   - Hiển thị email đã che (ví dụ `nguy***@gmail.com`).
   - Cho phép nhập OTP 8 ký tự.
   - Hiển thị countdown TTL ~10 phút.
7. User nhập OTP và bấm **Xác nhận & kích hoạt**:
   - Frontend ghép 8 ô thành `code`.
   - Gửi `POST /api/auth/verify-account` với `{ email, code }`.
8. **Backend `/api/auth/verify-account`**:
   - Gọi `verifyOtp(email, "ACCOUNT_ACTIVATION", code)`.
   - Nếu `success: true`:
     - Tìm `User` theo email.
     - Set `emailVerified = new Date()`.
     - (Tuỳ chọn) gửi email chào mừng.
     - Trả 200 với message “activated”.
   - Nếu thất bại:
     - Map `reason` → HTTP code + message thân thiện:
       - `NOT_FOUND` → 400 “Mã OTP không hợp lệ.”.
       - `INVALID` → 400 “Mã OTP không chính xác.”.
       - `EXPIRED` → 400 “Mã OTP đã hết hạn.”.
       - `TOO_MANY_ATTEMPTS` → 429 “Bạn đã thử quá số lần cho phép.”.
9. **Frontend sau khi kích hoạt thành công**:
   - Hiển thị trạng thái thành công.
   - Kích hoạt `PageTransitionOverlay` (trạng thái “Chào mừng bạn…”).
   - Sau ~1100ms, `router.push("/login")` hoặc `/` theo thiết kế.

---

## 4. Bước chi tiết – Frontend đăng ký (`AuthRegisterPage`)

### 4.1. Vị trí & UI

- File: `src/features/auth/components/AuthRegisterPage.tsx`.
- Route sử dụng: `src/app/(auth)/register/page.tsx` (đã/ sẽ render component này).
- UI hiện tại:
  - Hai cột: trái (brand + social proof), phải (form đăng ký).
  - Input:
    - Họ và tên.
    - Địa chỉ email.
    - Mật khẩu.
    - Xác nhận mật khẩu.
    - Checkbox chấp nhận điều khoản.
- Button hiện tại:
  - Text: “Đăng ký”.
  - On submit: mới chỉ `toast.success("Tạo tài khoản thành công (demo).");` (chưa gọi API).

### 4.2. Hành vi cần nâng cấp

1. **Validate client-side** (đã có một phần):
   - Không để trống các trường.
   - Mật khẩu trùng với xác nhận.
   - Checkbox điều khoản đã được tick.
   - Có thể bổ sung:
     - Độ dài mật khẩu ≥ 8.
     - Định dạng email cơ bản (regex).
2. **Gọi API đăng ký**:
   - Thay vì chỉ toast demo, cần:
     - Đặt state `isSubmitting` để disable button trong lúc call API.
     - Gọi `fetch("/api/auth/register", { method: "POST", body: JSON.stringify({ fullName, email, password }) })`.
     - Nếu success:
       - Hiển thị toast “Tạo tài khoản thành công, vui lòng kiểm tra email để kích hoạt tài khoản.”.
       - Kích hoạt `PageTransitionOverlay` với nội dung phù hợp.
       - `router.push("/verify-account?email=" + encodeURIComponent(email))` sau ~1100ms.
     - Nếu lỗi (email đã tồn tại, server error):
       - Hiển thị toast lỗi theo message trả về.

---

## 5. Bước chi tiết – Backend đăng ký (`POST /api/auth/register`)

### 5.1. Vị trí đề xuất

- File route:
  - `src/app/api/auth/register/route.ts`.
- Có thể tạo thêm service:
  - `src/features/auth/auth-service.ts` (hoặc tương đương) để gom logic đăng ký.

### 5.2. Input & validation

- Request body (JSON):
  - `fullName: string`
  - `email: string`
  - `password: string`
- Các bước:
  1. Parse body JSON.
  2. Trim và prepare:
     - `fullNameTrimmed`, `emailTrimmed.toLowerCase()`, `passwordTrimmed`.
  3. Validate:
     - Các trường không rỗng.
     - Email đúng định dạng.
     - Mật khẩu ≥ 8 ký tự.
  4. Check user tồn tại:
     - `const existing = await prisma.user.findUnique({ where: { email: emailTrimmed } });`
     - Nếu đã tồn tại → trả 400 với message “Email đã được sử dụng.”.

### 5.3. Tạo user trong DB (trạng thái chưa kích hoạt)

- Hash mật khẩu:
  - Sử dụng `bcrypt` hoặc thư viện tương đương.
- Tạo user:
  - `await prisma.user.create({ data: { name: fullNameTrimmed, email: emailTrimmed, passwordHash, emailVerified: null, role: "USER" } });`
  - Ghi nhận:
    - `emailVerified: null` → **chưa kích hoạt**.

### 5.4. Tạo OTP kích hoạt & gửi email

1. **Tạo OTP**:
   - Gọi:
     - `const { code, expiresAt } = await createOtp({ email: emailTrimmed, userId: user.id, type: "ACCOUNT_ACTIVATION" });`
   - OTP sinh ra đã được hash trong DB, `code` là bản plaintext để gửi qua mail.
2. **Gửi email qua SendGrid**:
   - Sử dụng `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`.
   - Gọi API SendGrid với:
     - To: `emailTrimmed`.
     - Template: `SENDGRID_TEMPLATE_ACCOUNT_ACTIVATION`.
     - Dynamic template data:
       - `fullName`: `fullNameTrimmed`.
       - `otpCode`: `code`.
       - (Tuỳ chọn) `expiresMinutes`: 10.
3. **Response cho client**:
   - Trả 201 + JSON:
     - `{ email: emailTrimmed, fullName: fullNameTrimmed }`.
   - Không trả về mã OTP cho client.

---

## 6. Bước chi tiết – Frontend kích hoạt (`AuthVerifyAccountPage`)

### 6.1. Vị trí & trạng thái hiện tại

- File: `src/features/auth/components/AuthVerifyAccountPage.tsx`.
- Đã có:
  - UI OTP 8 ô.
  - Countdown TTL 10 phút (`OTP_TTL_MS`).
  - Resend button bị disable khi timer > 0.
  - `PageTransitionOverlay` cho trạng thái vào trang.
  - Obfuscate email qua query param `email`.
- Chưa có:
  - Gọi API verify OTP.
  - Gọi API resend OTP.
  - Kết nối với backend để set `emailVerified`.

### 6.2. Hành vi cần bổ sung

1. **Submit OTP**:
   - Gom `otpValues.join("")` thành `code`.
   - Gửi `POST /api/auth/verify-account` với `{ email, code }`.
   - Trong lúc gửi:
     - Set `isSubmitting = true`.
     - Disable input OTP + nút resend.
   - Xử lý response:
     - 200:
       - Hiển thị message thành công.
       - Kích hoạt `PageTransitionOverlay` với text chào mừng.
       - Sau ~1100ms, `router.push("/login")` hoặc `/`.
     - 4xx/429:
       - Hiển thị lỗi cụ thể theo message (sai OTP, hết hạn, quá số lần).
       - Nếu `EXPIRED` hoặc `TOO_MANY_ATTEMPTS` → có thể highlight rõ nút “Gửi lại mã mới”.
2. **Gửi lại OTP**:
   - Khi countdown hết hạn (`remainingMs === 0`) và user bấm “Gửi lại mã mới”:
     - Gọi `POST /api/auth/resend-activation-otp` với `{ email }`.
     - Backend:
       - Gọi lại `createOtp({ email, userId, type: "ACCOUNT_ACTIVATION" })`.
       - Gửi email OTP mới.
     - Frontend:
       - Reset `otpValues` về `["", "", ..., ""]`.
       - Reset `remainingMs` về `OTP_TTL_MS`.
       - Hiển thị banner:
         - “Chúng tôi vừa gửi một mã OTP mới đến {{email}}. Mã cũ sẽ không còn hiệu lực.”

---

## 7. Bước chi tiết – Backend verify OTP (`POST /api/auth/verify-account`)

### 7.1. Vị trí đề xuất

- File route:
  - `src/app/api/auth/verify-account/route.ts`.

### 7.2. Input & quy trình

- Request body:
  - `email: string`
  - `code: string` (8 ký tự).
- Các bước:
  1. Parse và trim `email`, `code`.
  2. Validate:
     - Không để trống.
     - `code` đủ 8 ký tự.
  3. Gọi `verifyOtp(email, "ACCOUNT_ACTIVATION", code)`.
  4. Xử lý kết quả:
     - Nếu `success: false`:
       - Map `reason` → status + message user-friendly.
     - Nếu `success: true`:
       - Tìm `User` theo email:
         - Nếu không tìm thấy:
           - Trả lỗi chung: “Có lỗi xảy ra với tài khoản của bạn. Vui lòng liên hệ đội ngũ hỗ trợ.”
       - Cập nhật `emailVerified`:
         - `await prisma.user.update({ where: { email }, data: { emailVerified: new Date() } });`
       - Trả 200 với `{ status: "activated" }`.

---

## 8. Checklist việc cần làm (implementation)

### 8.1. Backend

- **[ ]** Tạo route `POST /api/auth/register`:
  - Validate input.
  - Kiểm tra trùng email.
  - Hash mật khẩu.
  - Tạo `User` với `emailVerified = null`.
  - Gọi `createOtp` với `type: "ACCOUNT_ACTIVATION"`.
  - Gửi email OTP bằng SendGrid (`SENDGRID_TEMPLATE_ACCOUNT_ACTIVATION`).
- **[ ]** Tạo route `POST /api/auth/verify-account`:
  - Nhận `{ email, code }`.
  - Gọi `verifyOtp(email, "ACCOUNT_ACTIVATION", code)`.
  - Nếu thành công, set `emailVerified` cho user.
  - Trả về JSON cho frontend.
- **[ ]** Tạo route `POST /api/auth/resend-activation-otp`:
  - Nhận `{ email }`.
  - Gọi `createOtp` với `ACCOUNT_ACTIVATION`.
  - Gửi email OTP mới bằng SendGrid.
  - Trả message thành công.

### 8.2. Frontend

- **Đăng ký (`AuthRegisterPage`)**
  - **[ ]** Thêm state `isSubmitting`.
  - **[ ]** Thay `toast.success("Tạo tài khoản thành công (demo).")` bằng:
    - Gọi `POST /api/auth/register`.
    - Xử lý lỗi từ server.
    - Nếu thành công:
      - Gọi `PageTransitionOverlay`.
      - Redirect sang `/verify-account?email=...`.
- **Kích hoạt (`AuthVerifyAccountPage`)**
  - **[ ]** Thêm state `isSubmitting` + status message (error/success).
  - **[ ]** Implement submit OTP:
    - Gom 8 ô input → `code`.
    - Gọi `POST /api/auth/verify-account`.
    - Hiển thị lỗi/thành công theo response.
  - **[ ]** Implement “Gửi lại mã mới”:
    - Khi timer cho phép, gọi `POST /api/auth/resend-activation-otp`.
    - Reset input OTP + timer.
    - Hiển thị banner thông báo gửi lại thành công.
  - **[ ]** Sau khi kích hoạt:
    - Dùng `PageTransitionOverlay` để chuyển hướng về `/login` (hoặc `/`).

### 8.3. Email & bảo mật

- **[ ]** Tạo/kiểm tra template SendGrid `ACCOUNT_ACTIVATION`:
  - Nội dung rõ ràng, hướng dẫn cách dùng OTP.
  - Nhấn mạnh thời gian hiệu lực (10 phút).
  - Có thông tin liên hệ hỗ trợ.
- **[ ]** Đảm bảo:
  - Không log OTP plaintext trong log production.
  - Không trả OTP về client qua API.
  - Giới hạn số lần thử OTP (`maxAttempts` đã có trong `OtpCode`).

---

## 9. Ghi chú thiết kế & trải nghiệm

- **Trạng thái chưa kích hoạt**:
  - Dựa hoàn toàn vào `User.emailVerified === null`.
  - Không cần thêm cờ mới, tránh trùng lặp trạng thái.
- **Đồng bộ visual giữa đăng ký & kích hoạt**:
  - Dùng cùng phong cách thương hiệu, màu nền, gradient, và `PageTransitionOverlay`.
  - Người dùng cảm nhận đây là một flow liền mạch: Đăng ký → Kiểm tra email → Nhập OTP → Hoàn tất.
- **Fallback & edge-case**:
  - Nếu user mở `/verify-account` mà không có param `email`:
    - Hiển thị hướng dẫn quay lại `/register` hoặc flow khác.
  - Nếu user đã kích hoạt rồi mà nhập lại OTP:
    - Backend có thể trả thành công idempotent, hoặc thông báo “Tài khoản đã được kích hoạt, vui lòng đăng nhập.” và redirect sang `/login`.

