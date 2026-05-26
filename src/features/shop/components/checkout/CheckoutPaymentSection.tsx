import React from "react";
import {
  MdPayments,
  MdCreditCard,
  MdQrCode2,
} from "react-icons/md";
import styles from "./CheckoutPaymentSection.module.css";

export type CheckoutPaymentMethod = "COD" | "VNPAY" | "QR_TRANSFER";

export type CheckoutPaymentSectionProps = {
  value: CheckoutPaymentMethod;
  onChange: (value: CheckoutPaymentMethod) => void;
};

const CheckoutPaymentSection: React.FC<CheckoutPaymentSectionProps> = ({
  value,
  onChange,
}) => {
  return (
    <section
      className={styles["checkout-payment"]}
      aria-labelledby="payment-heading"
    >
      <header className={styles["checkout-payment__header"]}>
        <span className={styles["checkout-payment__header-icon"]}>
          <MdPayments aria-hidden="true" />
        </span>
        <h2
          id="payment-heading"
          className={styles["checkout-payment__header-title"]}
        >
          Phương thức thanh toán
        </h2>
      </header>

      <div className={styles["checkout-payment__list"]}>
        {/* COD */}
        <div className={styles["checkout-payment__item"]}>
          <label
            className={[
              styles["checkout-payment__method"],
              value === "COD" && styles["checkout-payment__method--selected"],
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              type="radio"
              name="payment"
              className={styles["checkout-payment__radio"]}
              checked={value === "COD"}
              onChange={() => onChange("COD")}
            />
            <span className={styles["checkout-payment__method-icon"]}>
              <MdPayments aria-hidden="true" />
            </span>
            <span className={styles["checkout-payment__method-text"]}>
              Thanh toán khi nhận hàng (COD)
            </span>
          </label>
          {value === "COD" && (
            <div className={styles["checkout-payment__detail"]}>
              <p className={styles["checkout-payment__note"]}>
                Quý khách vui lòng kiểm tra sản phẩm và thanh toán cho nhân viên giao
                hàng.
              </p>
            </div>
          )}
        </div>

        {/* VNPAY */}
        <div className={styles["checkout-payment__item"]}>
          <label
            className={[
              styles["checkout-payment__method"],
              value === "VNPAY" &&
                styles["checkout-payment__method--selected"],
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              type="radio"
              name="payment"
              className={styles["checkout-payment__radio"]}
              checked={value === "VNPAY"}
              onChange={() => onChange("VNPAY")}
            />
            <span className={styles["checkout-payment__method-icon"]}>
              <MdCreditCard aria-hidden="true" />
            </span>
            <span className={styles["checkout-payment__method-text"]}>
              Thanh toán thẻ / Ví VNPAY
            </span>
          </label>
          {value === "VNPAY" && (
            <div className={styles["checkout-payment__detail"]}>
              <p className={styles["checkout-payment__note"]}>
                Hỗ trợ thẻ ATM nội địa, QR Pay và ví VNPAY. Hệ thống sẽ chuyển hướng
                đến cổng thanh toán an toàn.
              </p>
            </div>
          )}
        </div>

        {/* VietQR */}
        <div className={styles["checkout-payment__item"]}>
          <label
            className={[
              styles["checkout-payment__method"],
              styles["checkout-payment__method--highlight"],
              value === "QR_TRANSFER" &&
                styles["checkout-payment__method--selected"],
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              type="radio"
              name="payment"
              className={styles["checkout-payment__radio"]}
              checked={value === "QR_TRANSFER"}
              onChange={() => onChange("QR_TRANSFER")}
            />
            <span className={styles["checkout-payment__method-icon"]}>
              <MdQrCode2 aria-hidden="true" />
            </span>
            <span className={styles["checkout-payment__method-text"]}>
              Chuyển khoản ngân hàng VietQR
            </span>
            <span className={styles["checkout-payment__badge"]}>KHUYÊN DÙNG</span>
          </label>
          {value === "QR_TRANSFER" && (
            <div className={styles["checkout-payment__detail"]}>
              <p className={styles["checkout-payment__note"]}>
                Website tạo mã QR và nội dung chuyển khoản riêng cho đơn hàng. Đơn sẽ
                tự xác nhận khi webhook ngân hàng ghi nhận giao dịch.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CheckoutPaymentSection;
