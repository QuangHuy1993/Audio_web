import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserCouponWallet } from "@/services/coupon-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Yêu cầu đăng nhập để xem ví voucher." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const subtotalParam = searchParams.get("orderSubtotal");
    const shippingFeeParam = searchParams.get("shippingFee");

    const orderSubtotal = subtotalParam ? Number(subtotalParam) : 0;
    if (!Number.isFinite(orderSubtotal) || orderSubtotal < 0) {
      return NextResponse.json(
        { error: "Tổng tiền hàng không hợp lệ." },
        { status: 400 },
      );
    }

    const shippingFee = shippingFeeParam ? Number(shippingFeeParam) : 0;
    if (!Number.isFinite(shippingFee) || shippingFee < 0) {
      return NextResponse.json(
        { error: "Phí vận chuyển không hợp lệ." },
        { status: 400 },
      );
    }

    const wallet = await getUserCouponWallet({
      userId: session.user.id,
      orderSubtotal,
      shippingFee,
    });

    return NextResponse.json({ coupons: wallet });
  } catch (error) {
    console.error("[CouponWallet][GET] Failed to load coupon wallet", error, {
      url: request.url,
    });

    return NextResponse.json(
      {
        error:
          "Không thể tải ví voucher vào lúc này. Vui lòng thử lại sau.",
      },
      { status: 500 },
    );
  }
}

