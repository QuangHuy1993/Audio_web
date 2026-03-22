import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * VNPAY Return URL handler (front-channel redirect sau khi user thanh toán xong).
 *
 * Luồng:
 * 1. VNPAY redirect user về URL này kèm các tham số vnp_* (bao gồm vnp_TxnRef, vnp_ResponseCode).
 * 2. Dùng vnp_TxnRef để tra cứu CheckoutSession.
 * 3. Redirect user sang /checkout/processing?sessionId=<id> để polling trạng thái.
 *
 * Lưu ý: Return URL chỉ là front-channel (có thể không chạy nếu user đóng tab).
 * IPN route (/api/payments/vnpay/ipn) là nguồn tin cậy để commit order.
 *
 * QUAN TRỌNG: Dùng NEXTAUTH_URL làm base cho redirect, KHÔNG dùng request.url.
 * Lý do: request.url trong Next.js dev = http://localhost:3000/... → redirect về localhost
 * thay vì ngrok URL → browser bị lỗi HTTPS trên localhost.
 */

function getAppBaseUrl(request: NextRequest): string {
  // Ưu tiên NEXTAUTH_URL (đã cấu hình ngrok/domain), fallback về request.url
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (nextAuthUrl) return nextAuthUrl;
  // Fallback: dựng từ request headers (hỗ trợ X-Forwarded-Host của ngrok/proxy)
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (request.url.startsWith("https") ? "https" : "http");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const txnRef = url.searchParams.get("vnp_TxnRef");
  const baseUrl = getAppBaseUrl(request);

  if (!txnRef) {
    return NextResponse.redirect(`${baseUrl}/checkout`);
  }

  try {
    const session = await prisma.checkoutSession.findUnique({
      where: { providerRef: txnRef },
      select: { id: true },
    });

    if (!session) {
      return NextResponse.redirect(`${baseUrl}/checkout`);
    }

    return NextResponse.redirect(
      `${baseUrl}/checkout/processing?sessionId=${session.id}`,
    );
  } catch (error) {
    console.error("[Payments][VNPAY][Return] Error looking up session", error);
    return NextResponse.redirect(`${baseUrl}/checkout`);
  }
}
