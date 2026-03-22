1. Bức tranh tổng thể quản lý kho trong project hiện tại
Dữ liệu hiện có (từ schema.prisma):
Product
stock: Int – tồn kho hiện tại.
Quan hệ: inventoryLogs InventoryLog[].
InventoryLog
productId: String
change: Int – số lượng thay đổi (+ nhập, - xuất/giảm).
reason: String? – mô tả tự do.
source: String? – mã nguồn sự kiện (ORDER, ADMIN_ADJUST, v.v.).
referenceId: String? – id tham chiếu (id đơn hàng, id phiếu điều chỉnh…).
createdAt: DateTime.
Hiện tại đã làm:
Khi tạo sản phẩm mới (POST /api/admin/products):
Lưu Product.stock.
Nếu stock > 0 → tạo 1 dòng InventoryLog:
change = stock.
reason = "Khởi tạo tồn kho khi tạo sản phẩm mới".
source = "ADMIN_CREATE_PRODUCT".
referenceId = productId.
→ Kho đã có “dòng log xuất phát” đúng theo thiết kế.
2. Nguyên tắc thiết kế quản lý kho cho dự án
Để dễ mở rộng và dễ debug, nên giữ 2 nguyên tắc:
Nguồn dữ liệu hiện tại:
Product.stock là con số tồn kho đang dùng cho business (hiển thị, check đủ hàng hay không).
InventoryLog là lịch sử/audit để truy ngược và phân tích.
Luồng chuẩn:
Mọi thay đổi Product.stock đều phải đi kèm 1 InventoryLog với:
change = chênh lệch (delta).
source + referenceId mô tả bối cảnh.
Như vậy sau này bạn có thể:
Xem lịch sử nhập/xuất của từng sản phẩm.
Đối chiếu nhanh: stock hiện tại ≈ sum(change) (cho mục đích kiểm tra).
3. Các luồng nghiệp vụ kho nên có
3.1. Nhập kho (tăng tồn kho)
Use case: Admin nhập thêm X sản phẩm vào kho.
UI:
Từ Quản lý sản phẩm → Sản phẩm:
Mở trang chi tiết / sửa sản phẩm (AdminProductEditPage) sẽ có thêm nút “Nhập kho”.
Nút mở modal “Nhập kho”:
Field: Số lượng nhập (Int > 0).
Optional: Ghi chú (reason).
API đề xuất:
POST /api/admin/products/{id}/inventory/import
Body:
quantity: number (>0).
reason?: string.
Backend:
Validate quyền ADMIN.
Trong transaction:
UPDATE Product SET stock = stock + quantity.
Tạo InventoryLog:
change = +quantity.
reason = reason || "Nhập kho thủ công".
source = "ADMIN_STOCK_IMPORT".
referenceId = productId (hoặc id của “phiếu nhập” nếu sau này bạn có model riêng).
3.2. Xuất kho / Điều chỉnh giảm (manual)
Use case: Kiểm kê thấy sai lệch, phải điều chỉnh giảm tồn kho; hoặc admin quyết định loại bỏ 1 số sản phẩm lỗi.
UI:
Modal “Điều chỉnh tồn kho”:
Hai mode:
Giảm theo số lượng (nhập quantityToDecrease).
Set tồn kho tuyệt đối (nhập newStock → backend tự tính delta).
Lý do (bắt buộc ngắn gọn): “Hàng lỗi”, “Kiểm kê”, v.v.
API đề xuất:
POST /api/admin/products/{id}/inventory/adjust
Body cho 2 mode (chỉ một trong hai):
decreaseBy?: number (>0).
setTo?: number (>=0).
reason: string.
Backend:
Lấy currentStock.
Nếu decreaseBy:
delta = -decreaseBy (không cho xuống <0).
Nếu setTo:
delta = setTo - currentStock.
Nếu delta === 0 → không làm gì.
Transaction:
UPDATE Product SET stock = stock + delta (clamp >=0).
InventoryLog:
change = delta.
reason = reason.
source = "ADMIN_STOCK_ADJUST".
referenceId = productId.
3.3. Luồng gắn với đơn hàng (sau này)
Ngay trong schema đã có Order, OrderItem, CartItem. Khi bạn làm phần order:
Khi đơn hàng được xác nhận (PLACED/PAID):
Giảm stock theo từng OrderItem.
InventoryLog:
change = -quantity.
source = "ORDER_PLACED".
referenceId = orderId.
Khi đơn hàng bị huỷ (CANCELLED) sau khi đã trừ hàng:
Tăng stock lại.
InventoryLog:
change = +quantity.
source = "ORDER_CANCELLED".
referenceId = orderId.
Điều này giúp bảng log thể hiện luôn cả “xuất kho cho khách hàng”.
4. Thiết kế màn hình Quản lý kho (Admin)
Đề xuất luồng UI dựa trên style admin hiện tại:
4.1. Màn tổng quan kho: /admin/inventory (mới)
Component: AdminInventoryDashboardPage (VD: src/features/admin/components/inventory/AdminInventoryDashboardPage.tsx).
Mục tiêu:
Danh sách sản phẩm theo góc nhìn kho:
Tên sản phẩm.
Thương hiệu / danh mục.
stock.
Trạng thái:
Còn hàng / Sắp hết (stock <= 3) / Hết hàng (stock === 0).
Filter:
Tìm theo tên/slug.
Filter theo trạng thái stock:
Tất cả / Hết hàng / Sắp hết / Còn nhiều.
Metrics nhanh:
Tổng số sản phẩm.
Số sản phẩm hết hàng.
Số sản phẩm sắp hết.
API:
Có thể tái sử dụng GET /api/admin/products với thêm param:
stockStatus=out|low|ok (mở rộng sau).
Hoặc tạo route riêng GET /api/admin/inventory nếu muốn query tối ưu.
4.2. Lịch sử tồn kho theo sản phẩm
Vị trí UI:
Ngay trong AdminProductEditPage, thêm tab hoặc card “Lịch sử tồn kho”.
Hoặc route riêng: /admin/products/[id]/inventory.
Hiển thị:
Bảng thời gian (mới nhất lên trên):
Thời gian (createdAt).
change (màu xanh nếu >0, đỏ nếu <0).
stockAfter (có thể tính thêm nếu muốn).
source (map ra label: Đơn hàng, Admin nhập kho…).
reason.
referenceId (click để mở đơn hàng / phiếu điều chỉnh).
API mới:
GET /api/admin/products/{id}/inventory/logs?page=1&pageSize=20
Query InventoryLog by productId, order createdAt desc, phân trang.
5. Luồng thao tác thực tế (gắn với code hiện tại)
Giả sử bạn đã có:
List sản phẩm: AdminProductManagementPage.
Sửa sản phẩm: AdminProductEditPage.
Luồng kho gắn vào:
Admin xem danh sách sản phẩm:
Thấy cột Tồn kho và highlight những sp stock <= 3.
Có nút context menu “Nhập kho / Điều chỉnh kho” → dẫn vào trang chi tiết.
Admin vào chi tiết sản phẩm (AdminProductEditPage):
Bên card “Giá & tồn kho”:
Thêm 2 nút nhỏ:
“Nhập kho” (modal).
“Điều chỉnh tồn kho” (modal).
Bên dưới có card “Lịch sử tồn kho” (sau này):
Gọi GET /api/admin/products/{id}/inventory/logs.
Admin nhập kho:
Điền Số lượng nhập = 20, reason = "Nhập hàng đợt 10/2026".
Gửi POST /api/admin/products/{id}/inventory/import.
Backend:
stock += 20.
InventoryLog.change = +20, source = ADMIN_STOCK_IMPORT.
UI:
Cập nhật stock hiển thị.
Append dòng mới vào bảng log.
Admin điều chỉnh vì kiểm kê:
Tồn kho hiển thị 50, kiểm kê thực tế 47.
Dùng mode “Set tồn kho tuyệt đối”:
setTo = 47, reason = "Kiểm kê kho tháng 10".
Backend:
delta = 47 - 50 = -3.
stock += delta.
Log: change = -3, source = ADMIN_STOCK_ADJUST.
6. Tóm tắt ngắn
Hiện tại:
Tạo sản phẩm mới đã ghi log nhập kho ban đầu nếu stock > 0.
CRUD sản phẩm & ảnh & SEO/AI đã ổn.
Đề xuất luồng Quản lý kho:
Chuẩn hóa nguyên tắc Product.stock + InventoryLog.
Thêm API + UI cho:
Nhập kho (import).
Điều chỉnh tồn kho (adjust).
Lịch sử tồn kho theo sản phẩm.
Sau này, khi làm Order, gắn tiếp:
ORDER_PLACED / ORDER_CANCELLED → log xuất/nhập tương ứng.


============================================
1. API & service tồn kho
Mục tiêu: Chuẩn hoá một chỗ duy nhất để thay đổi stock + ghi InventoryLog.
B1 – Tạo service tồn kho:
File gợi ý: src/services/inventory-service.ts
Hàm chính:
adjustProductStock({ productId, delta, reason, source, referenceId })
Transaction:
Lấy currentStock.
Tính newStock = max(currentStock + delta, 0).
UPDATE Product.stock.
InventoryLog.create({ productId, change: delta, reason, source, referenceId }).
Trả về newStock.
B2 – API nhập kho:
Route: POST /api/admin/products/[id]/inventory/import
Body: { quantity: number; reason?: string }
Flow:
Check ADMIN.
Validate quantity > 0.
Gọi adjustProductStock với:
delta = +quantity
source = "ADMIN_STOCK_IMPORT"
reason = reason || "Nhập kho thủ công"
B3 – API điều chỉnh kho:
Route: POST /api/admin/products/[id]/inventory/adjust
Body: { decreaseBy?: number; setTo?: number; reason: string }
Flow:
Check ADMIN.
Lấy currentStock.
Nếu decreaseBy:
delta = -min(decreaseBy, currentStock).
Nếu setTo:
delta = max(setTo,0) - currentStock.
Nếu delta === 0 → trả về OK, không ghi log.
Gọi adjustProductStock với:
source = "ADMIN_STOCK_ADJUST".
2. UI quản lý kho trên từng sản phẩm
Mục tiêu: Từ AdminProductEditPage quản lý kho giống chuẩn UI sản phẩm.
B4 – Nút & modal “Nhập kho” ở AdminProductEditPage:
Vị trí: trong card Giá & tồn kho, cạnh input Tồn kho hiện tại.
UI:
Button nhỏ “Nhập kho”.
Modal:
Input Số lượng nhập (number, >0).
Textarea Ghi chú optional.
Nút “Xác nhận nhập kho”.
Loading/disable button giống pattern confirm dialog hiện tại.
Logic:
Gọi POST /api/admin/products/{id}/inventory/import.
Thành công:
Cập nhật state stock trong AdminProductEditPage = newStock trả về.
Toast success: “Đã nhập thêm X đơn vị vào kho”.
Đóng modal.
B5 – Nút & modal “Điều chỉnh tồn kho”:
Cạnh nút “Nhập kho”.
Modal:
Radio:
Giảm theo số lượng.
Set tồn kho tuyệt đối.
Input theo mode:
Số lượng giảm hoặc Tồn kho mới.
Textarea Lý do (bắt buộc).
Logic:
Map sang body phù hợp POST /inventory/adjust.
Cập nhật stock trong state.
Toast rõ ràng: “Đã điều chỉnh tồn kho từ A → B”.
B6 – Card “Lịch sử tồn kho” trong AdminProductEditPage:
Card mới bên dưới “Giá & tồn kho” (dùng cùng layout grid-second).
UI:
Bảng nhỏ:
Cột: Thời gian, Thay đổi, Nguồn, Lý do.
Thay đổi: màu xanh với +x, đỏ với -x.
Phân trang đơn giản (next/prev) nếu nhiều log.
Loading overlay trong card (sử dụng DataLoadingOverlay pattern local).
API:
GET /api/admin/products/{id}/inventory/logs?page=1&pageSize=20.
3. Màn tổng quan kho /admin/inventory
Mục tiêu: Một bảng tổng quan giống “Quản lý sản phẩm”, nhưng focus vào kho.
B7 – API list inventory:
Option 1: mở rộng GET /api/admin/products:
Query param stockStatus:
out → stock = 0
low → stock > 0 AND stock <= 3
ok → stock > 3
Option 2: route mới GET /api/admin/inventory (wrap lại product list).
Trường trả về: id, name, brandName, categoryName, stock, status, primaryImageUrl.
B8 – Page /admin/inventory:
Route: src/app/admin/inventory/page.tsx render AdminInventoryDashboardPage.
Component: src/features/admin/components/inventory/AdminInventoryDashboardPage.tsx.
UI (tái dùng pattern AdminProductManagementPage):
Header: “Quản lý kho hàng”.
Filter card:
Search theo tên/slug.
Select Trạng thái tồn: Tất cả / Hết hàng / Sắp hết / Còn nhiều.
Bảng:
Cột: Ảnh, Tên, Thương hiệu/Danh mục, Tồn kho, Trạng thái, Actions.
Actions:
“Xem chi tiết” → đi tới AdminProductEditPage (mang query page/search/status).
Metrics trên đầu:
Tổng sản phẩm.
Hết hàng.
Sắp hết.
4. Thứ tự triển khai đề xuất
Backend service + API tồn kho (B1–B3).
Modal “Nhập kho / Điều chỉnh” trong AdminProductEditPage (B4–B5).
Card “Lịch sử tồn kho” cho từng sản phẩm (B6).
Màn /admin/inventory (B7–B8).

---

## 7. Luồng kho gắn Order (đã chuẩn bị sẵn)

Khi triển khai phần đơn hàng, mọi thay đổi tồn kho theo order phải đi qua service tồn kho để ghi InventoryLog. Đã có sẵn trong `src/services/inventory-service.ts`:

### 7.1. Khi đơn hàng được xác nhận (trừ kho)

- **Điều kiện:** Đơn chuyển sang trạng thái đã thanh toán/xác nhận (ví dụ PAID, COMPLETED, SHIPPED tùy nghiệp vụ).
- **Hàm gọi:** `applyOrderStockDeduction(orderId: string)`.
- **Luồng:**
  1. Trong 1 transaction: lấy order + items.
  2. Kiểm tra từng sản phẩm: `product.stock >= item.quantity`. Nếu có bất kỳ sản phẩm nào thiếu hàng → throw `Error(ORDER_INVENTORY_ERROR.INSUFFICIENT_STOCK)`.
  3. Với từng OrderItem: gọi `adjustProductStockWithTx` với `delta = -item.quantity`, `source = "ORDER_PLACED"`, `referenceId = orderId`, `reason = "Đơn hàng #<orderNumber>"`.
  4. Trả về `{ orderId, orderNumber, deducted: [{ productId, quantity, newStock }] }`.
- **Tích hợp API Order (khi làm):**
  - Trong API xác nhận/thanh toán đơn (ví dụ `PATCH /api/admin/orders/[id]` hoặc `POST /api/orders/[id]/confirm`):
    1. Cập nhật `Order.status` (và payment nếu cần).
    2. Gọi `applyOrderStockDeduction(orderId)`.
    3. Nếu bước 2 throw `INSUFFICIENT_STOCK` → trả 409 và không đổi status (hoặc rollback status).
  - Hoặc gọi `applyOrderStockDeduction` trước khi đổi status; nếu thành công mới update order.

### 7.2. Khi đơn hàng bị huỷ (hoàn kho)

- **Điều kiện:** Đơn đã từng trừ kho (đã gọi `applyOrderStockDeduction` trước đó), nay bị huỷ (CANCELLED).
- **Hàm gọi:** `revertOrderStockDeduction(orderId: string)`.
- **Luồng:**
  1. Trong 1 transaction: lấy order + items.
  2. Với từng OrderItem: gọi `adjustProductStockWithTx` với `delta = +item.quantity`, `source = "ORDER_CANCELLED"`, `referenceId = orderId`, `reason = "Hoàn kho đơn hàng #<orderNumber> (đã huỷ)"`.
  3. Trả về `{ orderId, orderNumber, deducted }` (deducted ở đây là danh sách đã hoàn).
- **Tích hợp API Order (khi làm):**
  - Trong API huỷ đơn (ví dụ `PATCH /api/admin/orders/[id]` status = CANCELLED):
    1. Kiểm tra đơn đã trừ kho chưa (ví dụ status từng là PAID/COMPLETED).
    2. Nếu đã trừ kho → gọi `revertOrderStockDeduction(orderId)`.
    3. Cập nhật `Order.status = CANCELLED`.

### 7.3. Lỗi và hằng số

- `ORDER_INVENTORY_ERROR.ORDER_NOT_FOUND`: đơn không tồn tại.
- `ORDER_INVENTORY_ERROR.INSUFFICIENT_STOCK`: không đủ tồn kho cho ít nhất một sản phẩm trong đơn.
- Có thể mở rộng (ví dụ kiểm tra đơn chưa trừ kho trước khi gọi `applyOrderStockDeduction` tránh trừ hai lần; đánh dấu order đã trừ kho trong metadata nếu cần).

---

## 8. Tổng kết quản lý kho

### Đã hoàn thành

- **Nguyên tắc:** Mọi thay đổi `Product.stock` đều đi qua service và ghi `InventoryLog` (source + referenceId).
- **Tạo sản phẩm:** Nếu stock > 0 → 1 log `ADMIN_CREATE_PRODUCT`.
- **Nhập kho:** API import + modal Nhập kho (trang sửa sản phẩm + trang /admin/inventory). Idempotency theo referenceId, tránh double log.
- **Điều chỉnh/xuất kho:** API adjust (decreaseBy / setTo) + modal Điều chỉnh. Idempotency theo referenceId.
- **Sửa sản phẩm (PATCH):** Khi thay đổi trường stock → gọi `adjustProductStock` (delta = mới - cũ), ghi log `ADMIN_STOCK_ADJUST`, referenceId = productId.
- **Lịch sử theo sản phẩm:** GET logs theo productId, card trong AdminProductEditPage.
- **Màn /admin/inventory:** Danh sách sản phẩm (filter search, stockStatus), metrics, tab lịch sử nhập/xuất toàn hệ thống.
- **Order (chuẩn bị sẵn):** `applyOrderStockDeduction(orderId)` và `revertOrderStockDeduction(orderId)` trong inventory-service; khi làm Order chỉ cần gọi đúng lúc (xác nhận đơn / huỷ đơn).

### Còn lại (khi làm Order)

- Tạo API/UI đơn hàng (tạo, xem, cập nhật status).
- Tại thời điểm chuyển đơn sang “đã thanh toán/xác nhận”: gọi `applyOrderStockDeduction(orderId)` (và xử lý INSUFFICIENT_STOCK).
- Tại thời điểm huỷ đơn đã trừ kho: gọi `revertOrderStockDeduction(orderId)`.