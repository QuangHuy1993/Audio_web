## Workflow: Email kích hoạt tài khoản & quên mật khẩu với Resend – Đức Uy Audio

Tài liệu này mô tả **chi tiết cách cấu hình và dùng Resend** cho hai luồng email quan trọng:

- **Kích hoạt tài khoản** (ACCOUNT_ACTIVATION) – gửi OTP kích hoạt sau khi đăng ký.
- **Quên mật khẩu / Đặt lại mật khẩu** (PASSWORD_RESET) – gửi OTP đặt lại mật khẩu.

Mục tiêu là **thay thế hoàn toàn SendGrid** bằng Resend, dùng **template khai báo bằng code** (React/HTML) để dễ quản lý trong repo.

---

## 1. Chuẩn bị trên Resend

### 1.1. Tạo API Key

1. Đăng nhập Resend.
2. Vào mục **API Keys**.
3. Tạo một key mới:
   - Tên gợi nhớ: `audio-ai-shop-backend`.
   - Quyền: cho phép gửi email (scope `emails.send` – Resend SDK mặc định dùng scope đầy đủ cho transactional).
4. Copy key dạng `re_************************` để cấu hình vào `.env`.

### 1.2. Xác thực domain gửi email

Bạn đã cấu hình domain `tiemtruyenmeobeo.me`, checklist:

- Đã thêm đầy đủ bản ghi DNS mà Resend yêu cầu (SPF, DKIM, v.v.).
- Trạng thái domain trong Resend: `Verified`.

**Địa chỉ gửi khuyến nghị**:

- `no-reply@tiemtruyenmeobeo.me`
- Tên hiển thị: `Duc Uy Audio`

---

## 2. Cấu hình môi trường (.env)

Trong file `.env` của dự án:

- **Xoá toàn bộ biến liên quan đến SendGrid**:

```env
# (Xoá các dòng này nếu còn)
# SENDGRID_API_KEY=...
# SENDGRID_FROM_EMAIL=...
# SENDGRID_FROM_NAME=...
# SENDGRID_TEMPLATE_ACCOUNT_ACTIVATION=...
# SENDGRID_TEMPLATE_PASSWORD_RESET=...
```

- Thêm biến môi trường cho Resend:

```env
# Resend API
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=no-reply@tiemtruyenmeobeo.me
RESEND_FROM_NAME=Duc Uy Audio
```

Lưu ý:

- `RESEND_API_KEY` **chỉ dùng server-side**, tuyệt đối **không dùng `NEXT_PUBLIC_`**.
- Sau khi sửa `.env`, cần **restart `npm run dev`** để Next/Node load lại env.

---

## 3. Cài đặt Resend SDK

Ở thư mục gốc dự án:

```bash
npm install resend
```

Resend SDK sẽ được dùng trong service backend (Next.js API route / server component), không chạy trên client.

---

## 4. Thiết kế service gửi email với Resend

### 4.1. Vị trí & trách nhiệm

- File service đề xuất: `src/services/email-resend-service.ts`.
- Trách nhiệm:
  - Khởi tạo client Resend với `RESEND_API_KEY`.
  - Định nghĩa các hàm gửi email domain-specific:
    - `sendAccountActivationEmail({ toEmail, fullName, otpCode, expiresMinutes })`.
    - `sendPasswordResetEmail({ toEmail, fullName, otpCode, expiresMinutes })`.
  - Ẩn toàn bộ chi tiết Resend khỏi phần còn lại của codebase (API route và service auth chỉ gọi hàm service).

### 4.2. Khởi tạo client Resend

Pseudo-code:

```ts
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  console.warn("[email-resend-service] Missing RESEND_API_KEY.");
}

const resend = new Resend(resendApiKey);
```

### 4.3. Template email bằng code (React/HTML)

Có hai hướng:

1. **React email component** (gợi ý, dễ tái sử dụng):
   - Tạo thư mục `src/emails/`.
   - Tạo component:
     - `AccountActivationEmail.tsx`.
     - `PasswordResetEmail.tsx`.
   - Dùng kèm `resend.emails.send({ react: <AccountActivationEmail ... /> })`.
2. **HTML string thuần**:
   - Xây dựng chuỗi HTML trong service (đơn giản hơn, ít phụ thuộc).

Để giữ workflow nhẹ, tài liệu giả định dùng **HTML string**, nhưng kiến trúc cho phép nâng cấp lên React email sau này.

Ví dụ hàm build HTML đơn giản cho **kích hoạt tài khoản**:

```ts
function buildActivationEmailHtml(params: {
  fullName: string;
  otpCode: string;
  expiresMinutes: number;
}) {
  const { fullName, otpCode, expiresMinutes } = params;

  return `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827;">
      <h2>Chào ${fullName || "bạn"},</h2>
      <p>Cảm ơn bạn đã đăng ký tài khoản tại <strong>Đức Uy Audio</strong>.</p>
      <p>Mã OTP kích hoạt tài khoản của bạn là:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">
        ${otpCode}
      </p>
      <p>Mã này có hiệu lực trong <strong>${expiresMinutes} phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
      <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
      <p>Trân trọng,<br />Đức Uy Audio</p>
    </div>
  `;
}
```

Tương tự, build HTML cho **đặt lại mật khẩu** với wording phù hợp.

### 4.4. Hàm gửi email kích hoạt tài khoản

Đề xuất chữ ký hàm:

```ts
type SendAccountActivationEmailParams = {
  toEmail: string;
  fullName: string;
  otpCode: string;
  expiresMinutes: number;
};

export async function sendAccountActivationEmail(
  params: SendAccountActivationEmailParams,
): Promise<void>;
```

Logic:

1. Kiểm tra cấu hình:
   - Nếu thiếu `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, log cảnh báo và **return sớm** (không throw để tránh vỡ flow đăng ký trong môi trường dev).
2. Build HTML:
   - Gọi `buildActivationEmailHtml(params)`.
3. Gửi email:

```ts
const { error } = await resend.emails.send({
  from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
  to: [params.toEmail],
  subject: "Kích hoạt tài khoản Đức Uy Audio",
  html,
});

if (error) {
  // Log chi tiết error.response.body nếu có, không log OTP hoặc secret.
}
```

### 4.5. Hàm gửi email quên mật khẩu

Tương tự, nhưng nội dung & tiêu đề thay đổi:

- Subject đề xuất: `"Đặt lại mật khẩu tài khoản Đức Uy Audio"`.
- Nội dung nói rõ:
  - Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu.
  - OTP / link chỉ dùng cho việc đặt lại mật khẩu.

Chữ ký hàm:

```ts
type SendPasswordResetEmailParams = {
  toEmail: string;
  fullName: string;
  otpCode: string;
  expiresMinutes: number;
};

export async function sendPasswordResetEmail(
  params: SendPasswordResetEmailParams,
): Promise<void>;
```

---

## 5. Tích hợp vào luồng kích hoạt tài khoản

Hiện tại, luồng đăng ký + kích hoạt đã dùng `otp-service` và service auth:

- `src/services/otp-service.ts` – sinh & verify OTP.
- `src/features/auth/auth-service.ts` – logic:
  - `registerUserAndSendActivationOtp`.
  - `verifyAccountOtpAndActivateUser`.
  - `resendActivationOtpAndSendEmail`.

### 5.1. Đổi sang dùng Resend trong `auth-service.ts`

Checklist thay đổi (implementation sau sẽ follow tài liệu này):

1. **Xoá import SendGrid cũ**:

```ts
// import { sendAccountActivationEmail } from "@/services/email-sendgrid-service";
```

2. **Thay bằng Resend service**:

```ts
import {
  sendAccountActivationEmail,
  sendPasswordResetEmail,
} from "@/services/email-resend-service";
```

3. Trong `registerUserAndSendActivationOtp`:
   - Sau khi `createOtp` trả về `{ code, expiresAt }`, gọi:

```ts
await sendAccountActivationEmail({
  toEmail: normalizedEmail,
  fullName,
  otpCode: code,
  expiresMinutes: Math.round(ttlMinutes),
});
```

4. Trong `resendActivationOtpAndSendEmail`:
   - Sau khi tạo OTP mới, gọi lại `sendAccountActivationEmail` với OTP mới.

> Lưu ý: nếu Resend/config gặp lỗi, service nên **log chi tiết** nhưng không throw sang client (tài khoản vẫn được tạo, OTP vẫn lưu DB). Client sẽ báo “hãy kiểm tra email”; nếu email không tới, user có thể dùng flow resend OTP sau khi login/đăng nhập lại.

---

## 6. Tích hợp vào luồng quên mật khẩu

Workflow quên mật khẩu (đang mô tả trong `workflowQuenMatKhau.md` / màn `AuthForgotPasswordPage`, `AuthResetPasswordPage`) sẽ dùng `OtpType.PASSWORD_RESET`.

### 6.1. API gửi OTP quên mật khẩu

Đề xuất endpoint:

- `POST /api/auth/forgot-password`:
  - Nhận `{ email }`.
  - Tạo OTP qua `createOtp({ email, type: "PASSWORD_RESET" })`.
  - Gọi `sendPasswordResetEmail({ toEmail, fullName, otpCode, expiresMinutes })`.

### 6.2. API xác minh OTP & đặt lại mật khẩu

- `POST /api/auth/reset-password`:
  - Nhận `{ email, code, newPassword }`.
  - Gọi `verifyOtp(email, "PASSWORD_RESET", code)`.
  - Nếu OK, hash & update `User.passwordHash`.

Resend chỉ tham gia ở **bước gửi OTP**, các bước verify/đổi mật khẩu vẫn dùng `otp-service` + Prisma như luồng kích hoạt tài khoản.

---

## 7. Checklist xoá SendGrid & chuyển sang Resend

1. **Env**:
   - [ ] Xoá toàn bộ `SENDGRID_*` khỏi `.env`.
   - [ ] Thêm `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`.
2. **Code**:
   - [ ] Xoá file `src/services/email-sendgrid-service.ts` hoặc đổi tên & refactor hoàn toàn sang Resend.
   - [ ] Tạo `src/services/email-resend-service.ts` theo thiết kế trên.
   - [ ] Cập nhật `src/features/auth/auth-service.ts`:
     - Dùng `sendAccountActivationEmail` (Resend) trong:
       - `registerUserAndSendActivationOtp`.
       - `resendActivationOtpAndSendEmail`.
   - [ ] Sau này, dùng `sendPasswordResetEmail` cho workflow quên mật khẩu.
3. **Test**:
   - [ ] Tạo tài khoản mới → kiểm tra:
     - `OtpCode` loại `ACCOUNT_ACTIVATION` được tạo.
     - Email kích hoạt từ `no-reply@tiemtruyenmeobeo.me` được gửi qua Resend.
   - [ ] Flow resend OTP kích hoạt:
     - OTP cũ được đánh dấu `consumedAt`.
     - OTP mới được tạo.
     - Email mới được gửi qua Resend.
   - [ ] Flow quên mật khẩu (sau khi implement):
     - Gửi email OTP `PASSWORD_RESET` thành công.
     - Đặt lại mật khẩu thành công sau khi nhập OTP đúng.

---

## 8. Ghi chú triển khai

- **Quota Resend**: Kiểm tra giới hạn free tier (số email/ngày); nếu gần chạm trần, nên log thống kê hoặc chuyển sang plan phù hợp.
- **Theo dõi lỗi**:
  - Với Resend, lỗi thường nằm ở domain chưa verify, from-email không hợp lệ, hoặc API key sai.
  - Luôn log `{ code, message, response.body }` (đã ẩn secret) để debug nhanh.
- **Bảo mật**:
  - Không log `otpCode` trong production.
  - Không expose `RESEND_API_KEY` ra client hoặc log.

