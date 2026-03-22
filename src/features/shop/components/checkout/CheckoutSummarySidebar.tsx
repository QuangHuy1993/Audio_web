import React from "react";
import {
  MdVerifiedUser,
  MdShield,
  MdSync,
} from "react-icons/md";
import styles from "./CheckoutSummarySidebar.module.css";

export type CheckoutSummaryItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl: string;
};

export type CheckoutSummarySidebarProps = {
  items: CheckoutSummaryItem[];
  subtotal: number;
  discountAmount: number;
  shippingDiscount: number;
  shippingFee: number;
  total: number;
  canSubmit?: boolean;
  isSubmitting?: boolean;
  onSubmitOrder?: () => void;
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const CheckoutSummarySidebar: React.FC<CheckoutSummarySidebarProps> = ({
  items,
  subtotal,
  discountAmount,
  shippingDiscount,
  shippingFee,
  total,
  canSubmit = true,
  isSubmitting = false,
  onSubmitOrder,
}) => {
  const finalShippingFee = Math.max(shippingFee - shippingDiscount, 0);

  return (
    <aside className={styles["checkout-summary"]} aria-label="Tóm tắt đơn hàng">
      <div className={styles["checkout-summary__card"]}>
        <div className={styles["checkout-summary__header"]}>
          <h2 className={styles["checkout-summary__title"]}>Tóm tắt đơn hàng</h2>
        </div>

        <div className={styles["checkout-summary__items"]}>
          {items.map((item) => (
            <div
              key={item.id}
              className={styles["checkout-summary__item"]}
            >
              <div className={styles["checkout-summary__thumb"]}>
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className={styles["checkout-summary__thumb-img"]}
                  />
                ) : (
                  <div className={styles["checkout-summary__thumb-img"]} style={{ background: "rgba(255,255,255,0.05)" }} />
                )}
              </div>
              <div className={styles["checkout-summary__info"]}>
                <h4 className={styles["checkout-summary__item-name"]}>
                  {item.name}
                </h4>
                <p className={styles["checkout-summary__item-qty"]}>
                  Số lượng: {item.quantity}
                </p>
                <p className={styles["checkout-summary__item-price"]}>
                  {formatCurrency(item.price)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles["checkout-summary__totals"]}>
          <div className={styles["checkout-summary__row"]}>
            <span className={styles["checkout-summary__label"]}>Tạm tính</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className={styles["checkout-summary__row"]}>
            <span className={styles["checkout-summary__label"]}>
              Giảm giá
            </span>
            <span className={styles["checkout-summary__discount"]}>
              -{formatCurrency(discountAmount)}
            </span>
          </div>
          {shippingDiscount > 0 && (
            <div className={styles["checkout-summary__row"]}>
              <span className={styles["checkout-summary__label"]}>
                Giảm phí vận chuyển
              </span>
              <span className={styles["checkout-summary__discount"]}>
                -{formatCurrency(shippingDiscount)}
              </span>
            </div>
          )}
          <div className={styles["checkout-summary__row"]}>
            <span className={styles["checkout-summary__label"]}>
              Phí vận chuyển (GHN)
            </span>
            {shippingDiscount > 0 ? (
              <span className={styles["checkout-summary__shipping-fee"]}>
                <span className={styles["checkout-summary__strike"]}>
                  {formatCurrency(shippingFee)}
                </span>
                <span className={styles["checkout-summary__shipping-fee-final"]}>
                  {formatCurrency(finalShippingFee)}
                </span>
              </span>
            ) : (
              <span>{formatCurrency(shippingFee)}</span>
            )}
          </div>

          <div className={styles["checkout-summary__row-divider"]} />

          <div
            className={`${styles["checkout-summary__row"]} ${styles["checkout-summary__row--total"]}`}
          >
            <span className={styles["checkout-summary__total-label"]}>
              Tổng thanh toán
            </span>
            <div className={styles["checkout-summary__total-box"]}>
              <p className={styles["checkout-summary__total-value"]}>
                {formatCurrency(total)}
              </p>
              <p className={styles["checkout-summary__total-note"]}>
                (Đã bao gồm thuế VAT)
              </p>
            </div>
          </div>
        </div>

        <div className={styles["checkout-summary__cta-wrapper"]}>
          <button
            type="button"
            className={styles["checkout-summary__cta"]}
            disabled={!canSubmit || isSubmitting}
            onClick={onSubmitOrder}
          >
            {isSubmitting ? "ĐANG XỬ LÝ..." : "HOÀN TẤT ĐẶT HÀNG"}
          </button>

          <div className={styles["checkout-summary__trust"]}>
            <div className={styles["checkout-summary__trust-item"]}>
              <MdVerifiedUser
                aria-hidden="true"
                className={styles["checkout-summary__trust-icon"]}
              />
              <span>100% Chính hãng</span>
            </div>
            <div
              className={`${styles["checkout-summary__trust-item"]} ${styles["checkout-summary__trust-item--bordered"]}`}
            >
              <MdShield
                aria-hidden="true"
                className={styles["checkout-summary__trust-icon"]}
              />
              <span>Bảo hành 24T</span>
            </div>
            <div className={styles["checkout-summary__trust-item"]}>
              <MdSync
                aria-hidden="true"
                className={styles["checkout-summary__trust-icon"]}
              />
              <span>Đổi trả 15 ngày</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles["checkout-summary__lock-row"]}>
        <span className={styles["checkout-summary__lock-text"]}>
          Thanh toán bảo mật SSL 256-bit
        </span>
      </div>
    </aside>
  );
};

export default CheckoutSummarySidebar;

