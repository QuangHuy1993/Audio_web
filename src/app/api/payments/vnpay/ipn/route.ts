import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyVnpaySignature } from "@/lib/vnpay";
import { prisma } from "@/lib/prisma";
import { commitOrderFromSession } from "@/services/checkout-session-service";

export const runtime = "nodejs";

/**
 * VNPAY IPN Handler (server-to-server).
 *
 * Luồng VNPAY doc:
 *  - Verify signature     → fail: RspCode 97
 *  - Tìm session          → not found: RspCode 01 (trigger retry)
 *  - Validate amount      → mismatch: RspCode 04
 *  - Idempotency check    → đã SUCCEEDED: RspCode 02
 *  - vnp_ResponseCode=00 & vnp_TransactionStatus=00 => THÀNH CÔNG → commit, RspCode 00
 *  - Ngược lại            → THẤT BẠI → mark FAILED, RspCode 00
 *
 * Cơ chế retry VNPAY: trả RspCode 00 hoặc 02 → VNPAY dừng; trả 01/04/97/99 → VNPAY retry (10 lần, cách 5 phút).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());

  // 1. Verify signature
  if (!verifyVnpaySignature(params)) {
    return NextResponse.json(
      { RspCode: "97", Message: "Invalid signature" },
      { status: 200 },
    );
  }

  const vnpTxnRef = params.vnp_TxnRef;
  const vnpResponseCode = params.vnp_ResponseCode;
  const vnpTransactionStatus = params.vnp_TransactionStatus;
  // vnp_Amount từ VNPAY = số tiền * 100 (đơn vị đồng × 100)
  const vnpAmountRaw = params.vnp_Amount;

  if (!vnpTxnRef) {
    return NextResponse.json(
      { RspCode: "99", Message: "Missing vnp_TxnRef" },
      { status: 200 },
    );
  }

  try {
    const session = await prisma.checkoutSession.findFirst({
      where: { providerRef: vnpTxnRef },
    });

    // 2. Không tìm thấy phiên → RspCode 01 để VNPAY retry
    if (!session) {
      return NextResponse.json(
        { RspCode: "01", Message: "Order not found" },
        { status: 200 },
      );
    }

    // 3. Validate số tiền (chống gian lận / spoofing)
    if (vnpAmountRaw) {
      const vnpAmount = Number(vnpAmountRaw);
      // session.amount là số tiền thực (VND), vnp_Amount = amount * 100
      const expectedVnpAmount = Math.round(Number(session.amount)) * 100;
      if (!Number.isNaN(vnpAmount) && vnpAmount !== expectedVnpAmount) {
        console.error(
          "[Payments][VNPAY][IPN] Amount mismatch",
          { vnpAmount, expectedVnpAmount, sessionId: session.id },
        );
        return NextResponse.json(
          { RspCode: "04", Message: "invalid amount" },
          { status: 200 },
        );
      }
    }

    // 4. Idempotency: đã xử lý thành công → trả 02 để VNPAY không retry
    if (session.status === "SUCCEEDED") {
      return NextResponse.json(
        { RspCode: "02", Message: "Order already confirmed" },
        { status: 200 },
      );
    }

    const providerPayload = params;
    const isPaid =
      vnpResponseCode === "00" && vnpTransactionStatus === "00";

    if (isPaid) {
      // 5a. Thanh toán thành công → commit order
      const commitResult = await commitOrderFromSession(session.id);

      // Lưu payload IPN dù commit thành công hay không
      await prisma.checkoutSession.update({
        where: { id: session.id },
        data: {
          providerCode: vnpResponseCode,
          providerPayload,
        },
      });

      if (!commitResult) {
        // Commit thực sự thất bại (hết hàng, v.v.) → báo 00 để ngăn retry
        // nhưng session đã được commitOrderFromSession đánh dấu FAILED bên trong
        console.error(
          "[Payments][VNPAY][IPN] commitOrderFromSession returned null",
          { sessionId: session.id },
        );
        return NextResponse.json(
          { RspCode: "00", Message: "Payment received but order commit failed" },
          { status: 200 },
        );
      }

      return NextResponse.json(
        { RspCode: "00", Message: "Confirm Success" },
        { status: 200 },
      );
    }

    // 5b. Thanh toán thất bại hoặc bị huỷ
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: {
        status: "FAILED",
        providerCode: vnpResponseCode,
        providerPayload,
      },
    });

    return NextResponse.json(
      { RspCode: "00", Message: "Payment failed, session marked as FAILED" },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Payments][VNPAY][IPN] Unexpected error", error, {
      url: request.url,
    });

    // RspCode 99 → VNPAY sẽ retry
    return NextResponse.json(
      { RspCode: "99", Message: "Unknown error" },
      { status: 200 },
    );
  }
}
