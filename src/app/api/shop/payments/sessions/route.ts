import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { CreatePaymentSessionRequestDto } from "@/types/payment";
import { prepareCheckoutSession, CheckoutSessionError } from "@/services/checkout-session-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: CreatePaymentSessionRequestDto;

  try {
    body = (await request.json()) as CreatePaymentSessionRequestDto;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Yêu cầu đăng nhập để thanh toán." },
      { status: 401 },
    );
  }

  try {
    const clientIpRaw =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "";

    let clientIp = clientIpRaw.split(",")[0]?.trim() || "127.0.0.1";

    // Chuẩn hóa IPv6 loopback (::1) về IPv4 để tương thích với VNPAY
    if (clientIp === "::1" || clientIp === "0:0:0:0:0:0:0:1") {
      clientIp = "127.0.0.1";
    }

    const result = await prepareCheckoutSession(session.user.id, body, clientIp);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof CheckoutSessionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }

    console.error("[Payments][POST] Failed to create checkout session", error, {
      url: request.url,
    });

    return NextResponse.json(
      { error: "Không thể khởi tạo phiên thanh toán. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

