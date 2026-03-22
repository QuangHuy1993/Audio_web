import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProfileCouponWallet } from "@/services/coupon-service";

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

        const wallet = await getProfileCouponWallet(session.user.id);

        return NextResponse.json({ coupons: wallet });
    } catch (error) {
        console.error("[ProfileVoucherWallet][GET] Failed to load coupon wallet", error, {
            url: request.url,
        });

        return NextResponse.json(
            {
                error: "Không thể tải ví voucher vào lúc này. Vui lòng thử lại sau.",
            },
            { status: 500 },
        );
    }
}
