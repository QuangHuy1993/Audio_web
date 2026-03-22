import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json(
            { error: "Bạn không có quyền truy cập dữ liệu này." },
            { status: 403 }
        );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status") as OrderStatus | null;
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    try {
        const where: any = {};
        if (status) {
            where.status = status;
        }
        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: "insensitive" } },
                { user: { name: { contains: search, mode: "insensitive" } } },
                { user: { email: { contains: search, mode: "insensitive" } } },
            ];
        }

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    user: {
                        select: {
                            name: true,
                            email: true,
                            image: true,
                        },
                    },
                    _count: {
                        select: { items: true },
                    },
                },
            }),
            prisma.order.count({ where }),
        ]);

        return NextResponse.json({
            orders: orders.map((o) => ({
                id: o.id,
                orderNumber: o.orderNumber,
                customerName: o.user?.name || o.user?.email || "Khách vãng lai",
                customerImage: o.user?.image,
                totalAmount: Number(o.totalAmount),
                status: o.status,
                itemCount: o._count.items,
                createdAt: o.createdAt.toISOString(),
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Admin Orders GET Error:", error);
        return NextResponse.json(
            { error: "Lỗi khi tải danh sách đơn hàng." },
            { status: 500 }
        );
    }
}
