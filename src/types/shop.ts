// DTO dùng cho các trang shop phía client

export type ProductCardDto = {
  id: string;
  name: string;
  slug: string;
  price: number;
  salePrice: number | null;
  currency: string;
  categoryName: string | null;
  brandName: string | null;
  primaryImageUrl: string | null;
};

export type ProductListResponseDto = {
  data: ProductCardDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ========= Header filter DTOs =========

export type BrandFilterItemDto = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  productCount: number;
};

export type PromotionSummaryDto = {
  id: string;
  title: string;
  subtitle: string | null;
  badgeText: string | null;
  type: "PRODUCT_SET" | "COUPON_GLOBAL";
  startsAt: string;
  endsAt: string | null;
};

// ========= Product Detail DTOs =========

export type ProductImageDto = {
  id: string;
  url: string;
  alt: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export type ReviewDto = {
  id: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  isVerified?: boolean;
  user: {
    name: string | null;
    image: string | null;
  };
};

export type ReviewStatsDto = {
  avgRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
};

export type ProductDetailResponseDto = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  salePrice: number | null;
  currency: string;
  stock: number;
  status: "ACTIVE" | "HIDDEN" | "DRAFT";
  seoTitle: string | null;
  seoDescription: string | null;
  aiDescription: string | null;
  aiTags: string[];
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  brand: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  } | null;
  images: ProductImageDto[];
  reviews: ReviewDto[];
  reviewStats: ReviewStatsDto;
  relatedProducts: ProductCardDto[];
};

// ========= Cart DTOs =========

export type CartItemDto = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productImageUrl: string | null;
  brandName: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
};

export type CartResponseDto = {
  cartId: string;
  items: CartItemDto[];
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
};

export type AddToCartRequestDto = {
  productId: string;
  quantity: number;
};

export type AddToCartResponseDto = {
  message: string;
  cartItem: CartItemDto;
  cartItemCount: number;
};

export type UpdateCartItemRequestDto = {
  quantity: number;
};

export type UpdateCartItemResponseDto = {
  message: string;
  cartItem: CartItemDto;
  cartItemCount: number;
};

export type RemoveCartItemResponseDto = {
  message: string;
  cartItemCount: number;
};

// ========= Wishlist DTOs =========

export type WishlistItemDto = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productImageUrl: string | null;
  categoryName: string | null;
  price: number;
  salePrice: number | null;
  currency: string;
  stock: number;
  addedAt: string;
};

export type WishlistResponseDto = {
  wishlistId: string;
  items: WishlistItemDto[];
  itemCount: number;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type ToggleWishlistResponseDto = {
  message: string;
  action: "added" | "removed";
  wishlistItemId: string | null;
  wishlistItemCount: number;
};
