import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCartByUserId } from "@/services/cart-service";

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

    const cart = await getCartByUserId(session.user.id);

    return NextResponse.json(cart);
  } catch (error) {
    console.error("[Cart][GET] Failed to load cart", error, {
      url: request.url,
    });

    return NextResponse.json(
      { error: "Không thể tải giỏ hàng. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

