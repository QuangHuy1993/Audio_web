/**
 * GET /api/admin/ai/content/stats
 * Thống kê trạng thái AI content (aiDescription, aiTags, seoTitle, seoDescription)
 * trên Product, Brand, Category.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ContentStat = {
  total: number;
  hasAll: number;
  hasPartial: number;
  hasNone: number;
};

function classify(
  aiDescription: string | null,
  aiTags: string[],
  seoTitle: string | null,
  seoDescription: string | null,
): "all" | "partial" | "none" {
  const filled = [
    !!aiDescription,
    aiTags.length > 0,
    !!seoTitle,
    !!seoDescription,
  ].filter(Boolean).length;

  if (filled === 4) return "all";
  if (filled === 0) return "none";
  return "partial";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [products, brands, categories] = await Promise.all([
      prisma.product.findMany({
        select: { aiDescription: true, aiTags: true, seoTitle: true, seoDescription: true },
      }),
      prisma.brand.findMany({
        select: { aiDescription: true, aiTags: true, seoTitle: true, seoDescription: true },
      }),
      prisma.category.findMany({
        select: { aiDescription: true, aiTags: true, seoTitle: true, seoDescription: true },
      }),
    ]);

    const calcStat = (
      items: { aiDescription: string | null; aiTags: string[]; seoTitle: string | null; seoDescription: string | null }[],
    ): ContentStat => {
      let hasAll = 0, hasPartial = 0, hasNone = 0;
      for (const item of items) {
        const c = classify(item.aiDescription, item.aiTags, item.seoTitle, item.seoDescription);
        if (c === "all") hasAll++;
        else if (c === "partial") hasPartial++;
        else hasNone++;
      }
      return { total: items.length, hasAll, hasPartial, hasNone };
    };

    return NextResponse.json({
      products: calcStat(products),
      brands: calcStat(brands),
      categories: calcStat(categories),
    });
  } catch (error) {
    console.error("[Admin AI Content Stats Error]", error);
    return NextResponse.json({ error: "Lỗi tải thống kê nội dung AI." }, { status: 500 });
  }
}
