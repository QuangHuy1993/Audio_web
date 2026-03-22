import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateCoupon } from "@/services/coupon-service";

export const runtime = "nodejs";

type ApplyBody = {
  code: string;
  orderSubtotal: number;
  shippingFee?: number;
};

/**
 * POST /api/shop/coupons/apply
 * Áp dụng mã giảm giá cho giỏ hàng / đơn hàng (ước tính).
 * Hiện tại tái sử dụng logic validateCoupon và không ghi vào DB.
 */
export async function POST(request: NextRequest) {
  let body: ApplyBody;
  try {
    body = (await request.json()) as ApplyBody;
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
  });

  if (!result.isValid) {
    return NextResponse.json(
      { error: result.reason ?? "Mã giảm giá không hợp lệ." },
      { status: 400 },
    );
  }

  return NextResponse.json(result);
}

