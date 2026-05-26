import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Period = "day" | "month" | "quarter" | "year";

const PAID_ORDER_WHERE = {
  OR: [
    { status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED] } },
    { paymentStatus: PaymentStatus.PAID },
  ],
};

function parseDateParam(value: string | null, fallback: Date, endOfDay = false) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

function getPeriodKey(date: Date, period: Period) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (period === "day") return date.toISOString().slice(0, 10);
  if (period === "quarter") return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
  if (period === "year") return String(year);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function formatPaymentProvider(provider: string | null) {
  if (provider === "VNPAY") return "VNPAY / thẻ";
  if (provider === "QR_TRANSFER") return "Chuyển khoản QR";
  if (provider === "COD") return "COD";
  return "Khác";
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền truy cập dữ liệu quản trị." },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const from = parseDateParam(searchParams.get("from"), defaultFrom);
    const to = parseDateParam(searchParams.get("to"), now, true);
    const periodParam = searchParams.get("period");
    const period: Period =
      periodParam === "day" ||
      periodParam === "quarter" ||
      periodParam === "year" ||
      periodParam === "month"
        ? periodParam
        : "month";

    const paidOrders = await prisma.order.findMany({
      where: {
        ...PAID_ORDER_WHERE,
        createdAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        totalAmount: true,
        paymentProvider: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, image: true } },
        items: {
          select: {
            productId: true,
            productName: true,
            quantity: true,
            unitPrice: true,
            product: {
              select: {
                category: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const revenueMap = new Map<string, number>();
    const productsMap = new Map<string, { name: string; quantity: number; orderIds: Set<string> }>();
    const customersMap = new Map<
      string,
      { name: string; email: string | null; image: string | null; totalSpend: number; orderCount: number }
    >();
    const categoryMap = new Map<string, number>();
    const paymentMethodMap = new Map<string, number>();

    for (const order of paidOrders) {
      const revenueKey = getPeriodKey(order.createdAt, period);
      revenueMap.set(revenueKey, (revenueMap.get(revenueKey) ?? 0) + Number(order.totalAmount));

      const paymentLabel = formatPaymentProvider(order.paymentProvider);
      paymentMethodMap.set(paymentLabel, (paymentMethodMap.get(paymentLabel) ?? 0) + Number(order.totalAmount));

      if (order.userId) {
        const current = customersMap.get(order.userId) ?? {
          name: order.user?.name || order.user?.email || "N/A",
          email: order.user?.email ?? null,
          image: order.user?.image ?? null,
          totalSpend: 0,
          orderCount: 0,
        };
        current.totalSpend += Number(order.totalAmount);
        current.orderCount += 1;
        customersMap.set(order.userId, current);
      }

      for (const item of order.items) {
        const productKey = item.productId ?? item.productName;
        const current = productsMap.get(productKey) ?? {
          name: item.productName,
          quantity: 0,
          orderIds: new Set<string>(),
        };
        current.quantity += item.quantity;
        current.orderIds.add(order.id);
        productsMap.set(productKey, current);

        const categoryName = item.product?.category?.name ?? "Chưa phân loại";
        categoryMap.set(
          categoryName,
          (categoryMap.get(categoryName) ?? 0) + Number(item.unitPrice) * item.quantity,
        );
      }
    }

    const revenueChartData = Array.from(revenueMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const topProducts = Array.from(productsMap.values())
      .map((p) => ({ name: p.name, quantity: p.quantity, orderCount: p.orderIds.size }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const topCustomers = Array.from(customersMap.values())
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 5);

    const categoryRevenueData = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const paymentMethodData = Array.from(paymentMethodMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const paymentTransactions = paidOrders
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.user?.name || order.user?.email || "Khách vãng lai",
        customerEmail: order.user?.email ?? null,
        paymentMethod: formatPaymentProvider(order.paymentProvider),
        totalAmount: Number(order.totalAmount),
        createdAt: order.createdAt.toISOString(),
      }));

    return NextResponse.json({
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        period,
      },
      revenueChartData,
      topProducts,
      topCustomers,
      categoryRevenueData,
      paymentMethodData,
      paymentTransactions,
    });
  } catch (error) {
    console.error("Reports Stats Error:", error);
    return NextResponse.json(
      { error: "Lỗi khi tải dữ liệu báo cáo." },
      { status: 500 },
    );
  }
}
