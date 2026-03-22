1. Mục tiêu chung cho mã giảm giá (Coupon)

- Thiết kế workflow **đơn giản nhưng mạnh**, phù hợp schema hiện tại trong `prisma/schema.prisma`:
  - `Coupon`: code, type (`PERCENTAGE` / `FIXED` / `FREE_SHIPPING`), `value`, `maxDiscount`, `minOrderAmount`, `usageLimit`, `usedCount`, `isActive`, `startsAt`, `endsAt`.
  - `Order`: liên kết với coupon qua `couponId`, `couponDiscount`.
- Đảm bảo:
  - Tra cứu mã **rất nhanh** (O(1) theo `code` nhờ unique index).
  - Kiểm tra điều kiện áp dụng, tính toán discount gọn, không cần join phức tạp.
  - Dễ mở rộng sau này (mã theo user, theo campaign, v.v.) mà không phá vỡ thiết kế.

---

2. Tóm tắt schema & index hiện tại

Trích lược từ `prisma/schema.prisma`:

- `enum CouponType`:
  - `PERCENTAGE` – giảm theo %.
  - `FIXED` – giảm số tiền cố định.
  - `FREE_SHIPPING` – miễn/giảm phí ship (tuỳ logic).
- `model Coupon`:
  - `code: String @unique` → **look-up theo mã nhanh**.
  - `type: CouponType`.
  - `value: Decimal?` – với `PERCENTAGE` là % (0–100), với `FIXED` là số tiền, với `FREE_SHIPPING` có thể là mức hỗ trợ tối đa (tuỳ design).
  - `maxDiscount: Decimal?` – trần số tiền giảm (dùng đặc biệt cho `PERCENTAGE`).
  - `minOrderAmount: Decimal?` – giá trị đơn tối thiểu để dùng.
  - `usageLimit: Int?` – tổng số lần được dùng (null = không giới hạn).
  - `usedCount: Int @default(0)` – số lần đã dùng.
  - `isActive: Boolean @default(true)` – bật/tắt nhanh.
  - `startsAt`, `endsAt`: khoảng thời gian hiệu lực.
  - Index: `@@index([isActive, startsAt, endsAt])` → tối ưu list các coupon đang hoạt động / sắp hết hạn.
- `model Order`:
  - `couponId: String?` – FK tới `Coupon`.
  - `couponDiscount: Decimal?` – số tiền đã giảm cho đơn (lưu “snap-shot” discount).

=> Về mặt DB, đã đủ để triển khai coupon theo đơn hàng đơn giản, **không cần thêm bảng** cho phiên bản đầu tiên.

---

3. Nguyên tắc thiết kế workflow mã giảm giá

- **Một nguồn sự thật (single source of truth) cho logic coupon**:
  - Toàn bộ validate + tính toán discount đặt trong **service layer** (ví dụ `src/services/coupon-service.ts`) để:
    - Tái sử dụng giữa API “áp dụng mã” và API “tạo đơn hàng / checkout”.
    - Đảm bảo **server luôn tự tính lại**, không tin vào số giảm giá từ client gửi lên.
- **Tra cứu theo `code` duy nhất**:
  - Khi user nhập mã, luôn normalize: `code = code.trim().toUpperCase()`.
  - Dùng `prisma.coupon.findUnique({ where: { code } })` → khai thác index unique.
- **Tính toán discount “stateless” trên input**:
  - Hàm tính toán chỉ nhận:
    - Subtotal (tổng tiền hàng, trước ship, trước coupon) – `orderSubtotal`.
    - `shippingFee` dự kiến (để xử lý `FREE_SHIPPING` nếu cần).
    - Đối tượng coupon từ DB.
  - Kết quả:
    - `discountAmount` (Decimal).
    - Cờ/flag cho `FREE_SHIPPING` nếu áp dụng.
- **Ghi nhận việc sử dụng coupon tại thời điểm hợp lý**:
  - **Validate / ước tính** (khi user nhập mã trong giỏ hàng):
    - Không động tới `usedCount`.
  - **Áp dụng thật** (khi đơn được xác nhận/thanh toán):
    - Tăng `usedCount`, ghi `couponId` + `couponDiscount` vào `Order` trong **một transaction**.
- **Hiệu năng**:
  - Tra cứu mã: 1 query `findUnique` rất nhẹ.
  - Check trạng thái hiệu lực dùng điều kiện trên trường có index:
    - `isActive = true`.
    - `startsAt <= now`, `endsAt == null || endsAt >= now`.
  - Không join thêm bảng → phù hợp yêu cầu “load ra tốc độ nhanh”.

---

4. Service đề xuất: `coupon-service.ts`

File gợi ý: `src/services/coupon-service.ts`.

4.1. Kiểu dữ liệu

- `CouponValidateInput` (cho cả admin & shop):
  - `code: string` – mã user nhập.
  - `orderSubtotal: number` – tổng trước ship, trước coupon (VND).
  - `shippingFee?: number` – ship dự kiến (dùng cho `FREE_SHIPPING` nếu muốn).
  - (Sau này có thể bổ sung: `userId`, `channel`, `campaignId`, ...).
- `CouponValidateResult`:
  - `isValid: boolean`.
  - `reason?: string` – nếu không hợp lệ, giải thích ngắn gọn.
  - `normalizedCode?: string` – mã chuẩn hoá (uppercase).
  - `couponId?: string`.
  - `type?: CouponType`.
  - `discountAmount?: number` – số tiền giảm.
  - `appliedShippingDiscount?: number` – số tiền giảm ship (nếu có).
  - `finalSubtotal?: number` – subtotal sau giảm (không gồm ship).

4.2. Hàm chính

- `normalizeCode(raw: string): string` → trim + uppercase.
- `getActiveCouponByCode(code: string, now: Date)`:
  - `findUnique` theo `code`.
  - Check:
    - `isActive`.
    - `startsAt == null || startsAt <= now`.
    - `endsAt == null || endsAt >= now`.
- `computeCouponDiscount(coupon, orderSubtotal, shippingFee?)`:
  - Nếu `coupon.minOrderAmount` > subtotal → không áp dụng.
  - Switch theo `coupon.type`:
    - `PERCENTAGE`:
      - `rawDiscount = subtotal * (value / 100)`.
      - Nếu có `maxDiscount` → `discount = min(rawDiscount, maxDiscount)`.
    - `FIXED`:
      - `discount = min(value, subtotal)` – không giảm quá subtotal.
    - `FREE_SHIPPING`:
      - Nếu có `shippingFee` > 0:
        - Nếu `value` null → `appliedShippingDiscount = shippingFee` (miễn hoàn toàn).
        - Nếu `value` > 0 → `appliedShippingDiscount = min(value, shippingFee)`.
      - `discountAmount` cho subtotal có thể = 0 (tuỳ design).
  - Tất cả kết quả chuẩn hoá về `number` cho phía service, phía DB vẫn dùng `Decimal`.
- `validateCoupon(input: CouponValidateInput): Promise<CouponValidateResult>`:
  1. Normalize code.
  2. Tìm coupon đang active.
  3. Check `usageLimit`:
     - Nếu `usageLimit != null && usedCount >= usageLimit` → invalid.
  4. Gọi `computeCouponDiscount`.
  5. Nếu `discountAmount === 0` và không có `appliedShippingDiscount` → invalid (tuỳ rule).
  6. Trả về object `CouponValidateResult` đầy đủ.

→ Mọi API phía dưới đều **chỉ** gọi service này, không tự tính lại.

---

5. API đề xuất

5.1. Admin – Quản lý coupon

Route gợi ý: `src/app/api/admin/coupons/route.ts`, `src/app/api/admin/coupons/[id]/route.ts`.

- `GET /api/admin/coupons`:
  - Query:
    - `page`, `pageSize` (phân trang).
    - `search` (theo code/description).
    - `status` (`all` | `active` | `scheduled` | `expired`).
    - `type` (`all` | `PERCENTAGE` | `FIXED` | `FREE_SHIPPING`).
  - `where` map từ các filter trên → khai thác index `@@index([isActive, startsAt, endsAt])` khi lọc theo trạng thái.
  - `select` tối thiểu các trường cần cho list: code, type, value, usageLimit, usedCount, isActive, thời gian hiệu lực.
- `POST /api/admin/coupons`:
  - Body:
    - `code`, `description?`, `type`, `value?`, `maxDiscount?`, `minOrderAmount?`, `usageLimit?`, `startsAt?`, `endsAt?`, `isActive?`.
  - Logic:
    - Normalize code (uppercase, bỏ khoảng trắng).
    - Validate theo type (ví dụ PERCENTAGE: 0 < value <= 100).
    - Check `endsAt > startsAt` nếu cả hai không null.
    - Create coupon.
- `PATCH /api/admin/coupons/[id]`:
  - Cho phép chỉnh sửa an toàn: mô tả, khoảng thời gian, limit, trạng thái bật/tắt.
  - Hạn chế sửa `code` ở bản đầu để tránh rối log; nếu cần, validate unique thật kỹ.
- `DELETE /api/admin/coupons/[id]`:
  - Tuỳ nhu cầu; thường production sẽ chỉ `isActive = false` thay vì xoá hẳn.

5.2. Shop – Kiểm tra / áp dụng mã trên giỏ hàng

Route gợi ý: `src/app/api/shop/coupons/validate/route.ts`.

- `POST /api/shop/coupons/validate`:
  - Body:
    - `code: string`.
    - `orderSubtotal: number` (tổng tiền hàng).
    - `shippingFee?: number`.
  - Flow:
    1. Gọi `validateCoupon` từ `coupon-service`.
    2. Trả về `CouponValidateResult` cho client.
  - Client (Next.js shop):
    - Dùng React Query để cache kết quả theo `code + subtotal` để tránh gọi liên tục.
    - Hiển thị message rõ ràng nếu mã không hợp lệ / hết lượt / không đủ điều kiện.

5.3. Luồng áp dụng thật khi tạo/confirm Order

- Khi tạo đơn hàng (Route sẽ làm sau, ví dụ `POST /api/shop/orders`):
  - Không trust `discountAmount` client gửi.
  - Server làm:
    1. Nhận `code` (nếu có), giỏ hàng / tổng tiền.
    2. Tự tính subtotal + shipping (dựa trên sản phẩm & phí ship thực tế).
    3. Gọi `validateCoupon`:
       - Nếu hợp lệ:
         - Set tạm `couponId`, `couponDiscount` cho đơn trước khi lưu (chưa tăng `usedCount` nếu đơn chỉ PENDING/UNPAID).
       - Nếu không:
         - Bỏ qua mã hoặc trả lỗi tuỳ flow UX.
    4. Lưu Order ở trạng thái `PENDING` cùng snapshot `couponDiscount`.
- Khi đơn được thanh toán thành công / chuyển sang `PAID`:
  - Trong transaction cùng logic thanh toán:
    1. Kiểm tra lại trạng thái coupon nếu cần (optional, tránh thay đổi quá bất ngờ).
    2. Tăng `usedCount` cho coupon tương ứng (nếu còn `usageLimit`).
       - Có thể dùng `updateMany` với điều kiện `usedCount < usageLimit` để tránh race condition; nếu `count === 0` → báo lỗi đã hết lượt.

---

6. Phân tích hiệu năng & index

- **Tra cứu mã giảm giá**:
  - `code` đã `@unique` → Prisma dùng index B-Tree, truy vấn `findUnique` rất nhanh ngay cả khi có nhiều coupon.
  - Không cần thêm index phụ cho tra cứu theo mã.
- **Lọc coupon hoạt động / sắp hết hạn** (admin list):
  - Index `@@index([isActive, startsAt, endsAt])`:
    - Phù hợp cho câu `where` kiểu:
      - `isActive = true AND startsAt <= now AND (endsAt IS NULL OR endsAt >= now)` (ACTIVE).
      - `isActive = true AND startsAt > now` (SCHEDULED).
      - `(isActive = false OR endsAt < now)` (EXPIRED) – vẫn hưởng lợi một phần từ index.
- **Cập nhật `usedCount`**:
  - Một trường Int đơn, update O(1).
  - Khi hệ thống lớn hơn, nếu lo contention có thể:
    - Hạn chế việc tăng `usedCount` chỉ khi đơn thật sự `PAID` (giảm số lần update).
    - Sử dụng queue/background job, nhưng giai đoạn hiện tại chưa cần.
- **API validate**:
  - Mỗi lần check mã = 1 query `findUnique` + chút logic CPU đơn giản.
  - Dùng HTTP caching ở client (React Query) và debounce input mã để tránh spam.

---

7. Hướng mở rộng sau này

- **Mã theo user / campaign**:
  - Có thể thêm bảng `UserCoupon` nếu cần gán coupon cho một nhóm user / 1 user.
  - Service hiện tại thiết kế khá stateless, dễ mở rộng bằng cách:
    - Thêm param `userId` vào `CouponValidateInput`.
    - Thêm bước check quyền dùng mã (theo campaign, theo nhóm user, v.v.).
- **Stack mã (nhiều coupon trên 1 đơn)**:
  - Thiết kế hiện tại của `Order` chỉ có 1 `couponId` + `couponDiscount` → đơn giản, dễ hiểu, phù hợp giai đoạn đầu.
  - Nếu cần nhiều mã, có thể chuyển sang bảng `OrderCoupon` trung gian về sau.
- **Reporting**:
  - Có thể thêm bảng log sử dụng coupon chi tiết, nhưng với `Order` + `Coupon` hiện tại đã đủ cho báo cáo cơ bản (join đơn–coupon qua `couponId`).

---

8. AI trợ lý tạo coupon (gợi ý code + rule)

Trong dự án đã có các service AI cho Brand/Product (`ai-brand-seo-service.ts`, `ai-product-seo-service.ts`) dùng Groq. Phần coupon sẽ dùng cùng pattern để admin **nhập ít, AI sinh nốt**.

8.1. Service AI: `src/services/ai-coupon-service.ts`

- Hàm chính: `generateCouponSuggestion(input: CouponAiInput): Promise<CouponAiOutput | null>`.
- Input (admin nhập rất ít, phần còn lại AI gợi ý):
  - `preferredType?`: loại giảm giá admin đã chọn trên form (`PERCENTAGE` | `FIXED` | `FREE_SHIPPING`). Nếu có thì AI bắt buộc sinh đúng loại này (kể cả khi user không nhập gì, chỉ chọn loại rồi bấm "AI gợi ý").
  - `campaignTitle?`: tiêu đề/ý tưởng (vd: “Sale cuối tuần loa soundbar”).
  - `goalDescription?`: mục tiêu (tăng đơn mới, đẩy hàng tồn…).
  - `discountPercent?`: nếu muốn giảm theo % (vd 10, 15, 20).
  - `discountFixedVnd?`: nếu muốn giảm số tiền cố định (vd 200000, 500000).
  - `freeShipping?`: admin tick nếu muốn freeship/bớt phí ship.
  - `minOrderAmountVnd?`, `maxDiscountVnd?`, `usageLimit?`: có thể để trống để AI đề xuất.
  - `preferredStartsAt?`, `preferredEndsAt?`, `validDays?`: nhập ngày kết thúc hoặc số ngày, AI tự suy ra khoảng thời gian.
- Output (map thẳng được vào model `Coupon` và form admin):
  - `code`: mã coupon chuẩn hoá (A–Z, 0–9, `-`, uppercase).
  - `description`: mô tả tiếng Việt 1–2 câu cho admin/trang checkout.
  - `type`: `"PERCENTAGE" | "FIXED | "FREE_SHIPPING"` (enum `CouponType`).
  - `value`: theo type (%, số tiền VND, hoặc mức hỗ trợ ship).
  - `maxDiscountVnd`, `minOrderAmountVnd`, `usageLimit`.
  - `suggestedStartsAt`, `suggestedEndsAt`: ISO string để UI bind vào date picker (admin vẫn chỉnh tay được).
- Bên trong:
  - Gọi `callGroqJson` giống các service AI khác, model `GROQ_MODEL_NAME` hoặc `llama-3.1-8b-instant`.
  - Prompt:
    - Giải thích ngữ cảnh Đức Uy Audio.
    - Nêu rõ yêu cầu về code, type, giá trị, điều kiện, thời gian.
    - Trả về **duy nhất JSON** với schema chặt chẽ.
  - Parse kết quả, ép kiểu an toàn:
    - Nếu admin gửi `preferredType` hợp lệ thì **luôn dùng** làm `type` đầu ra (bỏ qua type do AI trả về), đảm bảo loại không bị nhảy khi user đã chọn sẵn (vd FREE_SHIPPING).
    - Nếu không có preferredType: chỉ chấp nhận `type` trong tập enum; nếu AI trả về không hợp lệ thì suy từ input (vd có freeShipping → ưu tiên `FREE_SHIPPING`, có % → `PERCENTAGE`, có tiền → `FIXED`).
    - Convert số từ string/number, bỏ kết quả không hợp lệ.

8.2. UX gợi ý AI trong màn admin coupon

- Trong form tạo/sửa coupon (`AdminCouponUpsertPage`, routes `/admin/promotions/new`, `/admin/promotions/[id]/edit`; luôn gửi `preferredType` theo loại đang chọn):
  - Khu vực “AI gợi ý cấu hình”:
    - Input đơn giản:
      - Tiêu đề / mục tiêu (text).
      - `% giảm` hoặc số tiền giảm / tick freeship.
      - Số ngày áp dụng hoặc chọn ngày hết hạn.
    - Nút `AI gợi ý cấu hình`:
      - Gửi request tới API `POST /api/admin/coupons/ai` (route gợi ý).
      - API gọi `generateCouponSuggestion` và trả về JSON `CouponAiOutput`.
  - Khi nhận kết quả:
    - Tự động fill:
      - `code`, `description`.
      - `type`, `value`, `minOrderAmount`, `maxDiscount`, `usageLimit`.
      - Ngày bắt đầu/kết thúc (nếu có) vào date picker.
    - Admin vẫn chỉnh tay trước khi bấm lưu.

8.3. API gợi ý AI

- Route gợi ý: `src/app/api/admin/coupons/ai/route.ts`.
- `POST /api/admin/coupons/ai`:
  - Chỉ cho phép ADMIN.
  - Body = `CouponAiInput` (bao gồm `preferredType` nếu admin đã chọn loại trên form).
  - Gọi `generateCouponSuggestion`.
  - Nếu thiếu `GROQ_API_KEY` hoặc AI lỗi → trả 503/500 với message “Tính năng AI tạm thời không khả dụng”.

---

9. Trạng thái triển khai (đối chiếu với code hiện tại)

- **Schema & DB**: Đúng như mục 2. Model `Coupon` có đủ trường và index `@@index([isActive, startsAt, endsAt])`. `Order` có `couponId`, `couponDiscount`.
- **Service `coupon-service.ts`**: Đủ theo mục 4: `normalizeCode`, `getActiveCouponByCode`, `computeCouponDiscount`, `validateCoupon`; types `CouponValidateInput`, `CouponValidateResult`, `ComputeDiscountResult`. Logic PERCENTAGE / FIXED / FREE_SHIPPING và kiểm tra `usageLimit` đã có.
- **Admin API**:
  - `GET /api/admin/coupons`: có; query `page`, `pageSize`, `search`, `status`, `type`; `buildWhere` dùng index; select đủ trường list.
  - `POST /api/admin/coupons`: có; normalize code, validate type/value, endsAt > startsAt, create.
  - `GET /api/admin/coupons/[id]`: có; chi tiết một coupon.
  - `PATCH /api/admin/coupons/[id]`: có; cập nhật an toàn (description, type, value, thời gian, isActive, v.v.), có thể sửa code (validate unique).
  - `DELETE /api/admin/coupons/[id]`: có; soft delete (`isActive = false`).
- **Shop API**: `POST /api/shop/coupons/validate`: có; body `code`, `orderSubtotal`, `shippingFee`; gọi `validateCoupon`, trả `CouponValidateResult`.
- **Luồng tạo/confirm Order (mục 5.3)**: Chưa triển khai. Khi có `POST /api/shop/orders`: server cần tự gọi `validateCoupon`, gán `couponId`/`couponDiscount` cho đơn; khi đơn chuyển PAID thì trong transaction tăng `usedCount` (có thể dùng `updateMany` với điều kiện `usedCount < usageLimit` để tránh race).
- **AI**: `ai-coupon-service.ts` có `generateCouponSuggestion`, input có `preferredType`; prompt ép AI trả đúng type khi có preferredType; parse ưu tiên `enforcedType`. Route `POST /api/admin/coupons/ai` có, chỉ ADMIN, trả 503 khi thiếu key/lỗi.
- **Admin UI**: Trang list `AdminPromotionManagementPage` (route `/admin/promotions`), trang tạo/sửa `AdminCouponUpsertPage` (routes `/admin/promotions/new`, `/admin/promotions/[id]/edit`). Form có nút "AI gợi ý cấu hình", gửi `preferredType` (loại đang chọn). Có thể vẫn giữ `AdminCouponUpsertModal` cho popup nếu cần.

---

10. Tóm tắt ngắn

- **DB hiện tại đủ tốt** cho một hệ thống mã giảm giá đơn giản, hiệu năng cao:
  - Tra cứu nhanh theo `code` (unique index).
  - Lọc danh sách coupon hoạt động dựa trên `isActive`, thời gian hiệu lực (index 3 cột).
- Workflow đã triển khai:
  - Logic validate + compute discount trong `coupon-service.ts` (stateless).
  - API admin CRUD + list phân trang; API shop `POST /api/shop/coupons/validate`; API AI `POST /api/admin/coupons/ai` (có `preferredType`).
  - Admin UI: list + form full page (tạo/sửa) với "AI gợi ý cấu hình" gửi loại đã chọn.
- Còn làm sau:
  - Khi có API tạo/confirm đơn hàng: server re-validate coupon, gán `couponId`/`couponDiscount`; khi đơn PAID tăng `usedCount` trong transaction.

---

## 11. NOTE – Phần chưa làm: Áp mã khi đặt hàng & ghi nhận sử dụng

Phần dưới đây **chưa triển khai**. Khi làm tính năng “người dùng áp mã và đặt hàng”, cần làm đúng theo các bước sau để đảm bảo an toàn và khớp workflow.

### 11.1. Khi tạo đơn hàng (vd. `POST /api/shop/orders` hoặc tương đương)

- **Không tin** `discountAmount` (hay bất kỳ số tiền giảm nào) do client gửi lên. Server luôn tự tính lại.
- Input từ client chỉ nên có: `code` (mã giảm giá, nếu có), giỏ hàng / danh sách sản phẩm, địa chỉ giao hàng, v.v. **Không** dùng số tiền giảm do client tính.
- Trên server:
  1. Tính lại **subtotal** (tổng tiền hàng) và **shippingFee** (phí ship dự kiến) từ giỏ hàng và cấu hình.
  2. Nếu có `code`:
     - Gọi `validateCoupon({ code, orderSubtotal, shippingFee })` từ `@/services/coupon-service`.
     - Nếu `result.isValid === false`: trả lỗi rõ ràng (vd. “Mã không hợp lệ / hết hạn / hết lượt”) hoặc bỏ qua mã tùy UX.
     - Nếu `result.isValid === true`: dùng `result.couponId`, `result.discountAmount`, `result.appliedShippingDiscount` để set vào đơn. Tổng tiền đơn = subtotal − discountAmount − (appliedShippingDiscount nếu có) + (shippingFee − appliedShippingDiscount nếu FREE_SHIPPING) + … tùy logic hiện tại.
  3. Ghi đơn với:
     - `couponId` = `result.couponId` (nếu áp mã thành công),
     - `couponDiscount` = tổng số tiền giảm thực tế (từ result, **không** lấy từ client).
  4. Ở bước tạo đơn (PENDING/UNPAID): **chưa** tăng `usedCount` của coupon. Chỉ lưu snapshot discount vào Order.

### 11.2. Khi đơn chuyển sang trạng thái thanh toán thành công (PAID)

- Trong **cùng transaction** với việc cập nhật Order sang PAID (hoặc xử lý thanh toán):
  1. Nếu đơn có `couponId`:
     - Trong transaction: đọc coupon theo `couponId`, kiểm tra còn lượt (`usageLimit == null` hoặc `usedCount < usageLimit`). Nếu không còn lượt → rollback / trả lỗi (vd. "Mã đã hết lượt sử dụng").
     - Nếu còn lượt: cập nhật `usedCount: { increment: 1 }` (Prisma: `coupon.update({ where: { id: order.couponId }, data: { usedCount: { increment: 1 } } })`). Đặt toàn bộ (cập nhật Order + cập nhật Coupon) trong `prisma.$transaction([...])` để tránh race hai đơn cùng lúc dùng một mã gần hết lượt.
     - Nếu sau này dùng raw SQL có thể dùng `UPDATE coupon SET used_count = used_count + 1 WHERE id = ? AND (usage_limit IS NULL OR used_count < usage_limit)` rồi kiểm tra số dòng bị ảnh hưởng; nếu 0 thì rollback.
  2. Chỉ tăng **một lần** cho mỗi đơn (không tăng lại nếu webhook/retry gọi trùng; có thể check Order đã PAID trước khi tăng).

### 11.3. Tóm tắt checklist khi triển khai

- [ ] API tạo đơn: không nhận `discountAmount` từ client; nhận `code` (optional).
- [ ] API tạo đơn: tính subtotal + shippingFee, gọi `validateCoupon`, gán `couponId` + `couponDiscount` từ kết quả.
- [ ] Lúc tạo đơn: không tăng `usedCount`.
- [ ] Khi đơn chuyển PAID: trong transaction, nếu có `couponId` thì tăng `usedCount` (có điều kiện tránh vượt `usageLimit`), xử lý trường hợp hết lượt giữa chừng.
- [ ] Frontend shop: trang checkout/giỏ hàng gọi `POST /api/shop/coupons/validate` để hiển thị preview giảm giá; khi submit đặt hàng chỉ gửi `code`, không gửi số tiền giảm tự tính.

