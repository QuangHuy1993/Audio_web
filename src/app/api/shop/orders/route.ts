import type { OrderStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createOrder,
  OrderServiceError,
} from "@/services/order-service";
import type { CreateOrderRequestDto } from "@/types/order";

export const runtime = "nodejs";

/**
 * POST: Đặt hàng COD — gọi createOrder (transaction: Order, trừ kho, InventoryLog, clear cart).
 * VNPAY / VietQR dùng POST /api/shop/payments/sessions, không dùng route này.
 */
export async function POST(request: NextRequest) {
  let body: CreateOrderRequestDto;

  try {
    body = (await request.json()) as CreateOrderRequestDto;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  if (body.paymentMethod !== "COD") {
    return NextResponse.json(
      {
        error:
          "Phương thức thanh toán không hợp lệ cho đường dẫn này. Vui lòng dùng VNPAY hoặc VietQR qua phiên thanh toán.",
        code: "INVALID_PAYMENT_METHOD",
      },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Yêu cầu đăng nhập để đặt hàng." },
      { status: 401 },
    );
  }

  try {
    const result = await createOrder(session.user.id, body);

    console.log("[Orders][POST][COD] Order created", {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof OrderServiceError) {
      const status = error.code === "UNAUTHENTICATED" ? 401 : 400;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }

    console.error("[Orders][POST] Unexpected error", error, {
      url: request.url,
    });

    return NextResponse.json(
      { error: "Không thể tạo đơn hàng. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "4"); // Default to 4
    const skip = (page - 1) * limit;

    const whereCondition: Prisma.OrderWhereInput = {
      userId: session.user.id,
    };

    if (status && status !== "ALL") {
      if (status === "PROCESSING") {
        whereCondition.status = { in: ["PENDING", "PAID"] };
      } else {
        whereCondition.status = status as OrderStatus;
      }
    }

    const [orders, totalOrders] = await Promise.all([
      prisma.order.findMany({
        where: whereCondition,
        include: {
          items: {
            include: {
              product: {
                select: {
                  images: {
                    where: { isPrimary: true },
                    take: 1
                  }
                }
              }
            }
          },
          shippingAddress: true,
        },
        orderBy: {
          createdAt: "desc"
        },
        skip,
        take: limit
      }),
      prisma.order.count({ where: whereCondition })
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        total: totalOrders,
        page,
        limit,
        totalPages: Math.ceil(totalOrders / limit)
      }
    });

  } catch (error) {
    console.error("[Orders API] Error fetching orders:", error);
    return NextResponse.json(
      { error: "Lỗi tải lịch sử đơn hàng." },
      { status: 500 }
    );
  }
}
