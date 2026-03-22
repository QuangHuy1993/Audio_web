import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adjustProductStock } from "@/services/inventory-service";

export const runtime = "nodejs";

type AdjustBody = {
  decreaseBy?: number;
  setTo?: number;
  reason?: string | null;
  referenceId?: string | null;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền điều chỉnh tồn kho sản phẩm." },
      { status: 403 },
    );
  }

  if (!id) {
    return NextResponse.json(
      { error: "Thiếu mã sản phẩm." },
      { status: 400 },
    );
  }

  let jsonBody: AdjustBody;
  try {
    jsonBody = (await request.json()) as AdjustBody;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const rawDecrease =
    typeof jsonBody.decreaseBy === "number" &&
    Number.isFinite(jsonBody.decreaseBy)
      ? jsonBody.decreaseBy
      : NaN;
  const rawSetTo =
    typeof jsonBody.setTo === "number" && Number.isFinite(jsonBody.setTo)
      ? jsonBody.setTo
      : NaN;

  const hasDecrease = Number.isFinite(rawDecrease);
  const hasSetTo = Number.isFinite(rawSetTo);

  if (hasDecrease && hasSetTo) {
    return NextResponse.json(
      {
        error:
          "Chỉ được phép chọn một trong hai: giảm theo số lượng hoặc đặt tồn kho tuyệt đối.",
      },
      { status: 400 },
    );
  }

  if (!hasDecrease && !hasSetTo) {
    return NextResponse.json(
      {
        error:
          "Thiếu thông tin điều chỉnh tồn kho. Vui lòng nhập số lượng cần giảm hoặc tồn kho mới.",
      },
      { status: 400 },
    );
  }

  const reason = (jsonBody.reason ?? "").trim();
  if (!reason) {
    return NextResponse.json(
      { error: "Lý do điều chỉnh tồn kho là bắt buộc." },
      { status: 400 },
    );
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, stock: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Sản phẩm không tồn tại." },
        { status: 404 },
      );
    }

    const currentStock = product.stock;

    let delta = 0;
    if (hasDecrease) {
      const value = Math.trunc(rawDecrease);
      if (value <= 0) {
        return NextResponse.json(
          { error: "Số lượng giảm phải là số nguyên dương." },
          { status: 400 },
        );
      }
      delta = -Math.min(value, currentStock);
    } else if (hasSetTo) {
      const value = Math.max(0, Math.trunc(rawSetTo));
      delta = value - currentStock;
    }

    if (delta === 0) {
      return NextResponse.json({
        data: {
          productId: id,
          previousStock: currentStock,
          newStock: currentStock,
          message: "Tồn kho không thay đổi.",
        },
      });
    }

    const referenceIdFromBody =
      typeof jsonBody.referenceId === "string" &&
      jsonBody.referenceId.trim().length > 0
        ? jsonBody.referenceId.trim()
        : null;

    if (referenceIdFromBody) {
      const existingLog = await prisma.inventoryLog.findFirst({
        where: { productId: id, referenceId: referenceIdFromBody },
        select: { id: true },
      });
      if (existingLog) {
        return NextResponse.json({
          data: {
            productId: id,
            previousStock: currentStock,
            newStock: currentStock,
          },
        });
      }
    }

    const result = await adjustProductStock({
      productId: id,
      delta,
      reason,
      source: "ADMIN_STOCK_ADJUST",
      referenceId: referenceIdFromBody ?? id,
    });

    return NextResponse.json({
      data: result,
    });
  } catch (error) {
    console.error(
      "[POST /api/admin/products/[id]/inventory/adjust] Failed to adjust stock",
      error,
    );
    return NextResponse.json(
      { error: "Không thể điều chỉnh tồn kho. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

