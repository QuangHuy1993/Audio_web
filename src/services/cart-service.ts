import { prisma } from "@/lib/prisma";
import type {
  AddToCartRequestDto,
  AddToCartResponseDto,
  CartItemDto,
  CartResponseDto,
  UpdateCartItemResponseDto,
  RemoveCartItemResponseDto,
} from "@/types/shop";

export type CartErrorCode =
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_INACTIVE"
  | "OUT_OF_STOCK"
  | "CART_ITEM_NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_QUANTITY";

export class CartServiceError extends Error {
  code: CartErrorCode;

  constructor(code: CartErrorCode, message?: string) {
    super(message ?? code);
    this.name = "CartServiceError";
    this.code = code;
  }
}

export async function getOrCreateCartForUser(userId: string): Promise<string> {
  const cart = await prisma.cart.upsert({
    where: { userId },
    create: {
      userId,
      status: "ACTIVE",
    },
    update: {},
    select: {
      id: true,
    },
  });

  return cart.id;
}

export async function getCartItemCount(userId: string): Promise<number> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: {
      _count: {
        select: {
          items: true,
        },
      },
    },
  });

  return cart?._count.items ?? 0;
}

function mapCartItemToDto(input: {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: unknown;
  product: {
    name: string;
    slug: string;
    images: { url: string }[];
    brand: { name: string } | null;
  };
}): CartItemDto {
  const unitPriceNumber = Number(input.unitPrice);
  const subtotal = unitPriceNumber * input.quantity;
  const primaryImageUrl = input.product.images[0]?.url ?? null;

  return {
    id: input.id,
    productId: input.productId,
    productName: input.product.name,
    productSlug: input.product.slug,
    productImageUrl: primaryImageUrl,
    brandName: input.product.brand?.name ?? null,
    unitPrice: unitPriceNumber,
    quantity: input.quantity,
    subtotal,
  };
}

export async function getCartByUserId(userId: string): Promise<CartResponseDto> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: {
      id: true,
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          unitPrice: true,
          product: {
            select: {
              name: true,
              slug: true,
              price: true,
              salePrice: true,
              images: {
                where: { isPrimary: true },
                select: { url: true },
                take: 1,
              },
              brand: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          items: true,
        },
      },
    },
  });

  if (!cart) {
    return {
      cartId: "",
      items: [],
      itemCount: 0,
      totalQuantity: 0,
      subtotal: 0,
    };
  }

  const itemsToUpdate: { id: string; price: number }[] = [];

  const items: CartItemDto[] = cart.items.map((item) => {
    // 1. Determine the effective price of the product right now
    const currentPrice = Number(item.product.salePrice ?? item.product.price);
    const cartPrice = Number(item.unitPrice);

    // 2. If it drifted, schedule an update and use the current price
    if (currentPrice !== cartPrice) {
      itemsToUpdate.push({ id: item.id, price: currentPrice });
    }

    const effectivePrice = currentPrice !== cartPrice ? currentPrice : cartPrice;

    return mapCartItemToDto({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: effectivePrice,
      product: {
        name: item.product.name,
        slug: item.product.slug,
        images: item.product.images,
        brand: item.product.brand,
      },
    });
  });

  // Background sync for the out-of-date prices
  if (itemsToUpdate.length > 0) {
    Promise.allSettled(
      itemsToUpdate.map((u) =>
        prisma.cartItem.update({
          where: { id: u.id },
          data: { unitPrice: u.price },
        })
      )
    ).catch((err) => console.error("[Cart] Auto-sync price failed", err));
  }

  const itemCount = cart._count.items;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    cartId: cart.id,
    items,
    itemCount,
    totalQuantity,
    subtotal,
  };
}

export async function addToCart(
  userId: string,
  body: AddToCartRequestDto,
): Promise<AddToCartResponseDto & { isExisting: boolean }> {
  const productId = body.productId?.trim();
  const quantity = body.quantity ?? 1;

  if (!productId) {
    throw new CartServiceError("PRODUCT_NOT_FOUND", "Thiếu mã sản phẩm.");
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new CartServiceError("INVALID_QUANTITY", "Số lượng không hợp lệ.");
  }

  // Round 1: product lookup + cart get/create chạy song song (tiết kiệm 1 round-trip)
  const [product, cart] = await Promise.all([
    prisma.product.findUnique({
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
        brand: {
          select: { name: true },
        },
      },
    }),
    prisma.cart.upsert({
      where: { userId },
      create: { userId, status: "ACTIVE" },
      update: {},
      select: {
        id: true,
        _count: { select: { items: true } },
      },
    }),
  ]);

  if (!product) {
    throw new CartServiceError(
      "PRODUCT_NOT_FOUND",
      "Sản phẩm không tồn tại hoặc đã bị xóa.",
    );
  }

  if (product.status !== "ACTIVE") {
    throw new CartServiceError(
      "PRODUCT_INACTIVE",
      "Sản phẩm hiện không còn được kinh doanh.",
    );
  }

  if (product.stock <= 0) {
    throw new CartServiceError(
      "OUT_OF_STOCK",
      "Sản phẩm tạm thời hết hàng. Vui lòng chọn sản phẩm khác.",
    );
  }

  const cartId = cart.id;

  // Round 2: kiểm tra item đã tồn tại chưa
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
    select: { id: true },
  });

  const effectivePrice = product.salePrice ?? product.price;

  // Round 3: upsert item – không cần query count riêng, tính từ _count đã có
  const upserted = await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, quantity, unitPrice: effectivePrice },
    update: { quantity: { increment: quantity } },
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      productId: true,
    },
  });

  // Tính count từ _count snapshot (không cần round-trip thứ 5)
  const isExisting = Boolean(existing);
  const cartItemCount = isExisting ? cart._count.items : cart._count.items + 1;

  const cartItemDto = mapCartItemToDto({
    id: upserted.id,
    productId: upserted.productId,
    quantity: upserted.quantity,
    unitPrice: upserted.unitPrice,
    product: {
      name: product.name,
      slug: product.slug,
      images: product.images,
      brand: product.brand,
    },
  });

  const message = isExisting
    ? "Đã tăng số lượng sản phẩm trong giỏ."
    : "Đã thêm sản phẩm vào giỏ hàng.";

  return {
    message,
    cartItem: cartItemDto,
    cartItemCount,
    isExisting,
  };
}

export async function updateCartItemQuantity(
  userId: string,
  cartItemId: string,
  quantity: number,
): Promise<UpdateCartItemResponseDto> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new CartServiceError("INVALID_QUANTITY", "Số lượng không hợp lệ.");
  }

  // Round 1: lấy item kèm _count của cart để tránh query count riêng
  const item = await prisma.cartItem.findUnique({
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
          brand: {
            select: { name: true },
          },
        },
      },
      cart: {
        select: {
          userId: true,
          _count: { select: { items: true } },
        },
      },
    },
  });

  if (!item) {
    throw new CartServiceError(
      "CART_ITEM_NOT_FOUND",
      "Không tìm thấy sản phẩm trong giỏ hàng.",
    );
  }

  if (item.cart.userId !== userId) {
    throw new CartServiceError(
      "FORBIDDEN",
      "Bạn không có quyền cập nhật sản phẩm trong giỏ hàng này.",
    );
  }

  // Round 2: cập nhật quantity – không cần query count riêng
  const updated = await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity },
    select: { id: true, quantity: true },
  });

  // Số lượng item không thay đổi khi chỉ update quantity
  const cartItemCount = item.cart._count.items;

  const cartItemDto = mapCartItemToDto({
    id: updated.id,
    productId: item.productId,
    quantity: updated.quantity,
    unitPrice: item.unitPrice,
    product: {
      name: item.product.name,
      slug: item.product.slug,
      images: item.product.images,
      brand: item.product.brand,
    },
  });

  return {
    message: "Đã cập nhật số lượng sản phẩm trong giỏ hàng.",
    cartItem: cartItemDto,
    cartItemCount,
  };
}

export async function removeCartItem(
  userId: string,
  cartItemId: string,
): Promise<RemoveCartItemResponseDto> {
  // Round 1: lấy item kèm _count để tránh query count riêng
  const item = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    select: {
      id: true,
      cartId: true,
      cart: {
        select: {
          userId: true,
          _count: { select: { items: true } },
        },
      },
    },
  });

  if (!item) {
    throw new CartServiceError(
      "CART_ITEM_NOT_FOUND",
      "Không tìm thấy sản phẩm trong giỏ hàng.",
    );
  }

  if (item.cart.userId !== userId) {
    throw new CartServiceError(
      "FORBIDDEN",
      "Bạn không có quyền xóa sản phẩm khỏi giỏ hàng này.",
    );
  }

  // Round 2: xóa item – tính count từ snapshot, không cần round-trip thứ 3
  await prisma.cartItem.delete({ where: { id: cartItemId } });

  const cartItemCount = item.cart._count.items - 1;

  return {
    message: "Đã xóa sản phẩm khỏi giỏ hàng.",
    cartItemCount,
  };
}

