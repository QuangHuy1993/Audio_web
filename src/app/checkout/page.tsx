"use client";

import React from "react";
import { MdLock } from "react-icons/md";
import ShopHeader from "@/components/layout/ShopHeader";
import ShopFooter from "@/components/layout/ShopFooter";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import CheckoutPage from "@/features/shop/components/checkout/CheckoutPage";
import styles from "./page.module.css";

export default function CheckoutAppPage() {
  const [isTransitionActive, setIsTransitionActive] = React.useState(true);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsTransitionActive(false);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className={styles["checkout-page"]}>
      <PageTransitionOverlay
        isActive={isTransitionActive}
        subtitle="Đang chuẩn bị không gian thanh toán..."
        bottomText="Đức Uy Audio cam kết bảo mật thông tin tuyệt đối."
      />

      {!isTransitionActive && (
        <>
          <ShopHeader />

          <main className={styles["checkout-page__inner"]}>
            <div className={styles["checkout-page__stepper"]}>
              <CheckoutPage />
            </div>

            <div className={styles["checkout-page__footer-lock"]}>
              <MdLock aria-hidden="true" />
              <span>Thanh toán được bảo mật với chuẩn SSL 256-bit.</span>
            </div>
          </main>

          <ShopFooter />
        </>
      )}
    </div>
  );
}

