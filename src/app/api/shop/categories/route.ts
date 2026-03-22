/**
 * GET /api/shop/categories
 *
 * Public API trả về danh sách danh mục cấp cao nhất (parentId = null)
 * kèm số lượng sản phẩm ACTIVE thuộc danh mục đó.
 * Chỉ trả về danh mục có ít nhất 1 sản phẩm ACTIVE.
 * Sắp xếp theo số sản phẩm giảm dần.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export type CategorySidebarItemDto = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
};

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          products: {
            where: { status: "ACTIVE" },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const data: CategorySidebarItemDto[] = categories
    .filter((c) => c._count.products > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      productCount: c._count.products,
    }))
    .sort((a, b) => b.productCount - a.productCount);

  return NextResponse.json({ data });
}
