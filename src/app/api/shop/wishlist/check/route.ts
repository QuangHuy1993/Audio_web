import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWishlistProductIds } from "@/services/wishlist-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Yêu cầu đăng nhập để xem danh sách yêu thích." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const productIdsParam = searchParams.get("productIds") ?? "";

    const productIds = productIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id);

    if (productIds.length === 0) {
      return NextResponse.json({ productIds: [] });
    }

    const wishedIds = await getWishlistProductIds(
      session.user.id,
      productIds,
    );

    return NextResponse.json({ productIds: wishedIds });
  } catch (error) {
    console.error("[WishlistCheck][GET] Failed to check wishlist items", error, {
      url: request.url,
    });

    return NextResponse.json(
      { error: "Không thể kiểm tra danh sách yêu thích." },
      { status: 500 },
    );
  }
}

