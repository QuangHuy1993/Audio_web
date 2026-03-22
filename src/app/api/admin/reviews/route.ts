import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { ReviewModerationStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");
  const ratingParam = searchParams.get("rating");
  const statusParam = searchParams.get("status");
  const search = searchParams.get("search")?.trim() ?? "";

  const page = Math.max(Number(pageParam ?? "1") || 1, 1);
  const pageSize = Math.max(
    Math.min(Number(pageSizeParam ?? "20") || 20, 100),
    1,
  );

  const where: Prisma.ReviewWhereInput = {};

  if (ratingParam) {
    const ratingNumber = Number(ratingParam);
    if (Number.isFinite(ratingNumber) && ratingNumber >= 1 && ratingNumber <= 5) {
      where.rating = ratingNumber;
    }
  }

  if (statusParam && ["PENDING", "APPROVED", "HIDDEN"].includes(statusParam)) {
    where.status = statusParam as ReviewModerationStatus;
  }

  if (search) {
    where.OR = [
      { product: { name: { contains: search, mode: "insensitive" } } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { comment: { contains: search, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        status: true,
        product: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.review.count({ where }),
  ]);

  const data = rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    title: null as string | null,
    content: r.comment,
    status: r.status as "PENDING" | "APPROVED" | "HIDDEN",
    createdAt: r.createdAt.toISOString(),
    productName: r.product.name,
    userName: r.user?.name ?? null,
  }));

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return NextResponse.json({
    data,
    total,
    page,
    pageSize,
    totalPages,
  });
}

