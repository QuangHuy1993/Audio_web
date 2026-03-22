import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CreatePaymentSessionRequestDto,
  CreatePaymentSessionResponseDto,
  CheckoutSessionStatusDto,
} from "@/types/payment";
import type { CreateOrderRequestDto } from "@/types/order";
import { sendOrderConfirmationEmail } from "@/services/email-resend-service";
import { buildVnpayUrl } from "@/lib/vnpay";
import { generateVietQRUrl } from "@/lib/vietqr";
import { getBankConfig } from "@/lib/admin-settings";
import {
  computeCouponDiscount,
  getActiveCouponByCode,
  normalizeCode,
} from "@/services/coupon-service";
import { adjustProductStockWithTx } from "@/services/inventory-service";

type TransactionClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Prisma client hiện tại chưa được generate lại với model CheckoutSession,
// nên không thể dùng CheckoutSessionGetPayload một cách type-safe ở đây.
// Sử dụng kiểu rộng hơn và rely vào cấu trúc JSON đã kiểm soát.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CheckoutSessionWithRelations = any;

export class CheckoutSessionError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CheckoutSessionError";
    this.code = code;
  }
}

async function calculateGhnShippingFee(params: {
  client: TransactionClient;
  toDistrictId: number | null | undefined;
  toWardCode: string | null | undefined;
  weight: number;
  serviceTypeId: number;
}): Promise<{ fee: number; estimatedDays: string }> {
  const { toDistrictId, toWardCode, weight, serviceTypeId } = params;

  const ghnToken = process.env.GHN_API_TOKEN;
  const ghnShopId = process.env.GHN_SHOP_ID;
  const fromDistrictId = Number(process.env.GHN_FROM_DISTRICT_ID);
  const fromWardCode = process.env.GHN_FROM_WARD_CODE;

  const fallbackFee = serviceTypeId === 5 ? 60_000 : 30_000;

  if (
    !ghnToken ||
    !ghnShopId ||
    !fromDistrictId ||
    !fromWardCode ||
    !toDistrictId ||
    !toWardCode
  ) {
    return {
      fee: fallbackFee,
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
        fee: fallbackFee,
        estimatedDays: serviceTypeId === 5 ? "1-2 ngày" : "3-5 ngày",
      };
    }

    const json = (await res.json().catch(() => null)) as
      | { data?: { total?: number } }
      | null;

    const total = json?.data?.total;
    if (typeof total !== "number" || !Number.isFinite(total) || total < 0) {
      return {
        fee: fallbackFee,
        estimatedDays: serviceTypeId === 5 ? "1-2 ngày" : "3-5 ngày",
      };
    }

    return {
      fee: total,
      estimatedDays: serviceTypeId === 5 ? "1-2 ngày" : "3-5 ngày",
    };
  } catch {
    return {
      fee: fallbackFee,
      estimatedDays: serviceTypeId === 5 ? "1-2 ngày" : "3-5 ngày",
    };
  }
}

function buildOrderRequestFromSession(
  session: CheckoutSessionWithRelations,
): CreateOrderRequestDto {
  const shippingSnapshot = session.shippingSnapshot as {
    address: {
      fullName: string;
      phone: string;
      line1: string;
      line2: string | null;
      ward: string | null;
      district: string | null;
      province: string | null;
      ghnDistrictId: number | null;
      ghnWardCode: string | null;
      addressId?: string;
    };
    shippingServiceTypeId: number;
    shippingFee: number;
  };

  const couponSnapshot = (session.couponSnapshot ?? null) as
    | {
      discountCouponCode?: string;
      shippingCouponCode?: string;
    }
    | null;

  return {
    shippingAddress: {
      fullName: shippingSnapshot.address.fullName,
      phone: shippingSnapshot.address.phone,
      line1: shippingSnapshot.address.line1,
      line2: shippingSnapshot.address.line2 ?? undefined,
      ward: shippingSnapshot.address.ward ?? undefined,
      district: shippingSnapshot.address.district ?? undefined,
      province: shippingSnapshot.address.province ?? undefined,
      addressId: shippingSnapshot.address.addressId,
    },
    // Map provider → paymentMethod
    paymentMethod: session.provider === "VNPAY" ? "VNPAY" : "QR_TRANSFER",
    shippingServiceTypeId: shippingSnapshot.shippingServiceTypeId,
    discountCouponCode: couponSnapshot?.discountCouponCode,
    shippingCouponCode: couponSnapshot?.shippingCouponCode,
    note: session.note ?? undefined,
  };
}

export async function prepareCheckoutSession(
  userId: string,
  dto: CreatePaymentSessionRequestDto,
  clientIp: string,
): Promise<CreatePaymentSessionResponseDto> {
  if (!userId) {
    throw new CheckoutSessionError(
      "UNAUTHENTICATED",
      "Yêu cầu đăng nhập để thanh toán.",
    );
  }

  if (dto.provider !== "VNPAY" && dto.provider !== "VIETQR") {
    throw new CheckoutSessionError(
      "UNSUPPORTED_PROVIDER",
      "Chỉ hỗ trợ thanh toán VNPAY hoặc VietQR.",
    );
  }

  const now = new Date();
  // VNPAY: 10 phút, VIETQR: 30 phút
  const sessionDuration = dto.provider === "VIETQR" ? 30 * 60 * 1000 : 10 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + sessionDuration);

  const result = await prisma.$transaction(async (tx) => {
    const client = tx as TransactionClient;

    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    // We do not reuse existing PENDING sessions anymore to ensure
    // every checkout click uses the most up-to-date cart, coupons, and shipping.

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
      throw new CheckoutSessionError(
        "CART_EMPTY",
        "Giỏ hàng trống, vui lòng thêm sản phẩm trước khi thanh toán.",
      );
    }

    let subtotal = 0;
    let totalQuantity = 0;

    for (const item of cart.items) {
      if (!item.product) {
        throw new CheckoutSessionError(
          "PRODUCT_NOT_FOUND",
          "Một sản phẩm trong giỏ hàng không còn tồn tại.",
        );
      }

      if (item.product.status !== "ACTIVE") {
        throw new CheckoutSessionError(
          "PRODUCT_INACTIVE",
          `Sản phẩm ${item.product.name} hiện không được kinh doanh.`,
        );
      }

      if (item.product.stock < item.quantity) {
        throw new CheckoutSessionError(
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
      addressId?: string;
    } | null = null;

    if (addressInput.addressId) {
      const existingAddress = await client.address.findUnique({
        where: { id: addressInput.addressId },
      });

      if (!existingAddress || existingAddress.userId !== userId) {
        throw new CheckoutSessionError(
          "ADDRESS_NOT_FOUND",
          "Địa chỉ giao hàng không hợp lệ.",
        );
      }

      shippingAddressSnapshot = {
        fullName: existingAddress.fullName,
        phone: existingAddress.phone,
        line1: existingAddress.line1,
        line2: existingAddress.line2,
        ward: existingAddress.ward,
        district: existingAddress.district,
        province: existingAddress.province,
        ghnDistrictId: existingAddress.ghnDistrictId ?? null,
        ghnWardCode: existingAddress.ghnWardCode ?? null,
        addressId: existingAddress.id,
      };
    } else {
      if (
        !addressInput.fullName ||
        !addressInput.phone ||
        !addressInput.line1 ||
        !addressInput.district ||
        !addressInput.province
      ) {
        throw new CheckoutSessionError(
          "ADDRESS_REQUIRED",
          "Vui lòng điền đầy đủ thông tin địa chỉ giao hàng.",
        );
      }

      shippingAddressSnapshot = {
        fullName: addressInput.fullName.trim(),
        phone: addressInput.phone.trim(),
        line1: addressInput.line1.trim(),
        line2: addressInput.line2?.trim() ?? null,
        ward: addressInput.ward?.trim() ?? null,
        district: addressInput.district.trim(),
        province: addressInput.province.trim(),
        ghnDistrictId: null,
        ghnWardCode: null,
      };
    }

    const ghnFee = await calculateGhnShippingFee({
      client,
      toDistrictId: shippingAddressSnapshot?.ghnDistrictId,
      toWardCode: shippingAddressSnapshot?.ghnWardCode,
      weight: totalWeight,
      serviceTypeId: shippingServiceTypeId,
    });

    let shippingFee = ghnFee.fee;

    let discountCouponAmount = 0;
    let shippingCouponDiscount = 0;

    const discountCouponCodeRaw = dto.discountCouponCode ?? undefined;
    const shippingCouponCodeRaw = dto.shippingCouponCode ?? undefined;

    const resolvedDiscountCode = discountCouponCodeRaw?.trim()
      ? normalizeCode(discountCouponCodeRaw)
      : "";
    const resolvedShippingCode = shippingCouponCodeRaw?.trim()
      ? normalizeCode(shippingCouponCodeRaw)
      : "";

    if (resolvedDiscountCode) {
      const coupon = await getActiveCouponByCode(resolvedDiscountCode, now);

      if (!coupon) {
        throw new CheckoutSessionError(
          "COUPON_INVALID",
          "Mã giảm giá không hợp lệ hoặc đã hết hạn.",
        );
      }

      const computed = computeCouponDiscount(
        {
          type: coupon.type,
          value: Number(coupon.value),
          maxDiscount:
            coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
          minOrderAmount:
            coupon.minOrderAmount != null
              ? Number(coupon.minOrderAmount)
              : null,
        },
        subtotal,
        shippingFee,
      );

      discountCouponAmount = computed.discountAmount ?? 0;
    }

    if (resolvedShippingCode) {
      const coupon = await getActiveCouponByCode(resolvedShippingCode, now);

      if (!coupon) {
        throw new CheckoutSessionError(
          "COUPON_INVALID",
          "Mã freeship không hợp lệ hoặc đã hết hạn.",
        );
      }

      const computed = computeCouponDiscount(
        {
          type: coupon.type,
          value: Number(coupon.value),
          maxDiscount:
            coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
          minOrderAmount:
            coupon.minOrderAmount != null
              ? Number(coupon.minOrderAmount)
              : null,
        },
        subtotal,
        shippingFee,
      );

      const applied = computed.appliedShippingDiscount ?? 0;
      shippingCouponDiscount = Math.min(applied, shippingFee);
      // Giữ nguyên shippingFee ở đây để tính totalAmount chuẩn hơn bên dưới
    }

    const totalAmount = subtotal - discountCouponAmount + Math.max(shippingFee - shippingCouponDiscount, 0);

    const cartSnapshot = {
      items: cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        productName: item.product?.name ?? "",
        productImageUrl: item.product?.images[0]?.url ?? null,
      })),
      subtotal,
      totalQuantity,
    };

    const shippingSnapshot = {
      address: shippingAddressSnapshot,
      shippingServiceTypeId,
      shippingFeeOriginal: shippingFee,
      shippingFee: Math.max(shippingFee - shippingCouponDiscount, 0),
      estimatedDays: ghnFee.estimatedDays,
    };

    const couponSnapshot = {
      discountCouponCode: resolvedDiscountCode || undefined,
      shippingCouponCode: resolvedShippingCode || undefined,
      discountCouponAmount,
      shippingCouponDiscount,
    };

    // ── VIETQR: delegate to prepareVietQRSession ──
    if (dto.provider === "VIETQR") {
      return prepareVietQRSession(
        client,
        userId,
        totalAmount,
        now,
        expiresAt,
        cartSnapshot,
        shippingSnapshot,
        couponSnapshot,
        dto.note,
      );
    }

    // ── VNPAY: tạo payment URL → redirect ──
    const timestampRef = now
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);
    const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const providerRef = `DUA${timestampRef}${randomSuffix}`;

    const orderInfo = `Thanh toan don hang Duc Uy Audio - ${providerRef}`;

    const vnpAmount = Math.round(totalAmount) * 100;

    const paymentUrl = buildVnpayUrl({
      vnp_TxnRef: providerRef,
      vnp_Amount: vnpAmount,
      vnp_OrderInfo: orderInfo,
      vnp_IpAddr: clientIp,
      vnp_ExpireDate: expiresAt,
      vnp_Locale: "vn",
    });

    const createdSession = await client.checkoutSession.create({
      data: {
        userId,
        provider: "VNPAY",
        status: "PENDING",
        expiresAt,
        amount: totalAmount,
        currency: "VND",
        cartSnapshot,
        shippingSnapshot,
        couponSnapshot,
        note: dto.note ?? null,
        providerRef,
        paymentUrl,
      },
    });

    return {
      sessionId: createdSession.id,
      provider: createdSession.provider,
      status: createdSession.status,
      expiresAt: createdSession.expiresAt.toISOString(),
      amount: Number(createdSession.amount),
      currency: createdSession.currency,
      paymentUrl: createdSession.paymentUrl ?? undefined,
      providerRef: createdSession.providerRef ?? undefined,
    } satisfies CreatePaymentSessionResponseDto;
  });

  return result;
}

// ==================== VIETQR BRANCH ====================

/**
 * Tạo CheckoutSession cho VIETQR.
 * Chạy bên trong transaction của prepareCheckoutSession().
 */
async function prepareVietQRSession(
  client: TransactionClient,
  userId: string,
  totalAmount: number,
  now: Date,
  expiresAt: Date,
  cartSnapshot: object,
  shippingSnapshot: object,
  couponSnapshot: object,
  note?: string,
): Promise<CreatePaymentSessionResponseDto> {
  // (No reuse of existing sessions here either, to ensure refreshed data)

  // Sinh providerRef = mã nội dung chuyển khoản
  const timestampRef = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const providerRef = `DUA${timestampRef}${randomSuffix}`;

  // Lấy bank info từ AdminSetting DB
  const bankConfig = await getBankConfig();

  // Sinh QR image URL (nội dung CK đã điền sẵn providerRef)
  const qrImageUrl = generateVietQRUrl({
    bankId: bankConfig.bankId,
    accountNo: bankConfig.accountNo,
    accountName: bankConfig.accountName,
    amount: Math.round(totalAmount),
    description: providerRef,
  });

  const createdSession = await client.checkoutSession.create({
    data: {
      userId,
      provider: "VIETQR",
      status: "PENDING",
      expiresAt,
      amount: totalAmount,
      currency: "VND",
      cartSnapshot,
      shippingSnapshot,
      couponSnapshot,
      note: note ?? null,
      providerRef,
      paymentUrl: qrImageUrl,
    },
  });

  return {
    sessionId: createdSession.id,
    provider: createdSession.provider,
    status: createdSession.status,
    expiresAt: createdSession.expiresAt.toISOString(),
    amount: Number(createdSession.amount),
    currency: createdSession.currency,
    paymentUrl: createdSession.paymentUrl ?? undefined,
    providerRef: createdSession.providerRef ?? undefined,
    bankInfo: {
      bankId: bankConfig.bankId,
      bankName: `Ngân hàng ${bankConfig.bankId}`,
      accountNo: bankConfig.accountNo,
      accountName: bankConfig.accountName,
    },
  } satisfies CreatePaymentSessionResponseDto;
}

export async function getCheckoutSessionStatus(
  sessionId: string,
  userId: string,
): Promise<CheckoutSessionStatusDto | null> {
  const session = await prisma.checkoutSession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  });

  if (!session) {
    return null;
  }

  return {
    sessionId: session.id,
    provider: session.provider,
    status: session.status,
    expiresAt: session.expiresAt.toISOString(),
    amount: Number(session.amount),
    currency: session.currency,
    orderId: session.orderId ?? undefined,
    paymentProviderCode: session.providerCode ?? null,
  };
}

export async function commitOrderFromSession(
  sessionId: string,
): Promise<{ orderId: string } | null> {
  const result = await prisma.$transaction(async (tx) => {
    const client = tx as TransactionClient;

    const session = await client.checkoutSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    if (session.status !== "PENDING") {
      if (session.orderId) {
        return { orderId: session.orderId };
      }
      return null;
    }

    const userId = session.userId;

    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const refreshed = await client.checkoutSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!refreshed || refreshed.status !== "PENDING") {
      if (refreshed?.orderId) {
        return { orderId: refreshed.orderId };
      }
      return null;
    }

    const cartSnapshot = refreshed.cartSnapshot as {
      items: {
        productId: string;
        quantity: number;
        unitPrice: number;
        productName: string;
        productImageUrl: string | null;
      }[];
    };

    if (!cartSnapshot.items || cartSnapshot.items.length === 0) {
      await client.checkoutSession.update({
        where: { id: refreshed.id },
        data: { status: "FAILED" },
      });
      return null;
    }

    const products = await client.product.findMany({
      where: {
        id: {
          in: cartSnapshot.items.map((item) => item.productId),
        },
      },
      select: {
        id: true,
        name: true,
        stock: true,
        status: true,
      },
    });

    const productMap = new Map(
      products.map((p) => [p.id, p]),
    );

    for (const item of cartSnapshot.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        await client.checkoutSession.update({
          where: { id: refreshed.id },
          data: { status: "FAILED" },
        });
        return null;
      }

      if (product.status !== "ACTIVE" || product.stock < item.quantity) {
        await client.checkoutSession.update({
          where: { id: refreshed.id },
          data: { status: "FAILED" },
        });
        return null;
      }
    }

    const orderRequest = buildOrderRequestFromSession(refreshed);

    const order = await createOrderWithExistingCart(
      client,
      userId,
      orderRequest,
      cartSnapshot.items,
      refreshed.shippingSnapshot as any,
      refreshed.couponSnapshot as any,
      Number(refreshed.amount),
    );

    await client.checkoutSession.update({
      where: { id: refreshed.id },
      data: {
        status: "SUCCEEDED",
        orderId: order.id,
      },
    });

    return { orderId: order.id };
  });

  return result;
}

async function createOrderWithExistingCart(
  client: TransactionClient,
  userId: string,
  dto: CreateOrderRequestDto,
  itemsSnapshot: {
    productId: string;
    quantity: number;
    unitPrice: number;
    productName: string;
    productImageUrl: string | null;
  }[],
  shippingSnapshot: {
    shippingFee: number;
    shippingFeeOriginal?: number;
    estimatedDays: string;
  } | null,
  couponSnapshot: {
    discountCouponCode?: string;
    shippingCouponCode?: string;
    discountCouponAmount?: number;
    shippingCouponDiscount?: number;
  } | null,
  sessionAmount: number,
): Promise<{ id: string }> {
  const now = new Date();

  const addressInput = dto.shippingAddress ?? {};
  let shippingAddressId: string | null = null;

  if (addressInput.addressId) {
    shippingAddressId = addressInput.addressId;
  } else {
    const createdAddress = await client.address.create({
      data: {
        userId,
        fullName: addressInput.fullName ?? "",
        phone: addressInput.phone ?? "",
        line1: addressInput.line1 ?? "",
        line2: addressInput.line2 ?? null,
        ward: addressInput.ward ?? null,
        district: addressInput.district ?? "",
        province: addressInput.province ?? "",
        postalCode: addressInput.postalCode ?? null,
        isDefault: false,
      },
    });
    shippingAddressId = createdAddress.id;
  }

  const subtotal = itemsSnapshot.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  const shippingServiceTypeId =
    dto.shippingServiceTypeId === 5 || dto.shippingServiceTypeId === 2
      ? dto.shippingServiceTypeId
      : 2;

  // Lấy dữ liệu từ snapshot để đảm bảo chính xác với số tiền user đã trả
  const shippingFee = shippingSnapshot?.shippingFee ?? 0;
  const couponDiscount = couponSnapshot?.discountCouponAmount ?? 0;
  const shippingCouponDiscount = couponSnapshot?.shippingCouponDiscount ?? 0;

  // Tìm ID của coupon để lưu relation
  let couponId: string | undefined = undefined;
  let shippingCouponId: string | undefined = undefined;

  if (couponSnapshot?.discountCouponCode) {
    const cp = await client.coupon.findUnique({
      where: { code: couponSnapshot.discountCouponCode },
      select: { id: true },
    });
    if (cp) couponId = cp.id;
  }

  if (couponSnapshot?.shippingCouponCode) {
    const scp = await client.coupon.findUnique({
      where: { code: couponSnapshot.shippingCouponCode },
      select: { id: true },
    });
    if (scp) shippingCouponId = scp.id;
  }

  // totalAmount phải khớp với sessionAmount để không bị lệch tiền trong Order
  const totalAmount = sessionAmount;
  const shippingFeeOriginal = shippingSnapshot?.shippingFeeOriginal ?? shippingFee;

  const order = await client.order.create({
    data: {
      orderNumber: `DUA-${now.getTime()}`,
      user: { connect: { id: userId } },
      status: "PAID",
      totalAmount,
      currency: "VND",
      paymentStatus: "PAID",
      paymentProvider: dto.paymentMethod === "QR_TRANSFER" ? "QR_TRANSFER" : "VNPAY",
      paymentIntentId: null,
      shippingFee,
      shippingFeeOriginal,
      coupon: couponId ? { connect: { id: couponId } } : undefined,
      couponDiscount,
      shippingCoupon: shippingCouponId ? { connect: { id: shippingCouponId } } : undefined,
      shippingCouponDiscount,
      shippingAddress: shippingAddressId
        ? { connect: { id: shippingAddressId } }
        : undefined,
      shippingProvider: "GHN",
      shippingService: shippingServiceTypeId === 5 ? "EXPRESS" : "ECONOMY",
      shippingServiceTypeId,
      metadata: dto.note
        ? ({ note: dto.note } as unknown as Prisma.InputJsonValue)
        : undefined,
    },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      shippingFee: true,
      couponDiscount: true,
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
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  // 3. Record Coupon Usage
  if (couponId) {
    await client.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });

    await client.orderCoupon.create({
      data: {
        orderId: order.id,
        couponId: couponId,
        appliedAmount: couponDiscount,
      },
    });

    // Mark user coupon as used if it exists
    await client.userCoupon.updateMany({
      where: {
        userId,
        couponId,
        status: "AVAILABLE",
      },
      data: { status: "USED" },
    });
  }

  if (shippingCouponId) {
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

  for (const item of itemsSnapshot) {
    await client.orderItem.create({
      data: {
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        productName: item.productName,
        productImageUrl: item.productImageUrl,
      },
    });

    await adjustProductStockWithTx(client, {
      productId: item.productId,
      delta: -item.quantity,
      reason: `Đơn hàng #${order.id}`,
      source: "ORDER_PLACED",
      referenceId: order.id,
    });
  }

  await client.cartItem.deleteMany({
    where: { cart: { userId } },
  });

  await client.cart.updateMany({
    where: { userId },
    data: { status: "CONVERTED" },
  });

  // Gửi email xác nhận đơn hàng (fire-and-forget)
  if (order.user?.email) {
    void sendOrderConfirmationEmail({
      toEmail: order.user.email,
      fullName: order.user.name || "",
      orderNumber: order.orderNumber,
      totalAmount: Number(order.totalAmount),
      shippingFee: Number(order.shippingFee ?? 0),
      couponDiscount: Number(order.couponDiscount ?? 0),
      items: itemsSnapshot.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.unitPrice * item.quantity,
      })),
      shippingAddress: order.shippingAddress
        ? {
            fullName: order.shippingAddress.fullName,
            phone: order.shippingAddress.phone,
            line1: order.shippingAddress.line1,
            line2: order.shippingAddress.line2 ?? null,
            ward: order.shippingAddress.ward ?? null,
            district: order.shippingAddress.district ?? null,
            province: order.shippingAddress.province ?? null,
          }
        : null,
      orderDetailUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/account/orders/${order.id}`,
    });
  }

  return { id: order.id };
}

