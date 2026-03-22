import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { validateCoupon } from "@/services/coupon-service";

export const runtime = "nodejs";

type ValidateBody = {
  code: string;
  orderSubtotal: number;
  shippingFee?: number;
};

/**
 * POST /api/shop/coupons/validate
 * Kiểm tra mã giảm giá cho giỏ hàng / đơn hàng (ước tính).
 * Không thay đổi usedCount; client dùng kết quả để hiển thị discount và finalSubtotal.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  let body: ValidateBody;
  try {
    body = (await request.json()) as ValidateBody;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const code = typeof body.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json(
      { error: "Vui lòng nhập mã giảm giá." },
      { status: 400 },
    );
  }

  const orderSubtotal = Number(body.orderSubtotal);
  if (!Number.isFinite(orderSubtotal) || orderSubtotal < 0) {
    return NextResponse.json(
      { error: "Tổng tiền hàng không hợp lệ." },
      { status: 400 },
    );
  }

  const shippingFee =
    body.shippingFee != null
      ? (Number(body.shippingFee) >= 0 ? Number(body.shippingFee) : 0)
      : 0;

  const result = await validateCoupon({
    code,
    orderSubtotal,
    shippingFee,
    userId: session?.user?.id,
  });

  return NextResponse.json(result);
}
