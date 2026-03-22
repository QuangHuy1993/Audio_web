import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCode } from "@/services/coupon-service";

export const runtime = "nodejs";

const DEFAULT_PAGE_SIZE = 10;

type StatusFilter = "all" | "active" | "scheduled" | "expired";
type TypeFilter = "all" | "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";

const COUPON_TYPES: TypeFilter[] = ["all", "PERCENTAGE", "FIXED", "FREE_SHIPPING"];
const STATUSES: StatusFilter[] = ["all", "active", "scheduled", "expired"];

type CreateCouponBody = {
  code: string;
  description?: string | null;
  type: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
  value?: number | null;
  maxDiscount?: number | null;
  minOrderAmount?: number | null;
  usageLimit?: number | null;
  usageLimitPerUser?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
};

function buildWhere(
  search: string,
  status: StatusFilter,
  typeFilter: TypeFilter,
  now: Date,
): Prisma.CouponWhereInput {
  const andConditions: Prisma.CouponWhereInput[] = [];

  if (search) {
    andConditions.push({
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (typeFilter !== "all") {
    andConditions.push({ type: typeFilter });
  }

  if (status === "active") {
    andConditions.push({ isActive: true });
    andConditions.push({
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
    });
    andConditions.push({
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    });
  } else if (status === "scheduled") {
    andConditions.push({ isActive: true });
    andConditions.push({ startsAt: { gt: now } });
  } else if (status === "expired") {
    andConditions.push({
      OR: [{ isActive: false }, { endsAt: { lt: now } }],
    });
  }

  if (andConditions.length === 0) return {};
  return { AND: andConditions };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");
  const search = searchParams.get("search")?.trim() ?? "";
  const status = (searchParams.get("status") as StatusFilter) ?? "all";
  const typeFilter = (searchParams.get("type") as TypeFilter) ?? "all";

  if (!STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "Tham số status không hợp lệ." },
      { status: 400 },
    );
  }
  if (!COUPON_TYPES.includes(typeFilter)) {
    return NextResponse.json(
      { error: "Tham số type không hợp lệ." },
      { status: 400 },
    );
  }

  const page = Math.max(Number(pageParam ?? "1") || 1, 1);
  const pageSize = Math.max(
    Math.min(
      Number(pageSizeParam ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE,
      50,
    ),
    1,
  );

  const now = new Date();
  const where = buildWhere(search, status, typeFilter, now);

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
      },
    }),
    prisma.coupon.count({ where }),
  ]);

  return NextResponse.json({
    data: coupons.map((c) => ({
      id: c.id,
      code: c.code,
      description: c.description,
      type: c.type,
      value: c.value != null ? Number(c.value) : null,
      maxDiscount: c.maxDiscount != null ? Number(c.maxDiscount) : null,
      minOrderAmount: c.minOrderAmount != null ? Number(c.minOrderAmount) : null,
      usageLimit: c.usageLimit,
      usageLimitPerUser: c.usageLimitPerUser,
      usedCount: c.usedCount,
      isActive: c.isActive,
      startsAt: c.startsAt?.toISOString() ?? null,
      endsAt: c.endsAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền tạo mã giảm giá." },
      { status: 403 },
    );
  }

  let body: CreateCouponBody;
  try {
    body = (await request.json()) as CreateCouponBody;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const code = normalizeCode(body.code ?? "");
  if (!code) {
    return NextResponse.json(
      { error: "Mã giảm giá là bắt buộc." },
      { status: 400 },
    );
  }

  const type = body.type;
  if (!type || !["PERCENTAGE", "FIXED", "FREE_SHIPPING"].includes(type)) {
    return NextResponse.json(
      { error: "Loại mã giảm giá không hợp lệ (PERCENTAGE, FIXED, FREE_SHIPPING)." },
      { status: 400 },
    );
  }

  let value: number | null = null;
  if (body.value != null) {
    const v = Number(body.value);
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json(
        { error: "Giá trị giảm không hợp lệ." },
        { status: 400 },
      );
    }
    value = v;
  }

  if (type === "PERCENTAGE" && (value == null || value <= 0 || value > 100)) {
    return NextResponse.json(
      { error: "Với loại PERCENTAGE, value phải trong khoảng 0 < value <= 100." },
      { status: 400 },
    );
  }

  let maxDiscount: number | null = null;
  if (body.maxDiscount != null) {
    const m = Number(body.maxDiscount);
    if (Number.isFinite(m) && m >= 0) maxDiscount = m;
  }

  let minOrderAmount: number | null = null;
  if (body.minOrderAmount != null) {
    const m = Number(body.minOrderAmount);
    if (Number.isFinite(m) && m >= 0) minOrderAmount = m;
  }

  let usageLimit: number | null = null;
  if (body.usageLimit != null) {
    const u = Number(body.usageLimit);
    if (Number.isInteger(u) && u > 0) usageLimit = u;
  }

  let usageLimitPerUser: number | null = null;
  if (body.usageLimitPerUser != null) {
    const u = Number(body.usageLimitPerUser);
    if (Number.isInteger(u) && u > 0) usageLimitPerUser = u;
  }

  let startsAt: Date | null = null;
  if (body.startsAt) {
    const d = new Date(body.startsAt);
    if (Number.isFinite(d.getTime())) startsAt = d;
  }

  let endsAt: Date | null = null;
  if (body.endsAt) {
    const d = new Date(body.endsAt);
    if (Number.isFinite(d.getTime())) endsAt = d;
  }

  if (startsAt != null && endsAt != null && endsAt <= startsAt) {
    return NextResponse.json(
      { error: "Ngày kết thúc phải sau ngày bắt đầu." },
      { status: 400 },
    );
  }

  const isActive = body.isActive !== false;

  try {
    const created = await prisma.coupon.create({
      data: {
        code,
        description: body.description?.trim() ?? null,
        type,
        value: value != null ? new Prisma.Decimal(value) : null,
        maxDiscount: maxDiscount != null ? new Prisma.Decimal(maxDiscount) : null,
        minOrderAmount: minOrderAmount != null ? new Prisma.Decimal(minOrderAmount) : null,
        usageLimit,
        usageLimitPerUser,
        isActive,
        startsAt,
        endsAt,
      },
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
      },
    });

    return NextResponse.json(
      {
        data: {
          ...created,
          value: created.value != null ? Number(created.value) : null,
          maxDiscount: created.maxDiscount != null ? Number(created.maxDiscount) : null,
          minOrderAmount: created.minOrderAmount != null ? Number(created.minOrderAmount) : null,
          startsAt: created.startsAt?.toISOString() ?? null,
          endsAt: created.endsAt?.toISOString() ?? null,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Mã giảm giá này đã tồn tại trong hệ thống." },
        { status: 409 },
      );
    }
    console.error("[POST /api/admin/coupons]", error);
    return NextResponse.json(
      { error: "Không thể tạo mã giảm giá. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}
