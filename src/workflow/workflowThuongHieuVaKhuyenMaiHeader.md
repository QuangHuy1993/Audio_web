## Workflow: Header `Thương hiệu` & `Khuyến mãi`

### 1. Mục tiêu tổng quan

- **Thương hiệu**
  - Khi hover/bấm vào mục `Thương hiệu` trên `ShopHeader`, hiển thị dropdown danh sách brand từ DB.
  - Click 1 brand → điều hướng sang trang `Tất cả sản phẩm` tại `/products?brandId=...` đã lọc theo brand.
  - Có link `Xem tất cả thương hiệu` → `/brands` (trang liệt kê/khám phá).
  - Tối ưu query để không bị N+1, chỉ load dữ liệu cần thiết cho UI.

- **Khuyến mãi**
  - Mục `Khuyến mãi` trong header mở dropdown hiển thị các chương trình ưu đãi đang chạy.
  - Click 1 khuyến mãi:
    - Nếu là **khuyến mãi gắn sản phẩm** → `/products?promotionId=...` (lọc tập sản phẩm tham gia).
    - Nếu là **mã coupon toàn shop** → `/promotions` và scroll/anchor tới block chi tiết.
  - Có link `Xem tất cả khuyến mãi` → `/promotions`.
  - Có filter “Đang giảm giá” trên trang `/products` để lọc tất cả sản phẩm có `salePrice < price`.

---

### 2. Kiến trúc & model liên quan

> Ghi chú: phần này mô tả theo hướng **dự kiến/chuẩn hoá**. Khi implement cần đối chiếu lại `prisma/schema.prisma` hiện tại.

#### 2.1. Bảng `Brand`

- Trường tối thiểu cần cho header/dropdown:
  - `id: string`
  - `name: string`
  - `slug: string` (dùng cho URL SEO nếu cần sau này)
  - `logoUrl: string | null`
  - Quan hệ: `products: Product[]`

#### 2.2. Bảng `Product`

- Trường đã sử dụng trong shop:
  - `id`, `name`, `slug`
  - `price: Decimal`
  - `salePrice: Decimal | null`
  - `currency: "VND" | ...`
  - `status: "ACTIVE" | "HIDDEN" | "DRAFT"`
  - `brandId: string | null`, `brand: Brand?`
  - `categoryId: string | null`
  - Quan hệ images: đảm bảo có flag `isPrimary`.

#### 2.3. Bảng khuyến mãi (gợi ý)

- Tên có thể là `Promotion` hoặc `Coupon` (đã tồn tại trong phần admin).
- Các trường hữu ích cho header:
  - `id: string`
  - `title: string` – tiêu đề ngắn.
  - `subtitle: string | null` – mô tả ngắn.
  - `badgeText: string | null` – text nhỏ hiển thị trong chip (VD: `-10%`, `Mã JBL10`).
  - `type: "PRODUCT_SET" | "COUPON_GLOBAL"` – phân biệt khuyến mãi theo bộ sản phẩm hay mã toàn shop.
  - `startsAt`, `endsAt`, `isActive` – xác định khuyến mãi đang chạy.
  - Quan hệ:
    - Nếu `PRODUCT_SET`: bảng trung gian `PromotionProduct` chứa list productId.
    - Nếu `COUPON_GLOBAL`: không cần quan hệ sản phẩm.

---

### 3. API layer – chống N+1 & tối ưu query

#### 3.1. `GET /api/shop/brands` – danh sách brand cho header & /brands

**File**: `src/app/api/shop/brands/route.ts` (mới)

**Mục đích**:
- Trả về danh sách brand đang có sản phẩm ACTIVE, với tổng số sản phẩm theo brand.
- Sử dụng ở:
  - Dropdown `Thương hiệu` trong `ShopHeader`.
  - Trang `/brands` (sau này).

**DTO**:

```ts
export type BrandFilterItemDto = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  productCount: number;
};
```

**Logic query (Prisma)**:

```ts
// Pseudo-code
const brands = await prisma.brand.findMany({
  where: {
    products: {
      some: { status: "ACTIVE" },
    },
  },
  select: {
    id: true,
    name: true,
    slug: true,
    logoUrl: true,
    _count: {
      select: {
        products: {
          where: { status: "ACTIVE" },
        },
      },
    },
  },
  orderBy: [
    { _count: { products: "desc" } },
    { name: "asc" },
  ],
});
```

- **Tránh N+1**: sử dụng `_count` thay vì đếm từng brand riêng lẻ.
- Chỉ **select** những trường cần cho UI (không include full `products`).

**Response**:

```jsonc
{
  "items": [
    {
      "id": "brand_1",
      "name": "JBL",
      "slug": "jbl",
      "logoUrl": "https://...",
      "productCount": 12
    }
  ]
}
```

**Validation & lỗi**:

- Không nhận body, chỉ query params đơn giản (có thể thêm `limit`/`q` sau).
- Lỗi server:
  - Log chi tiết bằng `console.error("[Brands][GET]", error)` với `request.url`.
  - Trả `500` với message chung: `"Không thể tải danh sách thương hiệu."`.

---

#### 3.2. Mở rộng `GET /api/shop/products` để lọc brand & onSale

**File hiện có**: `src/app/api/shop/products/route.ts`

- Đã hỗ trợ:
  - `page`, `sort`, `search`, `categoryId`, `brandId` (đã có).
- Cần bổ sung:
  - Query `onSale` (string `"true" | "false" | undefined"`).
  - (Tuỳ nhu cầu sau) `promotionId`.

**Where clause (onSale)**:

```ts
const onSaleParam = searchParams.get("onSale");
const onSale = onSaleParam === "true";

const where: Prisma.ProductWhereInput = {
  status: "ACTIVE",
};

if (search) {
  where.OR = [
    { name: { contains: search, mode: "insensitive" } },
    { brand: { name: { contains: search, mode: "insensitive" } } },
  ];
}

if (categoryId) where.categoryId = categoryId;
if (brandId) where.brandId = brandId;

if (onSale) {
  where.salePrice = {
    not: null,
    lt: Prisma.Decimal ??? // chú ý kiểu Decimal, cần so sánh đúng
  };
}
```

> Lưu ý: với Prisma + Decimal, nên so sánh theo `salePrice: { not: null }` và thêm điều kiện `price > salePrice` trong code (nếu cần). Hoặc normalize dữ liệu để đảm bảo `salePrice < price` luôn đúng trong DB.

**Performance**:

- Giữ `PAGE_SIZE = 9` như hiện tại.
- Không `include` quan hệ không cần thiết (reviews, specs, v.v.) vì DTO cho grid chỉ cần:
  - `id, name, slug, price, salePrice, currency, category.name, brand.name, primaryImage`.

---

#### 3.3. API `GET /api/shop/promotions` (gợi ý)

**File**: `src/app/api/shop/promotions/route.ts` (mới)

**Mục đích**:
- Cung cấp danh sách các promotion đang active cho:
  - Dropdown `Khuyến mãi` trong header.
  - Trang `/promotions`.

**DTO**:

```ts
export type PromotionSummaryDto = {
  id: string;
  title: string;
  subtitle: string | null;
  badgeText: string | null;
  type: "PRODUCT_SET" | "COUPON_GLOBAL";
  startsAt: string;
  endsAt: string | null;
};
```

**Where** (tránh trả về promotion hết hạn):

```ts
const now = new Date();
const items = await prisma.promotion.findMany({
  where: {
    isActive: true,
    startsAt: { lte: now },
    OR: [
      { endsAt: null },
      { endsAt: { gte: now } },
    ],
  },
  select: {
    id: true,
    title: true,
    subtitle: true,
    badgeText: true,
    type: true,
    startsAt: true,
    endsAt: true,
  },
  orderBy: [{ startsAt: "desc" }],
});
```

**Tránh N+1**:

- Không cần load `PromotionProduct` ở đây; chỉ dùng summary.
- Nếu cần hiển thị số sản phẩm trong từng promotion:
  - Dùng `_count: { select: { products: true } }`, tương tự phần Brand.

---

### 4. Frontend – ShopHeader: dropdown `Thương hiệu`

**File**: `src/components/layout/ShopHeader.tsx` & `ShopHeader.module.css`

#### 4.1. State & fetch

- Thêm state:

```ts
const [brandItems, setBrandItems] = useState<BrandFilterItemDto[] | null>(null);
const [isBrandsOpen, setIsBrandsOpen] = useState(false);
const [isLoadingBrands, setIsLoadingBrands] = useState(false);
const [brandsError, setBrandsError] = useState<string | null>(null);
```

- Khi user hover/click vào nav item `Thương hiệu`:
  - Nếu `brandItems === null && !isLoadingBrands`:
    - Call `GET /api/shop/brands`.
  - Set `isBrandsOpen = true`.

#### 4.2. UI desktop

- Trong phần nav:
  - Với item `href === "/brands"`:
    - Render một wrapper `div` với `onMouseEnter`/`onMouseLeave` hoặc `onClick` (tuỳ mobile/desktop).
    - Bên trong:
      - Nút label “Thương hiệu”.
      - Dropdown absolutely-positioned:
        - Nếu `isLoadingBrands`: loader nhỏ.
        - Nếu `brandsError`: “Không thể tải danh sách thương hiệu, thử lại”.
        - Nếu OK:
          - List 8–12 brand đầu tiên (theo `productCount`).
          - Mỗi dòng: logo nhỏ (nếu có), tên brand, số lượng sản phẩm.
          - Cuối dropdown: link “Xem tất cả thương hiệu” → `/brands`.

- Click 1 brand:

```ts
onClick={() => {
  router.push(`/products?brandId=${encodeURIComponent(brand.id)}`);
  setIsBrandsOpen(false);
}}
```

#### 4.3. UI mobile (drawer)

- Ở drawer nav:
  - Giữ item “Thương hiệu” dẫn tới trang `/brands` (full trang).
  - Có thể sau này thêm bottom sheet brand filter riêng cho mobile nếu cần.

---

### 5. Frontend – ShopHeader: dropdown `Khuyến mãi`

#### 5.1. State & fetch

- Thêm state:

```ts
const [promotionItems, setPromotionItems] =
  useState<PromotionSummaryDto[] | null>(null);
const [isPromotionsOpen, setIsPromotionsOpen] = useState(false);
const [isLoadingPromotions, setIsLoadingPromotions] = useState(false);
const [promotionsError, setPromotionsError] = useState<string | null>(null);
```

- Khi hover/click nav `Khuyến mãi`:
  - Nếu `promotionItems === null`: fetch `GET /api/shop/promotions`.

#### 5.2. UI

- Dropdown nội dung:
  - Header: “Ưu đãi đang diễn ra”.
  - Mỗi promotion:
    - `badgeText` (chip nhỏ).
    - `title` (đậm).
    - `subtitle` (nhỏ hơn).
  - Action:
    - Nếu `type === "PRODUCT_SET"`:
      - `router.push("/products?promotionId=...")`.
    - Nếu `type === "COUPON_GLOBAL"`:
      - `router.push("/promotions#id-...")`.
  - Footer: link “Xem tất cả khuyến mãi” → `/promotions`.

---

### 6. Frontend – Products page: đọc filter từ URL

**File**: `src/app/products/page.tsx`

#### 6.1. Đảm bảo đọc đầy đủ query

- Sử dụng `useSearchParams()`:
  - `search` – đã có.
  - `categoryId` – nếu sau này muốn giữ sync với sidebar.
  - `brandId` – từ dropdown Thương hiệu.
  - `onSale` – từ filter “Đang giảm giá”.
  - `promotionId` – nếu cần.

- Khởi tạo state từ query:

```ts
const searchParams = useSearchParams();
const [searchTerm, setSearchTerm] = useState(
  () => searchParams.get("search")?.trim() ?? "",
);
const [activeBrandId, setActiveBrandId] = useState<string | null>(
  () => searchParams.get("brandId") ?? null,
);
const [onSaleOnly, setOnSaleOnly] = useState<boolean>(
  () => searchParams.get("onSale") === "true",
);
```

- `useEffect` lắng nghe `searchParams` để sync state khi user điều hướng bằng browser/back/forward.

#### 6.2. Gọi `fetchProducts`

- Ký hàm (đã được mở rộng):

```ts
async function fetchProducts(
  page: number,
  sortBy: SortOption,
  categoryId: string | null,
  search: string,
  brandId: string | null,
  onSale: boolean,
  promotionId: string | null,
)
```

- Mọi chỗ gọi (lần load đầu, nút Retry, đổi trang, đổi sort, đổi brand/category) đều truyền full params từ state.

#### 6.3. Filter “Đang giảm giá”

- UI:
  - Một checkbox / pill “Chỉ hiển thị sản phẩm đang khuyến mãi”.
  - Khi bật:
    - `setOnSaleOnly(true); setCurrentPage(1);`
    - Optionally, update URL bằng `router.push` với `onSale=true`.

---

### 7. Trang `/brands` & `/promotions` (mô tả high-level)

> Có thể triển khai sau khi dropdown hoạt động ổn định.

#### 7.1. `/brands`

- Layout:
  - Grid card brand, có logo + tên + số lượng sản phẩm.
  - Bộ lọc theo chữ cái đầu (A–Z) nếu số lượng nhiều.
- Data:
  - Sử dụng `GET /api/shop/brands`.
- Interaction:
  - Click brand → `/products?brandId=...`.

#### 7.2. `/promotions`

- Layout:
  - Danh sách các khuyến mãi (group theo type).
  - Với `PRODUCT_SET`: có nút “Xem sản phẩm áp dụng” → `/products?promotionId=...`.
  - Với `COUPON_GLOBAL`: hiển thị mã, điều kiện, ngày hiệu lực.
- Data:
  - Sử dụng `GET /api/shop/promotions` + (tuỳ chọn) `GET /api/shop/promotions/[id]`.

---

### 8. Validation & xử lý lỗi

#### 8.1. API

- Brand:
  - Không có input từ client → chỉ cần try/catch quanh Prisma.
  - Lỗi DB/network: trả `500` với message chung, log chi tiết stack.

- Products:
  - `page`: parse `Number`, fallback 1, không cho nhỏ hơn 1.
  - `sort`: chỉ chấp nhận trong tập `["newest","price_asc","price_desc","name_asc"]`, sai thì fallback `"newest"`.
  - `brandId`, `categoryId`, `promotionId`: chỉ `.trim()`, không query thêm để “validate” 404 – nếu không tồn tại thì sẽ ra 0 sản phẩm (acceptable ở search).

- Promotions:
  - Cẩn thận điều kiện thời gian (`startsAt`, `endsAt`).
  - Nếu không tìm được promotion (với `/[id]`), trả `404`.

#### 8.2. Frontend

- Dropdown:
  - Nếu load brand/promotion lỗi → show message ngắn + nút `Thử lại`.
  - Không chặn render header nếu API fail.
- Products page:
  - Khi không có sản phẩm:
    - Hiển thị empty state: “Không tìm thấy sản phẩm phù hợp. Hãy thử thay đổi bộ lọc.”
- URL:
  - Tất cả điều hướng (`router.push`) cần `encodeURIComponent` cho param string.

---

### 9. Test case đề xuất

#### 9.1. Brands

1. **Có nhiều brand, sản phẩm ACTIVE**
   - Gọi `GET /api/shop/brands` → trả về đúng số brand, mỗi brand có `productCount > 0`.
2. **Brand không có sản phẩm ACTIVE**
   - Brand A không có sản phẩm ACTIVE → không xuất hiện trong kết quả.
3. **Dropdown header**
   - Hover/click `Thương hiệu` → API được gọi **một lần duy nhất** (mở lại dùng cache state).
   - UI hiển thị đúng tên, logo (nếu có), số lượng.
4. **Điều hướng**
   - Click brand JBL → URL `/products?brandId=<id-jbl>`; Products page gọi API với `brandId` đó.
   - Grid chỉ hiển thị sản phẩm JBL.

#### 9.2. Promotions

1. **Promotion active**
   - Promotion trong khoảng thời gian hiện tại → xuất hiện trong `GET /api/shop/promotions`.
2. **Promotion hết hạn / inactive**
   - `isActive = false` hoặc `endsAt` < now → không xuất hiện.
3. **Dropdown header**
   - Hover/click `Khuyến mãi` → hiển thị danh sách promotions, không crash nếu danh sách rỗng.
4. **Điều hướng**
   - Với promotion `PRODUCT_SET` → `/products?promotionId=...`, Products page truyền `promotionId` trong API.
   - Với `COUPON_GLOBAL` → `/promotions#id-...`.

#### 9.3. Filter “Đang giảm giá”

1. **Có salePrice**
   - Sản phẩm A có `salePrice < price` → xuất hiện khi `onSale=true`.
2. **Không salePrice**
   - Sản phẩm B không có `salePrice` → không xuất hiện khi `onSale=true`.
3. **Kết hợp brand + onSale**
   - Query `/products?brandId=...&onSale=true` → chỉ thấy các sản phẩm của brand đó đang giảm.

---

### 10. Checklist bảo trì & tránh lỗi

- [ ] Khi thêm `BrandFilterItemDto` & `PromotionSummaryDto`, khai báo type trong `src/types/shop.ts` (hoặc file types riêng) – không dùng `any`.
- [ ] Mọi API mới (`/api/shop/brands`, `/api/shop/promotions`) đều:
  - [ ] Bọc trong `try/catch` và log theo format `[Feature][Method]` (đồng bộ với phần còn lại).
  - [ ] Không trả về dữ liệu thừa (password, secret, ...).
- [ ] Sau khi chỉnh `ShopHeader.tsx`:
  - [ ] Kiểm tra trên desktop + mobile (header, drawer).
  - [ ] Đảm bảo dropdown không bị cắt bởi `overflow: hidden` của container.
- [ ] Sau khi mở rộng `products/page.tsx`:
  - [ ] Chạy `ReadLints` / ESLint cho file để đảm bảo không lỗi TS/ESLint.
  - [ ] Test manual các trạng thái:
    - [ ] Vào `/products` không query.
    - [ ] Vào `/products?search=loa`.
    - [ ] Vào `/products?brandId=...`.
    - [ ] Vào `/products?brandId=...&onSale=true`.
- [ ] Trước khi merge:
  - [ ] Chạy lại test/lint toàn project (nếu có script).
  - [ ] Kiểm tra lại route trùng tên (`/brands`, `/promotions`) không xung đột với route admin.

