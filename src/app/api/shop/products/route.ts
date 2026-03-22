/**
 * GET /api/shop/products
 *
 * Public API trả về danh sách sản phẩm ACTIVE cho trang shop.
 * Query params:
 *   - page        (default 1)
 *   - search      (optional, tìm theo tên)
 *   - categoryId  (optional)
 *   - brandId     (optional)
 *   - onSale      (optional, \"true\" để lọc sản phẩm đang giảm giá)
 *   - sort        "newest" | "price_asc" | "price_desc" | "name_asc" (default "newest")
 *
 * Mỗi trang 9 sản phẩm. Chỉ trả về các trường cần thiết cho ProductCard.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProductListResponseDto } from "@/types/shop";

export const runtime = "nodejs";

const PAGE_SIZE = 9;

type SortOption = "newest" | "price_asc" | "price_desc" | "name_asc";

function buildOrderBy(
  sort: SortOption,
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ price: "asc" }, { createdAt: "desc" }];
    case "price_desc":
      return [{ price: "desc" }, { createdAt: "desc" }];
    case "name_asc":
      return [{ name: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const pageParam = searchParams.get("page");
  const search = searchParams.get("search")?.trim() ?? "";
  const categoryId = searchParams.get("categoryId")?.trim() ?? "";
  const brandId = searchParams.get("brandId")?.trim() ?? "";
  const onSaleParam = searchParams.get("onSale");
  const sortParam = (searchParams.get("sort") ?? "newest") as SortOption;

  const page = Math.max(Number(pageParam ?? "1") || 1, 1);
  const sort: SortOption = ["newest", "price_asc", "price_desc", "name_asc"].includes(
    sortParam,
  )
    ? sortParam
    : "newest";

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

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (brandId) {
    where.brandId = brandId;
  }

  if (onSale) {
    where.salePrice = {
      not: null,
    };
  }

  const [rawProducts, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: buildOrderBy(sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        salePrice: true,
        currency: true,
        category: {
          select: { name: true },
        },
        brand: {
          select: { name: true },
        },
        images: {
          where: { isPrimary: true },
          select: { url: true },
          take: 1,
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const data = rawProducts.map((p) => ({
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

  const response: ProductListResponseDto = {
    data,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };

  return NextResponse.json(response);
}
