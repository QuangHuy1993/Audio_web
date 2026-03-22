import React from "react";
import { MdCheck } from "react-icons/md";
import styles from "./CheckoutStepper.module.css";

export type CheckoutStepperProps = {
  currentStep: 1 | 2 | 3 | 4;
};

const STEPS = [
  { id: 1, label: "Địa chỉ" },
  { id: 2, label: "Vận chuyển" },
  { id: 3, label: "Thanh toán" },
  { id: 4, label: "Xác nhận" },
];

const CheckoutStepper: React.FC<CheckoutStepperProps> = ({ currentStep }) => {
  const progressPercent =
    currentStep <= 1 ? 0 : currentStep >= 4 ? 100 : ((currentStep - 1) / 3) * 100;

  return (
    <div className={styles["checkout-stepper"]}>
      <div className={styles["checkout-stepper__track"]}>
        <div
          className={styles["checkout-stepper__track-active"]}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className={styles["checkout-stepper__items"]}>
        {STEPS.map((step) => {
          const isDone = step.id < currentStep;
          const isActive = step.id === currentStep;

          return (
            <div
              key={step.id}
              className={styles["checkout-stepper__item"]}
              aria-current={isActive ? "step" : undefined}
            >
              <div
                className={[
                  styles["checkout-stepper__circle"],
                  isDone && styles["checkout-stepper__circle--done"],
                  isActive && styles["checkout-stepper__circle--active"],
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {isDone ? (
                  <MdCheck aria-hidden="true" />
                ) : (
                  <span>{`0${step.id}`}</span>
                )}
              </div>
              <span
                className={[
                  styles["checkout-stepper__label"],
                  isActive && styles["checkout-stepper__label--active"],
                  isDone && styles["checkout-stepper__label--done"],
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CheckoutStepper;

