import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DEFAULT_PAGE_SIZE = 20;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền xem lịch sử tồn kho." },
      { status: 403 },
    );
  }

  if (!id) {
    return NextResponse.json(
      { error: "Thiếu mã sản phẩm." },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");

  const page = Math.max(Number(pageParam ?? "1") || 1, 1);
  const pageSize = Math.max(
    Math.min(
      Number(pageSizeParam ?? DEFAULT_PAGE_SIZE.toString()) || DEFAULT_PAGE_SIZE,
      50,
    ),
    1,
  );

  try {
    const [logs, total] = await Promise.all([
      prisma.inventoryLog.findMany({
        where: { productId: id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          change: true,
          reason: true,
          source: true,
          referenceId: true,
          createdAt: true,
        },
      }),
      prisma.inventoryLog.count({ where: { productId: id } }),
    ]);

    return NextResponse.json({
      data: logs.map((log) => ({
        id: log.id,
        change: log.change,
        reason: log.reason,
        source: log.source,
        referenceId: log.referenceId,
        createdAt: log.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error(
      "[GET /api/admin/products/[id]/inventory/logs] Failed to fetch logs",
      error,
    );
    return NextResponse.json(
      { error: "Không thể tải lịch sử tồn kho. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

