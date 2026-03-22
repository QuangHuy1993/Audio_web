import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { revertOrderStockDeduction } from "@/services/inventory-service";
import { sendOrderStatusUpdateEmail } from "@/services/email-resend-service";

export const runtime = "nodejs";

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await context.params;

    try {
        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
                shippingAddress: true,
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                images: {
                                    where: { isPrimary: true },
                                    take: 1,
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!order) {
            return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
        }

        return NextResponse.json(order);
    } catch (error) {
        console.error("Admin Order Detail Error:", error);
        return NextResponse.json({ error: "Lỗi máy chủ." }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const nextStatus: OrderStatus | undefined = body?.status;

    if (!nextStatus || !Object.values(OrderStatus).includes(nextStatus)) {
        return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
    }

    try {
        const current = await prisma.order.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        email: true,
                        name: true,
                    },
                },
                items: {
                    select: {
                        productId: true,
                        quantity: true,
                    },
                },
            },
        });

        if (!current) {
            return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
        }

        const prevStatus = current.status;

        const updatedOrder = await prisma.order.update({
            where: { id },
            data: { status: nextStatus },
        });

        if (nextStatus === "CANCELLED" && prevStatus !== "CANCELLED") {
            try {
                await revertOrderStockDeduction(id);
            } catch (error) {
                console.error("[AdminOrder][CANCELLED] revertOrderStockDeduction failed:", error);
            }
        }

        if (
            (nextStatus === "SHIPPED" || nextStatus === "COMPLETED") &&
            current.user?.email
        ) {
            void sendOrderStatusUpdateEmail({
                toEmail: current.user.email,
                fullName: current.user.name || "",
                orderNumber: current.orderNumber,
                newStatus: nextStatus,
            });
        }

        return NextResponse.json(updatedOrder);
    } catch (error) {
        console.error("Admin Order Update Error:", error);
        return NextResponse.json({ error: "Lỗi máy chủ." }, { status: 500 });
    }
}
