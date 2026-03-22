import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCode } from "@/services/coupon-service";

export const runtime = "nodejs";

type PatchCouponBody = {
  code?: string;
  description?: string | null;
  type?: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
  value?: number | null;
  maxDiscount?: number | null;
  minOrderAmount?: number | null;
  usageLimit?: number | null;
  usageLimitPerUser?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { error: "Thiếu mã coupon." },
      { status: 400 },
    );
  }

  const coupon = (await prisma.coupon.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      description: true,
      type: true,
      value: true,
      maxDiscount: true,
      minOrderAmount: true,
      usageLimit: true,
      usageLimitPerUser: true,
      usedCount: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      updatedAt: true,
    } as any,
  })) as any;

  if (!coupon) {
    return NextResponse.json(
      { error: "Mã giảm giá không tồn tại." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      ...coupon,
      value: coupon.value != null ? Number(coupon.value) : null,
      maxDiscount: coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
      minOrderAmount: coupon.minOrderAmount != null ? Number(coupon.minOrderAmount) : null,
      startsAt: coupon.startsAt?.toISOString() ?? null,
      endsAt: coupon.endsAt?.toISOString() ?? null,
      createdAt: coupon.createdAt.toISOString(),
      updatedAt: coupon.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền cập nhật mã giảm giá." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { error: "Thiếu mã coupon." },
      { status: 400 },
    );
  }

  const existing = await prisma.coupon.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      description: true,
      type: true,
      value: true,
      maxDiscount: true,
      minOrderAmount: true,
      usageLimit: true,
      usageLimitPerUser: true,
      usedCount: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
    } as any,
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Mã giảm giá không tồn tại." },
      { status: 404 },
    );
  }

  let body: PatchCouponBody;
  try {
    body = (await request.json()) as PatchCouponBody;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const existingData = existing as any;

  let code: string | undefined = existingData.code;
  if (body.code !== undefined) {
    const normalizedCode = normalizeCode(body.code);
    if (!normalizedCode) {
      return NextResponse.json(
        { error: "Mã giảm giá không được để trống." },
        { status: 400 },
      );
    }
    code = normalizedCode;
  }

  let type = existingData.type;
  if (body.type !== undefined) {
    if (!["PERCENTAGE", "FIXED", "FREE_SHIPPING"].includes(body.type)) {
      return NextResponse.json(
        { error: "Loại mã giảm giá không hợp lệ." },
        { status: 400 },
      );
    }
    type = body.type;
  }

  let value: number | null = existingData.value != null ? Number(existingData.value) : null;
  if (body.value !== undefined) {
    if (body.value == null) {
      value = null;
    } else {
      const v = Number(body.value);
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json(
          { error: "Giá trị giảm không hợp lệ." },
          { status: 400 },
        );
      }
      value = v;
    }
  }

  if (type === "PERCENTAGE" && value != null && (value <= 0 || value > 100)) {
    return NextResponse.json(
      { error: "Với loại PERCENTAGE, value phải trong khoảng 0 < value <= 100." },
      { status: 400 },
    );
  }

  let maxDiscount: number | null = existingData.maxDiscount != null ? Number(existingData.maxDiscount) : null;
  if (body.maxDiscount !== undefined) {
    maxDiscount = body.maxDiscount == null ? null : (Number.isFinite(Number(body.maxDiscount)) && Number(body.maxDiscount) >= 0 ? Number(body.maxDiscount) : maxDiscount);
  }

  let minOrderAmount: number | null = existingData.minOrderAmount != null ? Number(existingData.minOrderAmount) : null;
  if (body.minOrderAmount !== undefined) {
    minOrderAmount = body.minOrderAmount == null ? null : (Number.isFinite(Number(body.minOrderAmount)) && Number(body.minOrderAmount) >= 0 ? Number(body.minOrderAmount) : minOrderAmount);
  }

  let usageLimit: number | null = existingData.usageLimit;
  if (body.usageLimit !== undefined) {
    usageLimit = body.usageLimit == null ? null : (Number.isInteger(Number(body.usageLimit)) && Number(body.usageLimit) > 0 ? Number(body.usageLimit) : usageLimit);
  }

  let usageLimitPerUser: number | null = existingData.usageLimitPerUser;
  if (body.usageLimitPerUser !== undefined) {
    usageLimitPerUser = body.usageLimitPerUser == null ? null : (Number.isInteger(Number(body.usageLimitPerUser)) && Number(body.usageLimitPerUser) > 0 ? Number(body.usageLimitPerUser) : usageLimitPerUser);
  }

  let startsAt: Date | null = existingData.startsAt;
  if (body.startsAt !== undefined) {
    startsAt = body.startsAt == null || body.startsAt === "" ? null : (() => {
      const d = new Date(body.startsAt!);
      return Number.isFinite(d.getTime()) ? d : startsAt;
    })();
  }

  let endsAt: Date | null = existingData.endsAt;
  if (body.endsAt !== undefined) {
    endsAt = body.endsAt == null || body.endsAt === "" ? null : (() => {
      const d = new Date(body.endsAt!);
      return Number.isFinite(d.getTime()) ? d : endsAt;
    })();
  }

  if (startsAt != null && endsAt != null && endsAt <= startsAt) {
    return NextResponse.json(
      { error: "Ngày kết thúc phải sau ngày bắt đầu." },
      { status: 400 },
    );
  }

  const description = body.description !== undefined ? (body.description?.trim() ?? null) : existingData.description;
  const isActive = body.isActive !== undefined ? body.isActive : existingData.isActive;

  const updateData: Prisma.CouponUpdateInput = {
    code,
    description,
    type,
    value: value != null ? new Prisma.Decimal(value) : null,
    maxDiscount: maxDiscount != null ? new Prisma.Decimal(maxDiscount) : null,
    minOrderAmount: minOrderAmount != null ? new Prisma.Decimal(minOrderAmount) : null,
    usageLimit,
    usageLimitPerUser,
    startsAt,
    endsAt,
    isActive,
  } as any;

  try {
    const updatedRaw = await prisma.coupon.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        code: true,
        description: true,
        type: true,
        value: true,
        maxDiscount: true,
        minOrderAmount: true,
        usageLimit: true,
        usageLimitPerUser: true,
        usedCount: true,
        isActive: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        updatedAt: true,
      } as any,
    });

    const updated = updatedRaw as any;

    return NextResponse.json({
      data: {
        ...updated,
        value: updated.value != null ? Number(updated.value) : null,
        maxDiscount: updated.maxDiscount != null ? Number(updated.maxDiscount) : null,
        minOrderAmount: updated.minOrderAmount != null ? Number(updated.minOrderAmount) : null,
        startsAt: updated.startsAt?.toISOString() ?? null,
        endsAt: updated.endsAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Mã giảm giá này đã được sử dụng bởi coupon khác." },
        { status: 409 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Mã giảm giá không tồn tại." },
        { status: 404 },
      );
    }
    console.error("[PATCH /api/admin/coupons/:id]", error);
    return NextResponse.json(
      { error: "Không thể cập nhật mã giảm giá. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

/** Soft delete: đặt isActive = false thay vì xoá hẳn (phù hợp production). */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền xoá mã giảm giá." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { error: "Thiếu mã coupon." },
      { status: 400 },
    );
  }

  try {
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!coupon) {
      return NextResponse.json(
        { error: "Mã giảm giá không tồn tại." },
        { status: 404 },
      );
    }

    await prisma.coupon.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Mã giảm giá không tồn tại." },
        { status: 404 },
      );
    }
    console.error("[DELETE /api/admin/coupons/:id]", error);
    return NextResponse.json(
      { error: "Không thể vô hiệu hoá mã giảm giá. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}
