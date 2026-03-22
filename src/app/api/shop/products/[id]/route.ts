/**
 * GET /api/shop/products/[id]
 *
 * Trả về chi tiết sản phẩm theo ID cho trang product detail.
 * Chỉ trả về sản phẩm có status ACTIVE.
 *
 * Response: ProductDetailResponseDto
 *   - Thông tin đầy đủ sản phẩm, images, reviews, reviewStats, relatedProducts
 *
 * 404: sản phẩm không tồn tại hoặc không ACTIVE
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ReviewModerationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ProductDetailResponseDto,
  ProductCardDto,
  ReviewStatsDto,
} from "@/types/shop";

export const runtime = "nodejs";

const RELATED_LIMIT = 4;
const REVIEW_LIMIT = 10;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ message: "ID sản phẩm không hợp lệ." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      salePrice: true,
      currency: true,
      stock: true,
      status: true,
      seoTitle: true,
      seoDescription: true,
      aiDescription: true,
      aiTags: true,
      categoryId: true,
      category: {
        select: { id: true, name: true, slug: true },
      },
      brand: {
        select: { id: true, name: true, slug: true, logoUrl: true },
      },
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: { id: true, url: true, alt: true, isPrimary: true, sortOrder: true },
      },
      reviews: {
        where: { status: ReviewModerationStatus.APPROVED },
        orderBy: { createdAt: "desc" },
        take: REVIEW_LIMIT,
        select: {
          id: true,
          userId: true,
          rating: true,
          comment: true,
          createdAt: true,
          orderId: true,
          user: { select: { name: true, image: true } },
        },
      },
      _count: {
        select: {
          reviews: { where: { status: ReviewModerationStatus.APPROVED } },
        },
      },
    },
  });

  if (!product || product.status !== "ACTIVE") {
    return NextResponse.json({ message: "Sản phẩm không tồn tại." }, { status: 404 });
  }

  // Tính reviewStats: phân bố rating
  const ratingGroups = await prisma.review.groupBy({
    by: ["rating"],
    where: { productId: id, status: ReviewModerationStatus.APPROVED },
    _count: { rating: true },
  });

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;
  for (const group of ratingGroups) {
    distribution[group.rating] = group._count.rating;
    ratingSum += group.rating * group._count.rating;
  }

  const totalReviews = product._count.reviews;
  const avgRating = totalReviews > 0 ? Math.round((ratingSum / totalReviews) * 10) / 10 : 0;

  const reviewStats: ReviewStatsDto = { avgRating, totalReviews, distribution };

  // Lấy related products cùng category (nếu có), khác id hiện tại
  let relatedRaw: {
    id: string;
    name: string;
    slug: string;
    price: { toFixed: (n: number) => string } & (object | number);
    salePrice: ({ toFixed: (n: number) => string } & (object | number)) | null;
    currency: string;
    category: { name: string } | null;
    brand: { name: string } | null;
    images: { url: string }[];
  }[] = [];

  if (product.categoryId) {
    relatedRaw = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        categoryId: product.categoryId,
        id: { not: id },
      },
      take: RELATED_LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        salePrice: true,
        currency: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        images: {
          where: { isPrimary: true },
          select: { url: true },
          take: 1,
        },
      },
    });
  }

  const relatedProducts: ProductCardDto[] = relatedRaw.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    salePrice: p.salePrice != null ? Number(p.salePrice) : null,
    currency: p.currency,
    categoryName: p.category?.name ?? null,
    brandName: p.brand?.name ?? null,
    primaryImageUrl: p.images[0]?.url ?? null,
  }));

  const response: ProductDetailResponseDto = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: Number(product.price),
    salePrice: product.salePrice != null ? Number(product.salePrice) : null,
    currency: product.currency,
    stock: product.stock,
    status: product.status as "ACTIVE" | "HIDDEN" | "DRAFT",
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    aiDescription: product.aiDescription,
    aiTags: product.aiTags,
    category: product.category ?? null,
    brand: product.brand ?? null,
    images: product.images,
    reviews: product.reviews.map((r) => ({
      id: r.id,
      userId: r.userId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      isVerified: !!r.orderId,
      user: { name: r.user.name, image: r.user.image },
    })),
    reviewStats,
    relatedProducts,
  };

  return NextResponse.json(response);
}
