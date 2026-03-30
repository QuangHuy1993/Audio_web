import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CartResponseDto, CartItemDto } from "@/types/shop";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Yêu cầu đăng nhập để mua hàng." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const qtyParam = searchParams.get("qty");
    
    if (!productId) {
      return NextResponse.json({ error: "Thiếu productId" }, { status: 400 });
    }
    
    const quantity = qtyParam ? parseInt(qtyParam, 10) : 1;
    if (isNaN(quantity) || quantity < 1) {
      return NextResponse.json({ error: "Số lượng không hợp lệ" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        brand: true,
        images: { where: { isPrimary: true }, take: 1 }
      }
    });

    if (!product || product.status !== "ACTIVE") {
      return NextResponse.json({ error: "Sản phẩm không tồn tại hoặc ngừng kinh doanh." }, { status: 404 });
    }

    const price = Number(product.price);
    const salePrice = product.salePrice ? Number(product.salePrice) : null;
    const unitPrice = salePrice !== null && salePrice < price ? salePrice : price;
    const subtotal = unitPrice * quantity;

    const item: CartItemDto = {
      id: "buy_now_item", // dummy id
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImageUrl: product.images[0]?.url || null,
      brandName: product.brand?.name || null,
      unitPrice,
      quantity,
      subtotal,
    };

    const mockCart: CartResponseDto = {
      cartId: "buy_now_cart",
      items: [item],
      itemCount: 1,
      totalQuantity: quantity,
      subtotal,
    };

    return NextResponse.json(mockCart);
  } catch (error) {
    console.error("[BuyNow][GET] Error", error);
    return NextResponse.json({ error: "Lỗi lấy dữ liệu sản phẩm." }, { status: 500 });
  }
}
