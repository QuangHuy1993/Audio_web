import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type OrderDetailResponseDto = {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentProvider: string | null;
  createdAt: string;
  subtotal: number;
  discountAmount: number;
  shippingDiscount: number;
  shippingFeeOriginal: number;
  shippingFeeFinal: number;
  totalAmount: number;
  items: {
    id: string;
    productName: string;
    productImageUrl: string | null;
    quantity: number;
    unitPrice: number;
    subtotalItem: number;
  }[];
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    ward: string | null;
    district: string | null;
    province: string | null;
  } | null;
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Yêu cầu đăng nhập để xem đơn hàng." },
      { status: 401 },
    );
  }

  const { orderId } = await context.params;
  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json({ error: "Mã đơn hàng không hợp lệ." }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: session.user.id,
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      paymentProvider: true,
      createdAt: true,
      totalAmount: true,
      couponDiscount: true,
      shippingCouponDiscount: true,
      shippingFee: true,
      items: {
        select: {
          id: true,
          productName: true,
          productImageUrl: true,
          quantity: true,
          unitPrice: true,
        },
        orderBy: { id: "asc" },
      },
      shippingAddress: {
        select: {
          fullName: true,
          phone: true,
          line1: true,
          line2: true,
          ward: true,
          district: true,
          province: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  }

  const items = order.items.map((item) => {
    const unitPrice = Number(item.unitPrice);
    const subtotalItem = unitPrice * item.quantity;
    return {
      id: item.id,
      productName: item.productName,
      productImageUrl: item.productImageUrl,
      quantity: item.quantity,
      unitPrice,
      subtotalItem,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.subtotalItem, 0);
  const shippingFeeFinal = Number(order.shippingFee ?? 0);
  const shippingDiscount = Number(order.shippingCouponDiscount ?? 0);
  const shippingFeeOriginal = Math.max(shippingFeeFinal + shippingDiscount, 0);

  const totalSavings = Number(order.couponDiscount ?? 0) + shippingDiscount;
  const discountAmount = Number(order.couponDiscount ?? 0);

  const response: OrderDetailResponseDto = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentProvider: order.paymentProvider ?? null,
    createdAt: order.createdAt.toISOString(),
    subtotal,
    discountAmount,
    shippingDiscount,
    shippingFeeOriginal,
    shippingFeeFinal,
    totalAmount: Number(order.totalAmount),
    items,
    shippingAddress: order.shippingAddress
      ? {
        fullName: order.shippingAddress.fullName,
        phone: order.shippingAddress.phone,
        line1: order.shippingAddress.line1,
        line2: order.shippingAddress.line2,
        ward: order.shippingAddress.ward,
        district: order.shippingAddress.district,
        province: order.shippingAddress.province,
      }
      : null,
  };

  return NextResponse.json(response);
}


export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { orderId } = await context.params;
  const body = await request.json();
  const { status } = body;

  if (status !== "COMPLETED") {
    return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId, userId: session.user.id },
      select: { status: true }
    });

    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    }

    if (order.status !== "SHIPPED") {
      return NextResponse.json({ error: "Chỉ có thể hoàn thành đơn hàng đang giao." }, { status: 400 });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "COMPLETED",
        updatedAt: new Date()
      }
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error("[Order Detail API][PATCH] Error:", error);
    return NextResponse.json({ error: "Không thể cập nhật đơn hàng." }, { status: 500 });
  }
}
