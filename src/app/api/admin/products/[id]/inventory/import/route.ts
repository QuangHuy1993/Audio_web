import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adjustProductStock } from "@/services/inventory-service";

export const runtime = "nodejs";

type ImportBody = {
  quantity?: number;
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
      { error: "Bạn không có quyền nhập kho sản phẩm." },
      { status: 403 },
    );
  }

  if (!id) {
    return NextResponse.json(
      { error: "Thiếu mã sản phẩm." },
      { status: 400 },
    );
  }

  let jsonBody: ImportBody;
  try {
    jsonBody = (await request.json()) as ImportBody;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const rawQuantity =
    typeof jsonBody.quantity === "number" && Number.isFinite(jsonBody.quantity)
      ? jsonBody.quantity
      : NaN;

  const quantity = Number.isFinite(rawQuantity) ? Math.trunc(rawQuantity) : 0;

  if (!quantity || quantity <= 0) {
    return NextResponse.json(
      { error: "Số lượng nhập kho phải là số nguyên dương." },
      { status: 400 },
    );
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
      const product = await prisma.product.findUnique({
        where: { id },
        select: { stock: true },
      });
      if (product) {
        return NextResponse.json({
          data: {
            productId: id,
            previousStock: product.stock,
            newStock: product.stock,
          },
        });
      }
    }
  }

  try {
    const result = await adjustProductStock({
      productId: id,
      delta: quantity,
      reason: jsonBody.reason ?? "Nhập kho thủ công",
      source: "ADMIN_STOCK_IMPORT",
      referenceId: referenceIdFromBody ?? id,
    });

    return NextResponse.json({
      data: result,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PRODUCT_NOT_FOUND"
    ) {
      return NextResponse.json(
        { error: "Sản phẩm không tồn tại." },
        { status: 404 },
      );
    }

    console.error(
      "[POST /api/admin/products/[id]/inventory/import] Failed to import stock",
      error,
    );
    return NextResponse.json(
      { error: "Không thể nhập kho cho sản phẩm. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

