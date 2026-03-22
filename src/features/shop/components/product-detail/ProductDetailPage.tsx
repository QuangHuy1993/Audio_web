"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import {
  MdChevronRight,
  MdVerified,
  MdStar,
  MdLocalShipping,
  MdVerifiedUser,
  MdPublishedWithChanges,
  MdPayments,
  MdSmartToy,
  MdShoppingCartCheckout,
  MdAdd,
  MdRemove,
  MdFavoriteBorder,
  MdFavorite,
  MdArrowForward,
  MdAddShoppingCart,
  MdWarning,
  MdZoomIn,
  MdClose,
  MdChevronLeft,
  MdCompare,
} from "react-icons/md";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import ShopHeader from "@/components/layout/ShopHeader";
import ShopFooter from "@/components/layout/ShopFooter";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import { getCloudinaryUrl } from "@/utils/cloudinary-url";
import { useCartContext } from "@/features/shop/context/CartContext";
import type {
  AddToCartResponseDto,
  ProductDetailResponseDto,
  ProductCardDto,
  ReviewDto,
  ToggleWishlistResponseDto,
} from "@/types/shop";
import ReviewList from "../reviews/ReviewList";
import ReviewStats from "../reviews/ReviewStats";
import ReviewModal from "../reviews/ReviewModal";
import AiChatPanel from "../ai-chat/AiChatPanel";
import AiProductComparison from "../product-comparison/AiProductComparison";
import styles from "./ProductDetailPage.module.css";

type TabKey = "description" | "specs" | "reviews" | "ai";

function formatPrice(amount: number, currency: string): string {
  if (currency === "VND") {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function getDiscountPercent(price: number, salePrice: number): number {
  return Math.round(((price - salePrice) / price) * 100);
}

type Props = {
  id: string;
};

export default function ProductDetailPage({ id }: Props) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { refreshCartCount } = useCartContext();

  const [product, setProduct] = useState<ProductDetailResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTransitionActive, setIsTransitionActive] = useState(true);

  // Gallery state
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Buy box state
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isTogglingWishlist, setIsTogglingWishlist] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>("description");

  // Comparison state
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Review management
  const [editingReview, setEditingReview] = useState<ReviewDto | null>(null);

  // Tắt PageTransitionOverlay sau 1100ms
  useEffect(() => {
    transitionTimerRef.current = setTimeout(() => {
      setIsTransitionActive(false);
    }, 1100);
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  const fetchProduct = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shop/products/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.");
        } else {
          setError("Có lỗi xảy ra khi tải sản phẩm. Vui lòng thử lại.");
        }
        return;
      }
      const data = (await res.json()) as ProductDetailResponseDto;
      setProduct(data);
    } catch {
      setError("Có lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa đánh giá này?")) return;
    try {
      const res = await fetch(`/api/shop/reviews/${reviewId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Đã xóa đánh giá thành công.");
        fetchProduct();
      } else {
        const data = await res.json();
        toast.error(data.error || "Không thể xóa đánh giá.");
      }
    } catch {
      toast.error("Lỗi kết nối.");
    }
  };

  // Kiểm tra trạng thái wishlist cho sản phẩm hiện tại khi user đã đăng nhập
  useEffect(() => {
    if (sessionStatus !== "authenticated" || !id) {
      setIsWishlisted(false);
      return;
    }

    let cancelled = false;

    const checkWishlist = async () => {
      try {
        const res = await fetch(
          `/api/shop/wishlist/check?productIds=${encodeURIComponent(id)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { productIds: string[] };
        if (!cancelled) {
          setIsWishlisted(data.productIds.includes(id));
        }
      } catch {
        // Nuốt lỗi – không cần toast cho check ban đầu
      }
    };

    void checkWishlist();

    return () => {
      cancelled = true;
    };
  }, [id, sessionStatus]);

  const handleQuantityChange = (delta: number) => {
    if (!product) return;
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > product.stock && product.stock > 0) return product.stock;
      return next;
    });
  };

  const ensureAuthenticated = (): boolean => {
    if (sessionStatus === "authenticated" && session?.user) {
      return true;
    }
    toast.info("Vui lòng đăng nhập để sử dụng giỏ hàng.");
    router.push("/login");
    return false;
  };

  const handleAddToCart = async () => {
    if (!product) return;
    if (!ensureAuthenticated() || isAddingToCart) return;

    try {
      setIsAddingToCart(true);

      const res = await fetch("/api/shop/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          quantity,
        }),
      });

      if (!res.ok) {
        const errorJson = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        const message =
          errorJson?.error ??
          (res.status === 401
            ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            : "Không thể thêm sản phẩm vào giỏ hàng.");
        toast.error(message);
        if (res.status === 401) {
          router.push("/login");
        }
        return;
      }

      const data = (await res.json()) as AddToCartResponseDto;

      refreshCartCount();
      toast.success(data.message ?? `Đã thêm ${quantity} x ${product.name} vào giỏ hàng.`);
    } catch {
      toast.error("Không thể thêm sản phẩm vào giỏ hàng. Vui lòng thử lại.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    toast.success("Đang chuyển đến trang thanh toán...");
  };

  const handleWishlist = async () => {
    if (!product) return;
    if (!ensureAuthenticated() || isTogglingWishlist) return;

    try {
      setIsTogglingWishlist(true);

      const res = await fetch("/api/shop/wishlist/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId: product.id }),
      });

      if (!res.ok) {
        const errorJson = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        const message =
          errorJson?.error ??
          "Không thể cập nhật danh sách yêu thích. Vui lòng thử lại.";
        toast.error(message);
        return;
      }

      const data = (await res.json()) as ToggleWishlistResponseDto;
      setIsWishlisted(data.action === "added");

      toast.success(
        data.action === "added"
          ? "Đã thêm vào danh sách yêu thích."
          : "Đã xóa khỏi danh sách yêu thích.",
      );
    } catch {
      toast.error("Không thể cập nhật danh sách yêu thích. Vui lòng thử lại.");
    } finally {
      setIsTogglingWishlist(false);
    }
  };

  // Keyboard handler cho lightbox
  useEffect(() => {
    if (!isLightboxOpen || !product) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsLightboxOpen(false);
      if (e.key === "ArrowRight") setActiveImageIdx((p) => (p + 1) % product.images.length);
      if (e.key === "ArrowLeft")
        setActiveImageIdx((p) => (p - 1 + product.images.length) % product.images.length);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isLightboxOpen, product]);

  const activeImage = product?.images[activeImageIdx] ?? null;
  const hasDiscount =
    product?.salePrice != null && product.salePrice < product.price;
  const discountPct = hasDiscount
    ? getDiscountPercent(product!.price, product!.salePrice!)
    : 0;
  const effectivePrice = hasDiscount ? product!.salePrice! : (product?.price ?? 0);

  const stockStatus: "available" | "low" | "soldout" =
    !product || product.stock === 0
      ? "soldout"
      : product.stock <= 5
        ? "low"
        : "available";

  const TAG_QUESTION_MAP: Record<string, string> = {
    "home-cinema": "Loa này dùng cho home cinema có tốt không?",
    "hi-end": "Sản phẩm này có xứng tầm Hi-end không?",
    "phong-20-30m2": "Phòng khách 25m² có phù hợp không?",
    "phong-30m2": "Phòng khách 35m² dùng được không?",
    "phong-10-15m2": "Phòng ngủ nhỏ dùng có ổn không?",
    "2-kenh": "Phối ghép với ampli 2 kênh nào tốt nhất?",
    "2-1-kenh": "Cần thêm subwoofer không?",
    "bolero": "Nghe nhạc bolero, nhạc vàng có hay không?",
    "nhac-co-dien": "Nghe nhạc cổ điển, thính phòng thế nào?",
    "nhac-jazz": "Nghe jazz, acoustic có tốt không?",
    "karaoke": "Dùng cho dàn karaoke gia đình được không?",
    "bluetooth": "Kết nối bluetooth có ổn định không?",
    "tube-amp": "Phối với ampli đèn nào phù hợp?",
    "solid-state": "Phối với ampli bán dẫn nào?",
    "tam-trung": "Tầm trung này có gì nổi bật không?",
    "entry-level": "Đây có phải lựa chọn tốt cho người mới?",
    "dac": "Cần thêm DAC ngoài không?",
    "streaming": "Tích hợp streaming như thế nào?",
    "loa-bookshelf": "Loa bookshelf có phù hợp phòng nhỏ không?",
    "loa-floor": "Loa đứng cần không gian bao nhiêu m²?",
  };

  const aiSuggestions =
    product?.aiTags?.slice(0, 4).map((tag) => {
      return TAG_QUESTION_MAP[tag] ?? `Tư vấn về ${tag}?`;
    }) ?? [
      "Phòng khách 25m² có phù hợp?",
      "Phối ghép ampli nào tốt?",
      "So sánh với sản phẩm khác?",
      "Tối ưu âm trầm như thế nào?",
    ];

  // ======================== RENDER ========================

  if (!isLoading && error) {
    return (
      <div className={styles["product-detail-page"]}>
        <PageTransitionOverlay
          isActive={isTransitionActive}
          subtitle="Đang tải thông tin sản phẩm..."
          bottomText="Đức Uy Audio – Trải nghiệm âm thanh cao cấp"
        />
        <ShopHeader />
        <div className={styles["product-detail-page__error-state"]}>
          <MdWarning className={styles["product-detail-page__error-icon"]} aria-hidden="true" />
          <p className={styles["product-detail-page__error-title"]}>{error}</p>
          <button
            type="button"
            className={styles["product-detail-page__error-retry"]}
            onClick={fetchProduct}
          >
            Thử lại
          </button>
        </div>
        <ShopFooter />
      </div>
    );
  }

  return (
    <div className={styles["product-detail-page"]}>
      <PageTransitionOverlay
        isActive={isTransitionActive}
        subtitle="Đang tải thông tin sản phẩm..."
        bottomText="Đức Uy Audio – Trải nghiệm âm thanh Hi-end"
      />

      <ShopHeader />

      {/* ===== BREADCRUMB ===== */}
      <nav className={styles["product-detail-page__breadcrumb"]} aria-label="Breadcrumb">
        <div className={styles["product-detail-page__breadcrumb-inner"]}>
          <ol className={styles["product-detail-page__breadcrumb-list"]}>
            <li>
              <Link href="/" className={styles["product-detail-page__breadcrumb-link"]}>
                Trang chủ
              </Link>
            </li>
            <li className={styles["product-detail-page__breadcrumb-sep"]} aria-hidden="true">
              <MdChevronRight />
            </li>
            <li>
              <Link href="/products" className={styles["product-detail-page__breadcrumb-link"]}>
                Sản phẩm
              </Link>
            </li>
            {product?.category && (
              <>
                <li className={styles["product-detail-page__breadcrumb-sep"]} aria-hidden="true">
                  <MdChevronRight />
                </li>
                <li>
                  <Link
                    href={`/products?categoryId=${product.category.id}`}
                    className={styles["product-detail-page__breadcrumb-link"]}
                  >
                    {product.category.name}
                  </Link>
                </li>
              </>
            )}
            <li className={styles["product-detail-page__breadcrumb-sep"]} aria-hidden="true">
              <MdChevronRight />
            </li>
            <li
              className={styles["product-detail-page__breadcrumb-current"]}
              aria-current="page"
            >
              {product?.name ?? "Đang tải..."}
            </li>
          </ol>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className={styles["product-detail-page__hero"]}>
        <div className={styles["product-detail-page__hero-inner"]}>
          {isLoading ? (
            <div className={styles["product-detail-page__skeleton-hero"]}>
              <div className={styles["product-detail-page__skeleton-gallery"]} />
              <div className={styles["product-detail-page__skeleton-buybox"]} />
            </div>
          ) : product ? (
            <div className={styles["product-detail-page__hero-grid"]}>
              {/* === GALLERY === */}
              <div className={styles["product-detail-page__gallery"]}>
                {/* Main image */}
                <div
                  className={styles["product-detail-page__gallery-main"]}
                  onClick={() => product.images.length > 0 && setIsLightboxOpen(true)}
                  role="button"
                  tabIndex={0}
                  aria-label="Phóng to ảnh sản phẩm"
                  onKeyDown={(e) => e.key === "Enter" && setIsLightboxOpen(true)}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeImageIdx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className={styles["product-detail-page__gallery-main-img-wrapper"]}
                    >
                      {activeImage ? (
                        <Image
                          src={
                            getCloudinaryUrl(activeImage.url, {
                              width: 900,
                              quality: "auto:best",
                            }) ?? activeImage.url
                          }
                          alt={activeImage.alt ?? product.name}
                          fill
                          sizes="(min-width: 1024px) 55vw, 100vw"
                          className={styles["product-detail-page__gallery-main-img"]}
                          unoptimized
                          priority
                        />
                      ) : (
                        <div className={styles["product-detail-page__gallery-placeholder"]} />
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {hasDiscount && (
                    <span className={styles["product-detail-page__gallery-badge"]}>
                      Sale -{discountPct}%
                    </span>
                  )}
                  {stockStatus === "soldout" && (
                    <div className={styles["product-detail-page__gallery-soldout-overlay"]}>
                      <span>Hết hàng</span>
                    </div>
                  )}
                  {product.images.length > 0 && (
                    <button
                      type="button"
                      className={styles["product-detail-page__gallery-zoom-btn"]}
                      aria-label="Phóng to ảnh"
                    >
                      <MdZoomIn aria-hidden="true" />
                    </button>
                  )}

                  {/* Prev/Next arrows */}
                  {product.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        className={`${styles["product-detail-page__gallery-arrow"]} ${styles["product-detail-page__gallery-arrow--prev"]}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveImageIdx(
                            (p) => (p - 1 + product.images.length) % product.images.length,
                          );
                        }}
                        aria-label="Ảnh trước"
                      >
                        <MdChevronLeft aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`${styles["product-detail-page__gallery-arrow"]} ${styles["product-detail-page__gallery-arrow--next"]}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveImageIdx((p) => (p + 1) % product.images.length);
                        }}
                        aria-label="Ảnh tiếp theo"
                      >
                        <MdChevronRight aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnails */}
                {product.images.length > 1 && (
                  <div className={styles["product-detail-page__gallery-thumbs"]}>
                    {product.images.map((img, idx) => (
                      <button
                        key={img.id}
                        type="button"
                        className={`${styles["product-detail-page__gallery-thumb"]} ${idx === activeImageIdx
                          ? styles["product-detail-page__gallery-thumb--active"]
                          : ""
                          }`}
                        onClick={() => setActiveImageIdx(idx)}
                        aria-label={`Xem ảnh ${idx + 1}`}
                      >
                        <Image
                          src={
                            getCloudinaryUrl(img.url, {
                              width: 200,
                              quality: "auto:eco",
                            }) ?? img.url
                          }
                          alt={img.alt ?? product.name}
                          fill
                          sizes="72px"
                          className={styles["product-detail-page__gallery-thumb-img"]}
                          unoptimized
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* === BUY BOX === */}
              <div className={styles["product-detail-page__buy-box"]}>
                {/* Brand & rating row */}
                <div className={styles["product-detail-page__buy-box-top-row"]}>
                  <div className={styles["product-detail-page__buy-box-brand"]}>
                    <MdVerified
                      className={styles["product-detail-page__buy-box-brand-icon"]}
                      aria-hidden="true"
                    />
                    <span className={styles["product-detail-page__buy-box-brand-name"]}>
                      {product.brand?.name ?? "Thương hiệu"}
                    </span>
                  </div>
                  {product.reviewStats.totalReviews > 0 && (
                    <button
                      type="button"
                      className={styles["product-detail-page__buy-box-rating-btn"]}
                      onClick={() => setActiveTab("reviews")}
                    >
                      <MdStar
                        className={styles["product-detail-page__buy-box-rating-star"]}
                        aria-hidden="true"
                      />
                      <span className={styles["product-detail-page__buy-box-rating-score"]}>
                        {product.reviewStats.avgRating.toFixed(1)}
                      </span>
                      <span className={styles["product-detail-page__buy-box-rating-count"]}>
                        ({product.reviewStats.totalReviews} đánh giá)
                      </span>
                    </button>
                  )}
                </div>

                {/* Status pills */}
                <div className={styles["product-detail-page__buy-box-pills"]}>
                  <span className={styles["product-detail-page__buy-box-pill-new"]}>
                    Mới về
                  </span>
                  <span
                    className={`${styles["product-detail-page__buy-box-stock"]} ${styles[`product-detail-page__buy-box-stock--${stockStatus}`]}`}
                  >
                    <span className={styles["product-detail-page__buy-box-stock-dot"]} />
                    {stockStatus === "available" && "Còn hàng"}
                    {stockStatus === "low" && `Chỉ còn ${product.stock} sản phẩm`}
                    {stockStatus === "soldout" && "Tạm hết hàng"}
                  </span>
                </div>

                {/* Product name */}
                <h1 className={styles["product-detail-page__buy-box-title"]}>
                  {product.name}
                </h1>

                {/* Price block */}
                <div className={styles["product-detail-page__buy-box-price-block"]}>
                  <div className={styles["product-detail-page__buy-box-price-row"]}>
                    <span className={styles["product-detail-page__buy-box-price-main"]}>
                      {formatPrice(effectivePrice, product.currency)}
                    </span>
                    {hasDiscount && (
                      <span className={styles["product-detail-page__buy-box-price-old"]}>
                        {formatPrice(product.price, product.currency)}
                      </span>
                    )}
                  </div>
                  <p className={styles["product-detail-page__buy-box-price-note"]}>
                    * Đã bao gồm thuế VAT và phí vận chuyển nội thành.
                  </p>
                </div>

                {/* Divider */}
                <div className={styles["product-detail-page__buy-box-divider"]} />

                {/* Quantity */}
                <div className={styles["product-detail-page__buy-box-qty-row"]}>
                  <span className={styles["product-detail-page__buy-box-qty-label"]}>
                    Số lượng:
                  </span>
                  <div className={styles["product-detail-page__buy-box-qty"]}>
                    <button
                      type="button"
                      className={styles["product-detail-page__buy-box-qty-btn"]}
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      aria-label="Giảm số lượng"
                    >
                      <MdRemove aria-hidden="true" />
                    </button>
                    <span className={styles["product-detail-page__buy-box-qty-value"]}>
                      {quantity}
                    </span>
                    <button
                      type="button"
                      className={styles["product-detail-page__buy-box-qty-btn"]}
                      onClick={() => handleQuantityChange(1)}
                      disabled={stockStatus === "soldout" || quantity >= product.stock}
                      aria-label="Tăng số lượng"
                    >
                      <MdAdd aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className={styles["product-detail-page__buy-box-cta"]}>
                  <button
                    type="button"
                    className={styles["product-detail-page__buy-box-cta-add"]}
                    onClick={handleAddToCart}
                    disabled={stockStatus === "soldout" || isAddingToCart}
                  >
                    <MdShoppingCartCheckout aria-hidden="true" />
                    Thêm vào giỏ
                  </button>
                  <button
                    type="button"
                    className={styles["product-detail-page__buy-box-cta-buy"]}
                    onClick={handleBuyNow}
                    disabled={stockStatus === "soldout"}
                  >
                    Mua ngay
                  </button>
                </div>

                {/* Mini Trust Cards */}
                <div className={styles["product-detail-page__buy-box-mini-trust"]}>
                  <div className={styles["product-detail-page__buy-box-mini-trust-card"]}>
                    <MdLocalShipping
                      className={styles["product-detail-page__buy-box-mini-trust-icon"]}
                      aria-hidden="true"
                    />
                    <div>
                      <p className={styles["product-detail-page__buy-box-mini-trust-title"]}>
                        Miễn phí giao hàng
                      </p>
                      <p className={styles["product-detail-page__buy-box-mini-trust-sub"]}>
                        Toàn quốc từ 2-4h
                      </p>
                    </div>
                  </div>
                  <div className={styles["product-detail-page__buy-box-mini-trust-card"]}>
                    <MdVerifiedUser
                      className={styles["product-detail-page__buy-box-mini-trust-icon"]}
                      aria-hidden="true"
                    />
                    <div>
                      <p className={styles["product-detail-page__buy-box-mini-trust-title"]}>
                        Bảo hành 12 tháng
                      </p>
                      <p className={styles["product-detail-page__buy-box-mini-trust-sub"]}>
                        Chính hãng {product.brand?.name ?? ""}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Wishlist */}
                <button
                  type="button"
                  className={styles["product-detail-page__buy-box-wishlist"]}
                  onClick={handleWishlist}
                  disabled={isTogglingWishlist}
                >
                  {isWishlisted ? (
                    <MdFavorite
                      className={styles["product-detail-page__buy-box-wishlist-icon--active"]}
                      aria-hidden="true"
                    />
                  ) : (
                    <MdFavoriteBorder aria-hidden="true" />
                  )}
                  {isWishlisted ? "Đã yêu thích" : "Thêm vào yêu thích"}
                </button>

                {/* AI Compare Button */}
                {product.relatedProducts.length > 0 && (
                  <button
                    type="button"
                    className={styles["product-detail-page__buy-box-compare"]}
                    onClick={() => setIsCompareOpen(true)}
                  >
                    <MdCompare aria-hidden="true" />
                    So sánh chi tiết bằng AI
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ===== TABS SECTION ===== */}
      {product && (
        <section className={styles["product-detail-page__tabs-section"]}>
          {/* Sticky tab nav */}
          <div className={styles["product-detail-page__tabs-nav"]}>
            <div className={styles["product-detail-page__tabs-nav-inner"]}>
              {(
                [
                  { key: "description", label: "Mô tả" },
                  { key: "specs", label: "Thông số" },
                  {
                    key: "reviews",
                    label: `Đánh giá${product.reviewStats.totalReviews > 0 ? ` (${product.reviewStats.totalReviews})` : ""}`,
                  },
                  { key: "ai", label: "AI Tư vấn", icon: true },
                ] as { key: TabKey; label: string; icon?: boolean }[]
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`${styles["product-detail-page__tab-btn"]} ${activeTab === tab.key ? styles["product-detail-page__tab-btn--active"] : ""
                    }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.icon && (
                    <MdSmartToy
                      className={styles["product-detail-page__tab-btn-icon"]}
                      aria-hidden="true"
                    />
                  )}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className={styles["product-detail-page__tab-content"]}>
            <AnimatePresence mode="wait">
              {/* === Tab: Mô tả === */}
              {activeTab === "description" && (
                <motion.div
                  key="description"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className={styles["product-detail-page__tab-description"]}
                >
                  <div className={styles["product-detail-page__tab-content-inner"]}>
                    <h2 className={styles["product-detail-page__tab-heading"]}>
                      Mô tả sản phẩm
                    </h2>
                    <div className={styles["product-detail-page__description-body"]}>
                      {product.description.split("\n").map((para, i) =>
                        para.trim() ? <p key={i}>{para}</p> : null,
                      )}
                    </div>
                    {product.aiTags.length > 0 && (
                      <div className={styles["product-detail-page__ai-tags"]}>
                        {product.aiTags.map((tag) => (
                          <span key={tag} className={styles["product-detail-page__ai-tag"]}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* === Tab: Thông số === */}
              {activeTab === "specs" && (
                <motion.div
                  key="specs"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className={styles["product-detail-page__tab-specs"]}
                >
                  <div className={styles["product-detail-page__tab-content-inner"]}>
                    <h2 className={styles["product-detail-page__tab-heading"]}>
                      Thông số kỹ thuật
                    </h2>
                    <div className={styles["product-detail-page__specs-placeholder"]}>
                      <MdSmartToy
                        className={styles["product-detail-page__specs-placeholder-icon"]}
                        aria-hidden="true"
                      />
                      <p>Thông số kỹ thuật chi tiết đang được cập nhật.</p>
                      <p className={styles["product-detail-page__specs-placeholder-sub"]}>
                        Vui lòng liên hệ Đức Uy Audio hoặc sử dụng tab AI Tư vấn để được hỗ
                        trợ thêm.
                      </p>
                      <button
                        type="button"
                        className={styles["product-detail-page__specs-ai-cta"]}
                        onClick={() => setActiveTab("ai")}
                      >
                        <MdSmartToy aria-hidden="true" />
                        Hỏi AI về thông số
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* === Tab: Đánh giá === */}
              {activeTab === "reviews" && (
                <motion.div
                  key="reviews"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className={styles["product-detail-page__tab-reviews"]}
                >
                  <div className={styles["product-detail-page__tab-content-inner"]}>
                    <h2 className={styles["product-detail-page__tab-heading"]}>
                      Đánh giá từ khách hàng
                    </h2>
                    <ReviewsSection
                      reviews={product.reviews}
                      reviewStats={product.reviewStats}
                      styles={styles}
                      currentUserId={session?.user?.id}
                      onEdit={(rev) => setEditingReview(rev)}
                      onDelete={handleDeleteReview}
                    />
                  </div>
                </motion.div>
              )}

              {/* === Tab: AI Tư vấn === */}
              {activeTab === "ai" && (
                <motion.div
                  key="ai"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className={styles["product-detail-page__tab-ai"]}
                >
                  <AiChatPanel
                    sessionKey={product.id}
                    productName={product.name}
                    suggestions={aiSuggestions}
                    compact
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* ===== TRUST BADGES ===== */}
      <section className={styles["product-detail-page__trust"]}>
        <div className={styles["product-detail-page__trust-inner"]}>
          <div className={styles["product-detail-page__trust-grid"]}>
            {[
              {
                icon: <MdLocalShipping aria-hidden="true" />,
                title: "Miễn phí giao hàng",
                sub: "Đơn hàng trên 2.000.000đ",
              },
              {
                icon: <MdVerifiedUser aria-hidden="true" />,
                title: "Bảo hành 12 tháng",
                sub: "Hỗ trợ kỹ thuật trọn đời",
              },
              {
                icon: <MdPublishedWithChanges aria-hidden="true" />,
                title: "Đổi trả 7 ngày",
                sub: "Lỗi nhà sản xuất 1 đổi 1",
              },
              {
                icon: <MdPayments aria-hidden="true" />,
                title: "Trả góp 0%",
                sub: "Thủ tục nhanh chóng đơn giản",
              },
            ].map((badge, idx) => (
              <div key={idx} className={styles["product-detail-page__trust-card"]}>
                <div className={styles["product-detail-page__trust-card-icon"]}>
                  {badge.icon}
                </div>
                <div>
                  <h4 className={styles["product-detail-page__trust-card-title"]}>
                    {badge.title}
                  </h4>
                  <p className={styles["product-detail-page__trust-card-sub"]}>{badge.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== RELATED PRODUCTS ===== */}
      {product && product.relatedProducts.length > 0 && (
        <section className={styles["product-detail-page__related"]}>
          <div className={styles["product-detail-page__related-inner"]}>
            <div className={styles["product-detail-page__related-header"]}>
              <div>
                <h2 className={styles["product-detail-page__related-title"]}>
                  Sản phẩm tương tự
                </h2>
                <p className={styles["product-detail-page__related-sub"]}>
                  Những lựa chọn Hi-end khác dành cho bạn
                </p>
              </div>
              <Link href="/products" className={styles["product-detail-page__related-see-all"]}>
                Xem tất cả
                <MdArrowForward aria-hidden="true" />
              </Link>
            </div>
            <div className={styles["product-detail-page__related-grid"]}>
              {product.relatedProducts.map((rp) => (
                <RelatedProductCard key={rp.id} product={rp} styles={styles} />
              ))}
            </div>
          </div>
        </section>
      )}

      <ShopFooter />

      {/* ===== LIGHTBOX ===== */}
      <AnimatePresence>
        {isLightboxOpen && activeImage && product && (
          <motion.div
            className={styles["product-detail-page__lightbox"]}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsLightboxOpen(false)}
            role="dialog"
            aria-label="Lightbox ảnh sản phẩm"
          >
            <button
              type="button"
              className={styles["product-detail-page__lightbox-close"]}
              onClick={() => setIsLightboxOpen(false)}
              aria-label="Đóng"
            >
              <MdClose aria-hidden="true" />
            </button>
            <div
              className={styles["product-detail-page__lightbox-img-wrap"]}
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={activeImage.url}
                alt={activeImage.alt ?? product.name}
                fill
                className={styles["product-detail-page__lightbox-img"]}
                sizes="100vw"
              />
            </div>
            {product.images.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${styles["product-detail-page__lightbox-arrow"]} ${styles["product-detail-page__lightbox-arrow--prev"]}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIdx(
                      (p) => (p - 1 + product.images.length) % product.images.length,
                    );
                  }}
                  aria-label="Ảnh trước"
                >
                  <MdChevronLeft aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`${styles["product-detail-page__lightbox-arrow"]} ${styles["product-detail-page__lightbox-arrow--next"]}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIdx((p) => (p + 1) % product.images.length);
                  }}
                  aria-label="Ảnh tiếp theo"
                >
                  <MdChevronRight aria-hidden="true" />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {editingReview && product && (
        <ReviewModal
          isOpen={!!editingReview}
          onClose={() => setEditingReview(null)}
          productId={product.id}
          productName={product.name}
          onSuccess={() => {
            fetchProduct();
            setEditingReview(null);
          }}
        />
      )}

      {/* ===== AI COMPARE MODAL ===== */}
      <AnimatePresence>
        {isCompareOpen && product && (
          <div className={styles["product-detail-page__modal-overlay"]} onClick={() => setIsCompareOpen(false)}>
            <div className={styles["product-detail-page__modal-container"]} onClick={(e) => e.stopPropagation()}>
              <AiProductComparison
                products={[
                  {
                    id: product.id,
                    name: product.name,
                    image: product.images[0]?.url,
                  },
                  ...product.relatedProducts.slice(0, 2).map((rp) => ({
                    id: rp.id,
                    name: rp.name,
                    image: rp.primaryImageUrl || undefined,
                  })),
                ]}
                onClose={() => setIsCompareOpen(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==============================
// Sub-components
// ==============================

type ReviewsSectionProps = {
  reviews: ReviewDto[];
  reviewStats: ProductDetailResponseDto["reviewStats"];
  styles: Record<string, string>;
  currentUserId?: string;
  onEdit?: (review: ReviewDto) => void;
  onDelete?: (reviewId: string) => void;
};

function ReviewsSection({ reviews, reviewStats, styles, currentUserId, onEdit, onDelete }: ReviewsSectionProps) {
  return (
    <div className={styles["product-detail-page__reviews-layout"]}>
      <div className={styles["product-detail-page__reviews-summary"]}>
        <ReviewStats
          avgRating={reviewStats.avgRating}
          totalReviews={reviewStats.totalReviews}
          distribution={reviewStats.distribution}
        />
      </div>

      <div className={styles["product-detail-page__reviews-list"]}>
        <ReviewList
          reviews={reviews}
          currentUserId={currentUserId}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

type RelatedProductCardProps = {
  product: ProductCardDto;
  styles: Record<string, string>;
};

function RelatedProductCard({ product, styles }: RelatedProductCardProps) {
  const hasDiscount = product.salePrice != null && product.salePrice < product.price;
  const effectivePrice = hasDiscount ? product.salePrice! : product.price;

  return (
    <Link href={`/products/${product.id}`} className={styles["product-detail-page__related-card"]}>
      <div className={styles["product-detail-page__related-card-img-wrap"]}>
        {product.primaryImageUrl ? (
          <Image
            src={
              getCloudinaryUrl(product.primaryImageUrl, {
                width: 400,
                quality: "auto:eco",
              }) ?? product.primaryImageUrl
            }
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className={styles["product-detail-page__related-card-img"]}
            unoptimized
          />
        ) : (
          <div className={styles["product-detail-page__related-card-placeholder"]} />
        )}
        <button
          type="button"
          className={styles["product-detail-page__related-card-wishlist"]}
          onClick={(e) => {
            e.preventDefault();
            toast.success(`Đã thêm ${product.name} vào yêu thích`);
          }}
          aria-label="Thêm vào yêu thích"
        >
          <MdFavoriteBorder aria-hidden="true" />
        </button>
      </div>
      <div className={styles["product-detail-page__related-card-body"]}>
        <p className={styles["product-detail-page__related-card-brand"]}>
          {product.brandName ?? product.categoryName ?? "Sản phẩm"}
        </p>
        <h3 className={styles["product-detail-page__related-card-name"]}>{product.name}</h3>
        <div className={styles["product-detail-page__related-card-footer"]}>
          <span className={styles["product-detail-page__related-card-price"]}>
            {new Intl.NumberFormat("vi-VN", {
              style: "currency",
              currency: "VND",
              maximumFractionDigits: 0,
            }).format(effectivePrice)}
          </span>
          <button
            type="button"
            className={styles["product-detail-page__related-card-add"]}
            onClick={(e) => {
              e.preventDefault();
              toast.success(`Đã thêm ${product.name} vào giỏ hàng`);
            }}
            aria-label="Thêm vào giỏ hàng"
          >
            <MdAddShoppingCart aria-hidden="true" />
          </button>
        </div>
      </div>
    </Link>
  );
}
