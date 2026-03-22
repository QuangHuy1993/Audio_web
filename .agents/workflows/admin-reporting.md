# Workflow: Xây dựng Báo cáo thống kê cho Admin

Hướng dẫn các bước để triển khai tính năng báo cáo chuyên sâu, biểu đồ doanh thu và phân tích khách hàng.

## 1. Chuẩn bị thư viện
- Sử dụng **Recharts** để vẽ biểu đồ (nhẹ, hỗ trợ tốt cho React).
- Cài đặt: `npm install recharts`.

## 2. API Phát triển (Deep Analytics API)

### [NEW] API Thống kê chuyên sâu (`/api/admin/reports/stats`)
- **Doanh thu theo tháng**: Lấy dữ liệu 12 tháng gần nhất, chỉ tính các đơn hàng có trạng thái `COMPLETED` hoặc `PAID`. Đặc biệt chú trọng các đơn thanh toán qua `VNPAY` và `VIETQR`.
- **Sản phẩm bán chạy (Top Sellers)**: Group by `OrderItem` theo `productId`, tính tổng số lượng đã bán. Lấy Top 10.
- **Phân tích khách hàng**:
    - **Khách hàng mới**: Số lượng user đăng ký mới theo từng tháng.
    - **Khách hàng tiềm năng**: Những user có tổng chi tiêu cao nhất hoặc số lượng đơn hàng hoàn thành nhiều nhất.
- **Tối ưu hóa**: Sử dụng `Prisma.groupBy` và `aggregate` để xử lý dữ liệu ở tầng Database, tránh kéo toàn bộ record về server.

## 3. Giao diện (Admin Reports Page)

### [NEW] Trang Báo cáo (`src/features/admin/components/reports/AdminReportsPage.tsx`)
- **Bộ lọc thời gian**: Chọn khoảng thời gian (7 ngày, 30 ngày, 90 ngày, Năm nay).
- **Khu vực Biểu đồ**:
    - Biểu đồ đường (Line Chart) cho doanh thu từng tháng.
    - Biểu đồ cột (Bar Chart) so sánh khách hàng mới.
- **Danh sách Top**:
    - Bảng danh sách sản phẩm bán chạy nhất kèm hình ảnh và doanh thu từng loại.
    - Bảng danh sách "Khách hàng VIP" dựa trên tổng chi tiêu.

## 4. Các bước thực hiện
1. **Bước 1**: Cài đặt `recharts`.
2. **Bước 2**: Viết API `/api/admin/reports/stats` với các truy vấn tối ưu.
3. **Bước 3**: Tạo UI Components cho trang báo cáo.
4. **Bước 4**: Tích hợp các Chart vào UI.
5. **Bước 5**: Kiểm tra tính chính xác của dữ liệu so với Database thực tế.

// turbo
3. npx install recharts
