"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MdArrowBack,
  MdAddCircle,
  MdLocalActivity,
  MdLocalShipping,
  MdConfirmationNumber,
  MdCardGiftcard,
  MdBolt,
  MdSchedule,
  MdCheckCircle,
  MdSentimentSatisfied,
} from "react-icons/md";
import clsx from "clsx";
import styles from "./CheckoutCouponWalletModal.module.css";

export type WalletCouponViewStatus =
  | "APPLICABLE"
  | "NOT_APPLICABLE"
  | "USED"
  | "EXPIRED";

export type WalletCouponView = {
  id: string;
  code: string;
  description: string | null;
  type: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
  minOrderAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  status: WalletCouponViewStatus;
  reasonNotApplicable?: string;
};

export type CheckoutCouponWalletModalProps = {
  isOpen: boolean;
  coupons: WalletCouponView[];
  isLoading: boolean;
  error: string | null;
  orderSubtotal: number;
  shippingFee: number;
  appliedDiscountCouponCode?: string | null;
  appliedShippingCouponCode?: string | null;
  totalSavings?: number;
  onClose: () => void;
  onConfirm: (payload: {
    discountCode: string | null;
    shippingCode: string | null;
  }) => void;
  onEnterCode?: () => void;
};

function formatExpiry(endsAt: string | null): string {
  if (!endsAt) return "";
  try {
    const d = new Date(endsAt);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    return `${day}/${month}`;
  } catch {
    return "";
  }
}

function formatExpiryFull(endsAt: string | null): string {
  if (!endsAt) return "";
  try {
    const d = new Date(endsAt);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

const CheckoutCouponWalletModal: React.FC<CheckoutCouponWalletModalProps> = ({
  isOpen,
  coupons,
  isLoading,
  error,
  orderSubtotal,
  shippingFee,
  appliedDiscountCouponCode = null,
  appliedShippingCouponCode = null,
  totalSavings = 0,
  onClose,
  onConfirm,
  onEnterCode,
}) => {
  const [activeTab, setActiveTab] = useState<"discount" | "shipping">(
    "discount",
  );
  const [selectedDiscountCode, setSelectedDiscountCode] = useState<
    string | null
  >(appliedDiscountCouponCode);
  const [selectedShippingCode, setSelectedShippingCode] = useState<
    string | null
  >(appliedShippingCouponCode);

  useEffect(() => {
    if (isOpen) {
      setSelectedDiscountCode(appliedDiscountCouponCode);
      setSelectedShippingCode(appliedShippingCouponCode);
    }
  }, [isOpen, appliedDiscountCouponCode, appliedShippingCouponCode]);

  const [previewSavings, setPreviewSavings] = useState<number | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewDebounceRef = useRef<number | null>(null);

  const discountCoupons = useMemo(
    () =>
      coupons.filter(
        (c) => c.type === "PERCENTAGE" || c.type === "FIXED",
      ),
    [coupons],
  );
  const shippingCoupons = useMemo(
    () => coupons.filter((c) => c.type === "FREE_SHIPPING"),
    [coupons],
  );

  const handleConfirm = () => {
    onConfirm({
      discountCode: selectedDiscountCode,
      shippingCode: selectedShippingCode,
    });
  };

  const handleSelectDiscount = (code: string, applicable: boolean) => {
    if (!applicable) return;
    setSelectedDiscountCode((prev) => (prev === code ? null : code));
  };

  const handleSelectShipping = (code: string, applicable: boolean) => {
    if (!applicable) return;
    setSelectedShippingCode((prev) => (prev === code ? null : code));
  };

  const appliedCodes = useMemo(() => {
    const list: string[] = [];
    if (appliedDiscountCouponCode) list.push(appliedDiscountCouponCode);
    if (appliedShippingCouponCode) list.push(appliedShippingCouponCode);
    return list;
  }, [appliedDiscountCouponCode, appliedShippingCouponCode]);

  const selectedCodes = useMemo(() => {
    const list: string[] = [];
    if (selectedDiscountCode) list.push(selectedDiscountCode);
    if (selectedShippingCode) list.push(selectedShippingCode);
    return list;
  }, [selectedDiscountCode, selectedShippingCode]);

  const isSelecting = selectedCodes.length > 0;
  const savingsToShow = isSelecting
    ? (previewSavings ?? 0)
    : totalSavings;
  const codesToShow = isSelecting ? selectedCodes : appliedCodes;

  useEffect(() => {
    if (!isOpen) return;

    if (previewDebounceRef.current != null) {
      window.clearTimeout(previewDebounceRef.current);
      previewDebounceRef.current = null;
    }

    previewAbortRef.current?.abort();
    previewAbortRef.current = null;

    if (!isSelecting) {
      setPreviewSavings(null);
      setIsPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError(null);

    previewDebounceRef.current = window.setTimeout(async () => {
      const controller = new AbortController();
      previewAbortRef.current = controller;

      const validateOne = async (code: string) => {
        const res = await fetch("/api/shop/coupons/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            orderSubtotal,
            shippingFee,
          }),
          signal: controller.signal,
        });

        const json = (await res.json().catch(() => null)) as
          | {
            isValid?: boolean;
            type?: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
            discountAmount?: number;
            appliedShippingDiscount?: number;
            error?: string;
            reason?: string;
          }
          | null;

        if (!res.ok) {
          throw new Error(
            json?.error ?? "Không thể kiểm tra mã. Vui lòng thử lại.",
          );
        }

        if (!json?.isValid) {
          throw new Error(
            json?.reason ??
            "Mã không hợp lệ hoặc chưa đủ điều kiện.",
          );
        }

        return json;
      };

      try {
        const results = await Promise.allSettled(
          selectedCodes.map((code) => validateOne(code)),
        );

        let nextDiscount = 0;
        let nextShipDiscount = 0;
        const errors: string[] = [];

        for (const r of results) {
          if (r.status === "rejected") {
            const msg =
              (r.reason as { message?: string } | undefined)?.message ??
              "Không thể kiểm tra một mã trong ví.";
            errors.push(msg);
            continue;
          }

          const type = r.value.type;
          if (type === "FREE_SHIPPING") {
            nextShipDiscount += Math.min(
              r.value.appliedShippingDiscount ?? 0,
              shippingFee,
            );
          } else {
            nextDiscount += r.value.discountAmount ?? 0;
          }
        }

        setPreviewSavings(nextDiscount + nextShipDiscount);
        setPreviewError(errors.length ? errors[0] : null);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        const msg = (err as { message?: string }).message;
        setPreviewSavings(0);
        setPreviewError(
          msg ?? "Không thể tính preview tiết kiệm. Vui lòng thử lại.",
        );
      } finally {
        setIsPreviewLoading(false);
      }
    }, 200);

    return () => {
      if (previewDebounceRef.current != null) {
        window.clearTimeout(previewDebounceRef.current);
        previewDebounceRef.current = null;
      }
      previewAbortRef.current?.abort();
      previewAbortRef.current = null;
    };
  }, [isOpen, isSelecting, orderSubtotal, selectedCodes, shippingFee]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles["checkout-coupon-wallet"]}
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <div
        className={styles["checkout-coupon-wallet__wrapper"]}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles["checkout-coupon-wallet__header"]}>
          <div className={styles["checkout-coupon-wallet__header-row"]}>
            <div className={styles["checkout-coupon-wallet__header-left"]}>
              <button
                type="button"
                className={styles["checkout-coupon-wallet__back"]}
                onClick={onClose}
                aria-label="Đóng"
              >
                <MdArrowBack aria-hidden />
              </button>
              <div>
                <h1 className={styles["checkout-coupon-wallet__title"]}>
                  Ví Voucher của bạn
                </h1>
                <p className={styles["checkout-coupon-wallet__subtitle"]}>
                  Ưu đãi độc quyền từ Đức Uy Audio
                </p>
              </div>
            </div>
            <button
              type="button"
              className={styles["checkout-coupon-wallet__enter-code"]}
              onClick={() => {
                onClose();
                onEnterCode?.();
              }}
            >
              <MdAddCircle aria-hidden />
              Nhập mã
            </button>
          </div>

          <div className={styles["checkout-coupon-wallet__tabs"]}>
            <button
              type="button"
              className={clsx(
                styles["checkout-coupon-wallet__tab"],
                activeTab === "discount" &&
                styles["checkout-coupon-wallet__tab--active"],
              )}
              onClick={() => setActiveTab("discount")}
            >
              Mã Giảm Giá
            </button>
            <button
              type="button"
              className={clsx(
                styles["checkout-coupon-wallet__tab"],
                activeTab === "shipping" &&
                styles["checkout-coupon-wallet__tab--active"],
              )}
              onClick={() => setActiveTab("shipping")}
            >
              Mã Freeship
            </button>
          </div>
        </header>

        <main className={styles["checkout-coupon-wallet__main"]}>
          {isLoading && (
            <p className={styles["checkout-coupon-wallet__empty"]}>
              Đang tải ví voucher...
            </p>
          )}

          {!isLoading && error && (
            <p className={styles["checkout-coupon-wallet__error"]}>{error}</p>
          )}

          {!isLoading && !error && coupons.length === 0 && (
            <p className={styles["checkout-coupon-wallet__empty"]}>
              Hiện chưa có voucher nào trong ví của bạn.
            </p>
          )}

          {!isLoading && !error && coupons.length > 0 && (
            <>
              {activeTab === "discount" && (
                <section className={styles["checkout-coupon-wallet__section"]}>
                  <div
                    className={
                      styles["checkout-coupon-wallet__section-head"]
                    }
                  >
                    <h2
                      className={
                        styles["checkout-coupon-wallet__section-title"]
                      }
                    >
                      <MdLocalActivity aria-hidden />
                      Giảm giá trực tiếp
                    </h2>
                    <span
                      className={
                        styles["checkout-coupon-wallet__section-count"]
                      }
                    >
                      Tìm thấy {discountCoupons.length} mã
                    </span>
                  </div>
                  <div className={styles["checkout-coupon-wallet__list"]}>
                    {discountCoupons.map((coupon) => {
                      const applicable = coupon.status === "APPLICABLE";
                      const isSelected =
                        selectedDiscountCode === coupon.code;
                      const isPremium =
                        coupon.type === "PERCENTAGE" && applicable;
                      return (
                        <div
                          key={coupon.id}
                          className={styles["checkout-coupon-wallet__card-wrap"]}
                        >
                          <div
                            className={clsx(
                              styles["checkout-coupon-wallet__card"],
                              applicable &&
                              styles["checkout-coupon-wallet__card--applicable"],
                              isSelected &&
                              styles["checkout-coupon-wallet__card--selected"],
                              isPremium &&
                              styles["checkout-coupon-wallet__card--premium"],
                              !applicable &&
                              styles["checkout-coupon-wallet__card--disabled"],
                            )}
                            onClick={() =>
                              handleSelectDiscount(coupon.code, applicable)
                            }
                            onKeyDown={(e) => {
                              if (
                                (e.key === "Enter" || e.key === " ") &&
                                applicable
                              ) {
                                e.preventDefault();
                                handleSelectDiscount(coupon.code, applicable);
                              }
                            }}
                            role="button"
                            tabIndex={applicable ? 0 : -1}
                          >
                            <div
                              className={clsx(
                                styles["checkout-coupon-wallet__card-strip"],
                                isPremium
                                  ? styles["checkout-coupon-wallet__card-strip--premium"]
                                  : styles["checkout-coupon-wallet__card-strip--discount"],
                              )}
                            >
                              {isPremium ? (
                                <MdCardGiftcard aria-hidden />
                              ) : (
                                <MdConfirmationNumber aria-hidden />
                              )}
                              <span>
                                {isPremium ? "Premium VIP" : "DISCOUNT"}
                              </span>
                            </div>
                            <div
                              className={
                                styles["checkout-coupon-wallet__card-body"]
                              }
                            >
                              <div
                                className={
                                  styles["checkout-coupon-wallet__card-top"]
                                }
                              >
                                <span
                                  className={clsx(
                                    styles["checkout-coupon-wallet__badge"],
                                    applicable
                                      ? styles["checkout-coupon-wallet__badge--ok"]
                                      : styles["checkout-coupon-wallet__badge--muted"],
                                    isPremium &&
                                    styles["checkout-coupon-wallet__badge--premium"],
                                  )}
                                >
                                  {applicable
                                    ? "Có thể áp dụng"
                                    : coupon.status === "EXPIRED"
                                      ? "Đã hết hạn"
                                      : "Chưa đủ điều kiện"}
                                </span>
                                {coupon.endsAt && (
                                  <span
                                    className={
                                      styles["checkout-coupon-wallet__expiry"]
                                    }
                                  >
                                    <MdSchedule aria-hidden />
                                    Hết hạn: {formatExpiry(coupon.endsAt)}
                                  </span>
                                )}
                              </div>
                              <h3
                                className={
                                  styles["checkout-coupon-wallet__code"]
                                }
                              >
                                {coupon.code}
                              </h3>
                              {coupon.description && (
                                <p
                                  className={
                                    styles["checkout-coupon-wallet__desc"]
                                  }
                                >
                                  {coupon.description}
                                </p>
                              )}
                              <div
                                className={
                                  styles["checkout-coupon-wallet__card-footer"]
                                }
                              >
                                <span
                                  className={
                                    styles["checkout-coupon-wallet__validity"]
                                  }
                                >
                                  {applicable
                                    ? "Hiệu lực: Còn 5 ngày"
                                    : coupon.reasonNotApplicable ?? ""}
                                </span>
                                {applicable ? (
                                  <span
                                    className={clsx(
                                      styles["checkout-coupon-wallet__card-btn"],
                                      isSelected &&
                                      styles["checkout-coupon-wallet__card-btn--selected"],
                                    )}
                                  >
                                    {isSelected ? (
                                      <>
                                        <MdCheckCircle aria-hidden />
                                        Đã chọn
                                      </>
                                    ) : (
                                      "Áp dụng"
                                    )}
                                  </span>
                                ) : (
                                  <span
                                    className={
                                      styles["checkout-coupon-wallet__card-btn--disabled"]
                                    }
                                  >
                                    Chưa đủ điều kiện
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {activeTab === "shipping" && (
                <section
                  className={styles["checkout-coupon-wallet__section"]}
                >
                  <div className={styles["checkout-coupon-wallet__section-head"]}>
                    <h2
                      className={
                        styles["checkout-coupon-wallet__section-title"]
                      }
                    >
                      <MdLocalShipping aria-hidden />
                      Vận chuyển miễn phí
                    </h2>
                  </div>
                  <div className={styles["checkout-coupon-wallet__list"]}>
                    {shippingCoupons.map((coupon) => {
                      const applicable = coupon.status === "APPLICABLE";
                      const isSelected =
                        selectedShippingCode === coupon.code;
                      const isHot = applicable && coupon.code.length <= 10;
                      return (
                        <div
                          key={coupon.id}
                          className={
                            styles["checkout-coupon-wallet__card-wrap"]
                          }
                        >
                          <div
                            className={clsx(
                              styles["checkout-coupon-wallet__card"],
                              applicable &&
                              styles["checkout-coupon-wallet__card--applicable"],
                              isSelected &&
                              styles["checkout-coupon-wallet__card--selected"],
                              isHot &&
                              styles["checkout-coupon-wallet__card--hot"],
                              !applicable &&
                              styles["checkout-coupon-wallet__card--disabled"],
                            )}
                            onClick={() =>
                              handleSelectShipping(coupon.code, applicable)
                            }
                            onKeyDown={(e) => {
                              if (
                                (e.key === "Enter" || e.key === " ") &&
                                applicable
                              ) {
                                e.preventDefault();
                                handleSelectShipping(coupon.code, applicable);
                              }
                            }}
                            role="button"
                            tabIndex={applicable ? 0 : -1}
                          >
                            <div
                              className={clsx(
                                styles["checkout-coupon-wallet__card-strip"],
                                styles["checkout-coupon-wallet__card-strip--ship"],
                                isHot &&
                                styles["checkout-coupon-wallet__card-strip--ship-hot"],
                              )}
                            >
                              {isHot ? (
                                <MdBolt aria-hidden />
                              ) : (
                                <MdLocalShipping aria-hidden />
                              )}
                              <span>{isHot ? "MAX" : "FREE SHIP"}</span>
                            </div>
                            <div
                              className={
                                styles["checkout-coupon-wallet__card-body"]
                              }
                            >
                              <div
                                className={
                                  styles["checkout-coupon-wallet__card-top"]
                                }
                              >
                                <span
                                  className={clsx(
                                    styles["checkout-coupon-wallet__badge"],
                                    applicable
                                      ? isHot
                                        ? styles["checkout-coupon-wallet__badge--hot"]
                                        : styles["checkout-coupon-wallet__badge--ok"]
                                      : styles["checkout-coupon-wallet__badge--muted"],
                                  )}
                                >
                                  {applicable
                                    ? isHot
                                      ? "Hot Deal"
                                      : "Toàn quốc"
                                    : "Chưa đủ điều kiện"}
                                </span>
                              </div>
                              <h3
                                className={
                                  styles["checkout-coupon-wallet__code"]
                                }
                              >
                                {coupon.code}
                              </h3>
                              {coupon.description && (
                                <p
                                  className={
                                    styles["checkout-coupon-wallet__desc"]
                                  }
                                >
                                  {coupon.description}
                                </p>
                              )}
                              <div
                                className={
                                  styles["checkout-coupon-wallet__card-footer"]
                                }
                              >
                                <span
                                  className={
                                    styles["checkout-coupon-wallet__validity"]
                                  }
                                >
                                  {coupon.endsAt
                                    ? `Hạn dùng: ${formatExpiryFull(coupon.endsAt)}`
                                    : ""}
                                </span>
                                {applicable ? (
                                  <span
                                    className={clsx(
                                      styles["checkout-coupon-wallet__card-btn"],
                                      isSelected &&
                                      styles["checkout-coupon-wallet__card-btn--selected"],
                                    )}
                                  >
                                    {isSelected ? (
                                      <>
                                        <MdCheckCircle aria-hidden />
                                        Đã chọn
                                      </>
                                    ) : (
                                      "Áp dụng"
                                    )}
                                  </span>
                                ) : (
                                  <span
                                    className={
                                      styles["checkout-coupon-wallet__card-btn--disabled"]
                                    }
                                  >
                                    Chưa đủ điều kiện
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {(activeTab === "discount"
                ? discountCoupons.length
                : shippingCoupons.length) > 0 && (
                  <div
                    className={
                      styles["checkout-coupon-wallet__empty-promo"]
                    }
                  >
                    <div
                      className={
                        styles["checkout-coupon-wallet__empty-promo-icon"]
                      }
                    >
                      <MdSentimentSatisfied aria-hidden />
                    </div>
                    <p>
                      Bạn đã xem hết ưu đãi hiện có.
                      <br />
                      Quay lại sau để cập nhật mã mới nhé!
                    </p>
                  </div>
                )}

              {(activeTab === "discount"
                ? discountCoupons.length === 0
                : shippingCoupons.length === 0) && (
                  <p className={styles["checkout-coupon-wallet__empty"]}>
                    {activeTab === "discount"
                      ? "Chưa có mã giảm giá nào."
                      : "Chưa có mã freeship nào."}
                  </p>
                )}
            </>
          )}
        </main>

        <footer className={styles["checkout-coupon-wallet__footer"]}>
          <div
            className={styles["checkout-coupon-wallet__footer-summary"]}
          >
            <div className={styles["checkout-coupon-wallet__footer-savings"]}>
              <span
                className={
                  styles["checkout-coupon-wallet__footer-label"]
                }
              >
                Bạn đang tiết kiệm được
              </span>
              <span
                className={
                  styles["checkout-coupon-wallet__footer-amount"]
                }
              >
                {savingsToShow > 0
                  ? `${savingsToShow.toLocaleString("vi-VN")}đ`
                  : "0đ"}
              </span>
              {isPreviewLoading && (
                <span className={styles["checkout-coupon-wallet__footer-hint"]}>
                  Đang tính ưu đãi...
                </span>
              )}
              {!isPreviewLoading && previewError && (
                <span className={styles["checkout-coupon-wallet__footer-hint"]}>
                  {previewError}
                </span>
              )}
            </div>
            <div className={styles["checkout-coupon-wallet__footer-applied"]}>
              <span
                className={
                  styles["checkout-coupon-wallet__footer-label"]
                }
              >
                Mã đã áp dụng
              </span>
              <div className={styles["checkout-coupon-wallet__footer-chips"]}>
                {codesToShow.length > 0 ? (
                  codesToShow.map((code) => (
                    <span
                      key={code}
                      className={
                        styles["checkout-coupon-wallet__footer-chip"]
                      }
                    >
                      {code}
                    </span>
                  ))
                ) : (
                  <span
                    className={
                      styles["checkout-coupon-wallet__footer-chip--none"]
                    }
                  >
                    Chưa có
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            className={styles["checkout-coupon-wallet__confirm-btn"]}
            onClick={handleConfirm}
            disabled={!selectedDiscountCode && !selectedShippingCode}
          >
            Xác nhận áp dụng
          </button>
        </footer>
      </div>

      <div
        className={styles["checkout-coupon-wallet__glow"]}
        aria-hidden
      />
      <div
        className={styles["checkout-coupon-wallet__glow--right"]}
        aria-hidden
      />
    </div>
  );
};

export default CheckoutCouponWalletModal;
