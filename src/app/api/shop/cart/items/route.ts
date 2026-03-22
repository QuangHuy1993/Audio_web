import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  addToCart,
  CartServiceError,
} from "@/services/cart-service";
import type { AddToCartRequestDto } from "@/types/shop";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Yêu cầu đăng nhập để thêm sản phẩm vào giỏ hàng." },
        { status: 401 },
      );
    }

    let body: AddToCartRequestDto;

    try {
      body = (await request.json()) as AddToCartRequestDto;
    } catch {
      return NextResponse.json(
        { error: "Dữ liệu gửi lên không hợp lệ." },
        { status: 400 },
      );
    }

    const result = await addToCart(session.user.id, body);

    return NextResponse.json(result, {
      status: result.isExisting ? 200 : 201,
    });
  } catch (error) {
    if (error instanceof CartServiceError) {
      switch (error.code) {
        case "INVALID_QUANTITY":
          return NextResponse.json(
            { error: "Số lượng sản phẩm không hợp lệ." },
            { status: 400 },
          );
        case "PRODUCT_NOT_FOUND":
        case "PRODUCT_INACTIVE":
          return NextResponse.json(
            { error: "Sản phẩm không tồn tại hoặc không còn bán." },
            { status: 404 },
          );
        case "OUT_OF_STOCK":
          return NextResponse.json(
            { error: "Sản phẩm tạm thời hết hàng." },
            { status: 409 },
          );
        default:
          break;
      }
    }

    console.error("[CartItems][POST] Failed to add to cart", error, {
      url: request.url,
    });

    return NextResponse.json(
      { error: "Không thể thêm sản phẩm vào giỏ hàng. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

