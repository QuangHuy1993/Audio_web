"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import ShopHeader from "@/components/layout/ShopHeader";
import ShopFooter from "@/components/layout/ShopFooter";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import { useCartContext } from "@/features/shop/context/CartContext";
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

function getPaymentMethodLabel(provider: string | null): string {
  if (provider === "COD") return "COD";
  if (provider === "VNPAY") return "VNPAY";
  if (provider === "QR_TRANSFER") return "VIETQR";
  return provider ?? "COD";
}

function CheckoutSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
  const [isCopying, setIsCopying] = useState(false);
  const [isTransitionActive, setIsTransitionActive] = useState(true);
  const [data, setData] = useState<OrderDetailResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { refreshCartCount } = useCartContext();

  // Refresh cart count on mount to ensure header is synced after checkout
  useEffect(() => {
    refreshCartCount();
  }, [refreshCartCount]);

  useEffect(() => {
    if (!orderId) return;

    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        const res = await fetch(`/api/shop/orders/${orderId}`, { method: "GET" });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: string } | null;
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsTransitionActive(false);
    }, 1100);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    try {
      const shouldToast = sessionStorage.getItem("checkout:successToast") === "1";
      const lastOrderId = sessionStorage.getItem("checkout:lastOrderId");
      if (!shouldToast) return;
      if (lastOrderId && orderId && lastOrderId !== orderId) return;

      toast.success("Cảm ơn bạn đã đặt hàng. Đức Uy Audio đã ghi nhận đơn của bạn.");
      sessionStorage.removeItem("checkout:successToast");
    } catch {
      // ignore storage access failures
    }
  }, [orderId]);

  const handleCopyOrderNumber = async () => {
    if (!data?.orderNumber) return;
    try {
      setIsCopying(true);
      await navigator.clipboard.writeText(data.orderNumber.replace(/^#/, ""));
    } finally {
      window.setTimeout(() => setIsCopying(false), 450);
    }
  };

  const handleContinueShopping = () => router.push("/products");

  const handleViewOrderDetail = () => {
    if (!data?.orderId) {
      router.push("/account/orders");
      return;
    }
    router.push(`/account/orders/${data.orderId}`);
  };

  const showMissingOrder = !orderId;
  const showNotFound = Boolean(orderId) && !isLoading && !data && !!loadError;

  return (
    <div className={styles["checkout-success-page"]}>
      <PageTransitionOverlay
        isActive={isTransitionActive}
        subtitle="Đang chuẩn bị biên nhận đơn hàng của bạn..."
        bottomText="Đức Uy Audio đang xác nhận thông tin đơn hàng."
      />

      {!isTransitionActive && (
        <>
          <ShopHeader />

          <main className={styles["checkout-success-page__inner"]}>
            {showMissingOrder ? (
              <section
                className={styles["checkout-success-page__hero-card"]}
                aria-label="Không tìm thấy đơn hàng"
              >
                <h1 className={styles["checkout-success-page__hero-title"]}>
                  Không tìm thấy đơn hàng
                </h1>
                <p className={styles["checkout-success-page__hero-subtitle"]}>
                  Vui lòng kiểm tra lại đường dẫn hoặc quay về trang sản phẩm để tiếp tục
                  mua sắm.
                </p>
                <div className={styles["checkout-success-page__cta-row"]}>
                  <button
                    type="button"
                    className={`${styles["checkout-success-page__button"]} ${styles["checkout-success-page__button--primary"]}`}
                    onClick={handleContinueShopping}
                  >
                    Về trang sản phẩm
                  </button>
                  <button
                    type="button"
                    className={styles["checkout-success-page__button"]}
                    onClick={() => router.push("/cart")}
                  >
                    Quay lại giỏ hàng
                  </button>
                </div>
              </section>
            ) : showNotFound ? (
              <section
                className={styles["checkout-success-page__hero-card"]}
                aria-label="Không tìm thấy đơn hàng"
              >
                <h1 className={styles["checkout-success-page__hero-title"]}>
                  Không tìm thấy đơn hàng
                </h1>
                <p className={styles["checkout-success-page__hero-subtitle"]}>
                  {loadError}
                </p>
                <div className={styles["checkout-success-page__cta-row"]}>
                  <button
                    type="button"
                    className={`${styles["checkout-success-page__button"]} ${styles["checkout-success-page__button--primary"]}`}
                    onClick={handleContinueShopping}
                  >
                    Về trang sản phẩm
                  </button>
                  <button
                    type="button"
                    className={styles["checkout-success-page__button"]}
                    onClick={() => router.push("/support")}
                  >
                    Liên hệ hỗ trợ
                  </button>
                </div>
              </section>
            ) : (
              <div className={styles["checkout-success-page__grid"]}>
                <div className={styles["checkout-success-page__left"]}>
                  {/* Success hero card */}
                  <section
                    className={styles["checkout-success-page__hero-card"]}
                    data-purpose="success-hero"
                  >
                    <div
                      className={styles["checkout-success-page__hero-icon-wrap"]}
                      aria-hidden="true"
                    >
                      <svg
                        className={styles["checkout-success-page__hero-icon"]}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M5 13l4 4L19 7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>

                    <h1 className={styles["checkout-success-page__hero-title"]}>
                      Cảm ơn bạn đã đặt hàng
                    </h1>
                    <p className={styles["checkout-success-page__hero-subtitle"]}>
                      Mã đơn hàng:{" "}
                      <span className={styles["checkout-success-page__order-number"]}>
                        {data ? `#${data.orderNumber}` : "—"}
                      </span>{" "}
                      <button
                        type="button"
                        className={styles["checkout-success-page__copy-button"]}
                        onClick={handleCopyOrderNumber}
                        disabled={isCopying}
                      >
                        {isCopying ? "Đã sao chép" : "Sao chép"}
                      </button>
                    </p>

                    <div className={styles["checkout-success-page__pill-row"]}>
                      <span className={styles["checkout-success-page__pill"]}>
                        {`Thanh toán: ${data?.paymentStatus === "PAID" ? "ĐÃ THANH TOÁN" : "CHỜ XÁC NHẬN"}`}
                      </span>
                      <span
                        className={`${styles["checkout-success-page__pill"]} ${styles["checkout-success-page__pill--green"]}`}
                      >
                        {`Phương thức: ${getPaymentMethodLabel(data?.paymentProvider ?? null)}`}
                      </span>
                    </div>
                  </section>

                  {/* Order items */}
                  <section
                    className={styles["checkout-success-page__card"]}
                    data-purpose="order-items-list"
                  >
                    <div className={styles["checkout-success-page__card-header"]}>
                      <h3 className={styles["checkout-success-page__card-title"]}>
                        Sản phẩm trong đơn hàng
                      </h3>
                      <span className={styles["checkout-success-page__card-subtitle"]}>
                        {data ? `${data.items.length} sản phẩm` : "—"}
                      </span>
                    </div>

                    <div className={styles["checkout-success-page__card-body"]}>
                      <div className={styles["checkout-success-page__items"]}>
                        {(data?.items ?? []).map((item) => (
                          <div key={item.id} className={styles["checkout-success-page__item"]}>
                            <div className={styles["checkout-success-page__item-thumb"]}>
                              <Image
                                alt={item.productName}
                                src={item.productImageUrl ?? "/favicon.ico"}
                                fill
                                sizes="80px"
                                style={{ objectFit: "cover" }}
                                priority={false}
                              />
                            </div>
                            <div className={styles["checkout-success-page__item-content"]}>
                              <h4 className={styles["checkout-success-page__item-name"]}>
                                {item.productName}
                              </h4>
                              <p className={styles["checkout-success-page__item-meta"]}>
                                {`Đơn giá: ${formatVnd(item.unitPrice)}`}
                              </p>
                              <div className={styles["checkout-success-page__item-row"]}>
                                <span className={styles["checkout-success-page__item-qty"]}>
                                  {`Số lượng: ${String(item.quantity).padStart(2, "0")}`}
                                </span>
                                <span className={styles["checkout-success-page__item-price"]}>
                                  {formatVnd(item.subtotalItem)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {isLoading && (
                          <div className={styles["checkout-success-page__skeleton"]} />
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Shipping + Payment grid */}
                  <div className={styles["checkout-success-page__info-grid"]}>
                    <section
                      className={styles["checkout-success-page__card"]}
                      data-purpose="shipping-info"
                    >
                      <div className={styles["checkout-success-page__info-header"]}>
                        <svg
                          className={styles["checkout-success-page__info-icon"]}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                          <path
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                        <h3 className={styles["checkout-success-page__info-title"]}>
                          Địa chỉ giao hàng
                        </h3>
                      </div>

                      <div className={styles["checkout-success-page__address"]}>
                        <p className={styles["checkout-success-page__address-name"]}>
                          {data?.shippingAddress?.fullName ?? "—"}
                        </p>
                        <p>{data?.shippingAddress?.phone ?? "—"}</p>
                        <p>
                          {data?.shippingAddress
                            ? `${data.shippingAddress.line1}${data.shippingAddress.ward ? `, ${data.shippingAddress.ward}` : ""
                            }`
                            : "—"}
                        </p>
                        <p>
                          {data?.shippingAddress
                            ? `${data.shippingAddress.district ?? ""}${data.shippingAddress.province ? `, ${data.shippingAddress.province}` : ""
                            }`
                            : "—"}
                        </p>
                      </div>
                    </section>

                    <section
                      className={styles["checkout-success-page__card"]}
                      data-purpose="payment-info"
                    >
                      <div className={styles["checkout-success-page__info-header"]}>
                        <svg
                          className={styles["checkout-success-page__info-icon"]}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                        <h3 className={styles["checkout-success-page__info-title"]}>
                          Thông tin thanh toán
                        </h3>
                      </div>

                      <div className={styles["checkout-success-page__payment-box"]}>
                        <p className={styles["checkout-success-page__payment-hint"]}>
                          Trạng thái
                        </p>
                        <p className={styles["checkout-success-page__payment-status"]}>
                          {data?.paymentStatus === "PAID"
                            ? "Thanh toán đã được xác nhận"
                            : "Đang chờ xác nhận giao dịch"}
                        </p>
                        <p className={styles["checkout-success-page__payment-desc"]}>
                          {data?.paymentProvider === "COD"
                            ? "Shipper sẽ thu tiền khi giao hàng. Vui lòng chuẩn bị đúng số tiền."
                            : "Hệ thống sẽ tự cập nhật trạng thái sau khi nhận được xác nhận thanh toán."}
                        </p>
                      </div>
                    </section>
                  </div>
                </div>

                {/* Right column summary */}
                <aside className={styles["checkout-success-page__right"]}>
                  <section
                    className={styles["checkout-success-page__summary-card"]}
                    data-purpose="order-summary-card"
                  >
                    <h3 className={styles["checkout-success-page__summary-title"]}>
                      Tóm tắt đơn hàng
                    </h3>

                    <div className={styles["checkout-success-page__summary-rows"]}>
                      <div className={styles["checkout-success-page__summary-row"]}>
                        <span className={styles["checkout-success-page__summary-label"]}>
                          Tạm tính
                        </span>
                        <span className={styles["checkout-success-page__summary-value"]}>
                          {data ? formatVnd(data.subtotal) : "—"}
                        </span>
                      </div>
                      <div className={styles["checkout-success-page__summary-row"]}>
                        <span className={styles["checkout-success-page__summary-label"]}>
                          Giảm giá sản phẩm
                        </span>
                        <span
                          className={`${styles["checkout-success-page__summary-value"]} ${styles["checkout-success-page__summary-value--discount"]}`}
                        >
                          {data ? `-${formatVnd(data.discountAmount)}` : "—"}
                        </span>
                      </div>
                      <div className={styles["checkout-success-page__summary-row"]}>
                        <span className={styles["checkout-success-page__summary-label"]}>
                          Phí vận chuyển
                        </span>
                        <span className={styles["checkout-success-page__shipping-fee"]}>
                          {data ? (
                            <>
                              {data.shippingDiscount > 0 && (
                                <span
                                  className={styles["checkout-success-page__shipping-strike"]}
                                >
                                  {formatVnd(data.shippingFeeOriginal)}
                                </span>
                              )}
                              <span className={styles["checkout-success-page__shipping-free"]}>
                                {data.shippingFeeFinal === 0 && data.shippingFeeOriginal > 0
                                  ? "Miễn phí"
                                  : formatVnd(data.shippingFeeFinal)}
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                    </div>

                    <div className={styles["checkout-success-page__summary-total-row"]}>
                      <span className={styles["checkout-success-page__summary-total-label"]}>
                        Tổng thanh toán
                      </span>
                      <span className={styles["checkout-success-page__summary-total-value"]}>
                        {data ? formatVnd(data.totalAmount) : "—"}
                      </span>
                    </div>

                    <div className={styles["checkout-success-page__summary-actions"]}>
                      <button
                        type="button"
                        className={`${styles["checkout-success-page__action-button"]} ${styles["checkout-success-page__action-button--primary"]}`}
                        onClick={handleContinueShopping}
                      >
                        Tiếp tục mua sắm
                      </button>
                      <button
                        type="button"
                        className={styles["checkout-success-page__action-button"]}
                        onClick={handleViewOrderDetail}
                      >
                        Xem chi tiết đơn hàng
                      </button>
                    </div>

                    <div className={styles["checkout-success-page__trust"]}>
                      <div className={styles["checkout-success-page__trust-item"]}>
                        <div className={styles["checkout-success-page__trust-icon"]}>
                          <svg
                            className={styles["checkout-success-page__trust-icon-svg"]}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className={styles["checkout-success-page__trust-meta"]}>
                            Hotline hỗ trợ 24/7
                          </p>
                          <p className={styles["checkout-success-page__trust-main"]}>
                            1900 6789
                          </p>
                        </div>
                      </div>

                      <div className={styles["checkout-success-page__trust-item"]}>
                        <div
                          className={`${styles["checkout-success-page__trust-icon"]} ${styles["checkout-success-page__trust-icon--zalo"]}`}
                        >
                          <svg
                            className={styles["checkout-success-page__trust-icon-svg"]}
                            fill="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.527 3.658 1.439 5.166l-1.42 5.14 5.253-1.39A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className={styles["checkout-success-page__trust-meta"]}>
                            Hỗ trợ qua Zalo
                          </p>
                          <p
                            className={`${styles["checkout-success-page__trust-main"]} ${styles["checkout-success-page__trust-main--zalo"]}`}
                          >
                            Đức Uy Audio Care
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                </aside>
              </div>
            )}
          </main>

          <ShopFooter />
        </>
      )}
    </div>
  );
}

export default function CheckoutSuccessPageRoute() {
  return (
    <Suspense fallback={null}>
      <CheckoutSuccessPage />
    </Suspense>
  );
}
