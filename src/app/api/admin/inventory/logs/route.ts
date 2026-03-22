import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DEFAULT_PAGE_SIZE = 20;

type InventoryLogListItemDto = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  change: number;
  reason: string | null;
  source: string | null;
  referenceId: string | null;
  createdAt: string;
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền xem lịch sử tồn kho." },
      { status: 403 },
    );
  }

  const ALLOWED_SOURCES = [
    "ADMIN_CREATE_PRODUCT",
    "ADMIN_STOCK_IMPORT",
    "ADMIN_STOCK_ADJUST",
    "ORDER_PLACED",
    "ORDER_CANCELLED",
  ] as const;

  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");
  const search = searchParams.get("search")?.trim() ?? "";
  const sourceParam = searchParams.get("source")?.trim() ?? "";

  const page = Math.max(Number(pageParam ?? "1") || 1, 1);
  const pageSize = Math.max(
    Math.min(
      Number(pageSizeParam ?? DEFAULT_PAGE_SIZE.toString()) || DEFAULT_PAGE_SIZE,
      50,
    ),
    1,
  );

  const where: Prisma.InventoryLogWhereInput = {};

  if (
    sourceParam &&
    ALLOWED_SOURCES.includes(sourceParam as (typeof ALLOWED_SOURCES)[number])
  ) {
    where.source = sourceParam;
  }

  if (search) {
    where.OR = [
      {
        product: {
          name: { contains: search, mode: "insensitive" },
        },
      },
      {
        product: {
          slug: { contains: search, mode: "insensitive" },
        },
      },
    ];
  }

  try {
    const [logs, total] = await Promise.all([
      prisma.inventoryLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          productId: true,
          change: true,
          reason: true,
          source: true,
          referenceId: true,
          createdAt: true,
          product: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      }),
      prisma.inventoryLog.count({ where }),
    ]);

    const data: InventoryLogListItemDto[] = logs.map((log) => ({
      id: log.id,
      productId: log.productId,
      productName: log.product?.name ?? "Không rõ sản phẩm",
      productSlug: log.product?.slug ?? "",
      change: log.change,
      reason: log.reason ?? null,
      source: log.source ?? null,
      referenceId: log.referenceId ?? null,
      createdAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error(
      "[GET /api/admin/inventory/logs] Failed to fetch inventory logs",
      error,
    );
    return NextResponse.json(
      { error: "Không thể tải lịch sử tồn kho. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

