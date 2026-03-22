# 🎧 Audio AI Shop – Website bán thiết bị âm thanh tích hợp AI

## 📌 Giới thiệu
**Audio AI Shop** là một website thương mại điện tử chuyên kinh doanh các **thiết bị âm thanh** như loa, tai nghe, micro, ampli,…  
Điểm nổi bật của hệ thống là **tích hợp trí tuệ nhân tạo (AI)** nhằm hỗ trợ tư vấn, gợi ý và so sánh sản phẩm, giúp người dùng dễ dàng lựa chọn thiết bị phù hợp với nhu cầu sử dụng.

Dự án được xây dựng với mục tiêu mô phỏng một hệ thống thương mại điện tử hiện đại, áp dụng các công nghệ web mới nhất và có khả năng mở rộng trong thực tế.

---

## 🎯 Mục tiêu của dự án
- Xây dựng website bán thiết bị âm thanh với giao diện hiện đại, thân thiện người dùng
- Tích hợp AI để:
  - Tư vấn sản phẩm theo nhu cầu
  - Gợi ý sản phẩm liên quan
  - So sánh các thiết bị âm thanh
- Áp dụng kiến trúc code rõ ràng, dễ bảo trì
- Đảm bảo hiệu năng, bảo mật và trải nghiệm người dùng

---

## 👥 Đối tượng sử dụng
- **Khách hàng**:  
  Xem sản phẩm, nhận tư vấn AI, đặt hàng và thanh toán
- **Quản trị viên (Admin)**:  
  Quản lý sản phẩm, đơn hàng, người dùng và nội dung hệ thống

---

## 🚀 Chức năng chính

### 🔹 Người dùng
- Đăng ký / đăng nhập tài khoản
- Xem danh sách và chi tiết sản phẩm
- Tìm kiếm, lọc sản phẩm theo danh mục
- Nhận tư vấn sản phẩm thông minh từ AI
- Thêm sản phẩm vào giỏ hàng
- Đặt hàng và thanh toán (mô phỏng)
- Nhận email xác nhận đơn hàng
- Đánh giá và nhận xét sản phẩm

---

### 🔹 AI tích hợp
- **AI tư vấn sản phẩm** theo ngân sách, không gian và mục đích sử dụng
- **AI gợi ý sản phẩm liên quan**
- **AI so sánh thiết bị âm thanh**
- **AI hỗ trợ tìm kiếm thông minh**

---

### 🔹 Quản trị viên
- Quản lý danh mục và sản phẩm
- Quản lý đơn hàng
- Quản lý người dùng và phân quyền
- Thống kê doanh thu và sản phẩm bán chạy
- Theo dõi hoạt động tư vấn AI

---

## 🛠️ Công nghệ sử dụng

### Frontend
- **NextJS 14 (App Router)**
- **React + TypeScript**
- **Framer Motion**
- **Skeleton Loading**

### Backend
- **NextJS API Routes**
- **Prisma ORM**

### Database
- **NeonDB (PostgreSQL)**

### AI
- **OpenAI API** (hoặc tương đương)

### Dịch vụ tích hợp
- **Auth.js (NextAuth)** – xác thực người dùng
- **Resend / SendEmail** – gửi email
- **Stripe** – thanh toán (demo)
- **Cloudinary** – lưu trữ hình ảnh

### Triển khai
- **Vercel**

---

## Cấu hình Cloudinary (lưu trữ ảnh)

Dự án dùng Cloudinary cho upload ảnh (logo thương hiệu, ảnh sản phẩm, v.v.) qua service `src/services/cloudinary-service.ts`. Khi cập nhật ảnh mới, ảnh cũ trên Cloudinary sẽ được xoá tự động.

### Bước 1: Tạo tài khoản và lấy thông tin

1. Đăng ký / đăng nhập tại [Cloudinary Console](https://console.cloudinary.com/).
2. **Cloud name:** Vào **Dashboard** (trang chủ) – Cloud name hiển thị ở đầu trang; hoặc **Settings** > **Product environments**. Đây là định danh môi trường (có thể là chuỗi mặc định do Cloudinary sinh, không phải tên "Key name" trong API Keys). Nếu bạn thấy lỗi 401 "Invalid cloud_name", hãy kiểm tra lại giá trị này.
3. **API Key và API Secret:** Vào **Settings** > **API Keys** để xem **API Key** và **API Secret** (có thể cần "Reveal" để xem secret).

### Bước 2: Thêm biến môi trường

Thêm vào file `.env` (ở thư mục gốc dự án) **một trong hai cách** sau:

**Cách 1 – Dùng một dòng `CLOUDINARY_URL` (khuyến nghị):**

```env
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

Thay `API_KEY`, `API_SECRET`, `CLOUD_NAME` bằng giá trị từ bước 1. Ví dụ:

```env
CLOUDINARY_URL=cloudinary://123456789012345:abcdefghijklmnopqrstuvwxyz@your-cloud-name
```

**Cách 2 – Dùng ba biến tách:**

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your_api_secret
```

Sau khi lưu `.env`, khởi động lại server (ví dụ `npm run dev`) để áp dụng.

### Giới hạn mặc định trong service

- **Định dạng ảnh:** JPEG, PNG, WebP, GIF.
- **Kích thước tối đa:** 5MB (có thể tùy chỉnh khi gọi `validateImageFile`).

Các bước tích hợp API upload vào form (ví dụ form thêm/sửa thương hiệu) sẽ xử lý lần lượt sau khi cấu hình xong.

---

## 📁 Cấu trúc thư mục chính

```text
src/
├── app/
│   ├── (auth)/
│   ├── (shop)/
│   ├── (admin)/
│   ├── api/
│   └── layout.tsx
│
├── components/
│   ├── ui/
│   ├── layout/
│   └── shared/
│
├── features/
│   ├── auth/
│   ├── product/
│   ├── cart/
│   ├── ai/
│   └── order/
│
├── services/
├── hooks/
├── utils/
├── types/
