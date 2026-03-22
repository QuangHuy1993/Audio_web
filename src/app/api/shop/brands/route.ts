/**
 * GET /api/shop/brands
 *
 * Public API trả về danh sách thương hiệu có ít nhất 1 sản phẩm ACTIVE,
 * kèm tổng số sản phẩm theo brand. Dùng cho:
 *  - Dropdown "Thương hiệu" trên header.
 *  - Trang /brands (khám phá thương hiệu).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { BrandFilterItemDto } from "@/types/shop";

export const runtime = "nodejs";

export async function GET() {
  try {
    const brands = await prisma.brand.findMany({
      where: {
        products: {
          some: {
            status: "ACTIVE",
          },
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
              where: {
                status: "ACTIVE",
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const items: BrandFilterItemDto[] = brands
      .filter((b) => b._count.products > 0)
      .map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        logoUrl: b.logoUrl ?? null,
        productCount: b._count.products,
      }))
      .sort((a, b) => {
        if (b.productCount !== a.productCount) {
          return b.productCount - a.productCount;
        }
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[ShopBrands][GET] Failed to load brands", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách thương hiệu." },
      { status: 500 },
    );
  }
}

