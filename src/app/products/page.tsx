"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  MdChevronRight,
  MdClose,
  MdTune,
  MdExpandMore,
  MdFavoriteBorder,
  MdAddShoppingCart,
  MdChevronLeft,
  MdChevronRight as MdChevronRightIcon,
  MdAutoAwesome,
  MdExpandMore as MdExpandMoreSmall,
  MdWarning,
} from "react-icons/md";
import { toast } from "sonner";
import type { BrandFilterItemDto } from "@/types/shop";
import ShopHeader from "@/components/layout/ShopHeader";
import ShopFooter from "@/components/layout/ShopFooter";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import ProductCardSkeleton from "@/components/shared/ProductCardSkeleton";
import { getCloudinaryUrl } from "@/utils/cloudinary-url";
import { useCartContext } from "@/features/shop/context/CartContext";
import type {
  ProductCardDto,
  ProductListResponseDto,
  ToggleWishlistResponseDto,
} from "@/types/shop";
import type { CategorySidebarItemDto } from "@/app/api/shop/categories/route";
import styles from "./page.module.css";

type SortOption = "newest" | "price_asc" | "price_desc" | "name_asc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Mới nhất" },
  { value: "price_asc", label: "Giá tăng dần" },
  { value: "price_desc", label: "Giá giảm dần" },
  { value: "name_asc", label: "Tên A - Z" },
];

function formatPrice(amount: number, currency: string): string {
  if (currency === "VND") {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function getDiscountPercent(price: number, salePrice: number): number {
  return Math.round(((price - salePrice) / price) * 100);
}

function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const { refreshCartCount } = useCartContext();
  const [products, setProducts] = useState<ProductCardDto[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState<SortOption>("newest");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitionActive, setIsTransitionActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [categories, setCategories] = useState<CategorySidebarItemDto[]>([]);
  const [brands, setBrands] = useState<BrandFilterItemDto[]>([]);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [wishedProductIds, setWishedProductIds] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState<string>(
    () => searchParams.get("search")?.trim() ?? "",
  );
  const [onSaleOnly, setOnSaleOnly] = useState<boolean>(
    () => searchParams.get("onSale") === "true",
  );
  const [activePromotionId, setActivePromotionId] = useState<string | null>(null);

  // AI Recommendation state
  const [aiBudget, setAiBudget] = useState(50);
  const [aiRoomType, setAiRoomType] = useState("living");
  const [aiMusicTaste, setAiMusicTaste] = useState("bolero");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<{
    expertVerdict: string;
    recommendedProducts: any[];
  } | null>(null);

  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tắt PageTransitionOverlay sau 1100ms khi lần đầu vào trang
  useEffect(() => {
    transitionTimerRef.current = setTimeout(() => {
      setIsTransitionActive(false);
    }, 1100);

    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  // Đồng bộ searchTerm với query string (?search=...)
  useEffect(() => {
    const nextSearch = searchParams.get("search")?.trim() ?? "";
    const nextCategoryId = searchParams.get("categoryId")?.trim() ?? null;
    const nextBrandId = searchParams.get("brandId")?.trim() ?? null;
    const onSaleParam = searchParams.get("onSale");
    const nextOnSaleOnly = onSaleParam === "true";
    const nextPromotionId = searchParams.get("promotionId")?.trim() ?? null;

    setSearchTerm(nextSearch);
    setActiveCategoryId(nextCategoryId);
    setActiveBrandId(nextBrandId);
    setOnSaleOnly(nextOnSaleOnly);
    setActivePromotionId(nextPromotionId);
    setCurrentPage(1);
  }, [searchParams]);

  // Fetch danh mục & thương hiệu một lần khi mount
  useEffect(() => {
    fetch("/api/shop/categories")
      .then((r) => r.json())
      .then((json: { data: CategorySidebarItemDto[] }) => setCategories(json.data))
      .catch(() => {});

    fetch("/api/shop/brands")
      .then((r) => r.json())
      .then((json: { items: BrandFilterItemDto[] }) => {
        setBrands(json.items);
      })
      .catch(() => {});
  }, []);

  const fetchProducts = useCallback(
    async (
      page: number,
      sortBy: SortOption,
      categoryId: string | null,
      search: string,
      brandId: string | null,
      onSale: boolean,
      promotionId: string | null,
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          sort: sortBy,
        });
        if (categoryId) params.set("categoryId", categoryId);
        if (search) params.set("search", search);
        if (brandId) params.set("brandId", brandId);
        if (onSale) params.set("onSale", "true");
        if (promotionId) params.set("promotionId", promotionId);

        const res = await fetch(`/api/shop/products?${params.toString()}`);
        if (!res.ok) throw new Error("Không thể tải danh sách sản phẩm.");
        const json = (await res.json()) as ProductListResponseDto;

        setProducts(json.data);
        setTotal(json.total);
        setTotalPages(json.totalPages);
        setCurrentPage(json.page);
      } catch {
        setError("Có lỗi xảy ra khi tải sản phẩm. Vui lòng thử lại.");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
      fetchProducts(
        currentPage,
        sort,
        activeCategoryId,
        searchTerm,
        activeBrandId,
        onSaleOnly,
        activePromotionId,
      );
    const timer = fetchTimerRef.current;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    fetchProducts,
    currentPage,
    sort,
    activeCategoryId,
    activeBrandId,
    onSaleOnly,
    activePromotionId,
    searchTerm,
  ]);

  // Bulk check wishlist cho danh sách sản phẩm hiện tại
  useEffect(() => {
    if (
      sessionStatus !== "authenticated" ||
      !session?.user?.id ||
      products.length === 0
    ) {
      setWishedProductIds(new Set());
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const ids = products.map((p) => p.id);
        const params = new URLSearchParams({
          productIds: ids.join(","),
        });
        const res = await fetch(`/api/shop/wishlist/check?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { productIds: string[] };
        if (!cancelled) {
          setWishedProductIds(new Set(data.productIds));
        }
      } catch {
        // bỏ qua lỗi – không ảnh hưởng render chính
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [products, session?.user?.id, sessionStatus]);

  const ensureAuthenticated = (): boolean => {
    if (sessionStatus === "authenticated" && session?.user) {
      return true;
    }
    router.push("/login");
    return false;
  };

  const handleToggleWishlist = async (product: ProductCardDto) => {
    if (!ensureAuthenticated()) return;
    if (togglingIds.has(product.id)) return;

    setTogglingIds((prev) => new Set(prev).add(product.id));

    try {
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
        console.error("[ProductsPage][wishlist]", message);
        return;
      }

      const data = (await res.json()) as ToggleWishlistResponseDto;

      setWishedProductIds((prev) => {
        const next = new Set(prev);
        if (data.action === "added") {
          next.add(product.id);
          toast.success(`Đã thêm ${product.name} vào danh sách yêu thích`);
        } else {
          next.delete(product.id);
          toast.info(`Đã xóa ${product.name} khỏi danh sách yêu thích`);
        }
        return next;
      });
    } catch {
      console.error(
        "[ProductsPage][wishlist] Failed to toggle wishlist item for product",
        product.id,
      );
      toast.error("Đã xảy ra lỗi khi cập nhật danh sách yêu thích.");
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const handleAddToCart = async (product: ProductCardDto) => {
    if (!ensureAuthenticated()) return;

    try {
      const res = await fetch("/api/shop/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
        }),
      });

      if (!res.ok) {
        const errorJson = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        const message =
          errorJson?.error ??
          "Không thể thêm sản phẩm vào giỏ hàng. Vui lòng thử lại.";
        console.error("[ProductsPage][cart]", message);
        toast.error(message);
        return;
      }

      refreshCartCount();
      toast.success(`Đã thêm ${product.name} vào giỏ hàng thành công!`);
    } catch {
      console.error(
        "[ProductsPage][cart] Failed to add product to cart",
        product.id,
      );
      toast.error("Đã xảy ra lỗi khi thêm sản phẩm vào giỏ hàng.");
    }
  };

  const handlePageChange = (page: number) => {
    if (page === currentPage || page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSortChange = (value: SortOption) => {
    setSort(value);
    setCurrentPage(1);
    setIsSortOpen(false);
  };

  const handleCategoryClick = (id: string | null) => {
    setActiveCategoryId(id);
    setCurrentPage(1);
  };

  const handleAiAnalyze = async () => {
    setIsAnalyzing(true);
    setRecommendation(null);
    try {
      const res = await fetch("/api/shop/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget: `${aiBudget}.000.000`,
          roomType: aiRoomType,
          musicTaste: aiMusicTaste,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setRecommendation(data);
      // Scroll to recommendation
      window.scrollTo({ top: 300, behavior: "smooth" });
    } catch (error) {
      console.error("AI Recommendation failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderPaginationButtons = () => {
    const pages: (number | "ellipsis")[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }

    return pages;
  };

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sắp xếp";

  return (
    <div className={styles["products-page-page"]}>
      <PageTransitionOverlay
        isActive={isTransitionActive}
        subtitle="Đang tải bộ sưu tập sản phẩm dành riêng cho bạn..."
        bottomText="Đức Uy Audio đang sắp xếp các cấu hình Hi-end phù hợp."
      />
      <ShopHeader />

      {/* Breadcrumb + header */}
      <section className={styles["products-page-page__breadcrumb-section"]}>
        <div className={styles["products-page-page__breadcrumb-inner"]}>
          <nav
            aria-label="Breadcrumb"
            className={styles["products-page-page__breadcrumb-nav"]}
          >
            <Link href="/" className={styles["products-page-page__breadcrumb-link"]}>
              Trang chủ
            </Link>
            <span className={styles["products-page-page__breadcrumb-separator"]}>
              <MdChevronRight aria-hidden="true" />
            </span>
            <span className={styles["products-page-page__breadcrumb-link"]}>
              Sản phẩm
            </span>
            <span className={styles["products-page-page__breadcrumb-separator"]}>
              <MdChevronRight aria-hidden="true" />
            </span>
            <span
              className={styles["products-page-page__breadcrumb-current"]}
              aria-current="page"
            >
              Tất cả sản phẩm
            </span>
          </nav>

          <div className={styles["products-page-page__header-row"]}>
            <div className={styles["products-page-page__title-group"]}>
              <h1 className={styles["products-page-page__title"]}>
                Tất cả sản phẩm
                <span className={styles["products-page-page__title-pill"]}>
                  {total > 0 ? `${total}+ sản phẩm` : "Đang tải..."}
                </span>
              </h1>
            </div>

            <div className={styles["products-page-page__actions"]}>
              <div className={styles["products-page-page__actions-main"]}>
                <button
                  type="button"
                  className={styles["products-page-page__advanced-filter-button"]}
                  onClick={() => setIsAdvancedFilterOpen(true)}
                >
                  <span
                    className={
                      styles["products-page-page__advanced-filter-button-icon"]
                    }
                  >
                    <MdTune aria-hidden="true" />
                  </span>
                  Bộ lọc nâng cao
                </button>

                <div className={styles["products-page-page__filter-tags"]}>
                  {minPrice != null && maxPrice != null && (
                    <button
                      type="button"
                      className={styles["products-page-page__filter-tag"]}
                      onClick={() => {
                        setMinPrice(null);
                        setMaxPrice(null);
                      }}
                    >
                      <span>
                        Giá: {formatPrice(minPrice, "VND")} -{" "}
                        {formatPrice(maxPrice, "VND")}
                      </span>
                      <span
                        className={styles["products-page-page__filter-tag-icon"]}
                      >
                        <MdClose aria-hidden="true" />
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    className={`${styles["products-page-page__sale-toggle"]} ${
                      onSaleOnly
                        ? styles["products-page-page__sale-toggle--active"]
                        : ""
                    }`}
                    onClick={() => {
                      const next = !onSaleOnly;
                      setOnSaleOnly(next);
                      setCurrentPage(1);

                      const params = new URLSearchParams(window.location.search);
                      if (next) {
                        params.set("onSale", "true");
                      } else {
                        params.delete("onSale");
                      }

                      const queryString = params.toString();
                      const url = queryString
                        ? `/products?${queryString}`
                        : "/products";
                      router.push(url);
                    }}
                  >
                    <span>Đang giảm giá</span>
                  </button>
                </div>

                {/* Sort dropdown */}
                <div
                  className={styles["products-page-page__sort-dropdown"]}
                  style={{ position: "relative" }}
                >
                  <button
                    type="button"
                    className={styles["products-page-page__sort-button"]}
                    onClick={() => setIsSortOpen((v) => !v)}
                    aria-expanded={isSortOpen}
                    aria-haspopup="listbox"
                  >
                    <span>{currentSortLabel}</span>
                    <span className={styles["products-page-page__sort-button-icon"]}>
                      <MdExpandMore aria-hidden="true" />
                    </span>
                  </button>

                  {isSortOpen && (
                    <div className={styles["products-page-page__sort-menu"]}>
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`${styles["products-page-page__sort-menu-item"]} ${
                            sort === opt.value
                              ? styles["products-page-page__sort-menu-item--active"]
                              : ""
                          }`}
                          onClick={() => handleSortChange(opt.value)}
                          role="option"
                          aria-selected={sort === opt.value}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <main className={styles["products-page-page__content"]}>
        <div className={styles["products-page-page__layout"]}>
          {/* Product grid */}
          <section className={styles["products-page-page__products-column"]}>
            {recommendation && (
              <div
                className={styles["products-page-page__ai-recommendation-hero"]}
                style={{
                  marginBottom: "40px",
                  padding: "32px",
                  borderRadius: "24px",
                  background: "radial-gradient(circle at top left, rgba(29, 185, 84, 0.15), rgba(15, 23, 42, 0.98))",
                  border: "1px solid rgba(29, 185, 84, 0.3)",
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", color: "var(--primary)" }}>
                    <MdAutoAwesome style={{ fontSize: "24px" }} />
                    <h2 style={{ fontSize: "20px", fontWeight: 800, margin: 0 }}>Gợi Ý Chuyên Gia AI</h2>
                  </div>
                  <p style={{ fontSize: "14px", lineHeight: "1.6", color: "rgba(226, 232, 240, 0.9)", marginBottom: "24px" }}>
                    {recommendation.expertVerdict}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "20px" }}>
                    {recommendation.recommendedProducts.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          padding: "16px",
                          borderRadius: "16px",
                          background: "rgba(15, 23, 42, 0.6)",
                          border: "1px solid rgba(148, 163, 184, 0.2)",
                          cursor: "pointer"
                        }}
                        onClick={() => router.push(`/products/${p.id}`)}
                      >
                        <p style={{ fontSize: "10px", fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", marginBottom: "4px" }}>{p.brandName}</p>
                        <h4 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px" }}>{p.name}</h4>
                        <p style={{ fontSize: "14px", fontWeight: 900, color: "var(--accent)" }}>
                          {formatPrice(p.salePrice ?? p.price, "VND")}
                        </p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setRecommendation(null)}
                    style={{ position: "absolute", top: "0", right: "0", background: "none", border: "none", color: "rgba(148, 163, 184, 0.6)", cursor: "pointer", padding: "8px" }}
                  >
                    <MdClose />
                  </button>
                </div>
              </div>
            )}
            <div className={styles["products-page-page__grid-wrapper"]}>
              {error && !isLoading && (
                <div className={styles["products-page-page__error-state"]}>
                  <span className={styles["products-page-page__error-icon"]}>
                    <MdWarning aria-hidden="true" />
                  </span>
                  <p className={styles["products-page-page__error-title"]}>
                    Có lỗi xảy ra khi tải sản phẩm.
                  </p>
                  <p className={styles["products-page-page__error-subtitle"]}>
                    Vui lòng thử lại hoặc liên hệ hỗ trợ Đức Uy Audio.
                  </p>
                  <button
                    type="button"
                    className={styles["products-page-page__retry-button"]}
                    onClick={() =>
                      fetchProducts(
                        currentPage,
                        sort,
                        activeCategoryId,
                        searchTerm,
                        activeBrandId,
                        onSaleOnly,
                        activePromotionId,
                      )
                    }
                  >
                    Thử lại
                  </button>
                </div>
              )}

              {!isLoading && !error && products.length === 0 && (
                <div className={styles["products-page-page__empty-state"]}>
                  <p className={styles["products-page-page__empty-title"]}>
                    Không tìm thấy sản phẩm phù hợp.
                  </p>
                  <p className={styles["products-page-page__empty-subtitle"]}>
                    Hãy thử nới rộng khoảng giá hoặc thay đổi bộ lọc.
                  </p>
                </div>
              )}

              {isLoading && !error && (
                <div className={styles["products-page-page__grid"]}>
                  {Array.from({ length: 9 }).map((_, index) => (
                    <ProductCardSkeleton key={index} />
                  ))}
                </div>
              )}

              {!isLoading && products.length > 0 && (
                <div className={styles["products-page-page__grid"]}>
                  {products.map((product) => {
                    const hasDiscount =
                      product.salePrice != null && product.salePrice < product.price;
                    const discountPct = hasDiscount
                      ? getDiscountPercent(product.price, product.salePrice!)
                      : 0;
                    const isWished = wishedProductIds.has(product.id);

                    return (
                      <article
                        key={product.id}
                        className={styles["products-page-page__product-card"]}
                        onClick={() => router.push(`/products/${product.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(`/products/${product.id}`);
                          }
                        }}
                        aria-label={`Xem chi tiết ${product.name}`}
                      >
                        {hasDiscount && (
                          <span
                            className={`${styles["products-page-page__product-badge"]} ${styles["products-page-page__product-badge--accent"]}`}
                          >
                            Sale -{discountPct}%
                          </span>
                        )}

                        <div
                          className={styles["products-page-page__favorite-button"]}
                        >
                          <button
                            type="button"
                            className={
                              styles["products-page-page__favorite-button-button"]
                            }
                            aria-label={
                              isWished
                                ? "Xóa khỏi danh sách yêu thích"
                                : "Thêm vào danh sách yêu thích"
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleToggleWishlist(product);
                            }}
                            disabled={togglingIds.has(product.id)}
                          >
                            <span
                              className={
                                styles["products-page-page__favorite-button-icon"]
                              }
                            >
                              <MdFavoriteBorder
                                aria-hidden="true"
                                style={
                                  isWished
                                    ? { fill: "var(--accent)" }
                                    : undefined
                                }
                              />
                            </span>
                          </button>
                        </div>

                        <div
                          className={styles["products-page-page__image-wrapper"]}
                        >
                          {product.primaryImageUrl ? (
                            <Image
                              src={
                                getCloudinaryUrl(product.primaryImageUrl, {
                                  width: 800,
                                  quality: "auto:eco",
                                }) ?? product.primaryImageUrl
                              }
                              alt={product.name}
                              className={styles["products-page-page__image"]}
                              fill
                              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                              // Cloudinary đã optimize (f_auto/q_auto) — tắt Next.js re-encode
                              unoptimized
                            />
                          ) : (
                            <div
                              className={
                                styles["products-page-page__image-placeholder"]
                              }
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        <div className={styles["products-page-page__content-body"]}>
                          <p className={styles["products-page-page__category"]}>
                            {product.categoryName ?? product.brandName ?? "Sản phẩm"}
                          </p>
                          <h2 className={styles["products-page-page__name"]}>
                            {product.name}
                          </h2>

                          <div className={styles["products-page-page__price-row"]}>
                            <div>
                              {hasDiscount && (
                                <p className={styles["products-page-page__price-old"]}>
                                  {formatPrice(product.price, product.currency)}
                                </p>
                              )}
                              <p
                                className={`${styles["products-page-page__price-main"]} ${
                                  hasDiscount
                                    ? styles["products-page-page__price-main--primary"]
                                    : ""
                                }`}
                              >
                                {formatPrice(
                                  hasDiscount ? product.salePrice! : product.price,
                                  product.currency,
                                )}
                              </p>
                            </div>

                            <button
                              type="button"
                              className={styles["products-page-page__add-button"]}
                              aria-label="Thêm vào giỏ hàng"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleAddToCart(product);
                              }}
                            >
                              <span
                                className={
                                  styles["products-page-page__add-button-icon"]
                                }
                              >
                                <MdAddShoppingCart aria-hidden="true" />
                              </span>
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pagination */}
            {!isLoading && totalPages > 1 && (
              <div className={styles["products-page-page__pagination"]}>
                <nav
                  aria-label="Phân trang sản phẩm"
                  className={styles["products-page-page__pagination-list"]}
                >
                  <button
                    type="button"
                    className={styles["products-page-page__pagination-button"]}
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Trang trước"
                  >
                    <span
                      className={styles["products-page-page__pagination-icon"]}
                      aria-hidden="true"
                    >
                      <MdChevronLeft />
                    </span>
                  </button>

                  {renderPaginationButtons().map((item, idx) =>
                    item === "ellipsis" ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className={styles["products-page-page__pagination-ellipsis"]}
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        className={`${styles["products-page-page__pagination-button"]} ${
                          item === currentPage
                            ? styles["products-page-page__pagination-button--current"]
                            : ""
                        }`}
                        onClick={() => handlePageChange(item)}
                        aria-current={item === currentPage ? "page" : undefined}
                      >
                        {item}
                      </button>
                    ),
                  )}

                  <button
                    type="button"
                    className={styles["products-page-page__pagination-button"]}
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Trang sau"
                  >
                    <span
                      className={styles["products-page-page__pagination-icon"]}
                      aria-hidden="true"
                    >
                      <MdChevronRightIcon />
                    </span>
                  </button>
                </nav>
              </div>
            )}
          </section>

          {/* Sidebar */}
          <aside className={styles["products-page-page__sidebar-column"]}>
            <div className={styles["products-page-page__sidebar-stack"]}>
              {/* AI panel */}
              <section className={styles["products-page-page__ai-panel"]}>
                <div className={styles["products-page-page__ai-panel-glow"]} />
                <div className={styles["products-page-page__ai-panel-inner"]}>
                  <div className={styles["products-page-page__ai-panel-header"]}>
                    <span className={styles["products-page-page__ai-panel-header-icon"]}>
                      <MdAutoAwesome aria-hidden="true" />
                    </span>
                    <h2 className={styles["products-page-page__ai-panel-title"]}>
                      AI gợi ý cho bạn
                    </h2>
                  </div>
                  <p className={styles["products-page-page__ai-panel-description"]}>
                    Nhập thông tin để AI đề xuất thiết bị phù hợp nhất với không gian và
                    sở thích của bạn.
                  </p>

                  <form className={styles["products-page-page__ai-panel-form"]} onSubmit={(e) => { e.preventDefault(); handleAiAnalyze(); }}>
                    <div>
                      <div
                        className={styles["products-page-page__ai-panel-field-header"]}
                      >
                        <label
                          className={styles["products-page-page__ai-panel-label"]}
                          htmlFor="budget-range"
                        >
                          Ngân sách dự kiến
                        </label>
                        <span className={styles["products-page-page__ai-panel-value"]}>
                          {aiBudget}tr - 100tr+
                        </span>
                      </div>
                      <input
                        id="budget-range"
                        type="range"
                        min={5}
                        max={200}
                        value={aiBudget}
                        onChange={(e) => setAiBudget(Number(e.target.value))}
                        className={styles["products-page-page__ai-panel-range"]}
                      />
                    </div>

                    <div>
                      <div
                        className={styles["products-page-page__ai-panel-field-header"]}
                      >
                        <label
                          className={styles["products-page-page__ai-panel-label"]}
                          htmlFor="room-type"
                        >
                          Loại phòng
                        </label>
                      </div>
                      <div
                        className={
                          styles["products-page-page__ai-panel-select-wrapper"]
                        }
                      >
                        <select
                          id="room-type"
                          className={styles["products-page-page__ai-panel-select"]}
                          value={aiRoomType}
                          onChange={(e) => setAiRoomType(e.target.value)}
                        >
                          <option value="living">Phòng khách (20-30m²)</option>
                          <option value="bedroom">Phòng ngủ (&lt; 20m²)</option>
                          <option value="dedicated">
                            Phòng giải trí riêng (&gt; 40m²)
                          </option>
                          <option value="outdoor">Sân vườn / Ngoài trời</option>
                        </select>
                        <span
                          className={styles["products-page-page__ai-panel-select-icon"]}
                        >
                          <MdExpandMoreSmall aria-hidden="true" />
                        </span>
                      </div>
                    </div>

                    <div>
                      <div
                        className={styles["products-page-page__ai-panel-field-header"]}
                      >
                        <label
                          className={styles["products-page-page__ai-panel-label"]}
                          htmlFor="music-taste"
                        >
                          Gu âm nhạc
                        </label>
                      </div>
                      <div
                        className={
                          styles["products-page-page__ai-panel-select-wrapper"]
                        }
                      >
                        <select
                          id="music-taste"
                          className={styles["products-page-page__ai-panel-select"]}
                          value={aiMusicTaste}
                          onChange={(e) => setAiMusicTaste(e.target.value)}
                        >
                          <option value="bolero">Nhạc vàng / Bolero</option>
                          <option value="pop">Pop / Ballad</option>
                          <option value="rock">Rock / EDM</option>
                          <option value="jazz">Jazz / Classical</option>
                          <option value="mixed">Đa thể loại</option>
                        </select>
                        <span
                          className={styles["products-page-page__ai-panel-select-icon"]}
                        >
                          <MdExpandMoreSmall aria-hidden="true" />
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles["products-page-page__ai-panel-button"]}
                      onClick={handleAiAnalyze}
                      disabled={isAnalyzing}
                    >
                      <span
                        className={styles["products-page-page__ai-panel-button-icon"]}
                      >
                        <MdAutoAwesome aria-hidden="true" />
                      </span>
                      {isAnalyzing ? "Đang phân tích..." : "Nhờ AI tư vấn ngay"}
                    </button>
                  </form>
                </div>
              </section>

              {/* Categories */}
              <section className={styles["products-page-page__categories-card"]}>
                <h2 className={styles["products-page-page__categories-title"]}>
                  Danh mục
                </h2>
                <ul className={styles["products-page-page__categories-list"]}>
                  <li>
                    <button
                      type="button"
                      onClick={() => handleCategoryClick(null)}
                      className={`${styles["products-page-page__categories-item-link"]} ${
                        activeCategoryId === null
                          ? styles["products-page-page__categories-item-link--active"]
                          : ""
                      }`}
                    >
                      <span>Tất cả sản phẩm</span>
                      <span className={styles["products-page-page__categories-count"]}>
                        {total > 0 ? total : "—"}
                      </span>
                    </button>
                  </li>

                  {categories.length > 0 && (
                    <li>
                      <div className={styles["products-page-page__categories-divider"]} />
                    </li>
                  )}

                  {categories.map((cat) => (
                    <li key={cat.id}>
                      <button
                        type="button"
                        onClick={() => handleCategoryClick(cat.id)}
                        className={`${styles["products-page-page__categories-item-link"]} ${
                          activeCategoryId === cat.id
                            ? styles["products-page-page__categories-item-link--active"]
                            : ""
                        }`}
                      >
                        <span>{cat.name}</span>
                        <span className={styles["products-page-page__categories-count"]}>
                          {cat.productCount}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Brands Filter */}
              <section className={styles["products-page-page__categories-card"]}>
                <h2 className={styles["products-page-page__categories-title"]}>
                  Thương hiệu
                </h2>
                <ul className={styles["products-page-page__categories-list"]}>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveBrandId(null);
                        setCurrentPage(1);
                      }}
                      className={`${styles["products-page-page__categories-item-link"]} ${
                        activeBrandId === null
                          ? styles["products-page-page__categories-item-link--active"]
                          : ""
                      }`}
                    >
                      <span>Tất cả thương hiệu</span>
                    </button>
                  </li>
                  <li>
                    <div className={styles["products-page-page__categories-divider"]} />
                  </li>
                  {brands.map((brand) => (
                    <li key={brand.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveBrandId(brand.id);
                          setCurrentPage(1);
                        }}
                        className={`${styles["products-page-page__categories-item-link"]} ${
                          activeBrandId === brand.id
                            ? styles["products-page-page__categories-item-link--active"]
                            : ""
                        }`}
                      >
                        <span>{brand.name}</span>
                        <span className={styles["products-page-page__categories-count"]}>
                          {brand.productCount}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </aside>
        </div>
      </main>

      <ShopFooter />

      {/* Advanced Filter Modal */}
      {isAdvancedFilterOpen && (
        <div className={styles["products-page-page__modal-overlay"]}>
          <div className={styles["products-page-page__modal-container"]}>
            <div className={styles["products-page-page__modal-header"]}>
              <h2 className={styles["products-page-page__modal-title"]}>Bộ lọc nâng cao</h2>
              <button 
                className={styles["products-page-page__modal-close"]}
                onClick={() => setIsAdvancedFilterOpen(false)}
              >
                <MdClose />
              </button>
            </div>
            
            <div className={styles["products-page-page__modal-body"]}>
              <div className={styles["products-page-page__modal-section"]}>
                <h3 className={styles["products-page-page__modal-section-title"]}>Khoảng giá (VND)</h3>
                <div className={styles["products-page-page__modal-price-inputs"]}>
                  <input 
                    type="number" 
                    placeholder="Từ" 
                    value={minPrice ?? ""} 
                    onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : null)}
                  />
                  <span>-</span>
                  <input 
                    type="number" 
                    placeholder="Đến" 
                    value={maxPrice ?? ""} 
                    onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              </div>

              <div className={styles["products-page-page__modal-section"]}>
                <h3 className={styles["products-page-page__modal-section-title"]}>Thương hiệu</h3>
                <div className={styles["products-page-page__modal-brands-grid"]}>
                  {brands.map((brand) => (
                    <button
                      key={brand.id}
                      className={`${styles["products-page-page__modal-brand-tag"]} ${activeBrandId === brand.id ? styles["products-page-page__modal-brand-tag--active"] : ""}`}
                      onClick={() => setActiveBrandId(brand.id === activeBrandId ? null : brand.id)}
                    >
                      {brand.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles["products-page-page__modal-footer"]}>
              <button 
                className={styles["products-page-page__modal-reset"]}
                onClick={() => {
                  setMinPrice(null);
                  setMaxPrice(null);
                  setActiveBrandId(null);
                }}
              >
                Thiết lập lại
              </button>
              <button 
                className={styles["products-page-page__modal-apply"]}
                onClick={() => {
                  setCurrentPage(1);
                  setIsAdvancedFilterOpen(false);
                }}
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductsPageRoute() {
  return (
    <Suspense fallback={null}>
      <ProductsPage />
    </Suspense>
  );
}
