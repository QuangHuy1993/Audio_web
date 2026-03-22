/**
 * GET /api/shop/promotions
 *
 * Public API trả về danh sách các chương trình khuyến mãi đang hoạt động,
 * hiện tại ánh xạ từ bảng Coupon (mã giảm giá toàn shop).
 * Dùng cho:
 *  - Dropdown "Khuyến mãi" trên header.
 *  - Trang /promotions.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PromotionSummaryDto } from "@/types/shop";

export const runtime = "nodejs";

export async function GET() {
  try {
    const now = new Date();

    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [
          {
            OR: [{ endsAt: null }, { endsAt: { gte: now } }],
          },
        ],
      },
      orderBy: {
        startsAt: "desc",
      },
      select: {
        id: true,
        code: true,
        description: true,
        type: true,
        value: true,
        maxDiscount: true,
        startsAt: true,
        endsAt: true,
      },
    });

    const items: PromotionSummaryDto[] = coupons.map((coupon) => {
      const title =
        coupon.description?.trim() ||
        `Mã ${coupon.code.toUpperCase()}`;

      let badgeText: string | null = null;
      if (coupon.type === "PERCENTAGE" && coupon.value != null) {
        badgeText = `-${Number(coupon.value)}%`;
      } else if (coupon.type === "FIXED" && coupon.value != null) {
        badgeText = `-${Number(coupon.value).toLocaleString("vi-VN")}₫`;
      } else if (coupon.type === "FREE_SHIPPING") {
        badgeText = "Free ship";
      }

      const subtitle = `Mã ${coupon.code.toUpperCase()} • Áp dụng toàn shop`;

      return {
        id: coupon.id,
        title,
        subtitle,
        badgeText,
        type: "COUPON_GLOBAL",
        startsAt: coupon.startsAt
          ? coupon.startsAt.toISOString()
          : now.toISOString(),
        endsAt: coupon.endsAt ? coupon.endsAt.toISOString() : null,
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[ShopPromotions][GET] Failed to load promotions", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách khuyến mãi." },
      { status: 500 },
    );
  }
}

