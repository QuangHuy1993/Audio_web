# Workflow: Tạo Sản Phẩm Mẫu Bằng AI (Demo Products)

## Mục tiêu

Cung cấp 2 cơ chế để tạo nhanh ~80–150 sản phẩm âm thanh thực tế vào database cho mục đích demo đồ án tốt nghiệp:

1. **Seed Script** (`prisma/seed-demo.ts`) — chạy 1 lần bằng CLI, tạo toàn bộ dữ liệu mẫu theo bộ brand/category định sẵn.
2. **Admin UI** (`Admin > AI > Tạo sản phẩm mẫu`) — giao diện trong admin panel, cho phép chọn brand, số lượng, theo dõi tiến độ real-time, phù hợp để demo trực tiếp trước hội đồng.

---

## Phần 1: Seed Script — `prisma/seed-demo.ts`

### 1.1. Mục đích

- Chạy offline một lần duy nhất: `npx ts-node -r tsconfig-paths/register prisma/seed-demo.ts`
- Tạo đủ ~80–100 sản phẩm phân bổ đều theo brand và category đang có trong DB.
- Không cần giao diện, không cần admin đăng nhập.
- Thích hợp cho môi trường dev/staging cần dữ liệu nhanh.

### 1.2. Luồng xử lý

```
1. Kết nối PrismaClient
2. Đọc tất cả Brand từ DB (id, name, slug, aiDescription, aiTags)
3. Đọc tất cả Category từ DB (id, name, slug)
4. Xây dựng danh sách PRODUCT_SPECS: mảng các bộ { brandName, categoryName, products[] }
   → brandName và categoryName phải khớp với tên trong DB (để gán brandId / categoryId)
5. Với mỗi spec trong PRODUCT_SPECS:
   a. Tìm brandId và categoryId tương ứng từ map đã đọc ở bước 2–3
   b. Gọi Groq với prompt sinh JSON cho N sản phẩm (tên, slug, mô tả, giá, aiDescription, aiTags, seoTitle, seoDescription)
   c. Parse JSON response
   d. Upsert từng sản phẩm vào DB bằng prisma.product.upsert({ where: { slug }, ... })
      → dùng upsert để script có thể chạy lại mà không tạo trùng
6. Log tiến độ console sau mỗi batch
7. Kết thúc: in tổng số sản phẩm đã tạo / cập nhật
```

### 1.3. Cấu trúc dữ liệu sản phẩm AI sinh ra (JSON schema yêu cầu)

Groq nhận prompt yêu cầu trả về JSON array, mỗi phần tử:

```json
{
  "name": "Tên đầy đủ sản phẩm (đúng model thực tế)",
  "slug": "ten-san-pham-slug-kebab-case",
  "description": "Mô tả kỹ thuật 150-250 từ tiếng Việt, chuyên nghiệp",
  "priceVnd": 15900000,
  "stockDemo": 5,
  "aiDescription": "Mô tả tư vấn AI 80-120 từ, highlight ưu điểm, không gian phù hợp",
  "aiTags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "seoTitle": "SEO title <70 ký tự",
  "seoDescription": "SEO meta description 150-160 ký tự"
}
```

### 1.4. Bộ sản phẩm mẫu định sẵn (PRODUCT_SPECS)

Gợi ý phân bổ (~90 sản phẩm), brand/category phải trùng với tên thực tế trong DB:

| Brand | Category | Số SP | Ví dụ model thực tế |
|---|---|---|---|
| Denon | Ampli | 4 | PMA-600NE, PMA-900HNE, PMA-1700NE, PMA-A110 |
| Denon | Đầu phát | 3 | DCD-900NE, DNP-2000NE, DNP-800NE |
| Marantz | Ampli | 4 | PM6007, PM7000N, MODEL 40n, PM-KI Ruby |
| Marantz | Đầu phát | 3 | CD6007, ND8006, SA-10 |
| Yamaha | Ampli | 4 | A-S301, A-S501, A-S701, A-S1200 |
| Yamaha | Loa | 3 | NS-B330, NS-BP301, NS-F700 |
| JBL | Loa | 4 | L52 Classic, L100 Classic, 4309, Stage A130 |
| KEF | Loa | 3 | Q350, Q550, LS50 Meta |
| Polk Audio | Loa | 4 | Reserve R100, Reserve R200, Signature Elite ES20, ES60 |
| Focal | Loa | 3 | Aria 906, Aria 926, Chora 806 |
| Cambridge Audio | Ampli | 3 | AXA35, CXA61, Evo 75 |
| Rega | Mâm đĩa than | 3 | Planar 1, Planar 2, Planar 3 |
| Sennheiser | Tai nghe | 4 | HD 400S, HD 560S, HD 650, HD 800S |
| AudioQuest | Dây cáp | 3 | Rocket 11, Rocket 33, Rocket 44 |
| Naim | Ampli | 3 | Nait 5si, SuperNait 3, Nait XS 3 |

> Lưu ý: Brand/Category tên phải khớp chính xác với dữ liệu trong bảng `Brand` và `Category` của DB. Script sẽ skip nếu không tìm thấy brand/category.

### 1.5. Prompt Groq cho seed script

```
Bạn là chuyên gia thiết bị âm thanh Hi-End. Hãy tạo danh sách {count} sản phẩm thực tế của thương hiệu {brandName} thuộc danh mục {categoryName}.

Yêu cầu:
- Tên sản phẩm phải là model thực tế đang/đã bán trên thị trường.
- Giá niêm yết VND phản ánh đúng phân khúc thị trường Việt Nam (2023-2024).
- Mô tả kỹ thuật chi tiết, chuyên nghiệp, tiếng Việt.
- AI description ngắn gọn (80-120 từ), dùng cho chatbot tư vấn.
- AI tags: 5-7 tags mô tả đặc tính, không gian dùng, phân khúc.
- SEO title và description chuẩn on-page SEO.

Trả về JSON array, không có text ngoài JSON:
[{ "name", "slug", "description", "priceVnd", "stockDemo", "aiDescription", "aiTags", "seoTitle", "seoDescription" }]
```

### 1.6. File cần tạo

```
prisma/seed-demo.ts          ← Script chính
```

### 1.7. Lưu ý kỹ thuật

- Dùng `callGroqJson` từ `src/lib/groq-json.ts` hoặc gọi thẳng `node-fetch` / `https` (vì script chạy ngoài Next.js)
- Vì script chạy với `ts-node`, cần có `tsconfig-paths/register` để resolve `@/lib/...`
- Hoặc đơn giản hơn: copy logic fetch Groq inline vào seed script (không phụ thuộc module alias)
- Giới hạn 1 giây delay giữa các batch Groq call để tránh rate limit
- `stockDemo` gán cứng 5 cho mỗi sản phẩm
- Ảnh: để trống (`ProductImage` không tạo), user tự thêm sau
- Nếu slug đã tồn tại → upsert cập nhật thông tin

---

## Phần 2: Admin UI — Trang "Tạo Sản Phẩm Mẫu AI"

### 2.1. Vị trí trong admin

- Route: `/admin/ai/demo-products`
- Hiển thị trong sub-nav của khu vực Admin > AI (cùng với Dashboard, Sessions, Settings...)
- Liên kết từ Admin > AI Dashboard (card hoặc quick link)

### 2.2. File cần tạo

```
src/app/admin/ai/demo-products/page.tsx
  └─ render <AdminAiDemoProductsPage />

src/features/admin/components/ai/AdminAiDemoProductsPage.tsx
src/features/admin/components/ai/AdminAiDemoProductsPage.module.css

src/app/api/admin/ai/demo-products/route.ts
  └─ POST: nhận brandIds[], categoryIds[], countPerCombo → sinh + lưu sản phẩm
  └─ GET: trả về danh sách brand và category hiện có
```

### 2.3. Luồng UX — Wizard 3 bước

#### Bước 1: Chọn nhãn hàng (Brand)

- Hiển thị danh sách checkbox tất cả Brand từ DB (fetch `GET /api/admin/brands?limit=100`)
- Mỗi brand hiện: logo (nếu có), tên, số sản phẩm hiện tại
- Nút "Chọn tất cả" / "Bỏ chọn tất cả"
- Validation: phải chọn ít nhất 1 brand

#### Bước 2: Chọn danh mục & cấu hình

- Hiển thị danh sách checkbox tất cả Category từ DB (fetch `GET /api/admin/categories`)
- Input số lượng sản phẩm mỗi bộ (brand × category): mặc định 3, range 1–8
- Checkbox "Bỏ qua nếu combo đã có sản phẩm" (skip nếu brand+category đó đã có SP trong DB)
- Checkbox "Gán status DRAFT" (tạo dưới dạng draft, admin duyệt trước khi publish)
- Validation: phải chọn ít nhất 1 category, số lượng 1–8

#### Bước 3: Xác nhận & Chạy

**Phần tóm tắt trước khi chạy:**
- Hiển thị bảng preview: brand × category = số combo, ước tính tổng SP sẽ tạo
- Ước tính thời gian (combo × ~3s Groq call)
- Nút "Bắt đầu tạo" + nút "Quay lại"

**Phần tiến độ khi đang chạy:**
- Thanh progress bar tổng thể (0→100%, đếm combo đã xong / tổng)
- Danh sách combo với trạng thái: `pending` / `processing` / `success (N SP)` / `error`
- Mỗi combo row: `[Brand] × [Category] → X sản phẩm`
- Nút "Dừng lại" (AbortController)
- Counter: "Đã tạo X / Y sản phẩm"

**Sau khi hoàn thành:**
- Summary card: tổng tạo thành công / lỗi / bỏ qua
- Nút "Xem danh sách sản phẩm" → `/admin/products`
- Nút "Tạo thêm" (reset về bước 1)

### 2.4. API Route: `POST /api/admin/ai/demo-products`

**Request body:**
```typescript
{
  brandIds: string[];        // ID brand đã chọn
  categoryIds: string[];     // ID category đã chọn
  countPerCombo: number;     // Số SP mỗi combo (1-8)
  skipExisting: boolean;     // Bỏ qua combo đã có SP
  statusDraft: boolean;      // true → DRAFT, false → ACTIVE
}
```

**Luồng server:**
```
1. Validate admin session (ADMIN role)
2. Validate input (brandIds, categoryIds không rỗng, countPerCombo 1-8)
3. Fetch brand records (name, aiDescription, aiTags) và category records
4. Build danh sách combo: brandIds × categoryIds
5. Nếu skipExisting: query COUNT products GROUP BY brandId+categoryId, lọc ra combo chưa có
6. Với mỗi combo:
   a. Build Groq prompt với brand context + category context + countPerCombo
   b. Gọi callGroqJson → nhận JSON array sản phẩm
   c. Parse và validate từng sản phẩm (name, slug, description, priceVnd bắt buộc)
   d. Upsert từng sản phẩm (slug unique → không tạo trùng)
   e. Delay 800ms giữa các combo (Groq rate limit)
7. Trả về { created: N, skipped: M, errors: [...] }
```

**Response:**
```typescript
{
  created: number;
  skipped: number;
  errors: Array<{ combo: string; message: string }>;
}
```

> Lưu ý: Endpoint này xử lý tuần tự trên server. Client chỉ gọi 1 request và chờ. Do đó không cần streaming.
> Tuy nhiên, để UX tốt hơn (progress bar real-time), cần thiết kế theo hướng **client-side orchestration** (client tự gọi từng combo, tương tự AdminAiBatchPage).

### 2.5. Chiến lược client-side orchestration (khuyến nghị)

Thay vì 1 request lớn chờ lâu, client điều phối từng combo:

```
API cần:
  POST /api/admin/ai/demo-products/generate
  Body: { brandId, brandName, categoryId, categoryName, count, status }
  Response: { products: GeneratedProduct[] }
  → AI sinh SP cho 1 combo

  POST /api/admin/products (JSON body, không cần file)
  → Đã có sẵn, tạo SP đơn
```

**Client flow:**
```
1. Build combo list: brandIds × categoryIds
2. Với mỗi combo (loop):
   a. Gọi POST /api/admin/ai/demo-products/generate
   b. Nhận mảng products
   c. Với mỗi product → gọi POST /api/admin/products (JSON)
   d. Cập nhật progress bar và result row
   e. Delay 500ms giữa Groq calls
3. Khi xong: hiện summary
```

Ưu điểm: progress bar thực sự realtime, có thể abort bất kỳ lúc nào, không bị timeout Vercel 10s.

### 2.6. API Route mới cần tạo

```
POST /api/admin/ai/demo-products/generate
  → Nhận 1 combo (brandId + categoryId + count)
  → Gọi Groq JSON để sinh mảng sản phẩm
  → Trả về { products: GeneratedProduct[] }
  → Không lưu DB (client tự lưu)
```

### 2.7. Prompt cho generate endpoint

```
Bạn là chuyên gia thiết bị âm thanh Hi-End. Tạo đúng {count} sản phẩm thực tế của thương hiệu "{brandName}" thuộc danh mục "{categoryName}" cho cửa hàng Đức Uy Audio tại Việt Nam.

Thông tin thương hiệu: {brandAiDescription}

Yêu cầu bắt buộc:
- Tên sản phẩm: model THỰC TẾ đang bán trên thị trường (không bịa).
- Slug: kebab-case từ tên, chỉ dùng chữ thường và dấu gạch ngang.
- Description: 150-200 từ tiếng Việt, mô tả kỹ thuật chuyên nghiệp, highlight thông số quan trọng.
- priceVnd: giá thực tế trên thị trường Việt Nam (đơn vị: VND, số nguyên).
- aiDescription: 80-100 từ, dùng cho chatbot tư vấn, nhấn mạnh không gian sử dụng phù hợp và điểm nổi bật.
- aiTags: mảng 5-7 string (không dấu, lowercase), ví dụ: ["ampli-integrated", "hi-fi", "phong-khach"].
- seoTitle: dưới 70 ký tự, bao gồm tên brand và model.
- seoDescription: 150-160 ký tự, chuẩn SEO.
- stock: 5 (cố định).

Trả về JSON array hợp lệ, không có text ngoài JSON:
[{"name","slug","description","priceVnd","stock","aiDescription","aiTags","seoTitle","seoDescription"}]
```

---

## Phần 3: Cập nhật Sub-nav Admin AI

Thêm link "Sản phẩm mẫu AI" vào sub-nav của khu vực Admin AI. Hiện tại sub-nav có các mục:
- Dashboard (`/admin/ai`)
- Phiên hội thoại (`/admin/ai/sessions`)
- Cài đặt AI (`/admin/ai/settings`)
- Nội dung AI (`/admin/ai/content`)
- Prompt system (`/admin/ai/prompts`)
- Sinh hàng loạt (`/admin/ai/batch`)

**Thêm mục mới:**
- Sản phẩm mẫu (`/admin/ai/demo-products`) ← thêm sau "Sinh hàng loạt"

---

## Phần 4: Kiến trúc Component

### 4.1. `AdminAiDemoProductsPage.tsx`

```
State:
  step: 0 | 1 | 2          ← Bước hiện tại
  brands: BrandOption[]     ← Danh sách brand từ DB
  categories: CategoryOption[]
  selectedBrandIds: Set<string>
  selectedCategoryIds: Set<string>
  countPerCombo: number     ← Default: 3
  skipExisting: boolean     ← Default: true
  statusDraft: boolean      ← Default: false

  // Step 3 progress
  combos: ComboItem[]       ← brand×category combos
  results: ComboResult[]    ← { combo, status, created, error }
  isRunning: boolean
  progress: number          ← 0-100
  totalCreated: number
  abortController: ref<AbortController>
```

### 4.2. Types

```typescript
type BrandOption = {
  id: string;
  name: string;
  logoUrl: string | null;
  productCount: number;
};

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

type ComboItem = {
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
};

type ComboResult = {
  combo: ComboItem;
  status: "pending" | "processing" | "success" | "error";
  createdCount: number;
  errorMessage?: string;
};

type GeneratedProduct = {
  name: string;
  slug: string;
  description: string;
  priceVnd: number;
  stock: number;
  aiDescription: string;
  aiTags: string[];
  seoTitle: string;
  seoDescription: string;
};
```

### 4.3. CSS Module (BEM block: `admin-ai-demo-products-page`)

- `admin-ai-demo-products-page__header`
- `admin-ai-demo-products-page__subnav` (tái dùng từ các page AI khác)
- `admin-ai-demo-products-page__stepper` — thanh bước 1/2/3
- `admin-ai-demo-products-page__step-content`
- `admin-ai-demo-products-page__brand-grid` — grid 3 cột checkbox brand
- `admin-ai-demo-products-page__brand-card` + `--selected`
- `admin-ai-demo-products-page__category-list`
- `admin-ai-demo-products-page__config-row` — row cấu hình (count, skip, draft)
- `admin-ai-demo-products-page__preview-table` — bảng preview combos
- `admin-ai-demo-products-page__progress-bar` — thanh progress tổng
- `admin-ai-demo-products-page__progress-fill`
- `admin-ai-demo-products-page__result-list` — danh sách combo result
- `admin-ai-demo-products-page__result-row` + `--pending` + `--processing` + `--success` + `--error`
- `admin-ai-demo-products-page__summary-card`
- `admin-ai-demo-products-page__actions` — row nút điều hướng

---

## Phần 5: Thứ tự triển khai (Implementation Plan)

### Phase A: Seed Script (độc lập, không cần UI)

- [ ] **A1** — Tạo `prisma/seed-demo.ts`:
  - Inline Groq fetch (không dùng module alias để tránh ts-node issue)
  - Định nghĩa PRODUCT_SPECS hardcode theo bảng mục 1.4
  - Loop qua từng spec → gọi Groq → upsert vào DB
  - Log progress chi tiết

### Phase B: API cho Admin UI

- [ ] **B1** — Tạo `GET /api/admin/brands/route.ts` thêm param `?withProductCount=true` trả về số SP mỗi brand (nếu chưa có)
- [ ] **B2** — Tạo `POST /api/admin/ai/demo-products/generate/route.ts`:
  - Nhận `{ brandId, categoryId, count, status }`
  - Gọi Groq → trả về `{ products: GeneratedProduct[] }`
  - Admin-only

### Phase C: Admin UI Component

- [ ] **C1** — Tạo `AdminAiDemoProductsPage.tsx` + CSS module
  - Step 0: Chọn brand (grid checkbox với brand card)
  - Step 1: Chọn category + config (countPerCombo, skipExisting, statusDraft)
  - Step 2: Preview + Run (progress bar, combo result list, abort)
- [ ] **C2** — Tạo `src/app/admin/ai/demo-products/page.tsx`
- [ ] **C3** — Cập nhật sub-nav trong tất cả các AdminAi*Page để thêm link "Sản phẩm mẫu"

### Phase D: Kiểm tra & Đánh bóng

- [ ] **D1** — Test seed script với 1 brand nhỏ (~5 SP) trên môi trường dev
- [ ] **D2** — Test Admin UI: chạy 2 brand × 2 category × 3 SP = 12 SP
- [ ] **D3** — Kiểm tra slug unique không bị lỗi khi chạy lại
- [ ] **D4** — Kiểm tra lint toàn bộ file mới

---

## Phần 6: Ràng buộc & Lưu ý

### Groq Rate Limit
- Model `llama-3.1-8b-instant`: 30 req/phút (free tier), ~6000 token/phút
- Seed script: delay 1000ms giữa các batch
- Admin UI: delay 800ms giữa các Groq call
- Ước tính: 10 brand × 5 category × 3 SP ≈ 50 combo ≈ ~2.5 phút

### Slug Unique
- AI sinh slug dạng kebab-case
- Nếu slug đã tồn tại → thêm suffix `-v2`, `-v3` bằng cách append ngẫu nhiên
- Hoặc dùng `upsert({ where: { slug }, update: {...}, create: {...} })`

### Ảnh sản phẩm
- Không sinh ảnh (tránh phụ thuộc image API)
- Sản phẩm tạo ra không có ảnh → Admin hoặc người dùng tự thêm sau
- Trong UI shop: hiển thị placeholder icon loa nếu không có ảnh

### Status mặc định
- Seed script: `ACTIVE` (hiển thị ngay trong shop)
- Admin UI: do user chọn (ACTIVE hoặc DRAFT)

### Tái chạy
- Cả seed script và Admin UI đều dùng `upsert` theo `slug` → chạy lại không tạo trùng
- Thay vào đó sẽ cập nhật nội dung (description, price, aiDescription...)

---

## Phần 7: Tham khảo các file hiện có

| File | Mục đích tham khảo |
|---|---|
| `src/features/admin/components/ai/AdminAiBatchPage.tsx` | Pattern wizard 3 bước, AbortController, progress loop |
| `src/app/api/admin/products/route.ts` | POST tạo sản phẩm JSON (không cần file) |
| `src/app/api/admin/products/ai/route.ts` | Gọi Groq sinh AI content từ name+brandId+categoryId |
| `src/lib/groq-json.ts` | Helper callGroqJson |
| `src/services/ai-product-seo-service.ts` | Prompt pattern sinh SEO/AI content |
| `src/features/admin/components/ai/AdminAiDashboardPage.tsx` | Sub-nav pattern, DataLoadingOverlay |
| `prisma/reset-admin-password.ts` | Pattern viết ts-node script với Prisma |
| `src/components/shared/DataLoadingOverlay.tsx` | Loading overlay khi fetch brand/category list |
