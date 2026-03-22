import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type InventorySummaryDto = {
  totalProducts: number;
  outOfStock: number;
  lowStock: number;
  okStock: number;
};

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền xem thống kê tồn kho." },
      { status: 403 },
    );
  }

  // Chỉ thống kê những sản phẩm đang ACTIVE để phản ánh đúng kho hàng thực tế.
  const baseWhere: Prisma.ProductWhereInput = {
    status: "ACTIVE",
  };

  try {
    const [totalProducts, outOfStock, lowStock, okStock] = await Promise.all([
      prisma.product.count({ where: baseWhere }),
      prisma.product.count({
        where: {
          ...baseWhere,
          stock: 0,
        },
      }),
      prisma.product.count({
        where: {
          ...baseWhere,
          stock: { gt: 0, lte: 3 },
        },
      }),
      prisma.product.count({
        where: {
          ...baseWhere,
          stock: { gt: 3 },
        },
      }),
    ]);

    const data: InventorySummaryDto = {
      totalProducts,
      outOfStock,
      lowStock,
      okStock,
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error(
      "[GET /api/admin/inventory/summary] Failed to build inventory summary",
      error,
    );
    return NextResponse.json(
      { error: "Không thể tải thống kê tồn kho. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

