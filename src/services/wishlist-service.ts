import { prisma } from "@/lib/prisma";
import type {
  ToggleWishlistResponseDto,
  WishlistItemDto,
  WishlistResponseDto,
} from "@/types/shop";

export type WishlistErrorCode =
  | "PRODUCT_NOT_FOUND"
  | "FORBIDDEN"
  | "WISHLIST_ITEM_NOT_FOUND";

export class WishlistServiceError extends Error {
  code: WishlistErrorCode;

  constructor(code: WishlistErrorCode, message?: string) {
    super(message ?? code);
    this.name = "WishlistServiceError";
    this.code = code;
  }
}

function mapWishlistItemToDto(input: {
  id: string;
  productId: string;
  createdAt: Date;
  product: {
    name: string;
    slug: string;
    price: unknown;
    salePrice: unknown | null;
    currency: string;
    stock: number;
    category?: { name: string };
    images: { url: string }[];
  };
}): WishlistItemDto {
  const primaryImageUrl = input.product.images[0]?.url ?? null;

  return {
    id: input.id,
    productId: input.productId,
    productName: input.product.name,
    productSlug: input.product.slug,
    categoryName: input.product.category?.name ?? null,
    productImageUrl: primaryImageUrl,
    price: Number(input.product.price),
    salePrice:
      input.product.salePrice != null ? Number(input.product.salePrice) : null,
    currency: input.product.currency,
    stock: input.product.stock,
    addedAt: input.createdAt.toISOString(),
  };
}

export async function getWishlistByUserId(
  userId: string,
  page: number = 1,
  limit: number = 4
): Promise<WishlistResponseDto> {
  const skip = (page - 1) * limit;

  const [wishlist, totalItems] = await Promise.all([
    prisma.wishlist.findUnique({
      where: { userId },
      select: {
        id: true,
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
                category: {
                  select: { name: true },
                },
                images: {
                  where: { isPrimary: true },
                  select: { url: true },
                  take: 1,
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        },
      },
    }),
    prisma.wishlistItem.count({
      where: { wishlist: { userId } },
    }),
  ]);

  if (!wishlist) {
    return {
      wishlistId: "",
      items: [],
      itemCount: 0,
      pagination: {
        total: 0,
        page,
        limit,
        totalPages: 0,
      },
    };
  }

  const items: WishlistItemDto[] = wishlist.items.map((item) =>
    mapWishlistItemToDto({
      id: item.id,
      productId: item.productId,
      createdAt: item.createdAt,
      product: {
        name: item.product.name,
        slug: item.product.slug,
        price: item.product.price,
        salePrice: item.product.salePrice,
        currency: item.product.currency,
        stock: item.product.stock,
        category: item.product.category ?? undefined,
        images: item.product.images,
      },
    }),
  );

  return {
    wishlistId: wishlist.id,
    items,
    itemCount: totalItems,
    pagination: {
      total: totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
}

export async function toggleWishlistItem(
  userId: string,
  productIdRaw: string,
): Promise<ToggleWishlistResponseDto> {
  const productId = productIdRaw.trim();

  if (!productId) {
    throw new WishlistServiceError(
      "PRODUCT_NOT_FOUND",
      "Thiếu mã sản phẩm yêu thích.",
    );
  }

  // Round 1: product lookup + wishlist get/create chạy song song (tiết kiệm 1 round-trip)
  const [product, wishlist] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    }),
    prisma.wishlist.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: {
        id: true,
        _count: { select: { items: true } },
      },
    }),
  ]);

  if (!product) {
    throw new WishlistServiceError(
      "PRODUCT_NOT_FOUND",
      "Sản phẩm không tồn tại hoặc đã bị xóa.",
    );
  }

  // Round 2: kiểm tra item đã tồn tại chưa
  const existing = await prisma.wishlistItem.findUnique({
    where: {
      wishlistId_productId: {
        wishlistId: wishlist.id,
        productId,
      },
    },
    select: { id: true },
  });

  let action: ToggleWishlistResponseDto["action"];
  let wishlistItemId: string | null;

  // Round 3: toggle – tính count từ _count snapshot, không cần round-trip thứ 5
  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    action = "removed";
    wishlistItemId = null;
  } else {
    const created = await prisma.wishlistItem.create({
      data: { wishlistId: wishlist.id, productId },
      select: { id: true },
    });
    action = "added";
    wishlistItemId = created.id;
  }

  const wishlistItemCount =
    action === "added" ? wishlist._count.items + 1 : wishlist._count.items - 1;

  const message =
    action === "added"
      ? "Đã thêm sản phẩm vào danh sách yêu thích."
      : "Đã xóa sản phẩm khỏi danh sách yêu thích.";

  return {
    message,
    action,
    wishlistItemId,
    wishlistItemCount,
  };
}

export async function isProductInWishlist(
  userId: string,
  productId: string,
): Promise<boolean> {
  if (!productId.trim()) return false;

  const item = await prisma.wishlistItem.findFirst({
    where: {
      productId,
      wishlist: { userId },
    },
    select: { id: true },
  });

  return Boolean(item);
}

export async function getWishlistProductIds(
  userId: string,
  productIds: string[],
): Promise<string[]> {
  if (productIds.length === 0) return [];

  const uniqueIds = Array.from(new Set(productIds.map((id) => id.trim()))).filter(
    (id) => id,
  );

  if (uniqueIds.length === 0) return [];

  const items = await prisma.wishlistItem.findMany({
    where: {
      productId: {
        in: uniqueIds,
      },
      wishlist: {
        userId,
      },
    },
    select: {
      productId: true,
    },
  });

  return items.map((item) => item.productId);
}

