import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type InventorySource =
  | "ADMIN_CREATE_PRODUCT"
  | "ADMIN_STOCK_IMPORT"
  | "ADMIN_STOCK_ADJUST"
  | "ORDER_PLACED"
  | "ORDER_CANCELLED";

export type AdjustProductStockInput = {
  productId: string;
  delta: number;
  reason?: string | null;
  source: InventorySource;
  referenceId?: string | null;
};

export type AdjustProductStockResult = {
  productId: string;
  previousStock: number;
  newStock: number;
};

type TransactionClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Nội bộ: điều chỉnh tồn kho trong transaction có sẵn.
 * Dùng khi cần gộp nhiều thay đổi kho trong một transaction (ví dụ trừ kho theo đơn hàng).
 */
export async function adjustProductStockWithTx(
  tx: TransactionClient,
  input: AdjustProductStockInput,
): Promise<AdjustProductStockResult> {
  const { productId, delta, reason, source, referenceId } = input;

  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { id: true, stock: true },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const previousStock = product.stock;
  const nextStock = Math.max(previousStock + delta, 0);

  if (nextStock === previousStock) {
    return { productId, previousStock, newStock: nextStock };
  }

  await tx.product.update({
    where: { id: productId },
    data: { stock: nextStock },
    select: { id: true },
  });

  await tx.inventoryLog.create({
    data: {
      productId,
      change: delta,
      reason: reason ?? null,
      source,
      referenceId: referenceId ?? null,
    },
  });

  return { productId, previousStock, newStock: nextStock };
}

/**
 * Điều chỉnh tồn kho sản phẩm và ghi lại InventoryLog trong cùng transaction.
 * - delta > 0: nhập kho (tăng stock)
 * - delta < 0: xuất kho / điều chỉnh giảm (giảm stock, không cho xuống < 0)
 */
export async function adjustProductStock(
  input: AdjustProductStockInput,
): Promise<AdjustProductStockResult> {
  return prisma.$transaction((tx) =>
    adjustProductStockWithTx(tx as TransactionClient, input),
  );
}

// --- Luồng kho gắn với đơn hàng (Order) ---

export const ORDER_INVENTORY_ERROR = {
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
} as const;

export type OrderStockDeductionResult = {
  orderId: string;
  orderNumber: string;
  deducted: { productId: string; quantity: number; newStock: number }[];
};

/**
 * Trừ tồn kho theo đơn hàng (gọi khi đơn chuyển sang trạng thái đã xác nhận / thanh toán).
 * - Lấy order + items, kiểm tra đủ tồn kho từng sản phẩm.
 * - Trong 1 transaction: trừ stock từng OrderItem, ghi InventoryLog source ORDER_PLACED.
 * - Nếu thiếu hàng: throw Error(ORDER_INVENTORY_ERROR.INSUFFICIENT_STOCK).
 * Luồng Order (khi làm): sau khi cập nhật status đơn sang PAID/COMPLETED, gọi hàm này.
 */
export async function applyOrderStockDeduction(
  orderId: string,
): Promise<OrderStockDeductionResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        items: { select: { productId: true, quantity: true } },
      },
    });

    if (!order) {
      throw new Error(ORDER_INVENTORY_ERROR.ORDER_NOT_FOUND);
    }

    const client = tx as TransactionClient;

    for (const item of order.items) {
      const product = await client.product.findUnique({
        where: { id: item.productId },
        select: { stock: true },
      });
      if (!product) {
        throw new Error("PRODUCT_NOT_FOUND");
      }
      if (product.stock < item.quantity) {
        throw new Error(ORDER_INVENTORY_ERROR.INSUFFICIENT_STOCK);
      }
    }

    const deducted: OrderStockDeductionResult["deducted"] = [];

    for (const item of order.items) {
      const result = await adjustProductStockWithTx(client, {
        productId: item.productId,
        delta: -item.quantity,
        reason: `Đơn hàng #${order.orderNumber}`,
        source: "ORDER_PLACED",
        referenceId: orderId,
      });
      deducted.push({
        productId: item.productId,
        quantity: item.quantity,
        newStock: result.newStock,
      });
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      deducted,
    };
  });
}

/**
 * Hoàn tồn kho khi huỷ đơn (gọi khi đơn đã trừ kho trước đó bị huỷ).
 * - Trong 1 transaction: cộng lại stock từng OrderItem, ghi InventoryLog source ORDER_CANCELLED.
 * Luồng Order (khi làm): khi admin/ hệ thống huỷ đơn đã thanh toán, gọi hàm này trước hoặc sau khi cập nhật status CANCELLED.
 */
export async function revertOrderStockDeduction(
  orderId: string,
): Promise<OrderStockDeductionResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        items: { select: { productId: true, quantity: true } },
      },
    });

    if (!order) {
      throw new Error(ORDER_INVENTORY_ERROR.ORDER_NOT_FOUND);
    }

    const client = tx as TransactionClient;
    const deducted: OrderStockDeductionResult["deducted"] = [];

    for (const item of order.items) {
      const result = await adjustProductStockWithTx(client, {
        productId: item.productId,
        delta: item.quantity,
        reason: `Hoàn kho đơn hàng #${order.orderNumber} (đã huỷ)`,
        source: "ORDER_CANCELLED",
        referenceId: orderId,
      });
      deducted.push({
        productId: item.productId,
        quantity: item.quantity,
        newStock: result.newStock,
      });
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      deducted,
    };
  });
}

