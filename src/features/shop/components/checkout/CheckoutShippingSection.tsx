import React from "react";
import { MdLocalShipping } from "react-icons/md";
import styles from "./CheckoutShippingSection.module.css";

export type CheckoutShippingSectionProps = {
  selectedType: "economy" | "express";
  options: {
    type: "economy" | "express";
    label: string;
    fee: number;
    estimatedDays: string;
    fallback?: boolean;
  }[];
  onChange: (value: "economy" | "express") => void;
};

const CheckoutShippingSection: React.FC<CheckoutShippingSectionProps> = ({
  selectedType,
  options,
  onChange,
}) => {
  const formatCurrency = (value: number): string =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value);

  const economy = options.find((option) => option.type === "economy");
  const express = options.find((option) => option.type === "express");
  const isExpressDisabled = express?.fallback === true;
  const effectiveSelectedType: "economy" | "express" =
    isExpressDisabled && selectedType === "express" ? "economy" : selectedType;

  return (
    <section
      className={styles["checkout-shipping"]}
      aria-labelledby="shipping-heading"
    >
      <header className={styles["checkout-shipping__header"]}>
        <div className={styles["checkout-shipping__header-left"]}>
          <span className={styles["checkout-shipping__header-icon"]}>
            <MdLocalShipping aria-hidden="true" />
          </span>
          <h2
            id="shipping-heading"
            className={styles["checkout-shipping__header-title"]}
          >
            Dịch vụ vận chuyển
          </h2>
        </div>
        <div className={styles["checkout-shipping__logo"]}>
          <span className={styles["checkout-shipping__logo-text"]}>Giao Hàng Nhanh</span>
        </div>
      </header>

      <div className={styles["checkout-shipping__options"]}>
        <label
          className={[
            styles["checkout-shipping__option"],
            effectiveSelectedType === "economy" &&
              styles["checkout-shipping__option--selected"],
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <input
            type="radio"
            name="shipping"
            className={styles["checkout-shipping__radio"]}
            checked={effectiveSelectedType === "economy"}
            onChange={() => onChange("economy")}
          />
          <div className={styles["checkout-shipping__option-body"]}>
            <div className={styles["checkout-shipping__option-row"]}>
              <span className={styles["checkout-shipping__option-name"]}>
                {economy?.label ?? "GHN Tiết kiệm"}
              </span>
              <span className={styles["checkout-shipping__option-price"]}>
                {economy ? formatCurrency(economy.fee) : "—"}
              </span>
            </div>
            <span className={styles["checkout-shipping__option-eta"]}>
              {economy
                ? `Dự kiến nhận hàng: ${economy.estimatedDays}`
                : "Dự kiến nhận hàng: 3-5 ngày"}
            </span>
          </div>
        </label>

        <label
          className={[
            styles["checkout-shipping__option"],
            effectiveSelectedType === "express" &&
              !isExpressDisabled &&
              styles["checkout-shipping__option--selected"],
            isExpressDisabled && styles["checkout-shipping__option--disabled"],
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <input
            type="radio"
            name="shipping"
            className={styles["checkout-shipping__radio"]}
            checked={selectedType === "express"}
            onChange={() => {
              if (isExpressDisabled) return;
              onChange("express");
            }}
            disabled={isExpressDisabled}
          />
          <div className={styles["checkout-shipping__option-body"]}>
            <div className={styles["checkout-shipping__option-row"]}>
              <span className={styles["checkout-shipping__option-name"]}>
                {express?.label ?? "GHN Nhanh (Hoả tốc)"}
              </span>
              <span className={styles["checkout-shipping__option-price"]}>
                {express && !isExpressDisabled
                  ? formatCurrency(express.fee)
                  : "—"}
              </span>
            </div>
            <span className={styles["checkout-shipping__option-eta"]}>
              {express && !isExpressDisabled
                ? `Dự kiến nhận hàng: ${express.estimatedDays}`
                : "Không khả dụng với địa chỉ này"}
            </span>
          </div>
        </label>
      </div>
    </section>
  );
};

export default CheckoutShippingSection;

