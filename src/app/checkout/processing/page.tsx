"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MdLockClock } from "react-icons/md";
import ShopHeader from "@/components/layout/ShopHeader";
import ShopFooter from "@/components/layout/ShopFooter";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import type { CheckoutSessionStatusDto } from "@/types/payment";
import styles from "./page.module.css";

type SessionState = CheckoutSessionStatusDto | null;

function CheckoutProcessingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const attemptsRef = React.useRef(0);
  const [session, setSession] = useState<SessionState>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitionActive, setIsTransitionActive] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsTransitionActive(false);
    }, 1100);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!sessionId) {
      router.replace("/checkout");
      return;
    }

    attemptsRef.current = 0;
    let cancelled = false;

    const pollStatus = async () => {
      if (cancelled) return;

      try {
        setIsLoading(true);
        const res = await fetch(`/api/payments/status/${sessionId}`);
        if (!res.ok) return;

        const json = (await res.json()) as CheckoutSessionStatusDto;
        if (cancelled) return;

        setSession(json);

        if (json.status === "SUCCEEDED" && json.orderId) {
          router.replace(`/checkout/success?orderId=${json.orderId}`);
          return;
        }

        if (json.status === "FAILED" || json.status === "CANCELLED") {
          window.clearInterval(intervalId);
          return;
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void pollStatus();

    const intervalId = window.setInterval(() => {
      attemptsRef.current += 1;
      if (attemptsRef.current >= 15) {
        window.clearInterval(intervalId);
        return;
      }
      void pollStatus();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);


  const statusLabel = (() => {
    if (!session) return "Đang chờ xác nhận thanh toán từ VNPAY...";
    if (session.status === "SUCCEEDED") return "Thanh toán thành công, đang chuyển đến trang cảm ơn...";
    if (session.status === "FAILED") return "Thanh toán không thành công. Bạn có thể thử lại.";
    if (session.status === "EXPIRED") return "Phiên thanh toán đã hết hạn. Vui lòng tạo lại đơn hàng.";
    return "Đang chờ xác nhận thanh toán từ VNPAY...";
  })();

  return (
    <div className={styles["checkout-processing-page"]}>
      <PageTransitionOverlay
        isActive={isTransitionActive || isLoading}
        subtitle="Đang đồng bộ trạng thái thanh toán của bạn..."
        bottomText="Đức Uy Audio đang kiểm tra xác nhận từ VNPAY."
      />

      {!isTransitionActive && (
        <>
          <ShopHeader />

          <main className={styles["checkout-processing-page__main"]}>
            <section className={styles["checkout-processing-page__card"]}>
              <header className={styles["checkout-processing-page__status"]}>
                <div className={styles["checkout-processing-page__status-icon"]}>
                  <MdLockClock aria-hidden="true" />
                </div>
                <div className={styles["checkout-processing-page__status-text"]}>
                  <span className={styles["checkout-processing-page__status-label"]}>
                    Đang xử lý thanh toán
                  </span>
                  <span className={styles["checkout-processing-page__status-value"]}>
                    {statusLabel}
                  </span>
                </div>
              </header>

              <div className={styles["checkout-processing-page__progress"]}>
                <div className={styles["checkout-processing-page__progress-bar"]} />
              </div>

              <p className={styles["checkout-processing-page__hint"]}>
                Bạn có thể đóng trang này. Đơn hàng sẽ tự động được cập nhật khi VNPAY gửi xác nhận
                thanh toán về Đức Uy Audio.
              </p>

              <div className={styles["checkout-processing-page__actions"]}>
                <button
                  type="button"
                  className={`${styles["checkout-processing-page__button"]} ${styles["checkout-processing-page__button--primary"]}`}
                  onClick={() => router.push("/orders")}
                >
                  Xem danh sách đơn hàng
                </button>
                <button
                  type="button"
                  className={`${styles["checkout-processing-page__button"]} ${styles["checkout-processing-page__button--ghost"]}`}
                  onClick={() => router.push("/")}
                >
                  Về trang chủ
                </button>
              </div>
            </section>
          </main>

          <ShopFooter />
        </>
      )}
    </div>
  );
}

export default function CheckoutProcessingPageRoute() {
  return (
    <Suspense fallback={null}>
      <CheckoutProcessingPage />
    </Suspense>
  );
}
