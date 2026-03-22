import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/shop/payments/sessions/[id]/status
 * Trả về trạng thái session để client poll tự động xác nhận thanh toán VietQR.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Select tối thiểu – tránh kéo cartSnapshot/shippingSnapshot (JSON lớn)
    const { id } = await params;
    const checkoutSession = await prisma.checkoutSession.findFirst({
        where: {
            id,
            userId: session.user.id, // chỉ xem session của chính mình
        },
        select: {
            id: true,
            status: true,
            orderId: true,
            expiresAt: true,
            amount: true,
        },
    });

    if (!checkoutSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
        sessionId: checkoutSession.id,
        status: checkoutSession.status,           // PENDING | SUCCEEDED | FAILED | EXPIRED | CANCELLED
        orderId: checkoutSession.orderId ?? null,  // có khi SUCCEEDED
        expiresAt: checkoutSession.expiresAt.toISOString(),
        amount: Number(checkoutSession.amount),
    });
}
