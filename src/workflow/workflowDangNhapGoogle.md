## Workflow: Đăng nhập bằng Google OAuth – Đức Uy Audio

Tài liệu này mô tả **toàn bộ luồng fullstack** cho tính năng đăng nhập bằng Google, bao gồm:

- Chuẩn bị Google Cloud Console và cấu hình biến môi trường.
- Cách NextAuth v4 + PrismaAdapter xử lý OAuth flow.
- Logic lưu dữ liệu người dùng (tên, ảnh, email, v.v.) vào DB.
- Kích hoạt tài khoản tự động (auto set `emailVerified`) qua Google.
- Xử lý xung đột email (user đã đăng ký bằng Credentials + cùng email đăng nhập Google).
- Tối ưu truy vấn DB trong quá trình xử lý Google callback.
- Thay đổi frontend để kết nối nút "Đăng nhập với Google" thực sự.

---

## 1. Bối cảnh và model liên quan

### 1.1. Schema Prisma hiện tại

**Model `User`** (`prisma/schema.prisma`):
```
id            String        @id @default(cuid())
name          String?
email         String?       @unique
emailVerified DateTime?     // null = chưa kích hoạt; DateTime = đã kích hoạt
image         String?       // URL ảnh đại diện Google sẽ được lưu vào đây
role          UserRole      @default(USER)
passwordHash  String?       // nullable vì user Google không có mật khẩu
accounts      Account[]
sessions      Session[]
```

**Model `Account`** (`prisma/schema.prisma`) – chuẩn NextAuth adapter:
```
id                 String
userId             String
type               String         // "oauth"
provider           String         // "google"
providerAccountId  String         // Google sub/id của user
refresh_token      String?
access_token       String?
expires_at         Int?
token_type         String?
scope              String?
id_token           String?
session_state      String?

@@unique([provider, providerAccountId])
@@index([userId])
```

**Mối quan hệ**:
- Một `User` có thể có nhiều `Account` (liên kết nhiều provider: Google, GitHub, v.v.).
- `Account.userId` → `User.id` (onDelete Cascade).
- `@@unique([provider, providerAccountId])` đảm bảo không tạo trùng bản ghi Google cho cùng một user.

### 1.2. Luồng dữ liệu Google OAuth → DB

Khi user đăng nhập Google lần đầu:

```
Google trả về profile:
  sub (providerAccountId): "1234567890"
  email: "user@gmail.com"
  name: "Nguyen Van A"
  picture: "https://lh3.googleusercontent.com/.../photo.jpg"
  email_verified: true
  access_token, id_token, expires_at, scope, token_type

PrismaAdapter.createUser() → INSERT vào bảng User:
  name    = profile.name        → "Nguyen Van A"
  email   = profile.email       → "user@gmail.com"
  image   = profile.image       → URL ảnh Google profile
  emailVerified = new Date()    → TU DONG KICH HOAT (Google email đã verified)
  role    = USER (default)
  passwordHash = null           → user OAuth không có mật khẩu

PrismaAdapter.linkAccount() → INSERT vào bảng Account:
  userId            = user.id (vừa tạo)
  type              = "oauth"
  provider          = "google"
  providerAccountId = profile.sub
  access_token      = token.access_token
  id_token          = token.id_token
  expires_at        = token.expires_at
  token_type        = token.token_type
  scope             = token.scope
```

---

## 2. Chuẩn bị Google Cloud Console

### Bước 1: Tạo hoặc chọn project

1. Truy cập: https://console.cloud.google.com/
2. Chọn project hiện có hoặc tạo mới:
   - Nhấn **Select a project** ở thanh trên → **New Project**.
   - Đặt tên, ví dụ: `duc-uy-audio`.
   - Nhấn **Create**.

### Bước 2: Kích hoạt Google OAuth API

1. Vào **APIs & Services** → **Library**.
2. Tìm kiếm `Google+ API` hoặc `Google Identity`.
3. Kích hoạt `Google+ API` (hoặc không cần vì NextAuth dùng OpenID Connect mặc định).
4. (Tùy chọn) Kích hoạt `People API` nếu muốn lấy thêm thông tin hồ sơ.

### Bước 3: Cấu hình OAuth Consent Screen

1. Vào **APIs & Services** → **OAuth consent screen**.
2. Chọn **External** (cho user ngoài tổ chức) → **Create**.
3. Điền thông tin:
   - **App name**: `Đức Uy Audio`
   - **User support email**: email admin của bạn.
   - **App logo**: logo thương hiệu (tùy chọn).
   - **App domain** → **Authorized domains**: thêm domain chính (ví dụ: `ducuyaudio.vn` khi production; để trống cho development).
   - **Developer contact information**: email của bạn.
4. Nhấn **Save and Continue**.
5. **Scopes**: nhấn **Add or Remove Scopes**, thêm:
   - `openid`
   - `email`
   - `profile`
   (Ba scope này NextAuth mặc định yêu cầu)
6. Nhấn **Save and Continue** → **Save and Continue** → **Back to Dashboard**.

> **Lưu ý (Testing mode)**: Ở trạng thái "Testing", chỉ các email được thêm vào **Test users** mới có thể đăng nhập. Khi deploy production, cần submit để Google review và chuyển sang **Published**.

### Bước 4: Tạo OAuth 2.0 Client ID

1. Vào **APIs & Services** → **Credentials**.
2. Nhấn **+ Create Credentials** → **OAuth client ID**.
3. **Application type**: chọn `Web application`.
4. **Name**: `Duc Uy Audio Web` (tên tùy chọn).
5. **Authorized JavaScript origins**:
   - Development: `http://localhost:3000`
   - Production: `https://ducuyaudio.vn` (thêm domain thực)
6. **Authorized redirect URIs** – đây là phần quan trọng nhất:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://ducuyaudio.vn/api/auth/callback/google`
   - Pattern chuẩn NextAuth: `{NEXTAUTH_URL}/api/auth/callback/{provider}`
7. Nhấn **Create**.
8. Sao chép **Client ID** và **Client Secret** vừa tạo.

> **Bảo mật**: Client Secret không được commit vào git, không được để trong code. Chỉ lưu trong file `.env` (đã có trong `.gitignore`).

---

## 3. Cấu hình biến môi trường

### 3.1. Thêm vào file `.env`

```env
# ===== GOOGLE OAUTH =====
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_client_secret_here
```

File `.env` hiện tại đã có `NEXTAUTH_URL` và `NEXTAUTH_SECRET` – hai biến này phải được set đúng:

```env
# NextAuth (đã có, kiểm tra lại)
NEXTAUTH_URL=http://localhost:3000          # development
# NEXTAUTH_URL=https://ducuyaudio.vn       # production (thay khi deploy)
NEXTAUTH_SECRET=your_random_secret_here    # openssl rand -base64 32
```

### 3.2. Khai báo type cho TypeScript (nếu cần)

Trong `next.config.ts`, không cần thêm gì. Nhưng nếu muốn IntelliSense đẹp hơn:

```typescript
// env.d.ts (nếu chưa có)
declare namespace NodeJS {
  interface ProcessEnv {
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    NEXTAUTH_URL: string;
    NEXTAUTH_SECRET: string;
  }
}
```

### 3.3. Kiểm tra khi deploy lên Vercel

Trên **Vercel Dashboard** → **Project Settings** → **Environment Variables**, thêm:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL` = `https://your-domain.vercel.app` (hoặc domain thực)
- `NEXTAUTH_SECRET`

Khi đã set trên Vercel, **không cần** `NEXTAUTH_URL` trên production với NextAuth v4.24+ vì nó tự detect. Nhưng tốt nhất vẫn nên set rõ ràng.

---

## 4. Cấu hình `src/lib/auth.ts` – Bổ sung signIn callback

### 4.1. Hiện trạng

File `src/lib/auth.ts` hiện đã có:
- `GoogleProvider` khai báo với `clientId` và `clientSecret` từ env.
- `PrismaAdapter` đã được mount.
- `jwt` callback đã truyền `id`, `role`, `emailVerified` vào token.

**Vấn đề còn thiếu**:
1. Không có `signIn` callback để xử lý xung đột email (user đã đăng ký bằng Credentials + cùng email Google).
2. `jwt` callback hiện tại chỉ set `role` khi `user` object có (lần sign-in đầu tiên). Nhưng với Google OAuth, `user` object từ PrismaAdapter không có `role` tường minh mà phải query từ DB.

### 4.2. Luồng JWT callback với Google OAuth

Với `strategy: "jwt"` và PrismaAdapter, khi user đăng nhập Google:

```
Lần sign-in đầu tiên (tạo user mới):
  jwt({ token, user, account, profile })
    user = object User vừa được PrismaAdapter lưu vào DB
    account = { provider: "google", type: "oauth", ... }
    profile = raw Google profile

Lần sign-in tiếp theo (đã có user):
  jwt({ token })
    user = undefined (chỉ có khi vừa sign-in)
    → Token đã có sẵn từ lần trước, không gọi DB thêm
```

**Vấn đề**: Khi `user` từ PrismaAdapter được trả về, `user.role` có thể không có vì Prisma adapter chỉ trả về các field trong NextAuth `User` type mặc định (`id`, `email`, `name`, `image`, `emailVerified`). Trường `role` là custom field.

**Giải pháp**: Bổ sung `signIn` callback để fetch `role` từ DB khi đăng nhập Google, sau đó truyền vào token.

### 4.3. Xử lý xung đột email

**Tình huống**: User A đăng ký bằng email/password với `user@gmail.com`. Sau đó, user A đăng nhập Google với account `user@gmail.com`.

**Hành vi mặc định của PrismaAdapter**:
- PrismaAdapter sẽ gọi `getUserByEmail("user@gmail.com")` trước.
- Nếu đã có User với email đó, nó sẽ **link Account mới** vào User hiện tại (gọi `linkAccount()`).
- Kết quả: User vẫn giữ nguyên `passwordHash`, đồng thời có thêm `Account` mới với `provider: "google"`.
- `emailVerified` sẽ được **update** thành `new Date()` (kích hoạt tài khoản nếu chưa kích hoạt).

**Tình huống cần phòng ngừa**: Một người khác cố tình đăng nhập Google bằng email của người khác. Đây là lý do tại sao Google chỉ trả về email đã được Google xác minh (`email_verified: true`) – nên đây không phải rủi ro lớn.

**Cấu hình `allowDangerousEmailAccountLinking`**: Mặc định NextAuth v4 với PrismaAdapter sẽ TỰ ĐỘNG link. Nếu muốn ngăn việc link, có thể dùng `signIn` callback để từ chối, nhưng với dự án này nên cho phép link để UX mượt mà.

---

## 5. Luồng end-to-end đầy đủ

### Lần đăng nhập Google đầu tiên (user mới hoàn toàn)

```
1. User nhấn "Đăng nhập với Google" trên trang /login
2. Frontend gọi: signIn("google", { callbackUrl: "/" })
3. NextAuth chuyển hướng tới Google OAuth URL:
   https://accounts.google.com/o/oauth2/auth?
     client_id=...&
     redirect_uri=http://localhost:3000/api/auth/callback/google&
     response_type=code&
     scope=openid email profile&
     state=...
4. User đồng ý cấp quyền trên trang Google.
5. Google redirect về: /api/auth/callback/google?code=...&state=...
6. NextAuth trao đổi `code` lấy `access_token` + `id_token` từ Google.
7. NextAuth decode `id_token` → lấy profile:
   { sub, email, name, picture, email_verified }
8. NextAuth gọi `signIn` callback (nếu có) → kiểm tra cho phép không.
9. PrismaAdapter.getUserByEmail("user@gmail.com"):
   → Không tìm thấy → tạo mới:
10. PrismaAdapter.createUser({
      email: "user@gmail.com",
      name: "Nguyen Van A",
      image: "https://lh3.googleusercontent.com/...",
      emailVerified: new Date()   // TỰ ĐỘNG KÍCH HOẠT
    })
    → INSERT INTO "User" ...
11. PrismaAdapter.linkAccount({
      userId: user.id,
      type: "oauth",
      provider: "google",
      providerAccountId: sub,
      access_token, id_token, expires_at, token_type, scope
    })
    → INSERT INTO "Account" ...
12. jwt({ token, user, account }) callback:
    → Fetch thêm role từ DB (vì PrismaAdapter không include custom fields)
    → SET token.id, token.role, token.emailVerified
13. session({ session, token }) callback:
    → SET session.user.id, session.user.role, session.user.emailVerified
14. NextAuth redirect tới callbackUrl ("/" hoặc URL được chỉ định)
```

### Lần đăng nhập Google tiếp theo (user đã có)

```
1. User nhấn "Đăng nhập với Google"
2-7. Giống lần đầu
8. PrismaAdapter.getUserByAccount({ provider: "google", providerAccountId: sub })
   → Tìm thấy Account → lấy User tương ứng
   → KHÔNG tạo User mới, KHÔNG tạo Account mới
9. jwt({ token, user }) callback:
   → user từ PrismaAdapter → fetch role từ DB
   → SET token.*
10. Redirect tới callbackUrl
```

### Đăng nhập Google với email đã có tài khoản Credentials

```
1-7. Giống lần đầu
8. PrismaAdapter.getUserByEmail("user@gmail.com"):
   → TÌM THẤY User hiện tại (đăng ký bằng email/password)
9. PrismaAdapter.getUserByAccount({ provider: "google", providerAccountId: sub })
   → KHÔNG tìm thấy Account Google cho user này
10. PrismaAdapter.linkAccount({...}) → INSERT Account Google mới gắn với User hiện tại
    (Tự động link 2 provider vào 1 user)
11. User.emailVerified được update = new Date() nếu chưa kích hoạt
    → TỰ ĐỘNG KÍCH HOẠT tài khoản vốn chưa verify bằng OTP
12. jwt → session → redirect
```

---

## 6. Thay đổi code cần thực hiện

### 6.1. Bổ sung `signIn` callback và sửa `jwt` callback trong `src/lib/auth.ts`

**Mục đích**:
- `signIn` callback: fetch và đính kèm `role` vào `user` object trước khi JWT được tạo, tránh query DB thêm lần nữa trong `jwt` callback.
- `jwt` callback: đảm bảo `role` luôn có, kể cả với Google OAuth user.

**Luồng tối ưu (1 query duy nhất lúc sign-in)**:

```typescript
// src/lib/auth.ts (phần callbacks bổ sung)

callbacks: {
  async signIn({ user, account }) {
    // Chỉ cần xử lý với OAuth (Google, v.v.)
    if (account?.type === "oauth" && user?.id) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, emailVerified: true },
        });
        if (dbUser) {
          // Đính kèm role và emailVerified vào user object
          // để jwt callback nhận được mà không cần query lại
          (user as { role?: string }).role = dbUser.role;
          (user as { emailVerified?: Date | null }).emailVerified =
            dbUser.emailVerified;
        }
      } catch (error) {
        console.error("[Auth][Google] signIn callback error", error);
      }
    }
    return true; // cho phép đăng nhập
  },

  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      token.role = (user as { role?: string }).role ?? "USER";
      token.email = user.email ?? undefined;
      token.name = user.name ?? undefined;
      token.picture = user.image ?? undefined;
      token.emailVerified =
        // @ts-expect-error: trường mở rộng từ Prisma adapter hoặc authorize()
        user.emailVerified ?? token.emailVerified ?? null;
    }
    return token;
  },

  async session({ session, token }) {
    if (session.user) {
      session.user.id = token.id ?? "";
      session.user.role = token.role ?? "USER";
      session.user.emailVerified = token.emailVerified ?? null;
    }
    return session;
  },
},
```

**Tại sao không dùng `session` strategy "database"?**

Dự án hiện dùng `strategy: "jwt"`. Với JWT, mỗi request chỉ verify chữ ký JWT, không cần query DB. Đây là trade-off hợp lý vì:
- Session DB strategy cần query DB mỗi request → chậm hơn.
- JWT strategy không cần, nhưng data trong token có thể stale (role, emailVerified).
- Với dự án này, `role` và `emailVerified` ít thay đổi nên JWT phù hợp.

### 6.2. Sửa `handleGoogleLogin` trong `src/features/auth/components/AuthLoginPage.tsx`

**Hiện tại** (dòng 167-169):
```typescript
const handleGoogleLogin = () => {
  toast.info("Đăng nhập với Google đang được phát triển.");
};
```

**Cần sửa thành**:
```typescript
const handleGoogleLogin = () => {
  signIn("google", {
    callbackUrl: callbackUrlFromQuery ?? "/",
  });
};
```

Lưu ý:
- `signIn("google", { callbackUrl })` sẽ trigger **full page redirect** (không phải `redirect: false`).
- Không cần `setIsSubmitting` vì browser sẽ điều hướng tới Google OAuth page ngay lập tức.
- Sau khi Google callback về, NextAuth tự xử lý redirect tới `callbackUrl`.

### 6.3. Xử lý redirect sau Google OAuth (page `/login`)

Sau khi Google callback thành công, NextAuth redirect về `callbackUrl`. Tuy nhiên, flow của trang `/login` hiện tại (kiểm tra `emailVerified`, điều hướng admin/user) chạy trong `handleSubmit` (cho Credentials). Google OAuth **bypass** hoàn toàn `handleSubmit`.

**Giải pháp**: Bổ sung xử lý trong `useEffect` kiểm tra session sau khi component mount:

```typescript
// Trong AuthLoginPage, useEffect đã có đoạn:
useEffect(() => {
  if (status === "loading" || hasInitialAuthCheckDoneRef.current) return;
  hasInitialAuthCheckDoneRef.current = true;
  if (status === "authenticated") {
    toast.info("Bạn đã đăng nhập rồi.");
    router.replace("/");
  }
}, [status, router]);
```

Đoạn này đã đủ để handle redirect. Khi Google callback về `/login?callbackUrl=...`, NextAuth sẽ tự redirect về `callbackUrl` được chỉ định. Không cần logic thêm trong `useEffect` của trang login.

**Quan trọng**: Với Google OAuth, `signIn("google", { callbackUrl: "/" })` thì sau khi xác thực xong, NextAuth sẽ tự redirect tới `/` mà không quay lại trang login. Trang login chỉ là điểm khởi đầu.

---

## 7. Tối ưu truy vấn DB trong Google OAuth flow

### 7.1. Các query xảy ra khi sign-in Google (PrismaAdapter mặc định)

Khi user **mới** đăng nhập Google lần đầu:
```sql
-- 1. Tìm user theo email
SELECT id, email, name, image, "emailVerified" FROM "User" WHERE email = $1;

-- 2. Tìm account theo provider
SELECT * FROM "Account"
WHERE provider = 'google' AND "providerAccountId" = $1;

-- 3. Tạo user mới
INSERT INTO "User" (id, name, email, image, "emailVerified") VALUES (...);

-- 4. Link account
INSERT INTO "Account" (id, "userId", type, provider, "providerAccountId", ...) VALUES (...);

-- 5. signIn callback: fetch role
SELECT role, "emailVerified" FROM "User" WHERE id = $1;
```

Khi user **đã tồn tại** đăng nhập Google lần tiếp:
```sql
-- 1. Tìm account theo provider (nhanh nhờ @@unique index)
SELECT "userId" FROM "Account"
WHERE provider = 'google' AND "providerAccountId" = $1;

-- 2. Lấy user theo id
SELECT id, email, name, image, "emailVerified" FROM "User" WHERE id = $1;

-- 3. signIn callback: fetch role
SELECT role, "emailVerified" FROM "User" WHERE id = $1;
```

### 7.2. Tối ưu: Gộp query 2 và 3

Thay vì để PrismaAdapter fetch User (không có `role`) rồi `signIn` callback fetch lại `role`, có thể **không fetch lại** trong `signIn` callback nếu dùng `events.signIn` kết hợp với cách lưu cache role vào token:

Tuy nhiên, với NextAuth v4 + JWT strategy, cách đơn giản và an toàn nhất vẫn là:
- `signIn` callback fetch thêm `role` **1 lần** khi sign-in.
- Sau đó, `jwt` callback lưu vào token.
- Các request tiếp theo chỉ đọc từ JWT, không query DB.

**Index đã có** phục vụ tốt cho các query này:
- `Account`: `@@unique([provider, providerAccountId])` → lookup theo provider cực nhanh (O(1) index).
- `Account`: `@@index([userId])` → reverse lookup nhanh.
- `User`: `email @unique` → lookup theo email cực nhanh.

### 7.3. Không query thừa trường nhạy cảm

Trong `signIn` callback, chỉ select những gì cần:
```typescript
await prisma.user.findUnique({
  where: { id: user.id },
  select: { role: true, emailVerified: true },
  // KHÔNG select: passwordHash, accounts, sessions, orders, ...
});
```

---

## 8. Mapping dữ liệu Google Profile → DB

### 8.1. Dữ liệu Google trả về (qua `id_token` / userinfo endpoint)

| Google field      | Ý nghĩa                              |
|-------------------|--------------------------------------|
| `sub`             | Google user ID duy nhất (providerAccountId) |
| `email`           | Địa chỉ email                        |
| `email_verified`  | Google đã xác minh email = true      |
| `name`            | Tên hiển thị đầy đủ                  |
| `given_name`      | Tên                                  |
| `family_name`     | Họ                                   |
| `picture`         | URL ảnh đại diện (HTTPS, public)     |
| `locale`          | Ngôn ngữ (vi, en, ...)               |
| `hd`              | Hosted domain (nếu Google Workspace) |

### 8.2. PrismaAdapter tự động map

| Google Profile  | Prisma `User` field | Ghi chú                              |
|-----------------|---------------------|--------------------------------------|
| `email`         | `email`             | Chuẩn hóa lowercase trước khi lưu   |
| `name`          | `name`              | Tên hiển thị Google                  |
| `picture`       | `image`             | URL ảnh Google profile               |
| `email_verified`| `emailVerified`     | Nếu `true` → `new Date()` (kích hoạt)|
| –               | `role`              | DEFAULT `USER` (không lấy từ Google) |
| –               | `passwordHash`      | `null` (không có mật khẩu)           |

### 8.3. URL ảnh Google (lưu ý quan trọng)

Google profile picture URL có dạng:
```
https://lh3.googleusercontent.com/a/ACg8ocJ..._s96-c
```

Tham số cuối (`_s96-c`) là kích thước 96px. Có thể thay bằng `_s200-c` để lấy ảnh 200px.

**Không cần lưu lại vào Cloudinary**: URL của Google là public, không expire (không giống OAuth access token). Tuy nhiên, nếu muốn kiểm soát ảnh người dùng trong Cloudinary, cần thêm step upload sau khi đăng nhập lần đầu – đây là tính năng nâng cao, chưa cần triển khai ngay.

---

## 9. Kích hoạt tài khoản tự động qua Google

### 9.1. Tại sao Google tự kích hoạt?

Trong hệ thống Đức Uy Audio:
- Tài khoản **chưa kích hoạt** = `emailVerified IS NULL`.
- Tài khoản **đã kích hoạt** = `emailVerified IS NOT NULL`.

Khi đăng nhập Google, Google đã xác minh email của user (`email_verified: true`). PrismaAdapter nhận thấy điều này và tự động set `emailVerified = new Date()` khi tạo hoặc update User.

**Kết quả**:
- User đăng nhập Google lần đầu → `emailVerified` tự động được set.
- User đăng ký bằng email/password nhưng chưa xác minh OTP → sau đó đăng nhập Google cùng email → `emailVerified` sẽ được set → **tài khoản tự động được kích hoạt**.

### 9.2. Không cần gửi OTP kích hoạt cho Google user

Flow OTP kích hoạt hiện tại chỉ áp dụng cho Credentials user. Cần đảm bảo:
- Trong `AuthLoginPage`, sau khi Google OAuth thành công, KHÔNG redirect sang `/verify-account`.
- Logic kiểm tra `emailVerified` trong `handleSubmit` chỉ chạy cho luồng Credentials (đã được đảm bảo vì Google OAuth không qua `handleSubmit`).

### 9.3. Cập nhật logic kiểm tra trong `AuthLoginPage`

Hiện tại trong `handleSubmit`, đoạn:
```typescript
if (!isAdmin && !isEmailVerified) {
  // redirect sang verify-account
}
```

Đây chỉ chạy sau `signIn("credentials", ...)`, không chạy sau Google OAuth. Không cần thay đổi gì.

---

## 10. Xử lý lỗi và edge cases

### 10.1. Lỗi phổ biến khi cấu hình sai

| Lỗi                                    | Nguyên nhân                                     | Giải pháp                                                    |
|----------------------------------------|-------------------------------------------------|--------------------------------------------------------------|
| `redirect_uri_mismatch`                | URI trong Google Console không khớp             | Thêm đúng `{NEXTAUTH_URL}/api/auth/callback/google`         |
| `invalid_client`                       | Client ID hoặc Secret sai                       | Copy lại từ Google Console                                   |
| `access_blocked: app not verified`     | App chưa publish, email không trong test list   | Thêm email vào Test users hoặc publish app                  |
| `OAuthAccountNotLinked`                | NextAuth không cho phép link tự động            | Xem section 4.3, PrismaAdapter nên tự xử lý được            |
| `NEXTAUTH_URL` mismatch                | Redirect về URL khác với cấu hình               | Đảm bảo `NEXTAUTH_URL` đúng với domain đang chạy            |
| User không có `role` trong session     | `signIn` callback không fetch role đúng cách    | Xem section 6.1                                              |

### 10.2. User cố tình đăng nhập Google với email người khác

Không thể xảy ra vì Google chỉ trả về email đã được Google xác minh (`email_verified: true`). User phải sở hữu Gmail account tương ứng.

### 10.3. User xóa quyền truy cập của app trên Google Account

- Khi user vào Google Account → Third-party apps → revoke quyền app.
- Lần đăng nhập tiếp theo: Google sẽ hiển thị lại màn hình xin quyền.
- Sau khi đồng ý, NextAuth sẽ update `Account.access_token` với token mới.
- **Không ảnh hưởng đến User và data của họ** trong DB.

### 10.4. User đổi ảnh đại diện Google

- `User.image` trong DB chứa URL ảnh tại thời điểm đăng nhập lần đầu.
- Khi user đăng nhập Google lần tiếp theo, PrismaAdapter **không tự update** `User.image`.
- Để giữ ảnh luôn mới nhất: bổ sung trong `signIn` callback:
  ```typescript
  if (account?.type === "oauth" && user?.id && user.image) {
    await prisma.user.update({
      where: { id: user.id },
      data: { image: user.image, name: user.name },
    });
  }
  ```
  Đây là tối ưu UX tùy chọn, chưa bắt buộc.

### 10.5. Tài khoản Google bị đình chỉ hoặc bị xóa

- NextAuth không tự kiểm tra trạng thái Google account.
- Nếu muốn kiểm tra, có thể dùng `events.signIn` để gọi Google API verify.
- Tuy nhiên, với quy mô dự án hiện tại không cần thiết.

---

## 11. Checklist triển khai

### Chuẩn bị (một lần)
- [ ] Tạo project trên Google Cloud Console.
- [ ] Cấu hình OAuth Consent Screen với các scope `openid`, `email`, `profile`.
- [ ] Tạo OAuth 2.0 Client ID với đúng Authorized redirect URIs.
- [ ] Thêm `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` vào file `.env`.
- [ ] Xác nhận `NEXTAUTH_URL` đúng với môi trường đang chạy.

### Code changes
- [ ] Bổ sung `signIn` callback trong `src/lib/auth.ts` để fetch `role` sau Google OAuth.
- [ ] Sửa `handleGoogleLogin` trong `AuthLoginPage.tsx` để gọi `signIn("google", { callbackUrl })`.
- [ ] (Tùy chọn) Bổ sung auto-update `name` và `image` từ Google trong `signIn` callback.

### Kiểm tra
- [ ] Đăng nhập Google với account mới → kiểm tra DB có bản ghi `User` và `Account` đúng.
- [ ] `User.emailVerified` được set (tài khoản kích hoạt ngay).
- [ ] `User.image` chứa URL ảnh Google profile.
- [ ] `User.role` = `USER` (không phải null hoặc undefined).
- [ ] Session phía client có `user.id`, `user.role`, `user.emailVerified`.
- [ ] Đăng nhập Google lần 2 với cùng account → không tạo User/Account mới.
- [ ] User có tài khoản Credentials + đăng nhập Google cùng email → Account được link, không tạo User mới.
- [ ] Kiểm tra Redirect URI mismatch không xảy ra.
- [ ] Chạy linter: `ReadLints` cho các file đã sửa.

---

## 12. Tóm tắt các file cần thay đổi

| File                                                               | Loại thay đổi      | Mô tả                                                         |
|--------------------------------------------------------------------|--------------------|---------------------------------------------------------------|
| `.env`                                                             | Cấu hình           | Thêm `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`               |
| `src/lib/auth.ts`                                                  | Bổ sung logic      | Thêm `signIn` callback để fetch `role` từ DB sau Google OAuth |
| `src/features/auth/components/AuthLoginPage.tsx`                   | Sửa handler        | `handleGoogleLogin` gọi `signIn("google", { callbackUrl })`   |

Không cần tạo file mới, không cần migration Prisma (schema đã sẵn sàng với `Account` model).

---

## 13. Tham khảo

- NextAuth v4 Google Provider: https://next-auth.js.org/providers/google
- NextAuth v4 PrismaAdapter: https://authjs.dev/reference/adapter/prisma
- Google OAuth 2.0 for Web: https://developers.google.com/identity/protocols/oauth2/web-server
- Google OAuth Consent Screen: https://support.google.com/cloud/answer/10311615
- NextAuth Callbacks: https://next-auth.js.org/configuration/callbacks
- NextAuth `signIn` callback: https://next-auth.js.org/configuration/callbacks#sign-in-callback
