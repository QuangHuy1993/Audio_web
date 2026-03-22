import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus, PaymentStatus } from "@prisma/client";

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
        const now = new Date();
        const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

        // 1. Doanh thu theo tháng (12 tháng gần nhất)
        const monthlyRevenueRaw = await prisma.order.groupBy({
            by: ["createdAt"],
            _sum: { totalAmount: true },
            where: {
                OR: [
                    { status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED] } },
                    { paymentStatus: PaymentStatus.PAID },
                ],
                createdAt: { gte: twelveMonthsAgo },
            },
            orderBy: { createdAt: "asc" },
        });

        // Gom nhóm dữ liệu theo tháng
        const monthlyRevenueMap: Record<string, number> = {};
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyRevenueMap[monthKey] = 0;
        }

        monthlyRevenueRaw.forEach((item) => {
            const d = new Date(item.createdAt);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (monthlyRevenueMap[monthKey] !== undefined) {
                monthlyRevenueMap[monthKey] += Number(item._sum.totalAmount || 0);
            }
        });

        const revenueChartData = Object.entries(monthlyRevenueMap)
            .map(([month, amount]) => ({ month, amount }))
            .sort((a, b) => a.month.localeCompare(b.month));

        // 2. Top 10 sản phẩm bán chạy
        const topProductsRaw = await prisma.orderItem.groupBy({
            by: ["productId", "productName"],
            _sum: { quantity: true },
            _count: { id: true },
            where: {
                order: {
                    OR: [
                        { status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED] } },
                        { paymentStatus: PaymentStatus.PAID },
                    ],
                },
            },
            orderBy: {
                _sum: { quantity: "desc" },
            },
            take: 10,
        });

        const topProducts = topProductsRaw.map((p) => ({
            name: p.productName,
            quantity: p._sum.quantity || 0,
            orderCount: p._count.id,
        }));

        // 3. Khách hàng mới theo tháng
        const newCustomersRaw = await prisma.user.groupBy({
            by: ["createdAt"],
            _count: { id: true },
            where: {
                role: "USER",
                createdAt: { gte: twelveMonthsAgo },
            },
        });

        const monthlyCustomersMap: Record<string, number> = {};
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyCustomersMap[monthKey] = 0;
        }

        newCustomersRaw.forEach((item) => {
            const d = new Date(item.createdAt);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (monthlyCustomersMap[monthKey] !== undefined) {
                monthlyCustomersMap[monthKey] += item._count.id;
            }
        });

        const customersChartData = Object.entries(monthlyCustomersMap)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month));

        // 4. Khách hàng tiềm năng (VIP) - Chi tiêu nhiều nhất
        const topCustomersRaw = await prisma.order.groupBy({
            by: ["userId"],
            _sum: { totalAmount: true },
            _count: { id: true },
            where: {
                userId: { not: null },
                OR: [
                    { status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED] } },
                    { paymentStatus: PaymentStatus.PAID },
                ],
            },
            orderBy: {
                _sum: { totalAmount: "desc" },
            },
            take: 10,
        });

        // Lấy thông tin user cho top customers
        const userIds = topCustomersRaw.map(c => c.userId as string);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true, image: true }
        });

        const topCustomers = topCustomersRaw.map(c => {
            const user = users.find(u => u.id === c.userId);
            return {
                name: user?.name || user?.email || "N/A",
                email: user?.email,
                image: user?.image,
                totalSpend: Number(c._sum.totalAmount || 0),
                orderCount: c._count.id
            };
        });

        return NextResponse.json({
            revenueChartData,
            topProducts,
            customersChartData,
            topCustomers,
        });
    } catch (error) {
        console.error("Reports Stats Error:", error);
        return NextResponse.json(
            { error: "Lỗi khi tải dữ liệu báo cáo." },
            { status: 500 }
        );
    }
}
