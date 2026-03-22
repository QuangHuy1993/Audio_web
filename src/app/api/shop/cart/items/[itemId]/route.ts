import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  CartServiceError,
  removeCartItem,
  updateCartItemQuantity,
} from "@/services/cart-service";
import type { UpdateCartItemRequestDto } from "@/types/shop";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ itemId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Yêu cầu đăng nhập để cập nhật giỏ hàng." },
        { status: 401 },
      );
    }

    const { itemId } = await context.params;

    if (!itemId) {
      return NextResponse.json(
        { error: "Thiếu mã sản phẩm trong giỏ hàng." },
        { status: 400 },
      );
    }

    let body: UpdateCartItemRequestDto;

    try {
      body = (await request.json()) as UpdateCartItemRequestDto;
    } catch {
      return NextResponse.json(
        { error: "Dữ liệu gửi lên không hợp lệ." },
        { status: 400 },
      );
    }

    const result = await updateCartItemQuantity(
      session.user.id,
      itemId,
      body.quantity,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CartServiceError) {
      switch (error.code) {
        case "INVALID_QUANTITY":
          return NextResponse.json(
            { error: "Số lượng sản phẩm không hợp lệ." },
            { status: 400 },
          );
        case "CART_ITEM_NOT_FOUND":
          return NextResponse.json(
            { error: "Không tìm thấy sản phẩm trong giỏ hàng." },
            { status: 404 },
          );
        case "FORBIDDEN":
          return NextResponse.json(
            { error: "Bạn không có quyền cập nhật sản phẩm này." },
            { status: 403 },
          );
        default:
          break;
      }
    }

    console.error("[CartItems][PATCH] Failed to update cart item", error, {
      url: request.url,
    });

    return NextResponse.json(
      {
        error: "Không thể cập nhật sản phẩm trong giỏ hàng. Vui lòng thử lại sau.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Yêu cầu đăng nhập để cập nhật giỏ hàng." },
        { status: 401 },
      );
    }

    const { itemId } = await context.params;

    if (!itemId) {
      return NextResponse.json(
        { error: "Thiếu mã sản phẩm trong giỏ hàng." },
        { status: 400 },
      );
    }

    const result = await removeCartItem(session.user.id, itemId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CartServiceError) {
      switch (error.code) {
        case "CART_ITEM_NOT_FOUND":
          return NextResponse.json(
            { error: "Không tìm thấy sản phẩm trong giỏ hàng." },
            { status: 404 },
          );
        case "FORBIDDEN":
          return NextResponse.json(
            { error: "Bạn không có quyền xóa sản phẩm này." },
            { status: 403 },
          );
        default:
          break;
      }
    }

    console.error("[CartItems][DELETE] Failed to remove cart item", error, {
      url: request.url,
    });

    return NextResponse.json(
      {
        error: "Không thể xóa sản phẩm khỏi giỏ hàng. Vui lòng thử lại sau.",
      },
      { status: 500 },
    );
  }
}

