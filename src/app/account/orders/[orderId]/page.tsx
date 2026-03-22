"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import ConfirmActionDialog from "@/components/shared/ConfirmActionDialog";
import styles from "./page.module.css";

type OrderDetailResponseDto = {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentProvider: string | null;
  createdAt: string;
  subtotal: number;
  discountAmount: number;
  shippingDiscount: number;
  shippingFeeOriginal: number;
  shippingFeeFinal: number;
  totalAmount: number;
  items: {
    id: string;
    productName: string;
    productImageUrl: string | null;
    quantity: number;
    unitPrice: number;
    subtotalItem: number;
  }[];
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    ward: string | null;
    district: string | null;
    province: string | null;
  } | null;
};

const formatVnd = (value: number): string =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

export default function AccountOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const orderId = params.orderId;

  const [data, setData] = useState<OrderDetailResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        const res = await fetch(`/api/shop/orders/${orderId}`, { method: "GET" });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          setLoadError(json?.error ?? "Không thể tải đơn hàng. Vui lòng thử lại.");
          setData(null);
          return;
        }
        const json = (await res.json()) as OrderDetailResponseDto;
        setData(json);
      } catch {
        setLoadError("Không thể tải đơn hàng. Vui lòng thử lại.");
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [orderId]);

  if (!orderId) {
    return (
      <div className={styles["account-order-detail-page"]}>
        <h1 className={styles["account-order-detail-page__heading"]}>
          Không tìm thấy đơn hàng
        </h1>
        <p>Mã đơn hàng không hợp lệ.</p>
        <button
          type="button"
          onClick={() => router.push("/account/orders")}
          className={styles["account-order-detail-page__back-button"]}
        >
          Quay lại danh sách đơn hàng
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles["account-order-detail-page"]}>
        <p>Đang tải chi tiết đơn hàng...</p>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className={styles["account-order-detail-page"]}>
        <h1 className={styles["account-order-detail-page__heading"]}>
          Không tìm thấy đơn hàng
        </h1>
        <p>{loadError ?? "Không thể tải đơn hàng. Vui lòng thử lại."}</p>
        <button
          type="button"
          onClick={() => router.push("/account/orders")}
          className={styles["account-order-detail-page__back-button"]}
        >
          Quay lại danh sách đơn hàng
        </button>
      </div>
    );
  }

  const canCancel =
    data.status === "PENDING" || data.status === "PROCESSING" || data.status === "CONFIRMED";

  const isPaid = data.paymentStatus === "PAID";
  const isCancelled = data.status === "CANCELLED";

  const handleCancelOrder = async () => {
    setIsCancelling(true);
    const toastId = toast.loading("Đang xử lý hủy đơn hàng...");
    try {
      const res = await fetch(`/api/shop/orders/${orderId}/cancel`, {
        method: "PATCH",
      });

      if (!res.ok) {
        const errorJson = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(errorJson?.error ?? "Không thể hủy đơn hàng.");
      }

      toast.success("Hủy đơn hàng thành công!", { id: toastId });
      router.push("/account/orders");
    } catch (error: any) {
      console.error("[OrderDetailPage] Failed to cancel order", error);
      toast.error(error.message ?? "Đã xảy ra lỗi khi hủy đơn hàng.", {
        id: toastId,
      });
    } finally {
      setIsCancelling(false);
      setIsCancelDialogOpen(false);
    }
  };

  return (
    <div className={styles["account-order-detail-page"]}>
      <button
        type="button"
        onClick={() => router.push("/account/orders")}
        className={styles["account-order-detail-page__back-button"]}
      >
        ← Quay lại danh sách đơn hàng
      </button>

      <h1 className={styles["account-order-detail-page__heading"]}>
        Đơn hàng #{data.orderNumber}
      </h1>

      <div className={styles["account-order-detail-page__meta"]}>
        <div>
          <span className={styles["account-order-detail-page__meta-label"]}>
            Ngày đặt:{" "}
          </span>
          <span>{new Date(data.createdAt).toLocaleString("vi-VN")}</span>
        </div>
        <div>
          <span className={styles["account-order-detail-page__meta-label"]}>
            Trạng thái đơn:{" "}
          </span>
          <span
            className={`${styles["account-order-detail-page__status-pill"]} ${
              isCancelled
                ? styles["account-order-detail-page__status-pill--cancelled"]
                : ""
            }`}
          >
            {data.status}
          </span>
        </div>
        <div>
          <span className={styles["account-order-detail-page__meta-label"]}>
            Thanh toán:{" "}
          </span>
          <span
            className={`${styles["account-order-detail-page__status-pill"]} ${
              isPaid
                ? styles["account-order-detail-page__status-pill--paid"]
                : styles["account-order-detail-page__status-pill--unpaid"]
            }`}
          >
            {isPaid ? "ĐÃ THANH TOÁN" : "CHƯA THANH TOÁN"}
          </span>
        </div>
        {data.paymentProvider && (
          <div>
            <span className={styles["account-order-detail-page__meta-label"]}>
              Cổng thanh toán:{" "}
            </span>
            <span>{data.paymentProvider}</span>
          </div>
        )}
      </div>

      <h2 className={styles["account-order-detail-page__section-title"]}>
        Sản phẩm trong đơn
      </h2>
      <table className={styles["account-order-detail-page__items-table"]}>
        <thead>
          <tr>
            <th className={styles["account-order-detail-page__items-header-cell"]}>
              Sản phẩm
            </th>
            <th
              className={`${styles["account-order-detail-page__items-header-cell"]} ${styles["account-order-detail-page__items-header-cell--right"]}`}
            >
              Đơn giá
            </th>
            <th
              className={`${styles["account-order-detail-page__items-header-cell"]} ${styles["account-order-detail-page__items-header-cell--right"]}`}
            >
              Số lượng
            </th>
            <th
              className={`${styles["account-order-detail-page__items-header-cell"]} ${styles["account-order-detail-page__items-header-cell--right"]}`}
            >
              Thành tiền
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr
              key={item.id}
              className={styles["account-order-detail-page__items-row"]}
            >
              <td
                className={`${styles["account-order-detail-page__items-cell"]} ${styles["account-order-detail-page__product-cell"]}`}
              >
                <div
                  className={
                    styles["account-order-detail-page__product-image-wrapper"]
                  }
                >
                  {item.productImageUrl ? (
                    <Image
                      src={item.productImageUrl}
                      alt={item.productName}
                      fill
                      sizes="64px"
                    />
                  ) : (
                    <div
                      className={
                        styles["account-order-detail-page__product-image-fallback"]
                      }
                    />
                  )}
                </div>
                <div className={styles["account-order-detail-page__product-name"]}>
                  {item.productName}
                </div>
              </td>
              <td
                className={`${styles["account-order-detail-page__items-cell"]} ${styles["account-order-detail-page__items-cell--right"]}`}
              >
                {formatVnd(item.unitPrice)}
              </td>
              <td
                className={`${styles["account-order-detail-page__items-cell"]} ${styles["account-order-detail-page__items-cell--right"]}`}
              >
                {item.quantity}
              </td>
              <td
                className={`${styles["account-order-detail-page__items-cell"]} ${styles["account-order-detail-page__items-cell--right"]}`}
              >
                {formatVnd(item.subtotalItem)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className={styles["account-order-detail-page__section-title"]}>
        Địa chỉ giao hàng
      </h2>
      {data.shippingAddress ? (
        <div className={styles["account-order-detail-page__shipping-block"]}>
          <p>{data.shippingAddress.fullName}</p>
          <p>{data.shippingAddress.phone}</p>
          <p>{data.shippingAddress.line1}</p>
          {data.shippingAddress.line2 && <p>{data.shippingAddress.line2}</p>}
          <p>
            {[
              data.shippingAddress.ward,
              data.shippingAddress.district,
              data.shippingAddress.province,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
      ) : (
        <p className={styles["account-order-detail-page__shipping-block"]}>
          Chưa có địa chỉ giao hàng.
        </p>
      )}

      <h2 className={styles["account-order-detail-page__section-title"]}>
        Tổng kết
      </h2>
      <div className={styles["account-order-detail-page__summary"]}>
        <div className={styles["account-order-detail-page__summary-row"]}>
          <span className={styles["account-order-detail-page__summary-label"]}>
            Tạm tính
          </span>
          <span>{formatVnd(data.subtotal)}</span>
        </div>
        <div className={styles["account-order-detail-page__summary-row"]}>
          <span className={styles["account-order-detail-page__summary-label"]}>
            Giảm giá sản phẩm
          </span>
          <span>-{formatVnd(data.discountAmount)}</span>
        </div>
        <div className={styles["account-order-detail-page__summary-row"]}>
          <span className={styles["account-order-detail-page__summary-label"]}>
            Phí vận chuyển
          </span>
          <span>
            {data.shippingDiscount > 0
              ? `${formatVnd(data.shippingFeeFinal)} (đã giảm từ ${formatVnd(
                  data.shippingFeeOriginal,
                )})`
              : formatVnd(data.shippingFeeFinal)}
          </span>
        </div>
        <div className={styles["account-order-detail-page__summary-row"]}>
          <span className={styles["account-order-detail-page__summary-label"]}>
            Tổng thanh toán
          </span>
          <span className={styles["account-order-detail-page__summary-value--total"]}>
            {formatVnd(data.totalAmount)}
          </span>
        </div>
      </div>

      {canCancel && !isCancelled && (
        <div className={styles["account-order-detail-page__actions"]}>
          <button
            type="button"
            onClick={() => setIsCancelDialogOpen(true)}
            className={`${styles["account-order-detail-page__cancel-button"]} ${styles["account-order-detail-page__cancel-button--danger"]}`}
          >
            Hủy đơn hàng
          </button>
        </div>
      )}

      <ConfirmActionDialog
        isOpen={isCancelDialogOpen}
        title="Hủy đơn hàng?"
        description="Bạn có chắc chắn muốn hủy đơn hàng này không? Hành động này không thể hoàn tác."
        confirmLabel="Hủy đơn"
        cancelLabel="Quay lại"
        isConfirmLoading={isCancelling}
        onConfirm={handleCancelOrder}
        onCancel={() => setIsCancelDialogOpen(false)}
      />
    </div>
  );
}

