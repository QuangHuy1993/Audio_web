import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateCouponSuggestion } from "@/services/ai-coupon-service";
import type { CouponAiInput } from "@/services/ai-coupon-service";

export const runtime = "nodejs";

/**
 * POST /api/admin/coupons/ai
 * AI gợi ý cấu hình coupon từ vài thông tin admin nhập (campaign, %, số tiền, freeship, thời gian).
 * Chỉ ADMIN; thiếu GROQ_API_KEY hoặc AI lỗi trả 503.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền sử dụng tính năng AI cho mã giảm giá." },
      { status: 403 },
    );
  }

  let body: CouponAiInput;
  try {
    body = (await request.json()) as CouponAiInput;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const generated = await generateCouponSuggestion(body);

  if (!generated) {
    return NextResponse.json(
      {
        error:
          "Tính năng AI tạm thời không khả dụng. Kiểm tra cấu hình GROQ_API_KEY hoặc thử lại sau.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    data: generated,
  });
}
