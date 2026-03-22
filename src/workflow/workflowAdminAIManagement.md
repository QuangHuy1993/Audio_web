# Workflow: Quản lý AI – Admin Panel (Audio AI Shop)

## Mục lục

1. [Tổng quan & Mục tiêu](#1-tổng-quan--mục-tiêu)
2. [Phân tích hiện trạng](#2-phân-tích-hiện-trạng)
3. [Kiến trúc module Admin AI](#3-kiến-trúc-module-admin-ai)
4. [Tính năng 1 – Dashboard AI](#4-tính-năng-1--dashboard-ai)
5. [Tính năng 2 – Lịch sử phiên tư vấn AI (AiSession log)](#5-tính-năng-2--lịch-sử-phiên-tư-vấn-ai-aisession-log)
6. [Tính năng 3 – Cài đặt & cấu hình AI](#6-tính-năng-3--cài-đặt--cấu-hình-ai)
7. [Tính năng 4 – Quản lý nội dung AI trên sản phẩm](#7-tính-năng-4--quản-lý-nội-dung-ai-trên-sản-phẩm)
8. [Tính năng 5 – Sinh AI hàng loạt (Batch Generate)](#8-tính-năng-5--sinh-ai-hàng-loạt-batch-generate)
9. [Tính năng 6 – Prompt Management (Quản lý system prompt)](#9-tính-năng-6--prompt-management-quản-lý-system-prompt)
10. [Tính năng 7 – AI Quality Review (Kiểm duyệt nội dung AI)](#10-tính-năng-7--ai-quality-review-kiểm-duyệt-nội-dung-ai)
11. [API Routes cần tạo mới](#11-api-routes-cần-tạo-mới)
12. [Prisma schema bổ sung](#12-prisma-schema-bổ-sung)
13. [File & thư mục cần tạo](#13-file--thư-mục-cần-tạo)
14. [Test cases](#14-test-cases)

---

## 1. Tổng quan & Mục tiêu

### Bối cảnh

Audio AI Shop đang tích hợp Groq API (model `llama-3.1-8b-instant`) cho:
- Chatbot tư vấn sản phẩm phía khách hàng (`/api/shop/ai/product-advice`)
- Gợi ý setup theo nhu cầu (`/api/shop/ai/recommend`)
- Sinh nội dung SEO/AI cho Product, Brand, Category, Coupon từ Admin

Toàn bộ phiên AI được ghi vào bảng `AiSession` với 4 kiểu: `ADVICE`, `RECOMMENDATION`, `COMPARISON`, `SEARCH`.

**Vấn đề hiện tại:**
- Admin không có UI để xem bất kỳ log AI nào
- Không có analytics AI (bao nhiêu tư vấn/ngày, chủ đề nào phổ biến, tỉ lệ có suggested products, v.v.)
- Không có cách cấu hình AI (model, nhiệt độ, max tokens) từ UI – phải sửa code
- Các trường `aiDescription`, `aiTags`, `seoTitle`, `seoDescription` trên Product/Brand/Category không có trang quản lý tổng hợp riêng
- Chưa có cơ chế kiểm duyệt hoặc chỉnh sửa lại nội dung AI đã sinh
- Chưa có system prompt management – prompt hard-code trong `product-advice/route.ts`

### Mục tiêu module Admin AI

1. **Quan sát (Observe)**: Xem toàn bộ hoạt động AI, thống kê usage, chất lượng tư vấn.
2. **Kiểm soát (Control)**: Cấu hình model, tham số, bật/tắt tính năng AI.
3. **Nội dung (Content)**: Quản lý, chỉnh sửa, sinh hàng loạt nội dung AI trên catalog sản phẩm.
4. **Prompt (Prompt)**: Quản lý và thử nghiệm system prompt trực tiếp từ UI.
5. **Kiểm duyệt (Review)**: Đánh dấu, chỉnh sửa lại các phiên hoặc nội dung AI kém chất lượng.

---

## 2. Phân tích hiện trạng

### 2.1. Đã có (hiện tại)

| Thành phần | Vị trí | Ghi chú |
|---|---|---|
| Groq helper (text) | `src/lib/groq-chat.ts` | Multi-turn, abort signal, timeout |
| Groq helper (JSON) | `src/lib/groq-json.ts` | Single-turn, parse JSON |
| Log AiSession | `src/services/ai-session-service.ts` | Fire-and-forget, cắt 5000 chars |
| AI sinh SEO Product | `src/services/ai-product-seo-service.ts` | 1 lần gọi LLM |
| AI sinh SEO Brand | `src/services/ai-brand-seo-service.ts` | 2 lần gọi LLM |
| AI sinh SEO Category | `src/services/ai-category-seo-service.ts` | 2 lần gọi LLM |
| AI gợi ý coupon | `src/services/ai-coupon-service.ts` | 1 lần gọi LLM |
| API chatbot tư vấn | `POST /api/shop/ai/product-advice` | 2 chế độ (product/general) |
| API gợi ý setup | `POST /api/shop/ai/recommend` | Trả JSON structured |
| Model AiSession | `prisma/schema.prisma` | ADVICE/RECOMMENDATION/COMPARISON/SEARCH |
| AdminSetting | `prisma/schema.prisma` | key-value, category general/payment |

### 2.2. Chưa có (vùng trắng)

| Thiếu | Ảnh hưởng |
|---|---|
| Trang `/admin/ai` (landing) | Admin không biết AI đang hoạt động thế nào |
| Dashboard widget AI | Không nhìn được bức tranh tổng thể |
| Bảng log AiSession | Không debug được lỗi hay phàn nàn của user |
| Filter/search log | Không phân tích được theo type/thời gian/user |
| Analytics chart AI | Không đo lường ROI của AI |
| AI Config UI | Không linh hoạt thay model/tham số |
| Prompt UI | Khó A/B test prompt, phải deploy lại code |
| Batch generate content | Tốn thời gian sinh AI từng sản phẩm một |
| Content review table | Không biết sản phẩm nào chưa có AI content |
| Quality flag | Không đánh dấu được câu trả lời AI kém |
| `/recommend` không log | Mất dữ liệu RECOMMENDATION |
| COMPARISON/SEARCH types | Enum tồn tại nhưng chưa được dùng |

---

## 3. Kiến trúc module Admin AI

### 3.1. Sidebar entry (bổ sung vào AdminLayoutClient.tsx)

```
Admin Sidebar
├── Dashboard
├── Đơn hàng
├── Sản phẩm
├── ...
└── [MỚI] Quản lý AI               ← /admin/ai
    ├── Tổng quan AI                ← /admin/ai (tab hoặc section)
    ├── Lịch sử tư vấn              ← /admin/ai/sessions
    ├── Cấu hình AI                 ← /admin/ai/settings
    ├── Nội dung AI (Catalog)       ← /admin/ai/content
    ├── Sinh hàng loạt              ← /admin/ai/batch
    └── Quản lý Prompt              ← /admin/ai/prompts
```

### 3.2. Luồng dữ liệu tổng thể

```
AiSession (DB)
    ↑ write
ai-session-service.ts  ←  product-advice route  ←  AiChatPanel (shop)
                       ←  recommend route        ←  HomePage AI form
                       ←  (COMPARISON)           ←  (future)
                       ←  (SEARCH)               ←  (future)

AiSession (DB)
    ↓ read
GET /api/admin/ai/sessions    →   AdminAiSessionListPage  (log viewer)
GET /api/admin/ai/stats       →   AdminAiDashboard        (charts)

AdminSetting (DB)
    ← write:  POST /api/admin/ai/config
    → read:   GET  /api/admin/ai/config   →  AdminAiSettingsPage

AiPrompt (DB, mới)
    ← write:  POST/PUT /api/admin/ai/prompts
    → read:   GET /api/admin/ai/prompts
    → read:   product-advice route  (thay hardcode prompt)
```

---

## 4. Tính năng 1 – Dashboard AI

### 4.1. Mô tả

Trang landing `/admin/ai` – màn hình tổng quan nhanh về hoạt động AI trong ngày/tuần/tháng. Tương tự `/admin/dashboard` nhưng tập trung hoàn toàn vào AI metrics.

### 4.2. Stat cards (hàng trên cùng)

| Card | Giá trị | So sánh |
|---|---|---|
| Tổng phiên AI hôm nay | count AiSession WHERE DATE(createdAt) = today | vs. hôm qua |
| Tổng phiên AI tháng này | count AiSession WHERE tháng hiện tại | vs. tháng trước |
| Tỉ lệ có Suggested Products | count(metadata.suggestedProductsCount > 0) / total | Phần trăm |
| Thời gian phản hồi trung bình | avg(metadata.latencyMs) hôm nay | ms |

### 4.3. Biểu đồ

**Biểu đồ 1: Số phiên AI theo 7 ngày gần nhất (BarChart)**
- X-axis: ngày
- Y-axis: số phiên
- 4 series: ADVICE (xanh), RECOMMENDATION (cam), COMPARISON (tím), SEARCH (xám)
- Dùng `recharts` BarChart tương tự AdminReportsPage

**Biểu đồ 2: Phân bổ loại phiên AI (PieChart)**
- 4 slice: ADVICE / RECOMMENDATION / COMPARISON / SEARCH
- Hiển thị tỉ lệ phần trăm + số lượng

**Biểu đồ 3: Top 10 từ khóa/câu hỏi phổ biến**
- Phân tích `input` từ AiSession
- Group by từ khóa (keyword extraction đơn giản, split + count)
- HorizontalBarChart: từ khóa – số lần xuất hiện

### 4.4. Bảng "Phiên AI gần nhất"

Hiển thị 10 phiên gần nhất:
- Cột: Thời gian, User (email hoặc "Khách"), Type, Input (cắt 80 chars), Latency, Actions (Xem chi tiết)
- Click "Xem chi tiết" → mở modal hoặc navigate đến `/admin/ai/sessions?id=...`

### 4.5. API cần

```
GET /api/admin/ai/stats?period=7d|30d|today
Response: {
  totalSessions: number,
  sessionsByType: { ADVICE: n, RECOMMENDATION: n, COMPARISON: n, SEARCH: n },
  avgLatencyMs: number,
  suggestedProductsRate: number, // 0..1
  chartData: { date: string, ADVICE: n, RECOMMENDATION: n, ... }[],
  recentSessions: AiSessionSummaryDto[]
}
```

### 4.6. File cần tạo

- `src/app/admin/ai/page.tsx` – entry, import `AdminAiDashboardPage`
- `src/features/admin/components/ai/AdminAiDashboardPage.tsx`
- `src/features/admin/components/ai/AdminAiDashboardPage.module.css`
- `src/app/api/admin/ai/stats/route.ts`

---

## 5. Tính năng 2 – Lịch sử phiên tư vấn AI (AiSession log)

### 5.1. Mô tả

Trang `/admin/ai/sessions` – bảng toàn bộ AiSession, hỗ trợ lọc, tìm kiếm, xem chi tiết conversation. Đây là công cụ debug và phân tích chất lượng AI quan trọng nhất.

### 5.2. Bảng danh sách

**Cột:**
| Cột | Giá trị |
|---|---|
| # | STT |
| Thời gian | `createdAt` format `dd/MM/yyyy HH:mm:ss` |
| User | `user.email` hoặc "Khách ẩn danh" nếu `userId = null` |
| Loại | Badge: `ADVICE` (xanh) / `RECOMMENDATION` (cam) / `COMPARISON` (tím) / `SEARCH` (xám) |
| Input (câu hỏi) | Cắt 100 ký tự, tooltip full |
| Model | `model` field (llama-3.1-8b-instant, v.v.) |
| Latency | `metadata.latencyMs` + " ms" |
| Hành động | Nút "Xem" (mở modal), Nút "Flag" (đánh dấu kém chất lượng) |

**Phân trang:** 20 phiên/trang, cursor-based hoặc offset, sort mặc định `createdAt DESC`.

### 5.3. Filter & Search

**Bộ lọc:**
- **Khoảng thời gian**: date-range picker (Hôm nay / 7 ngày / 30 ngày / Tùy chọn)
- **Loại phiên**: checkbox multi-select: ADVICE / RECOMMENDATION / COMPARISON / SEARCH
- **User**: dropdown hoặc search input (email)
- **Model**: dropdown (lấy distinct values từ DB)
- **Có suggested products**: toggle (chỉ phiên trả về sản phẩm gợi ý)
- **Flagged**: toggle (chỉ phiên bị đánh dấu kém)

**Tìm kiếm full-text** (client-side hoặc server-side ILIKE): theo `input` field.

### 5.4. Modal xem chi tiết phiên

Khi click "Xem", mở modal hiển thị:

```
┌─────────────────────────────────────────────────────────┐
│  [X]  Phiên AI #abc123  ·  ADVICE  ·  14/03/2026 09:32  │
├─────────────────────────────────────────────────────────┤
│  User: user@example.com                                  │
│  Model: llama-3.1-8b-instant                             │
│  Latency: 843ms    ProductId: prod_xyz (nếu có)          │
│  Mode: product | general                                 │
├─────────────────────────────────────────────────────────┤
│  Input (câu hỏi):                                        │
│  ┌─────────────────────────────────────────────────────┐│
│  │ So sánh JBL 4367 với Focal Aria cho phòng 20m² ...  ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  Output (câu trả lời AI):                                │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Với diện tích 20m²...                               ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  Metadata:                                               │
│  ┌─────────────────────────────────────────────────────┐│
│  │ { "productId": "...", "latencyMs": 843,             ││
│  │   "mode": "product", "turnCount": 3,                ││
│  │   "suggestedProductsCount": 2 }                     ││
│  └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│  [Đánh dấu kém chất lượng]           [Đóng]             │
└─────────────────────────────────────────────────────────┘
```

### 5.5. Export CSV

Nút "Xuất CSV" ở header bảng:
- Export tất cả phiên theo filter hiện tại (không giới hạn trang)
- Cột: id, createdAt, userId, userEmail, type, input, output, model, latencyMs, metadata
- Dùng `xlsx` package (đã cài) hoặc thuần CSV blob download

### 5.6. API cần

```
GET /api/admin/ai/sessions
  ?page=1&limit=20
  &type=ADVICE,RECOMMENDATION
  &userId=xxx
  &dateFrom=2026-01-01
  &dateTo=2026-03-14
  &hasProducts=true
  &flagged=true
  &search=so+sánh+loa
  &sort=createdAt_desc

Response: {
  items: AiSessionAdminDto[],
  total: number,
  page: number,
  totalPages: number
}

GET /api/admin/ai/sessions/[id]
Response: AiSessionAdminDetailDto  // full input/output/metadata

PUT /api/admin/ai/sessions/[id]/flag
Body: { flagged: boolean, flagReason?: string }
```

### 5.7. DTO types (cần thêm vào types hoặc trong file)

```typescript
type AiSessionAdminDto = {
  id: string;
  createdAt: string;
  userId: string | null;
  userEmail: string | null;
  type: "ADVICE" | "RECOMMENDATION" | "COMPARISON" | "SEARCH";
  inputPreview: string;    // 100 chars
  model: string | null;
  latencyMs: number | null;
  flagged: boolean;
  hasSuggestedProducts: boolean;
};

type AiSessionAdminDetailDto = AiSessionAdminDto & {
  inputFull: string;
  outputFull: string;
  metadata: Record<string, unknown> | null;
};
```

### 5.8. File cần tạo

- `src/app/admin/ai/sessions/page.tsx`
- `src/features/admin/components/ai/AdminAiSessionListPage.tsx`
- `src/features/admin/components/ai/AdminAiSessionListPage.module.css`
- `src/app/api/admin/ai/sessions/route.ts`
- `src/app/api/admin/ai/sessions/[id]/route.ts`
- `src/app/api/admin/ai/sessions/[id]/flag/route.ts`

---

## 6. Tính năng 3 – Cài đặt & cấu hình AI

### 6.1. Mô tả

Trang `/admin/ai/settings` – admin cấu hình các tham số vận hành AI từ UI, không cần sửa code hay restart server. Các settings này lưu vào `AdminSetting` (đã có) với `category = "ai"`.

### 6.2. Nhóm cài đặt

**Nhóm A: Model & tham số chính**

| Key | Label | Type | Default | Mô tả |
|---|---|---|---|---|
| `ai_enabled` | Bật/tắt AI toàn bộ | Toggle | `true` | Tắt sẽ trả fallback message cho shop |
| `ai_model` | Model Groq | Select | `llama-3.1-8b-instant` | Dropdown: llama-3.1-8b-instant, llama-3.3-70b-versatile, mixtral-8x7b-32768 |
| `ai_temperature` | Temperature | Slider 0.0–1.0 | `0.7` | Thấp = nhất quán, cao = sáng tạo |
| `ai_max_tokens` | Max output tokens | Number | `512` | Giới hạn độ dài trả lời |
| `ai_timeout_ms` | Timeout (ms) | Number | `10000` | Hủy request nếu Groq không trả lời trong thời gian này |

**Nhóm B: Cài đặt chatbot shop**

| Key | Label | Type | Default | Mô tả |
|---|---|---|---|---|
| `ai_chat_enabled` | Bật chatbot phía shop | Toggle | `true` | Bật/tắt AiChatPanel |
| `ai_chat_catalog_limit` | Số sản phẩm trong context | Number | `30` | Fetch bao nhiêu SP để build catalog prompt |
| `ai_chat_suggested_enabled` | Trả về gợi ý sản phẩm | Toggle | `true` | Bật/tắt `suggestedProducts` trong response |
| `ai_chat_suggested_limit` | Số sản phẩm gợi ý tối đa | Number | `3` | |
| `ai_chat_fallback_message` | Tin nhắn khi AI tắt | Textarea | `"Tính năng AI tạm thời không khả dụng..."` | |

**Nhóm C: Rate limiting (bảo vệ quota Groq)**

| Key | Label | Type | Default | Mô tả |
|---|---|---|---|---|
| `ai_rate_limit_per_user_per_day` | Giới hạn tư vấn/user/ngày | Number | `50` | Chỉ áp dụng cho user đăng nhập |
| `ai_rate_limit_anonymous_per_ip` | Giới hạn tư vấn/IP/ngày | Number | `10` | Áp dụng cho user ẩn danh |
| `ai_rate_limit_enabled` | Bật rate limiting | Toggle | `false` | |

**Nhóm D: Cài đặt sinh nội dung Admin**

| Key | Label | Type | Default | Mô tả |
|---|---|---|---|---|
| `ai_seo_model` | Model sinh SEO | Select | `llama-3.1-8b-instant` | Model dùng cho sinh SEO Product/Brand/Category |
| `ai_seo_language` | Ngôn ngữ sinh content | Select | `vi` | vi (Tiếng Việt) / en (English) / bilingual |
| `ai_seo_auto_generate` | Tự động sinh khi tạo mới | Toggle | `false` | Tự sinh SEO khi admin tạo Product/Brand/Category |

### 6.3. UI layout

- Form 3 nhóm (Accordion hoặc Section với heading).
- Mỗi field có label, input phù hợp (Toggle/Slider/Select/Number/Textarea), mô tả nhỏ bên dưới.
- Nút "Lưu cài đặt" cuối form (PATCH tất cả settings đã thay đổi).
- Banner cảnh báo nếu `ai_enabled = false`: "AI đang bị tắt – chatbot shop không hoạt động".
- Toast success/error sau khi lưu.

### 6.4. API cần

```
GET /api/admin/ai/config
Response: { settings: Record<string, string> }  // tất cả key bắt đầu bằng "ai_"

PATCH /api/admin/ai/config
Body: { settings: Record<string, string> }
// Upsert batch: gọi AdminSetting upsert cho từng key
```

Tái sử dụng logic từ `/api/admin/settings/route.ts` nhưng filter `category = "ai"`.

### 6.5. File cần tạo

- `src/app/admin/ai/settings/page.tsx`
- `src/features/admin/components/ai/AdminAiSettingsPage.tsx`
- `src/features/admin/components/ai/AdminAiSettingsPage.module.css`
- `src/app/api/admin/ai/config/route.ts`

### 6.6. Tích hợp vào runtime

- Sửa `src/lib/groq-chat.ts` và `src/lib/groq-json.ts`: đọc `ai_model`, `ai_temperature`, `ai_max_tokens`, `ai_timeout_ms` từ `getAdminSetting()` (đã có `src/lib/admin-settings.ts`).
- Sửa `product-advice/route.ts`: check `ai_chat_enabled`, lấy `ai_chat_catalog_limit`, `ai_chat_suggested_enabled`, `ai_chat_suggested_limit` từ settings.
- Thêm `ai_` defaults vào `prisma/seed.ts` để seed sẵn khi khởi động.

---

## 7. Tính năng 4 – Quản lý nội dung AI trên sản phẩm

### 7.1. Mô tả

Trang `/admin/ai/content` – bảng tổng hợp tất cả Product, Brand, Category với trạng thái AI content (đã có / chưa có) để admin quản lý và chỉnh sửa dễ dàng, không phải vào từng sản phẩm riêng lẻ.

### 7.2. Sub-tabs

```
[Sản phẩm]  [Thương hiệu]  [Danh mục]
```

Mỗi tab là một bảng riêng với cùng cấu trúc.

### 7.3. Bảng sản phẩm

**Cột:**
| Cột | Giá trị |
|---|---|
| Tên sản phẩm | Thumbnail nhỏ + name |
| Danh mục | `category.name` |
| Thương hiệu | `brand.name` |
| AI Description | Badge "Có" (xanh) / "Chưa có" (đỏ) + preview 60 chars |
| AI Tags | Badge count "3 tags" / "Chưa có" |
| SEO Title | Badge "Có" / "Chưa có" + preview |
| SEO Description | Badge "Có" / "Chưa có" |
| Hành động | Nút "Sinh AI" (single), Nút "Chỉnh sửa" (mở drawer) |

**Filter:**
- Trạng thái AI: Tất cả / Đã có đầy đủ / Thiếu AI Description / Thiếu SEO / Chưa có gì
- Danh mục, Thương hiệu (dropdown multi-select)
- Tìm kiếm theo tên

**Stat tóm tắt ở đầu bảng:**
- Tổng sản phẩm: N
- Đã có đủ AI content: N (%)
- Còn thiếu: N (%)

### 7.4. Drawer chỉnh sửa nội dung AI

Click "Chỉnh sửa" mở `<Drawer>` từ bên phải:

```
┌────────────────────────────────────────┐
│  Chỉnh sửa AI Content                  │
│  [Tên sản phẩm]                        │
├────────────────────────────────────────┤
│  AI Description                        │
│  ┌──────────────────────────────────┐  │
│  │ textarea (auto-resize)           │  │
│  │ Mô tả ngữ nghĩa cho chatbot...  │  │
│  └──────────────────────────────────┘  │
│  [Sinh lại với AI]                     │
│                                        │
│  AI Tags (cách nhau bởi dấu phẩy)      │
│  ┌──────────────────────────────────┐  │
│  │ loa-bookshelf, hi-end, yamaha    │  │
│  └──────────────────────────────────┘  │
│  Chip tags hiển thị bên dưới input    │
│                                        │
│  SEO Title                             │
│  ┌──────────────────────────────────┐  │
│  │ input text (max 60 chars)        │  │
│  └──────────────────────────────────┘  │
│                                        │
│  SEO Description                       │
│  ┌──────────────────────────────────┐  │
│  │ textarea (max 160 chars)         │  │
│  └──────────────────────────────────┘  │
│                                        │
│  [Sinh lại toàn bộ với AI]  [Lưu]     │
└────────────────────────────────────────┘
```

- Nút "Sinh lại với AI" gọi `POST /api/admin/products/ai` (đã có), tự fill vào các field.
- Nút "Lưu" gọi `PUT /api/admin/products/[id]` cập nhật 4 fields.
- Validation: aiTags parse thành `string[]` (split by comma, trim, lowercase, replace space → `-`).

### 7.5. API cần

Tái sử dụng:
- `GET /api/admin/products?page=&limit=&filter=noAi|hasAi|partial` – thêm query param mới vào route hiện có
- `PUT /api/admin/products/[id]` – đã có, chỉ thêm 4 fields vào DTO

Cần thêm:
```
GET /api/admin/ai/content/stats
Response: {
  products: { total: n, hasAll: n, hasPartial: n, hasNone: n },
  brands:   { total: n, hasAll: n, hasPartial: n, hasNone: n },
  categories: { total: n, hasAll: n, hasPartial: n, hasNone: n }
}
```

### 7.6. File cần tạo

- `src/app/admin/ai/content/page.tsx`
- `src/features/admin/components/ai/AdminAiContentPage.tsx`
- `src/features/admin/components/ai/AdminAiContentPage.module.css`
- `src/features/admin/components/ai/AiContentEditDrawer.tsx`
- `src/features/admin/components/ai/AiContentEditDrawer.module.css`
- `src/app/api/admin/ai/content/stats/route.ts`

---

## 8. Tính năng 5 – Sinh AI hàng loạt (Batch Generate)

### 8.1. Mô tả

Trang `/admin/ai/batch` – cho phép admin chọn nhiều sản phẩm/brand/category cùng lúc và sinh AI content hàng loạt (với throttle để không bị rate limit Groq). Đây là tính năng tiết kiệm thời gian nhất khi mới ra mắt catalog lớn.

### 8.2. Luồng UX

```
Bước 1: Chọn loại target
  ○ Sản phẩm    ○ Thương hiệu    ○ Danh mục

Bước 2: Chọn items
  ● Filter: Tất cả / Chỉ item chưa có AI content
  ● Checkbox table để chọn cụ thể, hoặc "Chọn tất cả"
  ● Hiển thị N item đã chọn

Bước 3: Chọn action & cấu hình
  ☐ Sinh AI Description
  ☐ Sinh AI Tags
  ☐ Sinh SEO Title
  ☐ Sinh SEO Description
  ---
  Tốc độ: Chậm (1/giây) / Bình thường (2/giây) / Nhanh (3/giây)
  ☐ Bỏ qua item đã có đủ content

Bước 4: Xác nhận & Chạy
  Sinh content cho 47 sản phẩm → khoảng 24 giây
  [Bắt đầu sinh]
```

### 8.3. Progress UI

Khi đang chạy:
```
┌─────────────────────────────────────────────────────┐
│  Đang sinh AI content...                            │
│                                                     │
│  [████████████░░░░░░░░░░░░░░░░░] 32/47  68%         │
│                                                     │
│  Đang xử lý: JBL Synthesis 4367 Studio Monitor      │
│                                                     │
│  Thành công: 31   Lỗi: 1   Bỏ qua: 0               │
│                                                     │
│  ✓ Yamaha A-S2200                                   │
│  ✓ Focal Aria 906                                   │
│  ✗ McIntosh MA352 [lỗi: timeout] → [Thử lại]        │
│  ...                                                │
│                                                     │
│  [Dừng lại]                                         │
└─────────────────────────────────────────────────────┘
```

- Progress bar animate theo `completedCount / totalCount`.
- Danh sách kết quả scrollable, hiển thị real-time.
- Nút "Dừng lại" để cancel batch (abort signal).
- Sau khi hoàn tất, nút "Tải xuống báo cáo" (CSV: id, name, status, error).

### 8.4. Kỹ thuật triển khai

**Frontend (client-side orchestration):**
- Không dùng background job – gọi API tuần tự từ browser để đơn giản.
- Dùng `AbortController` để dừng.
- Throttle: `await delay(intervalMs)` giữa các lần gọi.
- State: `queue[]`, `currentIndex`, `results[]`, `isCancelled`.

**API:**
- Tái sử dụng `POST /api/admin/products/ai` cho từng item.
- Gọi `PUT /api/admin/products/[id]` sau khi có kết quả để lưu.

**Lý do không dùng background job:** Đơn giản, dễ debug, user nhìn thấy progress real-time, không cần infra phức tạp (queue, worker). Giới hạn: không vượt quá 200 items trong một batch để tránh browser timeout.

### 8.5. File cần tạo

- `src/app/admin/ai/batch/page.tsx`
- `src/features/admin/components/ai/AdminAiBatchPage.tsx`
- `src/features/admin/components/ai/AdminAiBatchPage.module.css`

---

## 9. Tính năng 6 – Prompt Management (Quản lý system prompt)

### 9.1. Mô tả

Trang `/admin/ai/prompts` – admin xem, chỉnh sửa và test các system prompt của AI mà không cần sửa code. Hiện tại, toàn bộ prompt của `product-advice/route.ts` đang hard-code trong file source.

### 9.2. Danh sách prompt

| Prompt Key | Label | Dùng ở đâu |
|---|---|---|
| `chat_system_general` | System prompt tư vấn chung | `/api/shop/ai/product-advice` (chế độ general) |
| `chat_system_product` | System prompt tư vấn sản phẩm | `/api/shop/ai/product-advice` (chế độ product) |
| `chat_rules` | Quy tắc trả lời AI | Ghép vào cuối cả 2 system prompt trên |
| `recommend_system` | System prompt gợi ý setup | `/api/shop/ai/recommend` |
| `seo_product_prompt` | Prompt sinh SEO/AI cho Product | `ai-product-seo-service.ts` |
| `seo_brand_prompt` | Prompt sinh SEO/AI cho Brand | `ai-brand-seo-service.ts` |
| `seo_category_prompt` | Prompt sinh SEO/AI cho Category | `ai-category-seo-service.ts` |
| `coupon_suggest_prompt` | Prompt gợi ý coupon | `ai-coupon-service.ts` |

### 9.3. UI bảng prompt

Bảng danh sách với cột: Key, Label, Mô tả, Cập nhật lần cuối, Hành động (Xem/Sửa, Test, Reset về mặc định).

### 9.4. Màn hình chỉnh sửa prompt

```
┌────────────────────────────────────────────────────────────┐
│  ← Quay lại                                                │
│                                                            │
│  Sửa Prompt: chat_system_product                           │
│  Tư vấn sản phẩm cụ thể                                   │
├────────────────────────────────────────────────────────────┤
│  Editor (full-width, monospace, syntax highlight)          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ You are an expert Hi-end audio consultant at Duc Uy  │  │
│  │ Audio...                                             │  │
│  │ ...                                                  │  │
│  │ {PRODUCT_CONTEXT}                                    │  │
│  │ {CATALOG_CONTEXT}                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  Dùng {PLACEHOLDER} để chèn context động.                  │
│  Các placeholder hợp lệ: {PRODUCT_CONTEXT}, {BRAND_NAME},  │
│  {CATALOG_CONTEXT}, {STORE_NAME}                           │
├────────────────────────────────────────────────────────────┤
│  Test nhanh                                                │
│  Gửi câu hỏi: [input................................................]  │
│  Sản phẩm test: [dropdown chọn sản phẩm]                  │
│  [Gửi test]                                                │
│                                                            │
│  Kết quả:                                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ (kết quả AI trả về với prompt này)                   │  │
│  └──────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────┤
│  [Reset về mặc định]        [Lưu prompt]                   │
└────────────────────────────────────────────────────────────┘
```

### 9.5. Prisma schema bổ sung (AiPrompt model)

```prisma
model AiPrompt {
  key            String   @id
  label          String
  description    String?
  content        String   @db.Text
  defaultContent String   @db.Text
  updatedAt      DateTime @updatedAt
  updatedByEmail String?
}
```

### 9.6. Tích hợp vào runtime

Sửa `product-advice/route.ts`, `ai-product-seo-service.ts`, v.v.:
1. Thêm helper `getAiPrompt(key: string)` – đọc DB trước, fallback về default hard-code nếu DB rỗng.
2. Thay `const systemPrompt = "You are..."` bằng `const systemPrompt = await getAiPrompt("chat_system_product")`.
3. Cache prompt trong memory 60 giây để không query DB mỗi request.

### 9.7. API cần

```
GET  /api/admin/ai/prompts              → list all
GET  /api/admin/ai/prompts/[key]        → get one
PUT  /api/admin/ai/prompts/[key]        → update content
POST /api/admin/ai/prompts/[key]/reset  → reset to defaultContent
POST /api/admin/ai/prompts/[key]/test   → { message, productId? } → { answer }
```

### 9.8. File cần tạo

- `src/app/admin/ai/prompts/page.tsx`
- `src/app/admin/ai/prompts/[key]/page.tsx`
- `src/features/admin/components/ai/AdminAiPromptsPage.tsx`
- `src/features/admin/components/ai/AdminAiPromptEditPage.tsx`
- `src/features/admin/components/ai/AdminAiPromptsPage.module.css`
- `src/features/admin/components/ai/AdminAiPromptEditPage.module.css`
- `src/app/api/admin/ai/prompts/route.ts`
- `src/app/api/admin/ai/prompts/[key]/route.ts`
- `src/app/api/admin/ai/prompts/[key]/reset/route.ts`
- `src/app/api/admin/ai/prompts/[key]/test/route.ts`
- `src/lib/ai-prompt.ts` – helper `getAiPrompt()` với in-memory cache

---

## 10. Tính năng 7 – AI Quality Review (Kiểm duyệt nội dung AI)

### 10.1. Mô tả

Tính năng nhỏ tích hợp vào `/admin/ai/sessions` – admin đánh dấu (flag) các phiên AI trả lời kém chất lượng, sai thông tin hoặc không phù hợp. Dữ liệu flag giúp cải thiện prompt và phát hiện vấn đề.

### 10.2. Prisma schema bổ sung

Thêm 2 field vào `AiSession`:

```prisma
model AiSession {
  // ... hiện có ...
  flagged     Boolean  @default(false)
  flagReason  String?
}
```

### 10.3. UX

- Trong bảng sessions, cột cuối có nút cờ (icon flag) – click toggle `flagged = !flagged`.
- Trong modal chi tiết, nút "Đánh dấu kém chất lượng" mở popover chọn lý do:
  - "Trả lời sai thông tin"
  - "Không liên quan đến sản phẩm"
  - "Thái độ không phù hợp"
  - "Chậm / timeout"
  - "Khác"
- Filter trong bảng: toggle "Chỉ hiện flagged" để xem nhanh tất cả phiên bị đánh dấu.

### 10.4. Analytics từ flag

Bổ sung vào `/api/admin/ai/stats`:
```json
{
  "flaggedCount": 12,
  "flaggedRate": 0.023,
  "flagReasonBreakdown": {
    "wrong_info": 5,
    "irrelevant": 4,
    "other": 3
  }
}
```

---

## 11. API Routes cần tạo mới

| Method | Path | Tính năng |
|---|---|---|
| GET | `/api/admin/ai/stats` | Dashboard AI – stats tổng quan, chart data |
| GET | `/api/admin/ai/sessions` | Danh sách phiên AI (filter, page, sort) |
| GET | `/api/admin/ai/sessions/[id]` | Chi tiết 1 phiên AI |
| PUT | `/api/admin/ai/sessions/[id]/flag` | Flag/unflag phiên AI |
| GET | `/api/admin/ai/config` | Lấy tất cả AI settings |
| PATCH | `/api/admin/ai/config` | Cập nhật batch AI settings |
| GET | `/api/admin/ai/content/stats` | Thống kê AI content trên catalog |
| GET | `/api/admin/ai/prompts` | Danh sách prompts |
| GET | `/api/admin/ai/prompts/[key]` | Chi tiết 1 prompt |
| PUT | `/api/admin/ai/prompts/[key]` | Cập nhật content prompt |
| POST | `/api/admin/ai/prompts/[key]/reset` | Reset prompt về default |
| POST | `/api/admin/ai/prompts/[key]/test` | Test prompt với câu hỏi thực |

**Tất cả các route trên đều yêu cầu `session.user.role === "ADMIN"` (dùng pattern hiện có trong codebase).**

---

## 12. Prisma schema bổ sung

```prisma
// Thêm vào model AiSession (migration)
model AiSession {
  // ... hiện có: id, userId, type, input, output, model, metadata, createdAt, user ...
  flagged    Boolean  @default(false)
  flagReason String?
}

// Model mới: AiPrompt
model AiPrompt {
  key            String   @id
  label          String
  description    String?
  content        String   @db.Text
  defaultContent String   @db.Text
  updatedAt      DateTime @updatedAt
  updatedByEmail String?
}
```

**Migration:**
```bash
npx prisma migrate dev --name add_ai_flag_and_prompt
```

**Seed data `AiPrompt`:**

Seed file (`prisma/seed-ai-prompts.ts`) tạo 8 prompt records với `key` và `defaultContent` hard-code từ các service hiện tại. Chạy 1 lần khi deploy.

---

## 13. File & thư mục cần tạo

### App routes (entry pages)
```
src/app/admin/ai/
├── page.tsx                              ← Dashboard AI
├── sessions/
│   └── page.tsx                          ← Danh sách sessions
├── settings/
│   └── page.tsx                          ← Cài đặt AI
├── content/
│   └── page.tsx                          ← Quản lý content AI
├── batch/
│   └── page.tsx                          ← Batch generate
└── prompts/
    ├── page.tsx                          ← Danh sách prompts
    └── [key]/
        └── page.tsx                      ← Sửa 1 prompt
```

### Feature components
```
src/features/admin/components/ai/
├── AdminAiDashboardPage.tsx
├── AdminAiDashboardPage.module.css
├── AdminAiSessionListPage.tsx
├── AdminAiSessionListPage.module.css
├── AdminAiSessionDetailModal.tsx
├── AdminAiSessionDetailModal.module.css
├── AdminAiSettingsPage.tsx
├── AdminAiSettingsPage.module.css
├── AdminAiContentPage.tsx
├── AdminAiContentPage.module.css
├── AiContentEditDrawer.tsx
├── AiContentEditDrawer.module.css
├── AdminAiBatchPage.tsx
├── AdminAiBatchPage.module.css
├── AdminAiPromptsPage.tsx
├── AdminAiPromptsPage.module.css
├── AdminAiPromptEditPage.tsx
└── AdminAiPromptEditPage.module.css
```

### API routes
```
src/app/api/admin/ai/
├── stats/route.ts
├── sessions/
│   ├── route.ts
│   └── [id]/
│       ├── route.ts
│       └── flag/route.ts
├── config/route.ts
├── content/
│   └── stats/route.ts
└── prompts/
    ├── route.ts
    └── [key]/
        ├── route.ts
        ├── reset/route.ts
        └── test/route.ts
```

### Lib & utils
```
src/lib/ai-prompt.ts          ← getAiPrompt() với 60s memory cache
src/lib/ai-config.ts          ← getAiConfig() helper lấy tất cả ai_ settings
```

---

## 14. Test cases

### Tính năng 1 – Dashboard AI
- [ ] Stats hiển thị đúng số phiên hôm nay / tháng này khi DB có data.
- [ ] BarChart 7 ngày hiển thị 4 series, trống ngày không có session.
- [ ] PieChart tỉ lệ cộng đúng 100%.
- [ ] Bảng 10 phiên gần nhất sort `createdAt DESC`.
- [ ] Click "Xem chi tiết" từ bảng mở đúng modal.

### Tính năng 2 – Lịch sử sessions
- [ ] Phân trang đúng (page 1 → 20 items, page 2 → item 21–40).
- [ ] Filter by type = ADVICE chỉ hiện ADVICE, không bị lộ type khác.
- [ ] Filter by date range đúng khoảng.
- [ ] Search theo input tìm được phiên liên quan.
- [ ] Flag phiên → cột hiển thị icon flag, refresh vẫn flag.
- [ ] Unflag: click lại → bỏ flag.
- [ ] Export CSV tạo file với đúng cột, đúng số hàng theo filter hiện tại.
- [ ] Modal chi tiết hiển thị full input/output/metadata không bị cắt.

### Tính năng 3 – AI Settings
- [ ] Load settings đúng giá trị hiện tại từ DB khi vào trang.
- [ ] Toggle `ai_enabled = false` → lưu → call chatbot phía shop nhận fallback message.
- [ ] Thay model, lưu → call AI lần sau dùng model mới (verify qua AiSession.model).
- [ ] Temperature out of range (< 0 hoặc > 1) → validation lỗi.
- [ ] Toast success sau lưu thành công, toast error khi lỗi mạng.

### Tính năng 4 – Content Management
- [ ] Tab Sản phẩm filter "Chưa có AI content" chỉ hiện SP có aiDescription = null.
- [ ] Click "Sinh AI" trên 1 SP → spinner → fill drawer với content mới.
- [ ] Lưu drawer → PUT /api/admin/products/[id] → reload bảng, badge cột cập nhật.
- [ ] AI Tags input "loa hi-end , yamaha , bookshelf" → lưu thành `["loa-hi-end","yamaha","bookshelf"]`.

### Tính năng 5 – Batch Generate
- [ ] Chọn 5 SP, bắt đầu batch → progress bar tiến từ 0 → 100%.
- [ ] Mỗi item xử lý xong hiện dòng kết quả (✓ hoặc ✗).
- [ ] Nút "Dừng lại" khi đang chạy → batch dừng giữa chừng, items đã xong không rollback.
- [ ] Item thất bại (timeout) có nút "Thử lại".
- [ ] Export báo cáo CSV có đúng cột status/error cho từng item.

### Tính năng 6 – Prompt Management
- [ ] Danh sách hiện đủ 8 prompt keys.
- [ ] Sửa prompt → Lưu → getAiPrompt(key) trả về content mới (sau khi cache expire 60s).
- [ ] Test prompt với câu hỏi thực → nhận response từ AI dùng prompt đã sửa.
- [ ] Reset về mặc định → content về đúng defaultContent.
- [ ] Placeholder không hợp lệ trong prompt → warning UI (không block lưu, chỉ cảnh báo).

### Tính năng 7 – Quality Review
- [ ] Flag session từ bảng → icon flag xuất hiện ngay (optimistic update).
- [ ] Flag với lý do → flagReason lưu DB.
- [ ] Filter "Flagged only" → đúng số lượng flagged.
- [ ] Dashboard AI stats hiển thị flaggedRate đúng.

---

## Phụ lục: Thứ tự ưu tiên triển khai

### Phase 1 – Quan sát (nhanh nhất, ít rủi ro)
1. Prisma migration: thêm `flagged`, `flagReason` vào `AiSession`.
2. Tạo `GET /api/admin/ai/stats` và `GET /api/admin/ai/sessions`.
3. Tạo `AdminAiDashboardPage` + `AdminAiSessionListPage`.
4. Thêm sidebar entry "Quản lý AI".
5. Sửa `/api/shop/ai/recommend` để log `AiSession` với type `RECOMMENDATION`.

**Lý do ưu tiên:** Không thay đổi runtime AI, chỉ đọc dữ liệu đã có. Low risk, high value.

### Phase 2 – Cấu hình & Nội dung
6. Tạo `AiPrompt` model + seed 8 prompts mặc định.
7. Tạo `GET/PATCH /api/admin/ai/config`.
8. Tạo `AdminAiSettingsPage`.
9. Sửa `groq-chat.ts` và `groq-json.ts` đọc config từ DB (với fallback env).
10. Tạo `AdminAiContentPage` + drawer chỉnh sửa.

**Lý do:** Config và content là 2 tính năng được dùng nhiều nhất trong vận hành hàng ngày.

### Phase 3 – Hiệu suất & Nâng cao
11. Tạo `AdminAiBatchPage` (batch generate).
12. Tạo `AdminAiPromptsPage` + `AdminAiPromptEditPage` + `ai-prompt.ts` helper.
13. Tích hợp prompt runtime vào `product-advice/route.ts`.
14. Bổ sung quality review flag vào modal sessions.

**Lý do:** Tính năng phức tạp hơn, cần Phase 1+2 làm nền tảng.
