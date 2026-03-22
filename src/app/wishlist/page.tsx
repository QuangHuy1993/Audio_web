"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ShopHeader from "@/components/layout/ShopHeader";
import ShopFooter from "@/components/layout/ShopFooter";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import ProductCardSkeleton from "@/components/shared/ProductCardSkeleton";
import Image from "next/image";
import { toast } from "sonner";
import { useCartContext } from "@/features/shop/context/CartContext";
import type { ToggleWishlistResponseDto, WishlistResponseDto } from "@/types/shop";
import { getCloudinaryUrl } from "@/utils/cloudinary-url";
import styles from "./page.module.css";

export default function WishlistPage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const { refreshCartCount, refreshWishlistCount } = useCartContext();

  const [isTransitionActive, setIsTransitionActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<WishlistResponseDto | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsTransitionActive(false);
    }, 1100);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    void loadWishlist();
  }, [currentPage]);

  const loadWishlist = async () => {
    try {
      setIsLoading(true);
      setError(null);

      setError(null);

      const res = await fetch(`/api/shop/wishlist?page=${currentPage}&limit=4`, {
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
            "Không thể tải danh sách yêu thích. Vui lòng thử lại sau.",
        );
        return;
      }

      const data = (await res.json()) as WishlistResponseDto;
      setWishlist(data);
    } catch {
      setError("Không thể tải danh sách yêu thích. Vui lòng thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      void loadWishlist();
    } else if (sessionStatus === "unauthenticated") {
      setIsLoading(false);
      setWishlist(null);
    }
  }, [sessionStatus]);

  const handleToggleWishlist = async (productId: string) => {
    if (togglingIds.has(productId)) return;

    setTogglingIds((prev) => new Set(prev).add(productId));

    try {
      const res = await fetch("/api/shop/wishlist/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId }),
      });

      if (!res.ok) {
        const errorJson = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        console.error(
          "[WishlistPage] Failed to toggle wishlist",
          errorJson?.error ?? res.statusText,
        );
        toast.error(errorJson?.error ?? "Không thể cập nhật danh sách yêu thích.");
        return;
      }

      const data = (await res.json()) as ToggleWishlistResponseDto;

      if (data.action === "removed") {
        toast.info("Đã xóa sản phẩm khỏi danh sách yêu thích");
      } else {
        toast.success("Đã thêm sản phẩm vào danh sách yêu thích");
      }

      setWishlist((prev) => {
        if (!prev) return prev;
        if (data.action === "removed") {
          const items = prev.items.filter((it) => it.productId !== productId);
          return {
            ...prev,
            items,
            itemCount: data.wishlistItemCount,
          };
        }
        // Nếu added từ trang khác, reload danh sách đầy đủ
        return prev;
      });
      refreshWishlistCount();
    } catch {
      console.error("[WishlistPage] Failed to toggle wishlist");
      toast.error("Đã xảy ra lỗi khi cập nhật danh sách yêu thích.");
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const handleAddToCart = async (productId: string) => {
    if (addingIds.has(productId)) return;

    setAddingIds((prev) => new Set(prev).add(productId));

    try {
      const res = await fetch("/api/shop/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      if (!res.ok) {
        const errorJson = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        console.error(
          "[WishlistPage] Failed to add product to cart",
          errorJson?.error ?? res.statusText,
        );
        toast.error(errorJson?.error ?? "Không thể thêm sản phẩm vào giỏ hàng.");
        return;
      }

      refreshCartCount();
      toast.success("Đã thêm sản phẩm vào giỏ hàng!");
    } catch {
      console.error("[WishlistPage] Failed to add product to cart");
      toast.error("Đã xảy ra lỗi khi thêm sản phẩm vào giỏ hàng.");
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const formatPrice = (value: number): string =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value);

  const hasItems = !!wishlist && wishlist.items.length > 0;

  return (
    <div className={styles["wishlist-page"]}>
      <PageTransitionOverlay
        isActive={isTransitionActive}
        subtitle="Đang đồng bộ danh sách yêu thích của bạn..."
        bottomText="Đức Uy Audio đang chuẩn bị trải nghiệm cá nhân hóa."
      />
      <ShopHeader />

      <main className={styles["wishlist-page__inner"]}>
        <header className={styles["wishlist-page__header"]}>
          <h1 className={styles["wishlist-page__title"]}>Danh sách yêu thích</h1>
          <button
            type="button"
            className={styles["wishlist-page__back"]}
            onClick={() => router.push("/products")}
          >
            Tiếp tục mua sắm
          </button>
        </header>

        {isLoading && !wishlist && (
          <div className={styles["wishlist-page__grid"]}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <ProductCardSkeleton key={idx} />
            ))}
          </div>
        )}

        {error && (
          <div className={styles["wishlist-page__error"]}>
            <p>{error}</p>
            <button 
              className={styles["wishlist-page__empty-cta"]}
              onClick={() => void loadWishlist()}
            >
              Thử lại
            </button>
          </div>
        )}

        {!isLoading && wishlist && wishlist.items.length === 0 && (
          <div className={styles["wishlist-page__empty"]}>
            <p>Chưa có sản phẩm nào trong danh sách yêu thích của bạn.</p>
            <button
              className={styles["wishlist-page__empty-cta"]}
              onClick={() => router.push("/products")}
            >
              Khám phá âm thanh ngay
            </button>
          </div>
        )}

        {wishlist && wishlist.items.length > 0 && (
          <>
            <div className={styles["wishlist-page__grid"]}>
              {wishlist.items.map((item) => (
                <div
                  key={item.id}
                  className={styles["wishlist-page__card"]}
                  onClick={() => router.push(`/products/${item.productSlug}`)}
                >
                  <div className={styles["wishlist-page__image-wrapper"]}>
                    {item.productImageUrl ? (
                      <Image
                        src={getCloudinaryUrl(item.productImageUrl, { width: 400 }) || ""}
                        alt={item.productName}
                        fill
                        className={styles["wishlist-page__image"]}
                      />
                    ) : (
                      <div className={styles["wishlist-page__image-placeholder"]} />
                    )}
                  </div>
                  <div className={styles["wishlist-page__card-body"]}>
                    <h3 className={styles["wishlist-page__card-name"]}>
                      {item.productName}
                    </h3>
                    <p className={styles["wishlist-page__card-price"]}>
                      {formatPrice(item.salePrice ?? item.price)}
                    </p>
                  </div>
                  <div className={styles["wishlist-page__card-actions"]}>
                    <button
                      className={styles["wishlist-page__card-add"]}
                      disabled={addingIds.has(item.productId)}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleAddToCart(item.productId);
                      }}
                    >
                      {addingIds.has(item.productId)
                        ? "Đang thêm..."
                        : "Vào giỏ hàng"}
                    </button>
                    <button
                      className={styles["wishlist-page__card-remove"]}
                      disabled={togglingIds.has(item.productId)}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleToggleWishlist(item.productId);
                      }}
                    >
                      {togglingIds.has(item.productId) ? "..." : "Xóa"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {wishlist.pagination && wishlist.pagination.totalPages > 1 && (
              <div className={styles["wishlist-page__pagination"]}>
                {Array.from({ length: wishlist.pagination.totalPages }).map(
                  (_, i) => (
                    <button
                      key={i}
                      className={`${styles["wishlist-page__page-btn"]} ${
                        currentPage === i + 1
                          ? styles["wishlist-page__page-btn--active"]
                          : ""
                      }`}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ),
                )}
              </div>
            )}
          </>
        )}
      </main>

      <ShopFooter />
    </div>
  );
}

