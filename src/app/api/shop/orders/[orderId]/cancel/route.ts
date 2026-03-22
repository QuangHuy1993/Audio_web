import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adjustProductStockWithTx } from "@/services/inventory-service";

export const runtime = "nodejs";

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ orderId: string }> },
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { orderId } = await context.params;
        const userId = session.user.id;

        const body = await request.json().catch(() => ({}));
        const reason = body.reason || "Người dùng tự huỷ đơn";

        const result = await prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: { items: true }
            });

            if (!order || order.userId !== userId) {
                throw new Error("FORBIDDEN");
            }

            if (order.status !== "PENDING") {
                throw new Error("CANNOT_CANCEL: order not PENDING");
            }

            const withinWindow = Date.now() - order.createdAt.getTime() <= CANCEL_WINDOW_MS;
            if (!withinWindow) {
                throw new Error("CANNOT_CANCEL: cancel window expired");
            }

            // Update order status
            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: {
                    status: "CANCELLED",
                    metadata: {
                        ...(typeof order.metadata === 'object' && order.metadata !== null ? order.metadata : {}),
                        cancelledBy: "USER",
                        cancelReason: reason,
                        cancelledAt: new Date().toISOString()
                    }
                }
            });

            // Revert inventory
            for (const item of order.items) {
                await adjustProductStockWithTx(tx, {
                    productId: item.productId,
                    delta: item.quantity,
                    reason: `Hoàn kho đơn hàng #${order.orderNumber} (Khách huỷ)`,
                    source: "ORDER_CANCELLED",
                    referenceId: orderId
                });
            }

            // Decrement coupon usage if applied
            if (order.couponId) {
                await tx.coupon.update({
                    where: { id: order.couponId },
                    data: { usedCount: { decrement: 1 } }
                });
            }

            return updatedOrder;
        });

        return NextResponse.json({ success: true, order: result });

    } catch (error: any) {
        console.error("[Order Cancel API] Error:", error);

        if (error.message === "FORBIDDEN") {
            return NextResponse.json({ error: "Không được phép thực hiện hành động này." }, { status: 403 });
        }
        if (error.message.startsWith("CANNOT_CANCEL")) {
            return NextResponse.json({ error: "Đơn hàng này không thể huỷ ở thời điểm hiện tại hoặc đã quá hạn 24H." }, { status: 400 });
        }

        return NextResponse.json({ error: "Đã xảy ra lỗi khi huỷ đơn." }, { status: 500 });
    }
}
