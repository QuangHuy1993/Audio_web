"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { toast } from "sonner";
import {
  MdAutorenew,
  MdChevronLeft,
  MdChevronRight,
  MdDelete,
  MdErrorOutline,
  MdHeadsetMic,
  MdPersonOutline,
  MdSecurity,
  MdShoppingCart,
} from "react-icons/md";
import ShopHeader from "@/components/layout/ShopHeader";
import ShopFooter from "@/components/layout/ShopFooter";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import { useCartContext } from "@/features/shop/context/CartContext";
import type {
  CartItemDto,
  CartResponseDto,
  RemoveCartItemResponseDto,
  UpdateCartItemResponseDto,
} from "@/types/shop";
import type { ProductCardDto, ProductListResponseDto } from "@/types/shop";
import styles from "./page.module.css";

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    x: -32,
    transition: { duration: 0.25 },
  },
} as const;

export default function CartPage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const { refreshCartCount } = useCartContext();

  const [isTransitionActive, setIsTransitionActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartResponseDto | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const [currentPage, setCurrentPage] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState<ProductCardDto[]>([]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsTransitionActive(false);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const loadCart = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch("/api/shop/cart", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const errorJson = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(
          errorJson?.error ??
          "Không thể tải giỏ hàng. Vui lòng thử lại sau.",
        );
        return;
      }

      const data = (await res.json()) as CartResponseDto;
      setCart(data);
    } catch {
      setError("Không thể tải giỏ hàng. Vui lòng thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      void loadCart();
    } else if (sessionStatus === "unauthenticated") {
      setIsLoading(false);
      setCart(null);
      setCurrentPage(1);
    }
  }, [loadCart, sessionStatus]);

  useEffect(() => {
    if (!cart || cart.items.length === 0) {
      setCurrentPage(1);
      return;
    }
    const totalPages = Math.max(Math.ceil(cart.items.length / 5), 1);
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [cart, currentPage]);

  useEffect(() => {
    if (!cart || cart.items.length === 0 || relatedProducts.length > 0) {
      return;
    }

    const loadRelated = async () => {
      try {
        const res = await fetch("/api/shop/products?page=1&sort=newest");
        if (!res.ok) return;
        const data = (await res.json()) as ProductListResponseDto;
        const pool = data.data ?? [];
        if (pool.length === 0) return;
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        setRelatedProducts(shuffled.slice(0, 4));
      } catch {
        // bỏ qua lỗi, không ảnh hưởng cart chính
      }
    };

    void loadRelated();
  }, [cart, relatedProducts.length]);

  const handleQuantityChange = async (item: CartItemDto, delta: number) => {
    if (!cart || updatingIds.has(item.id)) return;

    const nextQuantity = item.quantity + delta;
    if (nextQuantity < 1) return;

    setUpdatingIds((prev) => new Set(prev).add(item.id));

    try {
      const res = await fetch(`/api/shop/cart/items/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity: nextQuantity }),
      });

      if (!res.ok) {
        const errorJson = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        console.error(
          "[CartPage] Failed to update quantity",
          errorJson?.error ?? res.statusText,
        );
        toast.error(errorJson?.error ?? "Không thể cập nhật số lượng sản phẩm.");
        return;
      }

      const data = (await res.json()) as UpdateCartItemResponseDto;

      setCart((prev) => {
        if (!prev) return prev;
        const items = prev.items.map((it) =>
          it.id === item.id ? data.cartItem : it,
        );
        const totalQuantity = items.reduce(
          (sum, it) => sum + it.quantity,
          0,
        );
        const subtotal = items.reduce(
          (sum, it) => sum + it.subtotal,
          0,
        );
        return {
          ...prev,
          items,
          totalQuantity,
          subtotal,
          itemCount: data.cartItemCount,
        };
      });

      refreshCartCount();
    } catch {
      console.error("[CartPage] Failed to update quantity");
      toast.error("Đã xảy ra lỗi khi cập nhật số lượng sản phẩm.");
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleRemoveItem = async (item: CartItemDto) => {
    if (!cart || updatingIds.has(item.id)) return;

    setUpdatingIds((prev) => new Set(prev).add(item.id));

    try {
      const res = await fetch(`/api/shop/cart/items/${item.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorJson = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        console.error(
          "[CartPage] Failed to remove item",
          errorJson?.error ?? res.statusText,
        );
        toast.error(errorJson?.error ?? "Không thể xóa sản phẩm khỏi giỏ hàng.");
        return;
      }

      const data = (await res.json()) as RemoveCartItemResponseDto;

      setCart((prev) => {
        if (!prev) return prev;
        const items = prev.items.filter((it) => it.id !== item.id);
        const totalQuantity = items.reduce(
          (sum, it) => sum + it.quantity,
          0,
        );
        const subtotal = items.reduce(
          (sum, it) => sum + it.subtotal,
          0,
        );
        return {
          ...prev,
          items,
          totalQuantity,
          subtotal,
          itemCount: data.cartItemCount,
        };
      });

      refreshCartCount();
      toast.success("Đã xóa sản phẩm khỏi giỏ hàng.");
    } catch {
      console.error("[CartPage] Failed to remove item");
      toast.error("Đã xảy ra lỗi khi xóa sản phẩm.");
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleCheckoutClick = () => {
    if (!cart || cart.items.length === 0) return;
    setIsTransitionActive(true);
    router.push("/checkout");
  };

  const formatPrice = (value: number): string =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value);

  const hasItems = !!cart && cart.items.length > 0;
  const isUnauthenticated = sessionStatus === "unauthenticated";

  const subtotal = cart?.subtotal ?? 0;
  const total = Math.max(subtotal, 0);
  const itemsPerPage = 5;
  const totalPages =
    cart && cart.items.length > 0
      ? Math.max(Math.ceil(cart.items.length / itemsPerPage), 1)
      : 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const pagedItems =
    cart && cart.items.length > 0
      ? cart.items.slice(startIndex, startIndex + itemsPerPage)
      : [];

  return (
    <div className={styles["cart-page"]}>
      <PageTransitionOverlay
        isActive={isTransitionActive}
        subtitle="Đang đồng bộ giỏ hàng của bạn..."
        bottomText="Đức Uy Audio đang chuẩn bị đơn hàng."
      />

      {!isTransitionActive && (
        <>
          <ShopHeader />

          <main className={styles["cart-page__inner"]}>
            <header className={styles["cart-page__header"]}>
              <button
                type="button"
                className={styles["cart-page__back"]}
                onClick={() => router.push("/products")}
              >
                <MdChevronLeft aria-hidden="true" />
                <span>Tiếp tục mua sắm</span>
              </button>

              <div className={styles["cart-page__title-group"]}>
                <h1 className={styles["cart-page__title"]}>Giỏ hàng của bạn</h1>
                <span className={styles["cart-page__badge"]}>
                  {cart?.itemCount ?? 0}
                </span>
              </div>
            </header>

            {isLoading && (
              <div className={styles["cart-page__loading"]}>
                <div className={styles["cart-page__skeleton-item"]} />
                <div className={styles["cart-page__skeleton-item"]} />
                <div className={styles["cart-page__skeleton-item"]} />
              </div>
            )}

            {!isLoading && error && (
              <div className={styles["cart-page__error"]}>
                <div className={styles["cart-page__error-icon"]}>
                  <MdErrorOutline aria-hidden="true" />
                </div>
                <h2 className={styles["cart-page__error-title"]}>
                  Không thể tải giỏ hàng
                </h2>
                <p className={styles["cart-page__error-desc"]}>{error}</p>
                <button
                  type="button"
                  className={styles["cart-page__retry"]}
                  onClick={() => void loadCart()}
                >
                  Thử lại
                </button>
              </div>
            )}

            {!isLoading && !error && isUnauthenticated && (
              <section className={styles["cart-page__unauth"]}>
                <div className={styles["cart-page__unauth-icon"]}>
                  <MdPersonOutline aria-hidden="true" />
                </div>
                <h2 className={styles["cart-page__unauth-title"]}>
                  Đăng nhập để xem giỏ hàng
                </h2>
                <p className={styles["cart-page__unauth-desc"]}>
                  Giỏ hàng của bạn sẽ được đồng bộ và lưu trữ an toàn khi bạn đăng
                  nhập vào tài khoản Đức Uy Audio.
                </p>
                <div className={styles["cart-page__unauth-actions"]}>
                  <button
                    type="button"
                    className={styles["cart-page__unauth-primary"]}
                    onClick={() => router.push("/login")}
                  >
                    Đăng nhập ngay
                  </button>
                  <button
                    type="button"
                    className={styles["cart-page__unauth-secondary"]}
                    onClick={() => router.push("/register")}
                  >
                    Tạo tài khoản mới
                  </button>
                </div>
              </section>
            )}

            {!isLoading && !error && !isUnauthenticated && !hasItems && (
              <section className={styles["cart-page__empty"]}>
                <div className={styles["cart-page__empty-icon"]}>
                  <MdShoppingCart aria-hidden="true" />
                </div>
                <h2 className={styles["cart-page__empty-title"]}>
                  Giỏ hàng của bạn đang trống
                </h2>
                <p className={styles["cart-page__empty-desc"]}>
                  Khám phá các thiết bị âm thanh hi-fi được Đức Uy Audio tuyển chọn
                  theo tiêu chuẩn phòng nghe thực tế.
                </p>
                <div className={styles["cart-page__empty-actions"]}>
                  <button
                    type="button"
                    className={styles["cart-page__empty-cta"]}
                    onClick={() => router.push("/products")}
                  >
                    Khám phá sản phẩm
                  </button>
                  <button
                    type="button"
                    className={styles["cart-page__empty-cta--secondary"]}
                    onClick={() => router.push("/wishlist")}
                  >
                    Xem danh sách yêu thích
                  </button>
                </div>
              </section>
            )}

            {!isLoading && !error && hasItems && cart && (
              <section className={styles["cart-page__content"]}>
                <div>
                  <motion.div
                    variants={listVariants}
                    initial="hidden"
                    animate="visible"
                    className={styles["cart-page__items"]}
                  >
                    <AnimatePresence initial={false}>
                      {pagedItems.map((item) => (
                        <motion.div
                          key={item.id}
                          variants={itemVariants}
                          layout
                          exit="exit"
                          className={clsx(
                            styles["cart-page__item"],
                            updatingIds.has(item.id) &&
                            styles["cart-page__item--updating"],
                          )}
                        >
                          <div className={styles["cart-page__item-main"]}>
                            <button
                              type="button"
                              className={styles["cart-page__item-image-wrap"]}
                              onClick={() =>
                                router.push(`/products/${item.productId}`)
                              }
                            >
                              {item.productImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.productImageUrl}
                                  alt={item.productName}
                                  className={styles["cart-page__item-image"]}
                                />
                              ) : (
                                <div
                                  className={styles["cart-page__item-image"]}
                                  aria-hidden="true"
                                />
                              )}
                            </button>

                            <div className={styles["cart-page__item-info"]}>
                              <button
                                type="button"
                                className={styles["cart-page__item-name"]}
                                onClick={() =>
                                  router.push(`/products/${item.productId}`)
                                }
                              >
                                {item.productName}
                              </button>

                              <div className={styles["cart-page__item-meta"]}>
                                <span className={styles["cart-page__item-brand"]}>
                                  {item.brandName || "Đức Uy Audio"}
                                </span>
                              </div>

                              <p className={styles["cart-page__item-unit-price"]}>
                                Đơn giá: {formatPrice(item.unitPrice)}
                              </p>
                            </div>
                          </div>

                          <div className={styles["cart-page__item-actions"]}>
                            <div className={styles["cart-page__qty"]}>
                              <button
                                type="button"
                                className={styles["cart-page__qty-btn"]}
                                onClick={() => void handleQuantityChange(item, -1)}
                                disabled={
                                  item.quantity <= 1 || updatingIds.has(item.id)
                                }
                                aria-label="Giảm số lượng"
                              >
                                <MdChevronLeft aria-hidden="true" />
                              </button>
                              <span className={styles["cart-page__qty-value"]}>
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                className={styles["cart-page__qty-btn"]}
                                onClick={() => void handleQuantityChange(item, 1)}
                                disabled={updatingIds.has(item.id)}
                                aria-label="Tăng số lượng"
                              >
                                <MdChevronRight aria-hidden="true" />
                              </button>
                            </div>

                            <div className={styles["cart-page__item-summary"]}>
                              <span className={styles["cart-page__item-subtotal"]}>
                                {formatPrice(item.subtotal)}
                              </span>
                              <button
                                type="button"
                                className={styles["cart-page__item-remove"]}
                                onClick={() => void handleRemoveItem(item)}
                                disabled={updatingIds.has(item.id)}
                                aria-label="Xóa sản phẩm khỏi giỏ hàng"
                              >
                                <MdDelete aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>

                  <section className={styles["cart-page__related"]}>
                    <h2 className={styles["cart-page__related-title"]}>
                      Có thể bạn cũng thích
                    </h2>
                    <div className={styles["cart-page__related-grid"]}>
                      {relatedProducts.length === 0 &&
                        [0, 1, 2, 3].map((key) => (
                          <div
                            key={key}
                            className={styles["cart-page__skeleton-item"]}
                          />
                        ))}
                      {relatedProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          className={styles["cart-page__related-card"]}
                          onClick={() => router.push(`/products/${product.id}`)}
                        >
                          <div
                            className={styles["cart-page__related-image-wrap"]}
                          >
                            {product.primaryImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={product.primaryImageUrl}
                                alt={product.name}
                                className={styles["cart-page__related-image"]}
                              />
                            ) : (
                              <div
                                className={styles["cart-page__related-image"]}
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <div className={styles["cart-page__related-info"]}>
                            <span className={styles["cart-page__related-name"]}>
                              {product.name}
                            </span>
                            <span className={styles["cart-page__related-price"]}>
                              {formatPrice(product.salePrice ?? product.price)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>

                <aside className={styles["cart-page__summary"]}>
                  <h2 className={styles["cart-page__summary-title"]}>
                    Tổng kết đơn hàng
                  </h2>

                  <div
                    className={clsx(
                      styles["cart-page__summary-row"],
                      styles["cart-page__summary-row--total"],
                    )}
                  >
                    <span className={styles["cart-page__summary-label"]}>
                      Tổng thanh toán
                    </span>
                    <span className={styles["cart-page__summary-value"]}>
                      {formatPrice(total)}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={styles["cart-page__checkout"]}
                    disabled={!hasItems}
                    onClick={handleCheckoutClick}
                  >
                    <MdShoppingCart aria-hidden="true" />
                    <span>Tiến hành thanh toán</span>
                  </button>

                  <div className={styles["cart-page__trust"]}>
                    <div className={styles["cart-page__trust-item"]}>
                      <MdSecurity aria-hidden="true" />
                      <span>Thanh toán bảo mật qua đối tác uy tín.</span>
                    </div>
                    <div className={styles["cart-page__trust-item"]}>
                      <MdAutorenew aria-hidden="true" />
                      <span>Đổi trả miễn phí trong 30 ngày theo điều kiện áp dụng.</span>
                    </div>
                    <div className={styles["cart-page__trust-item"]}>
                      <MdHeadsetMic aria-hidden="true" />
                      <span>Hỗ trợ kỹ thuật & tư vấn 24/7.</span>
                    </div>
                  </div>
                </aside>
              </section>
            )}
          </main>

          {!isLoading && !error && hasItems && cart && totalPages > 1 && (
            <div className={styles["cart-page__pagination"]}>
              <button
                type="button"
                className={styles["cart-page__pagination-button"]}
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                disabled={currentPage === 1}
              >
                <MdChevronLeft aria-hidden="true" />
              </button>
              <span className={styles["cart-page__pagination-info"]}>
                Trang {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className={styles["cart-page__pagination-button"]}
                onClick={() =>
                  setCurrentPage((page) => Math.min(page + 1, totalPages))
                }
                disabled={currentPage === totalPages}
              >
                <MdChevronRight aria-hidden="true" />
              </button>
            </div>
          )}

          {!isLoading && !error && hasItems && cart && (
            <div className={styles["cart-page__sticky-bar"]}>
              <div className={styles["cart-page__sticky-total"]}>
                <span className={styles["cart-page__sticky-total-label"]}>
                  Tổng thanh toán
                </span>
                <span className={styles["cart-page__sticky-total-value"]}>
                  {formatPrice(total)}
                </span>
              </div>
              <button
                type="button"
                className={styles["cart-page__sticky-checkout"]}
                onClick={handleCheckoutClick}
                disabled={!hasItems}
              >
                <span>Thanh toán ngay</span>
              </button>
            </div>
          )}

          <ShopFooter />
        </>
      )}
    </div>
  );
}


