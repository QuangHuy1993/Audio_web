import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWishlistByUserId } from "@/services/wishlist-service";

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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "4");

    const wishlist = await getWishlistByUserId(session.user.id, page, limit);

    return NextResponse.json(wishlist);
  } catch (error) {
    console.error("[Wishlist][GET] Failed to load wishlist", error, {
      url: request.url,
    });

    return NextResponse.json(
      { error: "Không thể tải danh sách yêu thích. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

