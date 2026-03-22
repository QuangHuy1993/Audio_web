import React from "react";
import { MdVerified } from "react-icons/md";
import styles from "./CheckoutCouponAndNoteSection.module.css";

export type CheckoutCouponAndNoteSectionProps = {
  couponCode: string;
  appliedDiscountCouponCode: string | null;
  appliedShippingCouponCode: string | null;
  totalSavings: number;
  isApplying: boolean;
  error: string | null;
  note: string;
  onCouponCodeChange: (value: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  onNoteChange: (value: string) => void;
   onOpenWallet: () => void;
};

const CheckoutCouponAndNoteSection: React.FC<
  CheckoutCouponAndNoteSectionProps
> = ({
  couponCode,
  appliedDiscountCouponCode,
  appliedShippingCouponCode,
  totalSavings,
  isApplying,
  error,
  note,
  onCouponCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  onNoteChange,
  onOpenWallet,
}) => {
  const appliedCodesText = [appliedDiscountCouponCode, appliedShippingCouponCode]
    .filter(Boolean)
    .join(" + ");

  return (
    <div className={styles["checkout-extra"]}>
      <section
        className={styles["checkout-coupon"]}
        aria-labelledby="coupon-heading"
      >
        <h3
          id="coupon-heading"
          className={styles["checkout-coupon__title"]}
        >
          Mã giảm giá
        </h3>

        {appliedCodesText ? (
          <div className={styles["checkout-coupon__status-row"]}>
            <span className={styles["checkout-coupon__badge"]}>
              <MdVerified
                aria-hidden="true"
                className={styles["checkout-coupon__badge-icon"]}
              />
              <span>
                Đã áp dụng: {appliedCodesText}
                {totalSavings > 0
                  ? ` (-${totalSavings.toLocaleString("vi-VN")}đ)`
                  : ""}
              </span>
            </span>
            <button
              type="button"
              className={styles["checkout-coupon__remove"]}
              onClick={onRemoveCoupon}
            >
              Xóa mã
            </button>
          </div>
        ) : (
          <>
            <div className={styles["checkout-coupon__row"]}>
              <input
                className={styles["checkout-coupon__input"]}
                type="text"
                placeholder="Nhập mã giảm giá (ví dụ: SALE50)"
                value={couponCode}
                onChange={(event) => onCouponCodeChange(event.target.value)}
              />
              <button
                type="button"
                className={styles["checkout-coupon__button"]}
                disabled={isApplying || !couponCode.trim()}
                onClick={onApplyCoupon}
              >
                {isApplying ? "Đang kiểm tra..." : "ÁP DỤNG"}
              </button>
            </div>
            <button
              type="button"
              className={styles["checkout-coupon__wallet-button"]}
              onClick={onOpenWallet}
            >
              Mở ví voucher của bạn
            </button>
            {error && (
              <p className={styles["checkout-coupon__error"]}>{error}</p>
            )}
          </>
        )}
      </section>

      <section
        className={styles["checkout-note"]}
        aria-labelledby="note-heading"
      >
        <h3 id="note-heading" className={styles["checkout-note__title"]}>
          Ghi chú đơn hàng
        </h3>
        <textarea
          className={styles["checkout-note__textarea"]}
          rows={2}
          placeholder="Ghi chú về thời gian nhận hàng hoặc yêu cầu khác..."
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </section>
    </div>
  );
};

export default CheckoutCouponAndNoteSection;

