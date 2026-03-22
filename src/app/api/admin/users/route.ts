import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DEFAULT_PAGE_SIZE = 5;

type CreateAdminUserBody = {
  name?: string;
  email?: string;
  password?: string;
  role?: "USER" | "ADMIN";
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");
  const search = searchParams.get("search")?.trim() ?? "";
  const role = searchParams.get("role");
  const emailVerifiedFilter = searchParams.get("emailVerified");
  const purchaseStatusFilter = searchParams.get("purchaseStatus");
  const cartStatusFilter = searchParams.get("cartStatus");
  const createdFrom = searchParams.get("createdFrom");
  const createdTo = searchParams.get("createdTo");

  const page = Math.max(Number(pageParam ?? "1") || 1, 1);
  const pageSize = Math.max(
    Math.min(
      Number(pageSizeParam ?? DEFAULT_PAGE_SIZE.toString()) || DEFAULT_PAGE_SIZE,
      50
    ),
    1
  );

  const where: Prisma.UserWhereInput = {};

  const andConditions: Prisma.UserWhereInput[] = [];

  if (search) {
    andConditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (role === "ADMIN" || role === "USER") {
    andConditions.push({ role });
  }

  if (emailVerifiedFilter === "verified") {
    andConditions.push({
      emailVerified: {
        not: null,
      },
    });
  } else if (emailVerifiedFilter === "unverified") {
    andConditions.push({
      emailVerified: null,
    });
  }

  if (purchaseStatusFilter === "hasOrders") {
    andConditions.push({
      orders: {
        some: {},
      },
    });
  } else if (purchaseStatusFilter === "noOrders") {
    andConditions.push({
      orders: {
        none: {},
      },
    });
  }

  if (cartStatusFilter === "hasCart") {
    andConditions.push({
      cart: {
        isNot: null,
      },
    });
  } else if (cartStatusFilter === "noCart") {
    andConditions.push({
      cart: {
        is: null,
      },
    });
  }

  if (createdFrom) {
    const fromDate = new Date(createdFrom);
    if (!Number.isNaN(fromDate.getTime())) {
      andConditions.push({
        createdAt: {
          gte: fromDate,
        },
      });
    }
  }

  if (createdTo) {
    const toDate = new Date(createdTo);
    if (!Number.isNaN(toDate.getTime())) {
      andConditions.push({
        createdAt: {
          lte: toDate,
        },
      });
    }
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  const userIds = users.map((user: (typeof users)[number]) => user.id);

  const [carts, orderItems] = await Promise.all([
    prisma.cart.findMany({
      where: {
        userId: { in: userIds },
        status: "ACTIVE",
      },
      select: {
        userId: true,
        items: {
          select: {
            productId: true,
          },
        },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          userId: { in: userIds },
        },
      },
      select: {
        productId: true,
        order: {
          select: {
            userId: true,
          },
        },
      },
    }),
  ]);

  const cartProductCounts = new Map<string, number>();
  carts.forEach((cart: (typeof carts)[number]) => {
    if (!cart.userId) return;
    const distinctProductIds = new Set(
      cart.items.map((item: (typeof carts)[number]["items"][number]) => item.productId)
    );
    cartProductCounts.set(cart.userId, distinctProductIds.size);
  });

  // Build sets for purchased products per user
  const purchasedProductSets = new Map<string, Set<string>>();
  orderItems.forEach((item: (typeof orderItems)[number]) => {
    const userId = item.order.userId;
    if (!userId) return;
    let set = purchasedProductSets.get(userId);
    if (!set) {
      set = new Set<string>();
      purchasedProductSets.set(userId, set);
    }
    set.add(item.productId);
  });

  const purchasedCounts = new Map<string, number>();
  purchasedProductSets.forEach((set: Set<string>, userId: string) => {
    purchasedCounts.set(userId, set.size);
  });

  return NextResponse.json({
    data: users.map((user: (typeof users)[number]) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
      cartProductCount: cartProductCounts.get(user.id) ?? 0,
      purchasedProductCount: purchasedCounts.get(user.id) ?? 0,
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
      { error: "Bạn không có quyền tạo người dùng mới." },
      { status: 403 }
    );
  }

  let jsonBody: CreateAdminUserBody;

  try {
    jsonBody = (await request.json()) as CreateAdminUserBody;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 }
    );
  }

  const rawEmail = jsonBody.email?.trim().toLowerCase() ?? "";
  const rawPassword = jsonBody.password ?? "";
  const rawName = jsonBody.name?.trim() ?? "";
  const role: "USER" | "ADMIN" =
    jsonBody.role === "ADMIN" || jsonBody.role === "USER" ? jsonBody.role : "USER";

  if (!rawEmail || !rawPassword) {
    return NextResponse.json(
      { error: "Email và mật khẩu là bắt buộc." },
      { status: 400 }
    );
  }

  if (!rawEmail.includes("@")) {
    return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
  }

  if (rawPassword.length < 6) {
    return NextResponse.json(
      { error: "Mật khẩu phải có ít nhất 6 ký tự." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(rawPassword, 10);

  try {
    const created = await prisma.user.create({
      data: {
        name: rawName || null,
        email: rawEmail,
        role,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        data: {
          ...created,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email này đã tồn tại trong hệ thống." },
        { status: 409 }
      );
    }

    console.error("Failed to create admin user", error);

    return NextResponse.json(
      { error: "Không thể tạo người dùng mới. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}

