# Workflow: API Giỏ hàng & Yêu thích – Đức Uy Audio

Tài liệu này mô tả chi tiết thiết kế API, service layer, DTOs, luồng xử lý và cách tích hợp vào UI cho tính năng **Giỏ hàng** (`Cart`) và **Sản phẩm yêu thích** (`Wishlist`).

---

## 1. Bối cảnh & Schema hiện tại

### 1.1. Schema Prisma liên quan

```
model Cart {
  id        String      @id @default(cuid())
  userId    String?     @unique
  status    CartStatus  @default(ACTIVE)
  items     CartItem[]
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  @@index([status, createdAt])
}

model CartItem {
  id         String   @id @default(cuid())
  cartId     String
  productId  String
  quantity   Int      @default(1)
  unitPrice  Decimal  @db.Decimal(12, 2)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@unique([cartId, productId])   // cùng cart không có 2 dòng cùng sản phẩm
  @@index([productId])
}

model Wishlist {
  id        String         @id @default(cuid())
  userId    String         @unique
  items     WishlistItem[]
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
}

model WishlistItem {
  id          String   @id @default(cuid())
  wishlistId  String
  productId   String
  createdAt   DateTime @default(now())
  @@unique([wishlistId, productId])   // mỗi sản phẩm chỉ xuất hiện 1 lần trong wishlist
  @@index([productId])
}
```

**Điểm then chốt từ schema**:
- `CartItem` có `@@unique([cartId, productId])` → tự nhiên "upsert" khi thêm cùng sản phẩm: tăng `quantity`.
- Giỏ hàng hiện tại chỉ hỗ trợ user đã đăng nhập (`userId @unique`) – chưa có guest cart.
- `Wishlist` cũng chỉ cho user đã đăng nhập.

---

## 2. Nguyên tắc thiết kế

1. **Tất cả API giỏ hàng và wishlist yêu cầu xác thực** – trả về `401` nếu chưa đăng nhập.
2. **Cart "upsert" tự nhiên**: Thêm sản phẩm đã có trong giỏ → tăng `quantity`, không tạo dòng mới.
3. **Server luôn tự lấy `userId` từ session** – không nhận `userId` từ body client.
4. **Logic nghiệp vụ tập trung vào service layer** (`src/services/cart-service.ts`, `src/services/wishlist-service.ts`) – API route chỉ validate input + gọi service + trả response.
5. **Cart count trên Header** = số dòng `CartItem` khác nhau (số loại sản phẩm), không phải tổng `quantity`.
6. **Header tự fetch** cart count qua React Context/Hook (`useCartContext`) – không nhận qua prop từ trang cha.

---

## 3. DTOs

Thêm vào `src/types/shop.ts`:

```typescript
// ========= Cart DTOs =========

export type CartItemDto = {
  id: string;           // CartItem.id
  productId: string;
  productName: string;
  productSlug: string;
  productImageUrl: string | null;
  unitPrice: number;    // giá tại thời điểm thêm vào giỏ
  quantity: number;
  subtotal: number;     // unitPrice * quantity
};

export type CartResponseDto = {
  cartId: string;
  items: CartItemDto[];
  itemCount: number;    // số loại sản phẩm (distinct) – dùng cho badge header
  totalQuantity: number; // tổng số lượng tất cả items
  subtotal: number;     // tổng tiền trước coupon/ship
};

export type AddToCartRequestDto = {
  productId: string;
  quantity: number;     // số lượng muốn thêm (default 1)
};

export type AddToCartResponseDto = {
  message: string;
  cartItem: CartItemDto;
  cartItemCount: number; // badge count sau khi thêm
};

export type UpdateCartItemRequestDto = {
  quantity: number;     // số lượng mới (>= 1)
};

export type UpdateCartItemResponseDto = {
  message: string;
  cartItem: CartItemDto;
  cartItemCount: number;
};

export type RemoveCartItemResponseDto = {
  message: string;
  cartItemCount: number; // badge count sau khi xóa
};

// ========= Wishlist DTOs =========

export type WishlistItemDto = {
  id: string;           // WishlistItem.id
  productId: string;
  productName: string;
  productSlug: string;
  productImageUrl: string | null;
  price: number;
  salePrice: number | null;
  currency: string;
  stock: number;
  addedAt: string;      // ISO date string
};

export type WishlistResponseDto = {
  wishlistId: string;
  items: WishlistItemDto[];
  itemCount: number;
};

export type ToggleWishlistResponseDto = {
  message: string;
  action: "added" | "removed";   // added nếu vừa thêm, removed nếu vừa bỏ
  wishlistItemId: string | null;  // null khi removed
  wishlistItemCount: number;
};
```

---

## 4. Service Layer

### 4.1. `src/services/cart-service.ts`

**Mục đích**: Tập trung logic giỏ hàng, tái sử dụng giữa API add, update, remove, get.

**Các hàm chính**:

```typescript
// Lấy hoặc tạo mới Cart cho user
// - Nếu user chưa có cart ACTIVE, tạo mới
// - Trả về cart.id để dùng tiếp
async function getOrCreateCartForUser(userId: string): Promise<string>

// Lấy toàn bộ giỏ hàng theo userId, trả về CartResponseDto
// - Join CartItem -> Product -> ProductImage (isPrimary = true)
// - Tính subtotal, itemCount, totalQuantity
async function getCartByUserId(userId: string): Promise<CartResponseDto>

// Thêm sản phẩm vào giỏ (upsert logic):
// 1. Kiểm tra sản phẩm ACTIVE, còn hàng
// 2. Lấy/tạo cart
// 3. upsert CartItem (tăng quantity nếu đã có, tạo mới nếu chưa có)
// 4. Giá lấy từ salePrice ?? price tại thời điểm thêm (snapshot price)
// 5. Trả về CartItem đã cập nhật + cartItemCount mới
async function addToCart(userId: string, productId: string, quantity: number): Promise<AddToCartResponseDto>

// Cập nhật quantity của CartItem
// - Validate quantity >= 1
// - Validate CartItem thuộc về cart của userId
// - Cập nhật, trả về CartItem + cartItemCount mới
async function updateCartItemQuantity(userId: string, cartItemId: string, quantity: number): Promise<UpdateCartItemResponseDto>

// Xóa CartItem
// - Validate CartItem thuộc về cart của userId (chống IDOR)
// - Xóa, trả về cartItemCount mới
async function removeCartItem(userId: string, cartItemId: string): Promise<RemoveCartItemResponseDto>

// Lấy số lượng loại sản phẩm trong giỏ (badge count)
async function getCartItemCount(userId: string): Promise<number>
```

**Luồng upsert thêm vào giỏ hàng**:

```
addToCart(userId, productId, quantity)
  ├─ prisma.product.findUnique({ where: { id: productId, status: 'ACTIVE' } })
  │    └─ Nếu null hoặc stock = 0 → throw Error("Sản phẩm không tồn tại hoặc hết hàng")
  ├─ getOrCreateCartForUser(userId) → cartId
  ├─ effectivePrice = product.salePrice ?? product.price
  ├─ prisma.cartItem.upsert({
  │    where: { cartId_productId: { cartId, productId } },
  │    update: { quantity: { increment: quantity } },
  │    create: { cartId, productId, quantity, unitPrice: effectivePrice }
  │  })
  ├─ cartItemCount = await prisma.cartItem.count({ where: { cartId } })
  └─ return { message, cartItem: mapToDto(item, product), cartItemCount }
```

### 4.2. `src/services/wishlist-service.ts`

**Mục đích**: Tập trung logic wishlist – toggle (thêm nếu chưa có, xóa nếu đã có).

**Các hàm chính**:

```typescript
// Lấy toàn bộ wishlist theo userId, trả về WishlistResponseDto
async function getWishlistByUserId(userId: string): Promise<WishlistResponseDto>

// Toggle: thêm nếu chưa có, xóa nếu đã có
// - Kiểm tra sản phẩm tồn tại
// - Lấy/tạo Wishlist cho user
// - findUnique WishlistItem theo wishlistId_productId
//   - Nếu tồn tại → xóa, action = "removed"
//   - Nếu chưa có → tạo, action = "added"
// - Trả về ToggleWishlistResponseDto
async function toggleWishlistItem(userId: string, productId: string): Promise<ToggleWishlistResponseDto>

// Kiểm tra một sản phẩm có trong wishlist của user không (dùng để render icon filled/outline)
async function isProductInWishlist(userId: string, productId: string): Promise<boolean>

// Lấy danh sách productId đang trong wishlist (dùng bulk check cho trang danh sách sản phẩm)
async function getWishlistProductIds(userId: string): Promise<string[]>
```

---

## 5. Prisma Query Tối ưu

Toàn bộ query đều dùng `select` tường minh – chỉ lấy đúng trường cần thiết, không lấy thừa. Không dùng `findMany` / `findUnique` không có `select` cho các relation.

---

### 5.1. Cart queries

#### `getCartItemCount(userId)` – nhẹ nhất, chỉ đếm

```typescript
// Dùng relation count, không join CartItem ra
const cart = await prisma.cart.findUnique({
  where: { userId },
  select: {
    _count: { select: { items: true } },
  },
});
return cart?._count.items ?? 0;
```

> Dùng cho `/api/shop/cart/count`. Chỉ 1 query nhỏ, không load CartItem hay Product.

---

#### `getOrCreateCartForUser(userId)` – trả về cartId

```typescript
const cart = await prisma.cart.upsert({
  where: { userId },
  create: { userId, status: "ACTIVE" },
  update: {},           // không thay đổi gì nếu đã tồn tại
  select: { id: true }, // chỉ cần id để dùng tiếp
});
return cart.id;
```

---

#### `getCartByUserId(userId)` – lấy giỏ hàng đầy đủ

```typescript
const cart = await prisma.cart.findUnique({
  where: { userId },
  select: {
    id: true,
    items: {
      select: {
        id: true,
        productId: true,
        quantity: true,
        unitPrice: true,        // snapshot giá – không lấy product.price lại
        product: {
          select: {
            name: true,
            slug: true,
            images: {
              where: { isPrimary: true }, // chỉ ảnh chính, không lấy toàn bộ gallery
              select: { url: true },
              take: 1,                    // tối đa 1 ảnh
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    },
    _count: { select: { items: true } }, // itemCount trong 1 query
  },
});

// Map sang CartResponseDto:
// - itemCount  = cart._count.items
// - subtotal   = items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0)
// - totalQty   = items.reduce((sum, i) => sum + i.quantity, 0)
// - productImageUrl = item.product.images[0]?.url ?? null
```

> Không load `description`, `aiTags`, `price` (dùng `unitPrice` snapshot), `seoTitle`, `brandId`, `categoryId`.

---

#### `addToCart(userId, productId, quantity)` – upsert

```typescript
// Bước 1: kiểm tra sản phẩm – chỉ select trường cần thiết
const product = await prisma.product.findUnique({
  where: { id: productId },
  select: {
    id: true,
    name: true,
    slug: true,
    price: true,
    salePrice: true,
    stock: true,
    status: true,
    images: {
      where: { isPrimary: true },
      select: { url: true },
      take: 1,
    },
  },
});

if (!product || product.status !== "ACTIVE") → 404
if (product.stock <= 0) → 409

// Bước 2: lấy / tạo cart
const cartId = await getOrCreateCartForUser(userId); // trả về string id

// Bước 3: upsert CartItem – không include relation, tự map DTO từ product đã có
const effectivePrice = product.salePrice ?? product.price;
const wasExisting = await prisma.cartItem.findUnique({
  where: { cartId_productId: { cartId, productId } },
  select: { id: true },
});

const upserted = await prisma.cartItem.upsert({
  where: { cartId_productId: { cartId, productId } },
  create: { cartId, productId, quantity, unitPrice: effectivePrice },
  update: { quantity: { increment: quantity } },
  select: { id: true, quantity: true, unitPrice: true },
});

// Bước 4: đếm số loại sản phẩm trong giỏ
const cartItemCount = await prisma.cartItem.count({ where: { cartId } });

// Trả về:
// - isExisting → status 200 (tăng qty) / 201 (thêm mới)
// - cartItem: map từ upserted + product data đã có
// - cartItemCount
```

> Dùng `wasExisting` để phân biệt 200 / 201 mà không cần query thêm sau upsert.

---

#### `updateCartItemQuantity(userId, cartItemId, quantity)` – IDOR check + update

```typescript
// Bước 1: tìm CartItem, kèm check ownership bằng 1 query
const cartItem = await prisma.cartItem.findUnique({
  where: { id: cartItemId },
  select: {
    id: true,
    cartId: true,
    productId: true,
    unitPrice: true,
    product: {
      select: {
        name: true,
        slug: true,
        images: {
          where: { isPrimary: true },
          select: { url: true },
          take: 1,
        },
      },
    },
    cart: {
      select: { userId: true }, // chỉ lấy userId để verify
    },
  },
});

if (!cartItem) → 404
if (cartItem.cart.userId !== userId) → 403

// Bước 2: update – không include thêm gì vì đã có data
const updated = await prisma.cartItem.update({
  where: { id: cartItemId },
  data: { quantity },
  select: { quantity: true }, // chỉ cần quantity mới để compose response
});

// Bước 3: đếm
const cartItemCount = await prisma.cartItem.count({ where: { cartId: cartItem.cartId } });

// Map CartItemDto từ cartItem (bước 1) + updated.quantity
```

> 3 query nhỏ, không load thừa. `cart: { select: { userId: true } }` thay vì include toàn bộ Cart.

---

#### `removeCartItem(userId, cartItemId)` – IDOR check + delete

```typescript
// Bước 1: ownership check – chỉ select đúng 2 trường
const cartItem = await prisma.cartItem.findUnique({
  where: { id: cartItemId },
  select: {
    cartId: true,
    cart: { select: { userId: true } },
  },
});

if (!cartItem) → 404
if (cartItem.cart.userId !== userId) → 403

// Bước 2: xóa
await prisma.cartItem.delete({ where: { id: cartItemId } });

// Bước 3: đếm lại sau khi xóa
const cartItemCount = await prisma.cartItem.count({
  where: { cartId: cartItem.cartId },
});
```

---

### 5.2. Wishlist queries

#### `getWishlistProductIds(userId)` – bulk check nhẹ nhất

```typescript
// Dùng cho /api/shop/wishlist/check khi đã có danh sách productIds cần kiểm tra
const items = await prisma.wishlistItem.findMany({
  where: {
    wishlist: { userId },
    productId: { in: productIds }, // filter ngay tại DB, không load toàn bộ wishlist
  },
  select: { productId: true },    // chỉ cần productId, không join Product
});
return items.map((i) => i.productId);
```

> Không load Wishlist ra, query thẳng WishlistItem với double filter. Cực nhẹ khi `productIds` có giới hạn (tối đa 1 page = 9 items).

---

#### `getWishlistByUserId(userId)` – trang yêu thích

```typescript
const wishlist = await prisma.wishlist.findUnique({
  where: { userId },
  select: {
    id: true,
    _count: { select: { items: true } }, // itemCount trong 1 query
    items: {
      select: {
        id: true,
        productId: true,
        createdAt: true,
        product: {
          select: {
            name: true,
            slug: true,
            price: true,
            salePrice: true,
            currency: true,
            stock: true,
            images: {
              where: { isPrimary: true },
              select: { url: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    },
  },
});
```

> Không load `description`, `aiTags`, `seoTitle`, `brandId`, `categoryId` của Product.

---

#### `toggleWishlistItem(userId, productId)` – check → create/delete

```typescript
// Bước 1: kiểm tra product tồn tại – chỉ select id
const product = await prisma.product.findUnique({
  where: { id: productId },
  select: { id: true },
});
if (!product) → 404

// Bước 2: upsert Wishlist – chỉ cần id
const wishlist = await prisma.wishlist.upsert({
  where: { userId },
  create: { userId },
  update: {},
  select: { id: true },
});

// Bước 3: kiểm tra WishlistItem đã tồn tại chưa – chỉ select id
const existing = await prisma.wishlistItem.findUnique({
  where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
  select: { id: true },
});

let action: "added" | "removed";
let wishlistItemId: string | null;

if (existing) {
  // Bước 4a: xóa
  await prisma.wishlistItem.delete({ where: { id: existing.id } });
  action = "removed";
  wishlistItemId = null;
} else {
  // Bước 4b: thêm – chỉ select id để trả về
  const created = await prisma.wishlistItem.create({
    data: { wishlistId: wishlist.id, productId },
    select: { id: true },
  });
  action = "added";
  wishlistItemId = created.id;
}

// Bước 5: đếm
const wishlistItemCount = await prisma.wishlistItem.count({
  where: { wishlistId: wishlist.id },
});
```

---

### 5.3. Tóm tắt chiến lược tối ưu query

| Operation | Số query | Kỹ thuật |
|---|---|---|
| Badge count header | 1 | `_count` relation, không join CartItem |
| Thêm vào giỏ | 4 | product check → upsert cart → cartItem upsert → count |
| Sửa quantity | 3 | findUnique (ownership) → update → count |
| Xóa item | 3 | findUnique (ownership) → delete → count |
| Lấy giỏ hàng | 1 | select + nested relation + `_count` |
| Toggle wishlist | 5 | product check → wishlist upsert → item check → create/delete → count |
| Bulk check wishlist | 1 | WishlistItem.findMany với `in` filter ngay tại DB |
| Lấy wishlist | 1 | select + nested relation + `_count` |

**Nguyên tắc nhất quán**:
- Luôn `select` tường minh, không dùng `findUnique` / `findMany` không có `select`.
- Với ảnh sản phẩm: luôn `where: { isPrimary: true }, take: 1` – không load cả gallery.
- Kiểm tra ownership (IDOR): join `cart: { select: { userId: true } }` trong cùng 1 query findUnique.
- Dùng `_count` relation thay vì `items.length` để tránh load toàn bộ mảng chỉ để đếm.
- Bulk check wishlist: filter `productId: { in: productIds }` tại DB, không load hết rồi filter ở JS.

---

## 6. API Routes

### 5.1. Giỏ hàng

#### `GET /api/shop/cart`
```
File:    src/app/api/shop/cart/route.ts
Auth:    Required (401 nếu chưa đăng nhập)
Mục đích: Lấy toàn bộ giỏ hàng hiện tại của user

Response 200:
  CartResponseDto {
    cartId, items[], itemCount, totalQuantity, subtotal
  }

Response 401: { error: "Yêu cầu đăng nhập" }
Response 500: { error: "Không thể tải giỏ hàng" }
```

#### `POST /api/shop/cart/items`
```
File:    src/app/api/shop/cart/items/route.ts
Auth:    Required (401 nếu chưa đăng nhập)
Mục đích: Thêm sản phẩm vào giỏ. Nếu sản phẩm đã có → tăng quantity.

Body (AddToCartRequestDto):
  { productId: string, quantity?: number }  // quantity default 1

Validate:
  - productId: required, non-empty string
  - quantity: integer >= 1, <= 99

Response 200 (đã có trong giỏ, tăng quantity):
  AddToCartResponseDto { message: "Đã tăng số lượng sản phẩm trong giỏ", cartItem, cartItemCount }

Response 201 (thêm mới):
  AddToCartResponseDto { message: "Đã thêm vào giỏ hàng", cartItem, cartItemCount }

Response 400: { error: "Dữ liệu không hợp lệ" }
Response 401: { error: "Yêu cầu đăng nhập" }
Response 404: { error: "Sản phẩm không tồn tại hoặc không còn bán" }
Response 409: { error: "Sản phẩm tạm hết hàng" }
Response 500: { error: "Không thể thêm vào giỏ hàng" }
```

#### `GET /api/shop/cart/count`
```
File:    src/app/api/shop/cart/count/route.ts
Auth:    Required
Mục đích: Chỉ trả về số loại sản phẩm trong giỏ – dùng cho Header badge.
          Endpoint nhẹ, không join nhiều bảng.

Response 200:
  { count: number }

Response 401: { error: "Yêu cầu đăng nhập" }
```

#### `PATCH /api/shop/cart/items/[itemId]`
```
File:    src/app/api/shop/cart/items/[itemId]/route.ts
Auth:    Required
Mục đích: Cập nhật quantity của 1 CartItem. Validate quyền sở hữu.

Body (UpdateCartItemRequestDto):
  { quantity: number }  // >= 1

Validate:
  - quantity: integer >= 1, <= 99

Response 200:
  UpdateCartItemResponseDto { message, cartItem, cartItemCount }

Response 400: { error: "Số lượng không hợp lệ" }
Response 401: { error: "Yêu cầu đăng nhập" }
Response 403: { error: "Không có quyền thao tác" }
Response 404: { error: "Không tìm thấy sản phẩm trong giỏ" }
```

#### `DELETE /api/shop/cart/items/[itemId]`
```
File:    src/app/api/shop/cart/items/[itemId]/route.ts (cùng file với PATCH)
Auth:    Required
Mục đích: Xóa 1 CartItem. Validate quyền sở hữu.

Response 200:
  RemoveCartItemResponseDto { message: "Đã xóa khỏi giỏ hàng", cartItemCount }

Response 401: { error: "Yêu cầu đăng nhập" }
Response 403: { error: "Không có quyền thao tác" }
Response 404: { error: "Không tìm thấy sản phẩm trong giỏ" }
```

---

### 5.2. Yêu thích (Wishlist)

#### `GET /api/shop/wishlist`
```
File:    src/app/api/shop/wishlist/route.ts
Auth:    Required
Mục đích: Lấy danh sách sản phẩm yêu thích của user.

Response 200:
  WishlistResponseDto { wishlistId, items[], itemCount }

Response 401: { error: "Yêu cầu đăng nhập" }
Response 500: { error: "Không thể tải danh sách yêu thích" }
```

#### `POST /api/shop/wishlist/toggle`
```
File:    src/app/api/shop/wishlist/toggle/route.ts
Auth:    Required
Mục đích: Toggle sản phẩm trong wishlist.
          - Nếu chưa có → thêm vào (action: "added")
          - Nếu đã có → xóa (action: "removed")
          Dùng 1 endpoint duy nhất để UI không cần quản lý state 2 chiều phức tạp.

Body:
  { productId: string }

Response 200:
  ToggleWishlistResponseDto { message, action, wishlistItemId, wishlistItemCount }

Response 400: { error: "productId không hợp lệ" }
Response 401: { error: "Yêu cầu đăng nhập" }
Response 404: { error: "Sản phẩm không tồn tại" }
Response 500: { error: "Không thể cập nhật danh sách yêu thích" }
```

#### `GET /api/shop/wishlist/check`
```
File:    src/app/api/shop/wishlist/check/route.ts
Auth:    Required
Mục đích: Kiểm tra 1 hoặc nhiều productId có trong wishlist không.
          Dùng cho trang danh sách sản phẩm – bulk check sau khi load xong.

Query params:
  - productIds: comma-separated list (vd: "abc123,def456,ghi789")

Response 200:
  { productIds: string[] }   // danh sách productId đang có trong wishlist

Response 401: { error: "Yêu cầu đăng nhập" }
```

---

## 7. Cart Context và Header Badge

### 7.1. Vấn đề hiện tại

`ShopHeader` nhận `cartCount` qua prop. Trang nào dùng `ShopHeader` cũng phải tự fetch và truyền số này xuống → trùng lặp, khó đồng bộ sau khi user thêm/xóa sản phẩm.

### 7.2. Giải pháp: CartContext

**File**: `src/features/shop/context/CartContext.tsx`

```typescript
// Context cung cấp:
type CartContextValue = {
  cartItemCount: number;             // số loại sản phẩm – dùng cho badge
  refreshCartCount: () => void;      // gọi sau khi add/remove thành công
};
```

**Luồng**:
1. `CartContext` mount → gọi `GET /api/shop/cart/count` (nếu user đã đăng nhập).
2. Khi thêm/xóa sản phẩm thành công, gọi `refreshCartCount()` → cập nhật badge ngay lập tức.
3. `ShopHeader` lấy `cartItemCount` từ `useCartContext()` thay vì nhận qua prop.

**Đặt Provider**: Trong `src/app/layout.tsx` (hoặc layout của shop group) – wrap bên trong `AuthProvider` (SessionProvider) để có thể đọc session.

**Chú ý**: Provider chỉ gọi API khi session tồn tại (user đã đăng nhập), tránh 401 với guest.

### 7.3. Thay đổi ShopHeader

- Xóa prop `cartCount?: number` (hoặc giữ lại làm fallback, giá trị mặc định 0).
- Bên trong component, gọi `useCartContext()` để lấy `cartItemCount`.
- Badge: `cartItemCount > 9 ? "9+" : cartItemCount` (giữ nguyên logic hiện tại).

---

## 8. Luồng UX tích hợp

### 8.1. Thêm vào giỏ hàng (từ bất kỳ trang nào)

```
User click "Thêm vào giỏ"
  ├─ Nếu chưa đăng nhập → toast.info("Vui lòng đăng nhập") + router.push("/login")
  ├─ Nếu đã đăng nhập:
  │    ├─ Button đổi sang trạng thái loading (disable, spinner)
  │    ├─ POST /api/shop/cart/items { productId, quantity }
  │    ├─ Thành công:
  │    │    ├─ toast.success("Đã thêm vào giỏ hàng")
  │    │    ├─ refreshCartCount() → badge header cập nhật ngay
  │    │    └─ Button trở lại trạng thái normal
  │    └─ Thất bại:
  │         ├─ toast.error(message từ server hoặc "Không thể thêm vào giỏ hàng")
  │         └─ Button trở lại trạng thái normal
```

### 8.2. Toggle yêu thích (từ bất kỳ trang nào)

```
User click icon tim
  ├─ Nếu chưa đăng nhập → toast.info("Vui lòng đăng nhập để lưu yêu thích") + router.push("/login")
  ├─ Nếu đã đăng nhập:
  │    ├─ Icon đổi sang loading (tạm disable)
  │    ├─ POST /api/shop/wishlist/toggle { productId }
  │    ├─ action = "added":
  │    │    ├─ Icon đổi sang MdFavorite (filled, màu đỏ/accent)
  │    │    └─ toast.success("Đã thêm vào danh sách yêu thích")
  │    └─ action = "removed":
  │         ├─ Icon đổi về MdFavoriteBorder (outline)
  │         └─ toast.success("Đã xóa khỏi danh sách yêu thích")
```

### 8.3. Trang danh sách sản phẩm (wishlist state)

```
ProductsPage mount
  ├─ Fetch products (đã có)
  ├─ Nếu user đã đăng nhập:
  │    └─ GET /api/shop/wishlist/check?productIds=id1,id2,...
  │         → Set wishedProductIds: Set<string>
  └─ Mỗi ProductCard: icon tim filled nếu productId in wishedProductIds
```

---

## 9. Cấu trúc file cần tạo

```
src/
├── app/
│   └── api/
│       └── shop/
│           ├── cart/
│           │   ├── route.ts                    # GET /api/shop/cart
│           │   ├── count/
│           │   │   └── route.ts                # GET /api/shop/cart/count
│           │   └── items/
│           │       ├── route.ts                # POST /api/shop/cart/items
│           │       └── [itemId]/
│           │           └── route.ts            # PATCH + DELETE /api/shop/cart/items/[itemId]
│           └── wishlist/
│               ├── route.ts                    # GET /api/shop/wishlist
│               ├── toggle/
│               │   └── route.ts                # POST /api/shop/wishlist/toggle
│               └── check/
│                   └── route.ts                # GET /api/shop/wishlist/check
├── services/
│   ├── cart-service.ts                         # Logic giỏ hàng
│   └── wishlist-service.ts                     # Logic wishlist
├── features/
│   └── shop/
│       └── context/
│           └── CartContext.tsx                 # CartContext + useCartContext hook
└── types/
    └── shop.ts                                 # Thêm các DTO cart/wishlist vào file hiện tại
```

---

## 10. Checklist triển khai

Danh sách các việc cần làm, thực hiện lần lượt:

### Bước 1 – DTO & Types
- [ ] Thêm `CartItemDto`, `CartResponseDto`, `AddToCartRequestDto`, `AddToCartResponseDto`,
      `UpdateCartItemRequestDto`, `UpdateCartItemResponseDto`, `RemoveCartItemResponseDto` vào `src/types/shop.ts`
- [ ] Thêm `WishlistItemDto`, `WishlistResponseDto`, `ToggleWishlistResponseDto` vào `src/types/shop.ts`

### Bước 2 – Service Layer
- [ ] Tạo `src/services/cart-service.ts` với các hàm:
  - `getOrCreateCartForUser`
  - `getCartByUserId`
  - `addToCart` (upsert logic)
  - `updateCartItemQuantity`
  - `removeCartItem`
  - `getCartItemCount`
- [ ] Tạo `src/services/wishlist-service.ts` với các hàm:
  - `getWishlistByUserId`
  - `toggleWishlistItem`
  - `isProductInWishlist`
  - `getWishlistProductIds`

### Bước 3 – API Routes
- [ ] Tạo `src/app/api/shop/cart/route.ts` (GET)
- [ ] Tạo `src/app/api/shop/cart/count/route.ts` (GET)
- [ ] Tạo `src/app/api/shop/cart/items/route.ts` (POST)
- [ ] Tạo `src/app/api/shop/cart/items/[itemId]/route.ts` (PATCH + DELETE)
- [ ] Tạo `src/app/api/shop/wishlist/route.ts` (GET)
- [ ] Tạo `src/app/api/shop/wishlist/toggle/route.ts` (POST)
- [ ] Tạo `src/app/api/shop/wishlist/check/route.ts` (GET)

### Bước 4 – CartContext
- [ ] Tạo `src/features/shop/context/CartContext.tsx`
  - Provider fetch `/api/shop/cart/count` khi user đăng nhập
  - Export `useCartContext()` hook
- [ ] Wrap `CartContext.Provider` vào `src/app/layout.tsx` (bên trong `AuthProvider`)

### Bước 5 – ShopHeader cập nhật
- [ ] Sửa `src/components/layout/ShopHeader.tsx`:
  - Đọc `cartItemCount` từ `useCartContext()` thay vì nhận qua prop
  - Giữ nguyên badge logic: hiển thị khi `> 0`, hiển thị "9+" khi `> 9`

### Bước 6 – Tích hợp vào các trang

#### Trang danh sách sản phẩm (`src/app/products/page.tsx` + `ProductsPage`)
- [ ] Sau khi fetch products thành công, nếu user đã đăng nhập:
  - Gọi `GET /api/shop/wishlist/check?productIds=...` để biết sản phẩm nào đã trong wishlist
  - Giữ `wishedProductIds: Set<string>` trong state
- [ ] Icon yêu thích trên mỗi ProductCard: `MdFavorite` (filled) nếu in Set, `MdFavoriteBorder` nếu không
- [ ] Nút "Thêm vào giỏ" trên ProductCard:
  - Gọi `POST /api/shop/cart/items`
  - Sau thành công: `refreshCartCount()`

#### Trang chi tiết sản phẩm (`src/features/shop/components/product-detail/ProductDetailPage.tsx`)
- [ ] Khi load sản phẩm, nếu user đã đăng nhập:
  - Gọi `GET /api/shop/wishlist/check?productIds=[id]` → set `isWished: boolean`
- [ ] Nút "Thêm vào giỏ hàng" (có quantity selector):
  - Gọi `POST /api/shop/cart/items { productId, quantity }`
  - Sau thành công: `refreshCartCount()`
- [ ] Icon yêu thích / nút "Lưu yêu thích":
  - Gọi `POST /api/shop/wishlist/toggle { productId }`
  - Toggle icon MdFavorite / MdFavoriteBorder theo `action`

#### Trang chủ (`src/app/page.tsx`)
- [ ] Nút "Thêm vào giỏ" trên featured products:
  - Gọi `POST /api/shop/cart/items` (hiện tại chỉ là static data, khi có real product id mới kết nối)
  - Sau thành công: `refreshCartCount()`

#### Trang giỏ hàng (`src/app/cart/page.tsx`) – cần tạo mới
- [ ] `GET /api/shop/cart` để hiển thị danh sách CartItem
- [ ] Cho phép tăng/giảm quantity: `PATCH /api/shop/cart/items/[itemId]`
- [ ] Xóa từng sản phẩm: `DELETE /api/shop/cart/items/[itemId]`
- [ ] Sau mỗi thao tác: `refreshCartCount()`
- [ ] Tích hợp với coupon (đã có `POST /api/shop/coupons/validate`)

#### Trang yêu thích (`src/app/wishlist/page.tsx`) – cần tạo mới
- [ ] `GET /api/shop/wishlist` để hiển thị danh sách
- [ ] Mỗi item có nút "Xóa khỏi yêu thích": gọi `POST /api/shop/wishlist/toggle { productId }`
- [ ] Nút "Thêm vào giỏ" trực tiếp từ wishlist

---

## 11. Lưu ý hiệu năng và bảo mật

- **Chống IDOR**: Trước khi PATCH/DELETE CartItem, luôn join với Cart để xác nhận `cart.userId === session.userId`.
- **Stock check**: Khi thêm vào giỏ, kiểm tra `product.stock > 0` và `product.status === "ACTIVE"`. Không check stock khi chỉ thay đổi quantity trong giỏ (user có thể đã chọn sớm).
- **Price snapshot**: `unitPrice` trong CartItem lưu giá tại thời điểm thêm vào giỏ (không tự động đồng bộ khi admin thay đổi giá) – hành vi chuẩn của e-commerce.
- **Cart count endpoint nhẹ**: `/api/shop/cart/count` chỉ dùng `prisma.cartItem.count({ where: { cart: { userId } } })` – không join bảng phụ.
- **Wishlist check bulk**: `/api/shop/wishlist/check` nhận danh sách productId và trả về subset đang có trong wishlist – tránh gọi N lần khi render danh sách sản phẩm.
