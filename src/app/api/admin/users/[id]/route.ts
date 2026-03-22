import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { OrderStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type UpdateUserBody = {
  name?: string;
  email?: string;
  defaultAddress?: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string | null;
    ward?: string | null;
    district?: string | null;
    province?: string | null;
    postalCode?: string | null;
  } | null;
  changePassword?: {
    newPassword: string;
  } | null;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền xem thông tin người dùng." },
      { status: 403 },
    );
  }

  const { id: userId } = await context.params;

  if (!userId) {
    return NextResponse.json({ error: "Thiếu mã người dùng." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      orders: {
        select: {
          id: true,
          status: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
      cart: {
        select: {
          id: true,
          status: true,
          items: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      addresses: {
        orderBy: [
          { isDefault: "desc" },
          { createdAt: "desc" },
        ],
      },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Không tìm thấy người dùng." },
      { status: 404 },
    );
  }

  const totalOrders = user.orders.length;
  const completedOrders = user.orders.filter(
    (order) => order.status === OrderStatus.COMPLETED,
  ).length;

  const cartItemCount =
    user.cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  const cartDistinctProducts = user.cart?.items.length ?? 0;

  return NextResponse.json({
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        emailVerified: user.emailVerified
          ? user.emailVerified.toISOString()
          : null,
      },
      stats: {
        totalOrders,
        completedOrders,
        cartItemCount,
        cartDistinctProducts,
      },
      orders: user.orders.map((order) => ({
        id: order.id,
        status: order.status,
        totalAmount: order.totalAmount.toString(),
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
      })),
      cart: user.cart
        ? {
            id: user.cart.id,
            status: user.cart.status,
            items: user.cart.items.map((item) => ({
              id: item.id,
              quantity: item.quantity,
              unitPrice: item.unitPrice.toString(),
              product: {
                id: item.product.id,
                name: item.product.name,
              },
            })),
          }
        : null,
      addresses: user.addresses.map((address) => ({
        id: address.id,
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        ward: address.ward,
        district: address.district,
        province: address.province,
        country: address.country,
        postalCode: address.postalCode,
        isDefault: address.isDefault,
        createdAt: address.createdAt.toISOString(),
      })),
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
      { error: "Bạn không có quyền cập nhật người dùng." },
      { status: 403 },
    );
  }

  const { id: userId } = await context.params;

  if (!userId) {
    return NextResponse.json({ error: "Thiếu mã người dùng." }, { status: 400 });
  }

  let body: UpdateUserBody;

  try {
    body = (await request.json()) as UpdateUserBody;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const updates: {
    name?: string | null;
    email?: string;
    passwordHash?: string;
  } = {};

  if (typeof body.name === "string") {
    const trimmedName = body.name.trim();
    updates.name = trimmedName.length > 0 ? trimmedName : null;
  }

  if (typeof body.email === "string") {
    const trimmedEmail = body.email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      return NextResponse.json(
        { error: "Email không hợp lệ." },
        { status: 400 },
      );
    }
    updates.email = trimmedEmail;
  }

  if (body.changePassword?.newPassword) {
    const newPassword = body.changePassword.newPassword;
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu mới phải có ít nhất 6 ký tự." },
        { status: 400 },
      );
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    updates.passwordHash = passwordHash;
  }

  try {
    const updatedUser = Object.keys(updates).length
      ? await prisma.user.update({
          where: { id: userId },
          data: updates,
        })
      : await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (body.defaultAddress) {
      const {
        fullName,
        phone,
        line1,
        line2,
        ward,
        district,
        province,
        postalCode,
      } = body.defaultAddress;

      if (!fullName.trim() || !phone.trim() || !line1.trim()) {
        return NextResponse.json(
          {
            error:
              "Họ tên, số điện thoại và địa chỉ dòng 1 của địa chỉ mặc định là bắt buộc.",
          },
          { status: 400 },
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.address.updateMany({
          where: {
            userId,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });

        await tx.address.create({
          data: {
            userId,
            fullName: fullName.trim(),
            phone: phone.trim(),
            line1: line1.trim(),
            line2: line2?.trim() || null,
            ward: ward?.trim() || null,
            district: district?.trim() || null,
            province: province?.trim() || null,
            postalCode: postalCode?.trim() || null,
            isDefault: true,
          },
        });
      });
    }

    return NextResponse.json({
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email này đã tồn tại trong hệ thống." },
        { status: 409 },
      );
    }

    console.error("Failed to update admin user", error);

    return NextResponse.json(
      { error: "Không thể cập nhật người dùng. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền xoá người dùng." },
      { status: 403 },
    );
  }

  const { id: userId } = await context.params;

  if (!userId) {
    return NextResponse.json({ error: "Thiếu mã người dùng." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: { userId },
        data: { userId: null },
      });

      await tx.aiSession.updateMany({
        where: { userId },
        data: { userId: null },
      });

      await tx.cart.deleteMany({
        where: { userId },
      });

      await tx.wishlist.deleteMany({
        where: { userId },
      });

      await tx.address.deleteMany({
        where: { userId },
      });

      await tx.user.delete({
        where: { id: userId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete admin user", error);

    return NextResponse.json(
      { error: "Không thể xoá người dùng. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

