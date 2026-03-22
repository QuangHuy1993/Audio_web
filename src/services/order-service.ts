import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AddressDto,
  CreateOrderRequestDto,
  CreateOrderResponseDto,
  OrderDetailDto,
  OrderItemSummaryDto,
  PaymentMethod,
} from "@/types/order";
import {
  computeCouponDiscount,
  getActiveCouponByCode,
  normalizeCode,
} from "@/services/coupon-service";
import { adjustProductStockWithTx } from "@/services/inventory-service";
import { generateVietQRUrl } from "@/lib/vietqr";

type TransactionClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type OrderServiceErrorCode =
  | "UNAUTHENTICATED"
  | "CART_EMPTY"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_INACTIVE"
  | "INSUFFICIENT_STOCK"
  | "ADDRESS_NOT_FOUND"
  | "INVALID_PAYMENT_METHOD"
  | "COUPON_INVALID"
  | "COUPON_USAGE_EXCEEDED";

export class OrderServiceError extends Error {
  code: OrderServiceErrorCode;

  constructor(code: OrderServiceErrorCode, message?: string) {
    super(message ?? code);
    this.name = "OrderServiceError";
    this.code = code;
  }
}

function generateOrderNumber(createdAt: Date): string {
  const date = createdAt.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `DUA-${date}-${suffix}`;
}

const SHIPPING_BASE_FEE = 30_000;

function computeShippingFeeFallback(serviceTypeId: number | null | undefined): number {
  // Fallback khi thiếu GHN token/shopId hoặc địa chỉ chưa có mã GHN
  // Economy(2): 30k, Express(5): 60k
  return serviceTypeId === 5 ? SHIPPING_BASE_FEE * 2 : SHIPPING_BASE_FEE;
}

async function calculateGhnShippingFee(params: {
  toDistrictId: number | null | undefined;
  toWardCode: string | null | undefined;
  weight: number;
  serviceTypeId: number;
}): Promise<{ fee: number; fallback: boolean; estimatedDays: string }> {
  const { toDistrictId, toWardCode, weight, serviceTypeId } = params;

  const ghnToken = process.env.GHN_API_TOKEN;
  const ghnShopId = process.env.GHN_SHOP_ID;
  const fromDistrictId = Number(process.env.GHN_FROM_DISTRICT_ID);
  const fromWardCode = process.env.GHN_FROM_WARD_CODE;

  if (
    !ghnToken ||
    !ghnShopId ||
    !fromDistrictId ||
    !fromWardCode ||
    !toDistrictId ||
    !toWardCode
  ) {
    return {
      fee: computeShippingFeeFallback(serviceTypeId),
      fallback: true,
      estimatedDays: serviceTypeId === 5 ? "1-2 ngày" : "3-5 ngày",
    };
  }

  const base =
    process.env.GHN_SHIPPING_API_BASE ??
    "https://dev-online-gateway.ghn.vn/shiip/public-api";
  const feeUrl = `${base}/v2/shipping-order/fee`;

  try {
    const res = await fetch(feeUrl, {
      method: "POST",
      headers: {
        Token: ghnToken,
        ShopId: ghnShopId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_district_id: fromDistrictId,
        from_ward_code: fromWardCode,
        to_district_id: toDistrictId,
        to_ward_code: toWardCode,
        weight,
        service_type_id: serviceTypeId,
      }),
    });

    if (!res.ok) {
      return {
        fee: computeShippingFeeFallback(serviceTypeId),
        fallback: true,
        estimatedDays: serviceTypeId === 5 ? "1-2 ngày" : "3-5 ngày",
      };
    }

    const json = (await res.json().catch(() => null)) as
      | { data?: { total?: number } }
      | null;

    const total = json?.data?.total;
    if (typeof total !== "number" || !Number.isFinite(total) || total < 0) {
      return {
        fee: computeShippingFeeFallback(serviceTypeId),
        fallback: true,
        estimatedDays: serviceTypeId === 5 ? "1-2 ngày" : "3-5 ngày",
      };
    }

    return {
      fee: total,
      fallback: false,
      estimatedDays: serviceTypeId === 5 ? "1-2 ngày" : "3-5 ngày",
    };
  } catch {
    return {
      fee: computeShippingFeeFallback(serviceTypeId),
      fallback: true,
      estimatedDays: serviceTypeId === 5 ? "1-2 ngày" : "3-5 ngày",
    };
  }
}

function mapShippingAddressToDto(address: {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  ward: string | null;
  district: string | null;
  province: string | null;
}): NonNullable<OrderDetailDto["shippingAddress"]> {
  return {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    ward: address.ward,
    district: address.district ?? "",
    province: address.province ?? "",
  };
}

function ensurePaymentMethod(method: PaymentMethod): PaymentMethod {
  const allowed: PaymentMethod[] = ["COD", "VNPAY", "QR_TRANSFER"];
  if (!allowed.includes(method)) {
    throw new OrderServiceError(
      "INVALID_PAYMENT_METHOD",
      "Phương thức thanh toán không được hỗ trợ.",
    );
  }
  return method;
}

export async function createOrder(
  userId: string,
  dto: CreateOrderRequestDto,
): Promise<CreateOrderResponseDto> {
  if (!userId) {
    throw new OrderServiceError("UNAUTHENTICATED", "Yêu cầu đăng nhập.");
  }

  const paymentMethod = ensurePaymentMethod(dto.paymentMethod);

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const client = tx as TransactionClient;

    // Serialize createOrder per-user để chặn request song song (double-click/retry)
    // có thể tạo 2 đơn và trừ kho 2 lần.
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const cart = await client.cart.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            unitPrice: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                stock: true,
                status: true,
                images: {
                  where: { isPrimary: true },
                  select: { url: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new OrderServiceError(
        "CART_EMPTY",
        "Giỏ hàng trống, vui lòng thêm sản phẩm trước khi đặt.",
      );
    }

    let subtotal = 0;
    let totalQuantity = 0;

    for (const item of cart.items) {
      if (!item.product) {
        throw new OrderServiceError(
          "PRODUCT_NOT_FOUND",
          "Một sản phẩm trong giỏ hàng không còn tồn tại.",
        );
      }

      if (item.product.status !== "ACTIVE") {
        throw new OrderServiceError(
          "PRODUCT_INACTIVE",
          `Sản phẩm ${item.product.name} hiện không được kinh doanh.`,
        );
      }

      if (item.product.stock < item.quantity) {
        throw new OrderServiceError(
          "INSUFFICIENT_STOCK",
          `Sản phẩm ${item.product.name} không đủ số lượng trong kho.`,
        );
      }

      const unitPrice = Number(item.unitPrice);
      subtotal += unitPrice * item.quantity;
      totalQuantity += item.quantity;
    }

    const serviceTypeIdRaw = dto.shippingServiceTypeId;
    const shippingServiceTypeId =
      serviceTypeIdRaw === 5 || serviceTypeIdRaw === 2 ? serviceTypeIdRaw : 2;

    const totalWeight =
      totalQuantity > 0 ? Math.max(500, totalQuantity * 1000) : 500;

    const addressInput = dto.shippingAddress ?? {};
    let shippingAddressId: string | null = null;
    let shippingAddressSnapshot: {
      fullName: string;
      phone: string;
      line1: string;
      line2: string | null;
      ward: string | null;
      district: string | null;
      province: string | null;
      ghnDistrictId: number | null;
      ghnWardCode: string | null;
    } | null = null;

    if (addressInput.addressId) {
      const existing = await client.address.findUnique({
        where: { id: addressInput.addressId },
      });

      if (!existing || existing.userId !== userId) {
        throw new OrderServiceError(
          "ADDRESS_NOT_FOUND",
          "Địa chỉ giao hàng không hợp lệ.",
        );
      }

      shippingAddressId = existing.id;
      shippingAddressSnapshot = {
        fullName: existing.fullName,
        phone: existing.phone,
        line1: existing.line1,
        line2: existing.line2,
        ward: existing.ward,
        district: existing.district,
        province: existing.province,
        ghnDistrictId: existing.ghnDistrictId ?? null,
        ghnWardCode: existing.ghnWardCode ?? null,
      };
    } else {
      if (
        !addressInput.fullName ||
        !addressInput.phone ||
        !addressInput.line1 ||
        !addressInput.district ||
        !addressInput.province
      ) {
        throw new OrderServiceError(
          "ADDRESS_NOT_FOUND",
          "Vui lòng điền đầy đủ thông tin địa chỉ giao hàng.",
        );
      }

      const createdAddress = await client.address.create({
        data: {
          userId,
          fullName: addressInput.fullName.trim(),
          phone: addressInput.phone.trim(),
          line1: addressInput.line1.trim(),
          line2: addressInput.line2?.trim() ?? null,
          ward: addressInput.ward?.trim() ?? null,
          district: addressInput.district.trim(),
          province: addressInput.province.trim(),
          postalCode: addressInput.postalCode?.trim() ?? null,
          isDefault: false,
        },
      });

      shippingAddressId = createdAddress.id;
      shippingAddressSnapshot = {
        fullName: createdAddress.fullName,
        phone: createdAddress.phone,
        line1: createdAddress.line1,
        line2: createdAddress.line2,
        ward: createdAddress.ward,
        district: createdAddress.district,
        province: createdAddress.province,
        ghnDistrictId: createdAddress.ghnDistrictId ?? null,
        ghnWardCode: createdAddress.ghnWardCode ?? null,
      };
    }

    const ghnFee = await calculateGhnShippingFee({
      toDistrictId: shippingAddressSnapshot?.ghnDistrictId,
      toWardCode: shippingAddressSnapshot?.ghnWardCode,
      weight: totalWeight,
      serviceTypeId: shippingServiceTypeId,
    });

    let shippingFee = ghnFee.fee;

    let discountCouponAmount = 0;
    let shippingCouponDiscount = 0;
    let discountCouponId: string | null = null;
    let shippingCouponId: string | null = null;

    const discountCouponCodeRaw =
      dto.discountCouponCode ?? dto.couponCode ?? undefined;
    const shippingCouponCodeRaw = dto.shippingCouponCode ?? undefined;

    // Backward compatible mapping: nếu chỉ có couponCode và nó là FREE_SHIPPING
    // thì coi như shippingCouponCode.
    let resolvedDiscountCode = discountCouponCodeRaw?.trim()
      ? normalizeCode(discountCouponCodeRaw)
      : "";
    let resolvedShippingCode = shippingCouponCodeRaw?.trim()
      ? normalizeCode(shippingCouponCodeRaw)
      : "";

    if (
      dto.couponCode &&
      !dto.discountCouponCode &&
      !dto.shippingCouponCode
    ) {
      const normalized = normalizeCode(dto.couponCode);
      const coupon = await getActiveCouponByCode(normalized, now);
      if (coupon?.type === "FREE_SHIPPING") {
        resolvedDiscountCode = "";
        resolvedShippingCode = normalized;
      }
    }

    if (resolvedDiscountCode) {
      const coupon = await getActiveCouponByCode(resolvedDiscountCode, now);

      if (!coupon) {
        throw new OrderServiceError(
          "COUPON_INVALID",
          "Mã giảm giá đã hết hạn hoặc không còn hợp lệ.",
        );
      }

      if (coupon.type === "FREE_SHIPPING") {
        throw new OrderServiceError(
          "COUPON_INVALID",
          "Mã này là mã freeship. Vui lòng áp dụng tại mục mã vận chuyển.",
        );
      }

      if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
        throw new OrderServiceError(
          "COUPON_USAGE_EXCEEDED",
          "Mã giảm giá đã hết lượt sử dụng.",
        );
      }

      const computed = computeCouponDiscount(
        {
          type: coupon.type,
          value: Number(coupon.value),
          maxDiscount:
            coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
          minOrderAmount:
            coupon.minOrderAmount != null ? Number(coupon.minOrderAmount) : null,
        },
        subtotal,
        0,
      );

      if (!(computed.discountAmount > 0)) {
        throw new OrderServiceError(
          "COUPON_INVALID",
          "Đơn hàng chưa đủ điều kiện áp dụng mã giảm giá.",
        );
      }

      discountCouponId = coupon.id;
      discountCouponAmount = computed.discountAmount ?? 0;
    }

    if (resolvedShippingCode) {
      const coupon = await getActiveCouponByCode(resolvedShippingCode, now);

      if (!coupon) {
        throw new OrderServiceError(
          "COUPON_INVALID",
          "Mã freeship đã hết hạn hoặc không còn hợp lệ.",
        );
      }

      if (coupon.type !== "FREE_SHIPPING") {
        throw new OrderServiceError(
          "COUPON_INVALID",
          "Mã này không phải mã freeship.",
        );
      }

      if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
        throw new OrderServiceError(
          "COUPON_USAGE_EXCEEDED",
          "Mã freeship đã hết lượt sử dụng.",
        );
      }

      const computed = computeCouponDiscount(
        {
          type: coupon.type,
          value: Number(coupon.value),
          maxDiscount:
            coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
          minOrderAmount:
            coupon.minOrderAmount != null ? Number(coupon.minOrderAmount) : null,
        },
        subtotal,
        shippingFee,
      );

      const applied = computed.appliedShippingDiscount ?? 0;
      if (!(applied > 0)) {
        throw new OrderServiceError(
          "COUPON_INVALID",
          "Đơn hàng chưa đủ điều kiện áp dụng mã freeship.",
        );
      }

      shippingCouponId = coupon.id;
      shippingCouponDiscount = Math.min(applied, shippingFee);
      shippingFee = Math.max(shippingFee - shippingCouponDiscount, 0);
    }

    const totalAmount =
      subtotal - discountCouponAmount - shippingCouponDiscount + shippingFee;

    const createdAt = now;
    let orderNumber = generateOrderNumber(createdAt);

    // Đảm bảo orderNumber unique (retry tối đa 3 lần nếu trùng hiếm gặp)
    for (let i = 0; i < 3; i += 1) {
      const existing = await client.order.findUnique({
        where: { orderNumber },
        select: { id: true },
      });
      if (!existing) {
        break;
      }
      orderNumber = generateOrderNumber(createdAt);
    }

    const order = await client.order.create({
      data: {
        orderNumber,
        user: { connect: { id: userId } },
        status: "PENDING",
        totalAmount,
        currency: "VND",
        paymentStatus: "PENDING",
        paymentProvider: paymentMethod,
        paymentIntentId: null,
        ...(discountCouponId ? { coupon: { connect: { id: discountCouponId } } } : {}),
        couponDiscount:
          (discountCouponAmount + shippingCouponDiscount) > 0
            ? (discountCouponAmount + shippingCouponDiscount)
            : null,
        ...(shippingCouponId
          ? { shippingCoupon: { connect: { id: shippingCouponId } } }
          : {}),
        shippingCouponDiscount:
          shippingCouponDiscount > 0 ? shippingCouponDiscount : null,
        ...(shippingAddressId
          ? { shippingAddress: { connect: { id: shippingAddressId } } }
          : {}),
        shippingFee,
        shippingProvider: "GHN",
        shippingService: shippingServiceTypeId === 5 ? "EXPRESS" : "ECONOMY",
        shippingServiceTypeId: shippingServiceTypeId,
        estimatedDeliveryDays: ghnFee.estimatedDays,
        metadata: dto.note
          ? {
            note: dto.note,
          }
          : undefined,
      },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        paymentStatus: true,
        status: true,
        shippingFee: true,
        couponDiscount: true,
      },
    });

    const orderItems: OrderItemSummaryDto[] = [];

    for (const item of cart.items) {
      const unitPriceNumber = Number(item.unitPrice);
      const subtotalItem = unitPriceNumber * item.quantity;
      const primaryImageUrl = item.product.images[0]?.url ?? null;

      await client.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: unitPriceNumber,
          productName: item.product.name,
          productImageUrl: primaryImageUrl,
        },
      });

      orderItems.push({
        productId: item.productId,
        productName: item.product.name,
        productImageUrl: primaryImageUrl,
        quantity: item.quantity,
        unitPrice: unitPriceNumber,
        subtotal: subtotalItem,
      });

      await adjustProductStockWithTx(client, {
        productId: item.productId,
        delta: -item.quantity,
        reason: `Đơn hàng #${order.orderNumber}`,
        source: "ORDER_PLACED",
        referenceId: order.id,
      });
    }

    await client.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await client.cart.update({
      where: { id: cart.id },
      data: { status: "CONVERTED" },
    });

    if (discountCouponId) {
      await client.coupon.update({
        where: { id: discountCouponId },
        data: { usedCount: { increment: 1 } },
      });

      await client.orderCoupon.create({
        data: {
          orderId: order.id,
          couponId: discountCouponId,
          appliedAmount: discountCouponAmount,
        },
      });

      await client.userCoupon.updateMany({
        where: {
          userId,
          couponId: discountCouponId,
          status: "AVAILABLE",
        },
        data: { status: "USED" },
      });
    }

    if (shippingCouponId && shippingCouponId !== discountCouponId) {
      await client.coupon.update({
        where: { id: shippingCouponId },
        data: { usedCount: { increment: 1 } },
      });

      await client.orderCoupon.create({
        data: {
          orderId: order.id,
          couponId: shippingCouponId,
          appliedAmount: shippingCouponDiscount,
        },
      });

      await client.userCoupon.updateMany({
        where: {
          userId,
          couponId: shippingCouponId,
          status: "AVAILABLE",
        },
        data: { status: "USED" },
      });
    }

    const shippingFeeNumber = Number(order.shippingFee ?? 0);
    const couponDiscountNumber = Number(order.couponDiscount ?? 0);

    const response: CreateOrderResponseDto = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: Number(order.totalAmount),
      shippingFee: shippingFeeNumber,
      couponDiscount: couponDiscountNumber,
      paymentMethod,
    };

    if (paymentMethod === "QR_TRANSFER") {
      const bankId = process.env.QR_BANK_ID?.trim() || "VCB";
      const accountNo = process.env.QR_ACCOUNT_NO?.trim() || "1016625868";
      const accountName = process.env.QR_ACCOUNT_NAME?.trim() || "Ngo Duc Uy";
      const transferNote = `DUA ${order.orderNumber} ${shippingAddressSnapshot?.fullName || ""}`;

      const qrImageUrl = generateVietQRUrl({
        bankId,
        accountNo,
        accountName,
        amount: Number(order.totalAmount),
        description: transferNote,
      });

      const qrExpiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 mins

      await client.order.update({
        where: { id: order.id },
        data: {
          qrImageUrl,
          qrExpiresAt,
        },
      });

      response.qrImageUrl = qrImageUrl;
      response.qrExpiresAt = qrExpiresAt.toISOString();
      response.bankTransferInfo = {
        bankName: bankId,
        accountNumber: accountNo,
        accountHolder: accountName,
        transferNote,
      };
    }

    return response;
  });

  return result;
}

export async function getOrdersByUser(
  userId: string,
  filters: { status?: string; limit?: number; offset?: number } = {},
) {
  const { status, limit = 10, offset = 0 } = filters;

  const where: any = { userId };
  if (status && status !== "ALL") {
    where.status = status;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        paymentStatus: true,
        paymentProvider: true,
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productImageUrl: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map((o) => ({
      ...o,
      totalAmount: Number(o.totalAmount),
    })),
    pagination: {
      total,
      limit,
      offset,
    },
  };
}
