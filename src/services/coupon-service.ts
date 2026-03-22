/**
 * Coupon service: tra cứu mã, kiểm tra điều kiện, tính toán discount.
 * Một nguồn sự thật cho logic coupon; API chỉ gọi service, không tự tính lại.
 */

import type { Coupon, CouponType, UserCouponStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CouponValidateInput = {
  code: string;
  orderSubtotal: number;
  userId?: string;
  shippingFee?: number;
};

export type CouponValidateResult = {
  isValid: boolean;
  reason?: string;
  normalizedCode?: string;
  couponId?: string;
  type?: CouponType;
  discountAmount?: number;
  appliedShippingDiscount?: number;
  finalSubtotal?: number;
};

export type WalletCouponStatus =
  | "APPLICABLE"
  | "NOT_APPLICABLE"
  | "USED"
  | "EXPIRED";

export type WalletCouponDto = {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  minOrderAmount: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  status: WalletCouponStatus;
  reasonNotApplicable?: string;
};

/** Chuẩn hoá mã: trim + uppercase để tra cứu nhất quán. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Lấy coupon đang hiệu lực theo mã (findUnique + check isActive, startsAt, endsAt). */
export async function getActiveCouponByCode(
  code: string,
  now: Date = new Date(),
): Promise<Coupon | null> {
  const coupon = await prisma.coupon.findUnique({
    where: { code },
  });
  if (!coupon || !coupon.isActive) {
    return null;
  }
  if (coupon.startsAt != null && coupon.startsAt > now) {
    return null;
  }
  if (coupon.endsAt != null && coupon.endsAt < now) {
    return null;
  }
  return coupon;
}

type CouponForCompute = {
  type: CouponType;
  value: number | null;
  maxDiscount: number | null;
  minOrderAmount: number | null;
};

function toNum(d: unknown): number | null {
  if (d == null) return null;
  if (typeof d === "number" && Number.isFinite(d)) return d;
  if (typeof d === "object" && d !== null && "toNumber" in d && typeof (d as { toNumber: () => number }).toNumber === "function") {
    return (d as { toNumber: () => number }).toNumber();
  }
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

/** Chuẩn hoá coupon từ DB sang object số để tính toán. */
function toCouponForCompute(coupon: Coupon): CouponForCompute {
  return {
    type: coupon.type,
    value: toNum(coupon.value),
    maxDiscount: toNum(coupon.maxDiscount),
    minOrderAmount: toNum(coupon.minOrderAmount),
  };
}

export type ComputeDiscountResult = {
  discountAmount: number;
  appliedShippingDiscount?: number;
};

/**
 * Tính số tiền giảm theo loại coupon (stateless).
 * - PERCENTAGE: subtotal * (value/100), cap bởi maxDiscount nếu có.
 * - FIXED: min(value, subtotal).
 * - FREE_SHIPPING: giảm phí ship (value = null => miễn toàn bộ; value > 0 => min(value, shippingFee)).
 */
export function computeCouponDiscount(
  coupon: CouponForCompute,
  orderSubtotal: number,
  shippingFee: number = 0,
): ComputeDiscountResult {
  const result: ComputeDiscountResult = { discountAmount: 0 };

  if (coupon.minOrderAmount != null && coupon.minOrderAmount > 0 && orderSubtotal < coupon.minOrderAmount) {
    return result;
  }

  switch (coupon.type) {
    case "PERCENTAGE": {
      const pct = coupon.value != null ? coupon.value / 100 : 0;
      let raw = orderSubtotal * pct;
      if (coupon.maxDiscount != null && coupon.maxDiscount >= 0) {
        raw = Math.min(raw, coupon.maxDiscount);
      }
      result.discountAmount = Math.round(raw);
      break;
    }
    case "FIXED": {
      const fixed = coupon.value != null ? coupon.value : 0;
      result.discountAmount = Math.min(fixed, orderSubtotal);
      result.discountAmount = Math.round(result.discountAmount);
      break;
    }
    case "FREE_SHIPPING": {
      if (shippingFee > 0) {
        if (coupon.value == null || coupon.value <= 0) {
          result.appliedShippingDiscount = shippingFee;
        } else {
          result.appliedShippingDiscount = Math.min(coupon.value, shippingFee);
        }
      }
      result.discountAmount = 0;
      break;
    }
    default:
      break;
  }

  return result;
}

/**
 * Validate mã giảm giá: tra cứu, kiểm tra usageLimit, tính discount.
 * Không thay đổi usedCount; dùng cho "ước tính" khi user nhập mã trên giỏ hàng.
 */
export async function validateCoupon(
  input: CouponValidateInput,
): Promise<CouponValidateResult> {
  const normalizedCode = normalizeCode(input.code);
  if (!normalizedCode) {
    return { isValid: false, reason: "Mã giảm giá không hợp lệ." };
  }

  const now = new Date();
  const coupon = await getActiveCouponByCode(normalizedCode, now);
  if (!coupon) {
    return {
      isValid: false,
      reason: "Mã không tồn tại, đã hết hạn hoặc chưa đến thời gian áp dụng.",
      normalizedCode,
    };
  }

  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return {
      isValid: false,
      reason: "Mã đã hết lượt sử dụng.",
      normalizedCode,
      couponId: coupon.id,
    };
  }

  // New check: usageLimitPerUser
  const couponData = coupon as any;
  if (input.userId && couponData.usageLimitPerUser != null) {
    const userUsageCount = await prisma.orderCoupon.count({
      where: {
        couponId: coupon.id,
        order: {
          userId: input.userId,
          // Only count successful or pending valid orders
          status: { notIn: ["CANCELLED", "FAILED"] },
        },
      },
    });

    if (userUsageCount >= (couponData.usageLimitPerUser as number)) {
      return {
        isValid: false,
        reason: `Bạn đã sử dụng mã này ${userUsageCount} lần (giới hạn ${couponData.usageLimitPerUser} lần/người).`,
        normalizedCode,
        couponId: coupon.id,
      };
    }
  }

  const forCompute = toCouponForCompute(coupon);
  const shippingFee = input.shippingFee ?? 0;
  const computed = computeCouponDiscount(
    forCompute,
    input.orderSubtotal,
    shippingFee,
  );

  const hasDiscount =
    (computed.discountAmount > 0) ||
    (computed.appliedShippingDiscount != null && computed.appliedShippingDiscount > 0);

  if (!hasDiscount) {
    return {
      isValid: false,
      reason: "Đơn hàng chưa đủ điều kiện áp dụng mã (ví dụ: đơn tối thiểu chưa đạt).",
      normalizedCode,
      couponId: coupon.id,
    };
  }

  const finalSubtotal = Math.max(0, input.orderSubtotal - computed.discountAmount);

  return {
    isValid: true,
    normalizedCode,
    couponId: coupon.id,
    type: coupon.type,
    discountAmount: computed.discountAmount,
    appliedShippingDiscount: computed.appliedShippingDiscount,
    finalSubtotal,
  };
}

function mapUserCouponStatusToWalletStatus(
  status: UserCouponStatus,
): WalletCouponStatus {
  switch (status) {
    case "USED":
      return "USED";
    case "EXPIRED":
      return "EXPIRED";
    case "LOCKED":
      return "NOT_APPLICABLE";
    case "AVAILABLE":
    default:
      return "APPLICABLE";
  }
}

export type GetWalletInput = {
  userId: string;
  orderSubtotal: number;
  shippingFee?: number;
};

/**
 * Lấy danh sách voucher trong ví của user và tính trạng thái áp dụng
 * dựa trên tổng tiền đơn hàng hiện tại.
 */
export async function getUserCouponWallet(
  input: GetWalletInput,
): Promise<WalletCouponDto[]> {
  const { userId, orderSubtotal, shippingFee = 0 } = input;
  const now = new Date();

  const [userCoupons, userUsageStats] = await Promise.all([
    prisma.userCoupon.findMany({
      where: {
        userId,
      },
      include: {
        coupon: true,
      },
    }),
    prisma.orderCoupon.groupBy({
      by: ["couponId"],
      where: {
        order: {
          userId,
          status: { notIn: ["CANCELLED", "FAILED"] },
        },
      },
      _count: {
        couponId: true,
      },
    }),
  ]);

  const usageMap = new Map<string, number>();
  userUsageStats.forEach((stat) => {
    usageMap.set(stat.couponId, stat._count.couponId);
  });

  if (userCoupons.length > 0) {
    return userCoupons.map((uc) => {
      const c = uc.coupon;

      const baseStatus = mapUserCouponStatusToWalletStatus(uc.status);

      let status: WalletCouponStatus = baseStatus;
      let reasonNotApplicable: string | undefined;

      const isTimeActive =
        c.isActive &&
        (c.startsAt == null || c.startsAt <= now) &&
        (c.endsAt == null || c.endsAt >= now);

      if (!isTimeActive) {
        status = "NOT_APPLICABLE";
        reasonNotApplicable = "Mã không còn trong thời gian áp dụng.";
      } else if (c.minOrderAmount != null) {
        const minAmount = toNum(c.minOrderAmount);
        if (minAmount != null && orderSubtotal < minAmount) {
          status = "NOT_APPLICABLE";
          reasonNotApplicable = `Đơn tối thiểu ${minAmount.toLocaleString("vi-VN")}đ.`;
        }
      }

      // Check usageLimitPerUser
      const userUsageCount = usageMap.get(c.id) ?? 0;
      const cData = c as any;
      if (status === "APPLICABLE" && cData.usageLimitPerUser != null && userUsageCount >= cData.usageLimitPerUser) {
        status = "NOT_APPLICABLE";
        reasonNotApplicable = `Bạn đã sử dụng mã này ${userUsageCount} lần (giới hạn ${cData.usageLimitPerUser} lần/người).`;
      }

      if (status === "APPLICABLE" && c.type === "FREE_SHIPPING" && shippingFee <= 0) {
        status = "NOT_APPLICABLE";
        reasonNotApplicable = "Đơn hàng hiện không phát sinh phí vận chuyển.";
      }

      // Nếu UserCoupon đã USED/EXPIRED thì ưu tiên trạng thái đó.
      if (baseStatus === "USED") {
        status = "USED";
        reasonNotApplicable = "Mã đã được sử dụng.";
      } else if (baseStatus === "EXPIRED") {
        status = "EXPIRED";
        reasonNotApplicable = "Mã đã hết hạn.";
      }

      return {
        id: uc.id,
        code: c.code,
        description: c.description ?? null,
        type: c.type,
        minOrderAmount:
          c.minOrderAmount != null ? toNum(c.minOrderAmount) : null,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        status,
        reasonNotApplicable,
      };
    });
  }

  const coupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      OR: [
        { startsAt: null },
        { startsAt: { lte: now } },
      ],
      AND: [
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return coupons.map((c) => {
    let status: WalletCouponStatus = "APPLICABLE";
    let reasonNotApplicable: string | undefined;

    const minAmount = c.minOrderAmount != null ? toNum(c.minOrderAmount) : null;
    if (minAmount != null && orderSubtotal < minAmount) {
      status = "NOT_APPLICABLE";
      reasonNotApplicable = `Đơn tối thiểu ${minAmount.toLocaleString("vi-VN")}đ.`;
    }

    if (status === "APPLICABLE" && c.type === "FREE_SHIPPING" && shippingFee <= 0) {
      status = "NOT_APPLICABLE";
      reasonNotApplicable = "Đơn hàng hiện không phát sinh phí vận chuyển.";
    }

    // Check usageLimitPerUser
    const userUsageCount = usageMap.get(c.id) ?? 0;
    const cData = c as any;
    if (status === "APPLICABLE" && cData.usageLimitPerUser != null && userUsageCount >= cData.usageLimitPerUser) {
      status = "NOT_APPLICABLE";
      reasonNotApplicable = `Bạn đã sử dụng mã này ${userUsageCount} lần (giới hạn ${cData.usageLimitPerUser} lần/người).`;
    }

    return {
      id: c.id,
      code: c.code,
      description: c.description ?? null,
      type: c.type,
      minOrderAmount: minAmount,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      status,
      reasonNotApplicable,
    };
  });
}

/**
 * Lấy danh sách TẤT CẢ voucher HỢP LỆ của người dùng để hiển thị trong Ví Voucher.
 * Không phụ thuộc vào giá trị đơn hàng hiện tại.
 */
export async function getProfileCouponWallet(
  userId: string,
): Promise<WalletCouponDto[]> {
  const now = new Date();

  const [userCoupons, userUsageStats] = await Promise.all([
    prisma.userCoupon.findMany({
      where: {
        userId,
      },
      include: {
        coupon: true,
      },
    }),
    prisma.orderCoupon.groupBy({
      by: ["couponId"],
      where: {
        order: {
          userId,
          status: { notIn: ["CANCELLED", "FAILED"] },
        },
      },
      _count: {
        couponId: true,
      },
    }),
  ]);

  const usageMap = new Map<string, number>();
  userUsageStats.forEach((stat) => {
    usageMap.set(stat.couponId, stat._count.couponId);
  });

  const walletCoupons: WalletCouponDto[] = [];
  const processedCouponIds = new Set<string>();

  // 1. Xử lý các voucher mà user đã lưu (UserCoupon)
  for (const uc of userCoupons) {
    const c = uc.coupon;
    processedCouponIds.add(c.id);

    const baseStatus = mapUserCouponStatusToWalletStatus(uc.status);

    // Nếu UserCoupon đã bị đánh dấu là USED, EXPIRED, LOCKED thì không hiển thị hoặc hiển thị mờ
    // Yêu cầu: chỉ hiển thị voucher CÓ THỂ ÁP DỤNG. Nên ta có thể bỏ qua các mã không APPLICABLE.
    if (baseStatus !== "APPLICABLE") {
      continue;
    }

    const isTimeActive =
      c.isActive &&
      (c.startsAt == null || c.startsAt <= now) &&
      (c.endsAt == null || c.endsAt >= now);

    if (!isTimeActive) {
      continue; // Đã cấu hình ngưng hoạt động hoặc sai thời gian
    }

    // Check usageLimit (tổng lượt dùng của mã)
    if (c.usageLimit != null && c.usedCount >= c.usageLimit) {
      continue;
    }

    // Check usageLimitPerUser
    const userUsageCount = usageMap.get(c.id) ?? 0;
    const cData = c as any;
    if (cData.usageLimitPerUser != null && userUsageCount >= cData.usageLimitPerUser) {
      continue; // User đã dùng hết lượt
    }

    walletCoupons.push({
      id: uc.id, // Trả về ID của UserCoupon
      code: c.code,
      description: c.description ?? null,
      type: c.type,
      minOrderAmount: c.minOrderAmount != null ? toNum(c.minOrderAmount) : null,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      status: "APPLICABLE",
    });
  }

  // 2. Kéo thêm các voucher công khai chưa lưu nhưng user có thể dùng
  const publicCoupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      id: { notIn: Array.from(processedCouponIds) }, // Không lấy trùng
      OR: [
        { startsAt: null },
        { startsAt: { lte: now } },
      ],
      AND: [
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  for (const c of publicCoupons) {
    // Check usageLimit (tổng lượt dùng của mã)
    if (c.usageLimit != null && c.usedCount >= c.usageLimit) {
      continue;
    }

    // Check usageLimitPerUser
    const userUsageCount = usageMap.get(c.id) ?? 0;
    const cData = c as any;
    if (cData.usageLimitPerUser != null && userUsageCount >= cData.usageLimitPerUser) {
      continue; // User đã dùng hết lượt
    }

    walletCoupons.push({
      id: c.id, // ID của Coupon public
      code: c.code,
      description: c.description ?? null,
      type: c.type,
      minOrderAmount: c.minOrderAmount != null ? toNum(c.minOrderAmount) : null,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      status: "APPLICABLE",
    });
  }

  return walletCoupons;
}
