import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCartItemCount } from "@/services/cart-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Yêu cầu đăng nhập để xem giỏ hàng." },
        { status: 401 },
      );
    }

    const count = await getCartItemCount(session.user.id);

    return NextResponse.json({ count });
  } catch (error) {
    console.error("[CartCount][GET] Failed to load cart count", error, {
      url: request.url,
    });

    return NextResponse.json(
      { error: "Không thể tải số lượng giỏ hàng. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

