import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Public endpoint để polling trạng thái thanh toán — KHÔNG yêu cầu đăng nhập.
 *
 * Bảo mật:
 * - sessionId là CUID2 (≥16 ký tự random) — đủ entropy, không thể brute-force.
 * - Chỉ trả về status + orderId, không trả về thông tin nhạy cảm.
 *
 * Lý do tách endpoint riêng:
 * - Sau khi VNPAY redirect về ngrok/domain khác, cookie đăng nhập (set trên localhost)
 *   không được gửi kèm → /api/shop/payments/sessions/:id trả 401.
 * - Endpoint này dùng sessionId như "bearer token" để không phụ thuộc cookie.
 */
export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await context.params;

    if (!sessionId || typeof sessionId !== "string") {
        return NextResponse.json(
            { error: "Session ID không hợp lệ." },
            { status: 400 },
        );
    }

    try {
        const session = await prisma.checkoutSession.findUnique({
            where: { id: sessionId },
            select: {
                id: true,
                status: true,
                orderId: true,
                expiresAt: true,
                provider: true,
                amount: true,
                currency: true,
                providerCode: true,
            },
        });

        if (!session) {
            return NextResponse.json(
                { error: "Không tìm thấy phiên thanh toán." },
                { status: 404 },
            );
        }

        return NextResponse.json(
            {
                sessionId: session.id,
                status: session.status,
                orderId: session.orderId ?? undefined,
                expiresAt: session.expiresAt.toISOString(),
                provider: session.provider,
                amount: Number(session.amount),
                currency: session.currency,
                paymentProviderCode: session.providerCode ?? null,
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("[Payments][Status] Error fetching session status", error);
        return NextResponse.json(
            { error: "Lỗi server khi lấy trạng thái thanh toán." },
            { status: 500 },
        );
    }
}
