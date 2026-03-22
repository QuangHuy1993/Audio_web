import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

export const runtime = "nodejs";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json(
            { error: "Bạn không có quyền truy cập dữ liệu quản trị." },
            { status: 403 }
        );
    }

    try {
        // 1. Chỉ số tổng quan
        const [
            revenueData,
            totalOrders,
            newUsers,
            totalProductsSold,
        ] = await Promise.all([
            // Doanh thu tổng (Chỉ tính các đơn đã thanh toán/hoàn thành)
            prisma.order.aggregate({
                _sum: { totalAmount: true },
                where: {
                    status: {
                        in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED],
                    },
                },
            }),
            // Tổng đơn hàng
            prisma.order.count(),
            // Khách hàng mới (trong 30 ngày qua)
            prisma.user.count({
                where: {
                    role: "USER",
                    createdAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                },
            }),
            // Tổng sản phẩm đã bán
            prisma.orderItem.aggregate({
                _sum: { quantity: true },
                where: {
                    order: {
                        status: {
                            in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED],
                        },
                    },
                },
            }),
        ]);

        // 2. Dữ liệu biểu đồ doanh thu (7 ngày gần nhất)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const dailyRevenue = await prisma.order.groupBy({
            by: ["createdAt"],
            _sum: { totalAmount: true },
            where: {
                status: {
                    in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED],
                },
                createdAt: {
                    gte: sevenDaysAgo,
                },
            },
            orderBy: {
                createdAt: "asc",
            },
        });

        // Gom nhóm dữ liệu theo ngày (vì createdAt có cả giờ phút giây)
        const revenueByDayMap: Record<string, number> = {};
        // Khởi tạo 7 ngày với giá trị 0
        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(d.getDate() + i);
            revenueByDayMap[d.toISOString().split("T")[0]] = 0;
        }

        dailyRevenue.forEach((item) => {
            const dateStr = item.createdAt.toISOString().split("T")[0];
            if (revenueByDayMap[dateStr] !== undefined) {
                revenueByDayMap[dateStr] += Number(item._sum.totalAmount || 0);
            }
        });

        const revenueByDay = Object.entries(revenueByDayMap).map(([date, amount]) => ({
            date,
            amount,
        }));

        // 3. Phân bổ danh mục (Top 5 danh mục có nhiều sản phẩm nhất hoặc bán chạy nhất)
        // Ở đây ta lấy top 5 danh mục theo số lượng sản phẩm
        const categories = await prisma.category.findMany({
            select: {
                name: true,
                _count: {
                    select: { products: true },
                },
            },
            orderBy: {
                products: { _count: "desc" },
            },
            take: 5,
        });

        const categoryDistribution = categories.map((c) => ({
            name: c.name,
            value: c._count.products,
        }));

        // 4. Đơn hàng gần đây (5 đơn mới nhất)
        const recentOrders = await prisma.order.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        image: true,
                    },
                },
                items: {
                    select: {
                        productName: true,
                    },
                    take: 1, // Lấy tên sản phẩm đầu tiên đại diện
                },
            },
        });

        return NextResponse.json({
            revenue: Number(revenueData._sum.totalAmount || 0),
            totalOrders,
            newUsers,
            totalProductsSold: totalProductsSold._sum.quantity || 0,
            revenueByDay,
            categoryDistribution,
            recentOrders: recentOrders.map((o) => ({
                id: o.id,
                orderNumber: o.orderNumber,
                customerName: o.user?.name || o.user?.email || "Khách vãng lai",
                customerImage: o.user?.image,
                productName: o.items[0]?.productName || "N/A",
                totalAmount: Number(o.totalAmount),
                status: o.status,
                createdAt: o.createdAt.toISOString(),
            })),
        });
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        return NextResponse.json(
            { error: "Lỗi khi tải dữ liệu thống kê." },
            { status: 500 }
        );
    }
}
