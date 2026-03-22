"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MdClose, MdNotificationsActive, MdSchedule } from "react-icons/md";
import styles from "./PaymentNotificationPopup.module.css";

export type PaymentPendingSession = {
  id: string;
  provider: "VNPAY" | "VIETQR";
  status?: "PENDING" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "CANCELLED";
  expiresAt: string;
  amount: number;
  currency: string;
  paymentUrl: string | null;
};

type PaymentNotificationPopupProps = {
  isOpen: boolean;
  isLoading: boolean;
  session: PaymentPendingSession | null;
  isCancelling?: boolean;
  onClose: () => void;
  onContinue: () => void;
  onCancel: () => void;
};

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: currency || "VND",
      maximumFractionDigits: currency === "VND" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("vi-VN")} ${currency || "VND"}`;
  }
}

function formatRemainingTime(expiresAtIso: string): {
  text: string;
  isExpired: boolean;
  isUrgent: boolean;
} {
  const expiresAtMs = new Date(expiresAtIso).getTime();
  const nowMs = Date.now();
  const diffMs = Math.max(0, expiresAtMs - nowMs);
  const isExpired = diffMs <= 0;

  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const text = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return {
    text: isExpired ? "Phiên đã hết hạn" : `Còn ${text}`,
    isExpired,
    isUrgent: !isExpired && diffMs <= 2 * 60 * 1000,
  };
}

const PaymentNotificationPopup: React.FC<PaymentNotificationPopupProps> = ({
  isOpen,
  isLoading,
  session,
  isCancelling = false,
  onClose,
  onContinue,
  onCancel,
}) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [isOpen]);

  const remaining = useMemo(() => {
    if (!session?.expiresAt) {
      return { text: "Không xác định", isExpired: false, isUrgent: false };
    }
    return formatRemainingTime(session.expiresAt);
    // tick giữ countdown update mỗi giây
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.expiresAt, tick]);

  if (!isOpen) return null;

  return (
    <div className={styles["payment-notif-popup"]} role="dialog" aria-modal="false">
      <div className={styles["payment-notif-popup__header"]}>
        <div className={styles["payment-notif-popup__title-wrap"]}>
          <MdNotificationsActive
            className={styles["payment-notif-popup__title-icon"]}
            aria-hidden="true"
          />
          <h3 className={styles["payment-notif-popup__title"]}>Thông báo thanh toán</h3>
        </div>
        <button
          type="button"
          className={styles["payment-notif-popup__close-btn"]}
          onClick={onClose}
          aria-label="Đóng thông báo"
        >
          <MdClose />
        </button>
      </div>

      <div className={styles["payment-notif-popup__body"]}>
        {isLoading ? (
          <div className={styles["payment-notif-popup__loading"]}>
            <div className={styles["payment-notif-popup__skeleton"]} />
            <div className={styles["payment-notif-popup__skeleton"]} />
            <div className={styles["payment-notif-popup__skeleton"]} />
          </div>
        ) : !session ? (
          <p className={styles["payment-notif-popup__empty"]}>
            Không có đơn hàng nào đang chờ thanh toán.
          </p>
        ) : (
          <>
            <p className={styles["payment-notif-popup__description"]}>
              Quý khách còn đơn hàng chưa thanh toán, quý khách có muốn tiếp tục không?
            </p>
            <div className={styles["payment-notif-popup__card"]}>
              <div className={styles["payment-notif-popup__row"]}>
                <span className={styles["payment-notif-popup__label"]}>Phương thức</span>
                <span className={styles["payment-notif-popup__provider"]}>
                  {session.provider === "VNPAY" ? "VNPAY" : "VietQR"}
                </span>
              </div>
              <div className={styles["payment-notif-popup__row"]}>
                <span className={styles["payment-notif-popup__label"]}>Giá trị</span>
                <span className={styles["payment-notif-popup__amount"]}>
                  {formatCurrency(session.amount, session.currency)}
                </span>
              </div>
              <div className={styles["payment-notif-popup__row"]}>
                <span className={styles["payment-notif-popup__label"]}>
                  <MdSchedule aria-hidden="true" /> Thời gian còn lại
                </span>
                <span
                  className={styles[
                    remaining.isExpired
                      ? "payment-notif-popup__time--expired"
                      : remaining.isUrgent
                        ? "payment-notif-popup__time--urgent"
                        : "payment-notif-popup__time"
                  ]}
                >
                  {remaining.text}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles["payment-notif-popup__actions"]}>
        {!isLoading && session && !remaining.isExpired ? (
          <>
            <button
              type="button"
              className={styles["payment-notif-popup__btn-continue"]}
              onClick={onContinue}
            >
              Tiếp tục thanh toán
            </button>
            <button
              type="button"
              className={styles["payment-notif-popup__btn-cancel"]}
              onClick={onCancel}
              disabled={isCancelling}
            >
              {isCancelling ? "Đang huỷ..." : "Huỷ đơn này"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles["payment-notif-popup__btn-close"]}
            onClick={onClose}
          >
            Đóng
          </button>
        )}
      </div>
    </div>
  );
};

export default PaymentNotificationPopup;
