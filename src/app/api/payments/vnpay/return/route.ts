import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyVnpaySignature } from "@/lib/vnpay";
import { commitOrderFromSession } from "@/services/checkout-session-service";

export const runtime = "nodejs";

/**
 * VNPAY Return URL handler (front-channel redirect sau khi user thanh toán xong).
 *
 * Để giải quyết vấn đề không cấu hình được IPN trên portal VNPAY:
 * - Route này sẽ thực hiện verify chữ ký của các tham số nhận được.
 * - Nếu hợp lệ và thanh toán thành công (vnp_ResponseCode = 00), tiến hành commit order ngay lập tức.
 * - Điều này giúp hoàn tất đơn hàng ngay khi user quay lại website mà không cần phụ thuộc IPN.
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
  const responseCode = url.searchParams.get("vnp_ResponseCode");
  const transactionStatus = url.searchParams.get("vnp_TransactionStatus");
  const baseUrl = getAppBaseUrl(request);

  if (!txnRef) {
    return NextResponse.redirect(`${baseUrl}/checkout`);
  }

  try {
    const session = await prisma.checkoutSession.findFirst({
      where: { providerRef: txnRef },
    });

    if (!session) {
      return NextResponse.redirect(`${baseUrl}/checkout`);
    }

    // 1. Verify signature từ các query parameters
    const params = Object.fromEntries(url.searchParams.entries());
    if (verifyVnpaySignature(params)) {
      const isPaid = responseCode === "00" && (!transactionStatus || transactionStatus === "00");

      if (isPaid) {
        // Chỉ commit nếu phiên vẫn đang ở trạng thái PENDING
        if (session.status === "PENDING") {
          await commitOrderFromSession(session.id);
          
          await prisma.checkoutSession.update({
            where: { id: session.id },
            data: {
              providerCode: responseCode ?? undefined,
              providerPayload: params,
            },
          });
          console.log(`[Payments][VNPAY][Return] Successfully committed order from return fallback for session ${session.id}`);
        }
      } else {
        if (session.status === "PENDING") {
          await prisma.checkoutSession.update({
            where: { id: session.id },
            data: {
              status: "FAILED",
              providerCode: responseCode ?? undefined,
              providerPayload: params,
            },
          });
        }
      }
    } else {
      console.error("[Payments][VNPAY][Return] Invalid signature verification failed");
    }

    return NextResponse.redirect(
      `${baseUrl}/checkout/processing?sessionId=${session.id}`,
    );
  } catch (error) {
    console.error("[Payments][VNPAY][Return] Error processing return callback", error);
    return NextResponse.redirect(`${baseUrl}/checkout`);
  }
}
