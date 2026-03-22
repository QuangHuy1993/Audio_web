import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  toggleWishlistItem,
  WishlistServiceError,
} from "@/services/wishlist-service";

export const runtime = "nodejs";

type ToggleBody = {
  productId: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Yêu cầu đăng nhập để quản lý danh sách yêu thích.",
        },
        { status: 401 },
      );
    }

    let body: ToggleBody;

    try {
      body = (await request.json()) as ToggleBody;
    } catch {
      return NextResponse.json(
        { error: "Dữ liệu gửi lên không hợp lệ." },
        { status: 400 },
      );
    }

    const result = await toggleWishlistItem(session.user.id, body.productId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WishlistServiceError) {
      switch (error.code) {
        case "PRODUCT_NOT_FOUND":
          return NextResponse.json(
            { error: "Sản phẩm không tồn tại hoặc đã bị xóa." },
            { status: 404 },
          );
        default:
          break;
      }
    }

    console.error("[WishlistToggle][POST] Failed to toggle wishlist item", error, {
      url: request.url,
    });

    return NextResponse.json(
      {
        error:
          "Không thể cập nhật danh sách yêu thích. Vui lòng thử lại sau.",
      },
      { status: 500 },
    );
  }
}

