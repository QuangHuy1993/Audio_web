"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { FaHeadphonesAlt } from "react-icons/fa";
import {
  MdSearch,
  MdShoppingCart,
  MdExpandMore,
  MdFavoriteBorder,
  MdMenu,
  MdClose,
  MdNotifications,
} from "react-icons/md";
import clsx from "clsx";
import { toast } from "sonner";
import { useCartContext } from "@/features/shop/context/CartContext";
import type { BrandFilterItemDto, PromotionSummaryDto } from "@/types/shop";
import PaymentNotificationPopup, {
  type PaymentPendingSession,
} from "@/components/shared/PaymentNotificationPopup";
import AiAdviceSearch from "@/features/shop/components/ai-search/AiAdviceSearch";
import { MdAutoAwesome } from "react-icons/md";
import styles from "./ShopHeader.module.css";

export type ShopHeaderProps = {
  onCartClick?: () => void;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onAccountClick?: () => void;
  onAdminClick?: () => void;
  onLogoutClick?: () => void;
  onSearchSubmit?: (query: string) => void;
};

const navItems: { href: string; label: string }[] = [
  { href: "/", label: "Trang chủ" },
  { href: "/products", label: "Sản phẩm" },
  { href: "/brands", label: "Thương hiệu" },
  { href: "/promotions", label: "Khuyến mãi" },
  { href: "/support", label: "Hỗ trợ" },
];

type SearchQuickProduct = {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  brandName?: string | null;
  imageUrl?: string | null;
};

const ShopHeader: React.FC<ShopHeaderProps> = ({
  onCartClick,
  onLoginClick,
  onRegisterClick,
  onAccountClick,
  onAdminClick,
  onLogoutClick,
  onSearchSubmit,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { cartItemCount, wishlistCount: contextWishlistCount } = useCartContext();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchQuickProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isAiSearchMode, setIsAiSearchMode] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // UI state
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const wishlistCount = contextWishlistCount;
  const [brandItems, setBrandItems] = useState<BrandFilterItemDto[] | null>(null);
  const [isBrandsOpen, setIsBrandsOpen] = useState(false);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [promotionItems, setPromotionItems] = useState<PromotionSummaryDto[] | null>(null);
  const [isPromotionsOpen, setIsPromotionsOpen] = useState(false);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(false);
  const [promotionsError, setPromotionsError] = useState<string | null>(null);
  const [hasPendingPayment, setHasPendingPayment] = useState(false);
  const [isPaymentPopupOpen, setIsPaymentPopupOpen] = useState(false);
  const [isLoadingPaymentPopup, setIsLoadingPaymentPopup] = useState(false);
  const [isCancellingPayment, setIsCancellingPayment] = useState(false);
  const [pendingPaymentSession, setPendingPaymentSession] =
    useState<PaymentPendingSession | null>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = Boolean(session?.user);
  const displayName = session?.user?.name ?? "Khách";
  const firstLetter = displayName.slice(0, 1).toUpperCase();
  const isAdmin = session?.user?.role === "ADMIN";

  // Fetch user profile to get most up-to-date avatar
  useEffect(() => {
    if (session?.user) {
      const fetchProfile = async () => {
        try {
          const res = await fetch("/api/shop/profile");
          if (res.ok) {
            const data = await res.json();
            if (data?.image) {
              setProfileImage(data.image);
            }
          }
        } catch (error) {
          console.error("[ShopHeader] Failed to fetch profile image", error);
        }
      };
      void fetchProfile();
    } else {
      setProfileImage(null);
    }
  }, [session]);

  const brandsCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promotionsCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBrands = async () => {
    if (brandItems || isLoadingBrands) return;
    try {
      setIsLoadingBrands(true);
      setBrandsError(null);
      const res = await fetch("/api/shop/brands");
      if (!res.ok) {
        throw new Error("Failed to load brands");
      }
      const data = (await res.json()) as { items: BrandFilterItemDto[] };
      setBrandItems(data.items ?? []);
    } catch (error) {
      console.error("[ShopHeader][Brands] Failed to load brands", error);
      setBrandsError("Không thể tải danh sách thương hiệu.");
    } finally {
      setIsLoadingBrands(false);
    }
  };

  const fetchPromotions = async () => {
    if (promotionItems || isLoadingPromotions) return;
    try {
      setIsLoadingPromotions(true);
      setPromotionsError(null);
      const res = await fetch("/api/shop/promotions");
      if (!res.ok) {
        throw new Error("Failed to load promotions");
      }
      const data = (await res.json()) as { items: PromotionSummaryDto[] };
      setPromotionItems(data.items ?? []);
    } catch (error) {
      console.error("[ShopHeader][Promotions] Failed to load promotions", error);
      setPromotionsError("Không thể tải danh sách khuyến mãi.");
    } finally {
      setIsLoadingPromotions(false);
    }
  };

  // Search logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 3) {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/shop/search/quick?q=${encodeURIComponent(searchQuery)}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data.products || []);
            setShowSearchDropdown(true);
          }
        } catch (err) {
          console.error("Quick search failed:", err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Wishlist count is now managed by CartContext

  // Bell badge: polling session thanh toán pending
  useEffect(() => {
    let mounted = true;

    const fetchPendingPaymentSession = async () => {
      if (!session?.user?.id) {
        if (mounted) {
          setHasPendingPayment(false);
          setPendingPaymentSession(null);
        }
        return;
      }

      try {
        const response = await fetch("/api/shop/payments/sessions/active");
        if (!response.ok) return;
        const data = (await response.json()) as PaymentPendingSession | null;
        if (!mounted) return;
        setPendingPaymentSession(data);
        setHasPendingPayment(Boolean(data));
      } catch {
        // silent fail để không ảnh hưởng header render
      }
    };

    void fetchPendingPaymentSession();
    const interval = window.setInterval(() => {
      void fetchPendingPaymentSession();
    }, 60_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [session?.user?.id]);

  // Click outside search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Click outside notification popup
  useEffect(() => {
    if (!isPaymentPopupOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setIsPaymentPopupOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPaymentPopupOpen]);

  const handleSubmitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    
    setShowSearchDropdown(false);
    if (onSearchSubmit) {
      onSearchSubmit(trimmed);
    } else {
      router.push(`/products?search=${encodeURIComponent(trimmed)}`);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  const handleCartClick = () => {
    if (onCartClick) {
      onCartClick();
      return;
    }
    router.push("/cart");
  };

  const handleLoginClick = () => {
    if (onLoginClick) {
      onLoginClick();
      return;
    }
    router.push("/login");
  };

  const handleRegisterClick = () => {
    if (onRegisterClick) {
      onRegisterClick();
      return;
    }
    router.push("/register");
  };

  const handleAccountClick = (tab?: string) => {
    if (onAccountClick) {
      onAccountClick();
      return;
    }
    router.push(`/account/profile${tab ? `?tab=${tab}` : ""}`);
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
  };

  const handleLogoutClick = async () => {
    if (onLogoutClick) {
      onLogoutClick();
      return;
    }
    await signOut({ callbackUrl: "/" });
  };

  const fetchLatestPendingSession = async (): Promise<PaymentPendingSession | null> => {
    const response = await fetch("/api/shop/payments/sessions/active");
    if (!response.ok) {
      throw new Error("Không thể tải phiên thanh toán.");
    }
    return (await response.json()) as PaymentPendingSession | null;
  };

  const handleOpenPaymentPopup = async () => {
    if (!session?.user?.id) return;
    setIsPaymentPopupOpen(true);
    setIsLoadingPaymentPopup(true);
    try {
      const latest = await fetchLatestPendingSession();
      setPendingPaymentSession(latest);
      setHasPendingPayment(Boolean(latest));
    } catch {
      toast.error("Không thể tải thông báo thanh toán. Vui lòng thử lại.");
      setPendingPaymentSession(null);
    } finally {
      setIsLoadingPaymentPopup(false);
    }
  };

  const handleContinuePendingPayment = () => {
    if (!pendingPaymentSession) return;
    setIsPaymentPopupOpen(false);

    if (pendingPaymentSession.provider === "VNPAY") {
      if (pendingPaymentSession.paymentUrl) {
        window.location.assign(pendingPaymentSession.paymentUrl);
        return;
      }
      router.push(
        `/checkout?sessionId=${encodeURIComponent(pendingPaymentSession.id)}`,
      );
      return;
    }

    router.push(
      `/checkout?sessionId=${encodeURIComponent(pendingPaymentSession.id)}`,
    );
  };

  const handleCancelPendingPayment = async () => {
    if (!pendingPaymentSession || isCancellingPayment) return;
    setIsCancellingPayment(true);
    try {
      const response = await fetch(
        `/api/shop/payments/sessions/${encodeURIComponent(pendingPaymentSession.id)}/cancel`,
        { method: "POST" },
      );
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(json.error ?? "Không thể huỷ đơn chờ thanh toán.");
        return;
      }
      setPendingPaymentSession(null);
      setHasPendingPayment(false);
      setIsPaymentPopupOpen(false);
      toast.success("Đã huỷ đơn chờ thanh toán.");
    } catch {
      toast.error("Không thể huỷ đơn chờ thanh toán. Vui lòng thử lại.");
    } finally {
      setIsCancellingPayment(false);
    }
  };

  return (
    <header className={styles["shop-header-header"]}>
      <div className={styles["shop-header-header__inner"]}>
        {/* Brand + main nav */}
        <div className={styles["shop-header-header__left"]}>
          <button 
            className={styles["shop-header-header__menu-toggle"]}
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Mở menu"
          >
            <MdMenu />
          </button>

          <Link
            href="/"
            className={styles["shop-header-header__brand"]}
            aria-label="Trang chủ Đức Uy Audio"
          >
            <div className={styles["shop-header-header__brand-icon"]}>
              <FaHeadphonesAlt aria-hidden="true" />
            </div>
            <div className={styles["shop-header-header__brand-text"]}>
              <span className={styles["shop-header-header__brand-name"]}>
                Đức Uy{" "}
                <span className={styles["shop-header-header__brand-name-highlight"]}>
                  Audio
                </span>
              </span>
              <span className={styles["shop-header-header__brand-subtitle"]}>
                Premium Audio Experience
              </span>
            </div>
          </Link>

          <nav
            className={styles["shop-header-header__nav"]}
            aria-label="Điều hướng chính"
          >
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              if (item.href === "/brands") {
                return (
                  <div
                    key={item.href}
                    className={styles["shop-header-header__brands-trigger"]}
                    onMouseEnter={() => {
                      if (brandsCloseTimeoutRef.current) {
                        clearTimeout(brandsCloseTimeoutRef.current);
                        brandsCloseTimeoutRef.current = null;
                      }
                      setIsBrandsOpen(true);
                      void fetchBrands();
                    }}
                    onMouseLeave={() => {
                      if (brandsCloseTimeoutRef.current) {
                        clearTimeout(brandsCloseTimeoutRef.current);
                      }
                      brandsCloseTimeoutRef.current = setTimeout(() => {
                        setIsBrandsOpen(false);
                      }, 180);
                    }}
                  >
                    <button
                      type="button"
                      className={clsx(
                        styles["shop-header-header__nav-link"],
                        isActive &&
                          styles["shop-header-header__nav-link--active"],
                      )}
                      onClick={() => {
                        router.push("/brands");
                      }}
                    >
                      {item.label}
                    </button>

                    {isBrandsOpen && (
                      <div
                        className={styles["shop-header-header__brands-dropdown"]}
                      >
                        <div
                          className={
                            styles["shop-header-header__brands-header"]
                          }
                        >
                          Thương hiệu nổi bật
                        </div>

                        {isLoadingBrands && (
                          <div
                            className={
                              styles["shop-header-header__brands-empty"]
                            }
                          >
                            Đang tải danh sách thương hiệu...
                          </div>
                        )}

                        {!isLoadingBrands && brandsError && (
                          <div
                            className={
                              styles["shop-header-header__brands-empty"]
                            }
                          >
                            <span>{brandsError}</span>
                            <button
                              type="button"
                              className={
                                styles[
                                  "shop-header-header__brands-retry-button"
                                ]
                              }
                              onClick={() => {
                                void fetchBrands();
                              }}
                            >
                              Thử lại
                            </button>
                          </div>
                        )}

                        {!isLoadingBrands &&
                          !brandsError &&
                          brandItems &&
                          brandItems.length > 0 && (
                            <>
                              <ul
                                className={
                                  styles["shop-header-header__brands-list"]
                                }
                              >
                                {brandItems.slice(0, 12).map((brand) => (
                                  <li
                                    key={brand.id}
                                    className={
                                      styles["shop-header-header__brands-item"]
                                    }
                                  >
                                    <button
                                      type="button"
                                      className={
                                        styles[
                                          "shop-header-header__brands-item-button"
                                        ]
                                      }
                                      onClick={() => {
                                        router.push(
                                          `/products?brandId=${encodeURIComponent(
                                            brand.id,
                                          )}`,
                                        );
                                        setIsBrandsOpen(false);
                                      }}
                                    >
                                      <div
                                        className={
                                          styles[
                                            "shop-header-header__brands-logo"
                                          ]
                                        }
                                      >
                                        {brand.logoUrl ? (
                                          <Image
                                            src={brand.logoUrl}
                                            alt={brand.name}
                                            width={28}
                                            height={28}
                                          />
                                        ) : (
                                          <span>
                                            {brand.name
                                              .slice(0, 1)
                                              .toUpperCase()}
                                          </span>
                                        )}
                                      </div>
                                      <div
                                        className={
                                          styles[
                                            "shop-header-header__brands-text"
                                          ]
                                        }
                                      >
                                        <span
                                          className={
                                            styles[
                                              "shop-header-header__brands-name"
                                            ]
                                          }
                                        >
                                          {brand.name}
                                        </span>
                                        <span
                                          className={
                                            styles[
                                              "shop-header-header__brands-count"
                                            ]
                                          }
                                        >
                                          {brand.productCount} sản phẩm
                                        </span>
                                      </div>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                              <button
                                type="button"
                                className={
                                  styles["shop-header-header__brands-footer"]
                                }
                                onClick={() => {
                                  router.push("/brands");
                                  setIsBrandsOpen(false);
                                }}
                              >
                                Xem tất cả thương hiệu
                              </button>
                            </>
                          )}

                        {!isLoadingBrands &&
                          !brandsError &&
                          brandItems &&
                          brandItems.length === 0 && (
                            <div
                              className={
                                styles["shop-header-header__brands-empty"]
                              }
                            >
                              Hiện chưa có thương hiệu nào có sản phẩm hiển thị.
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                );
              }

              if (item.href === "/promotions") {
                return (
                  <div
                    key={item.href}
                    className={styles["shop-header-header__promotions-trigger"]}
                    onMouseEnter={() => {
                      if (promotionsCloseTimeoutRef.current) {
                        clearTimeout(promotionsCloseTimeoutRef.current);
                        promotionsCloseTimeoutRef.current = null;
                      }
                      setIsPromotionsOpen(true);
                      void fetchPromotions();
                    }}
                    onMouseLeave={() => {
                      if (promotionsCloseTimeoutRef.current) {
                        clearTimeout(promotionsCloseTimeoutRef.current);
                      }
                      promotionsCloseTimeoutRef.current = setTimeout(() => {
                        setIsPromotionsOpen(false);
                      }, 180);
                    }}
                  >
                    <button
                      type="button"
                      className={clsx(
                        styles["shop-header-header__nav-link"],
                        isActive &&
                          styles["shop-header-header__nav-link--active"],
                      )}
                      onClick={() => {
                        router.push("/promotions");
                      }}
                    >
                      {item.label}
                    </button>

                    {isPromotionsOpen && (
                      <div
                        className={
                          styles["shop-header-header__promotions-dropdown"]
                        }
                      >
                        <div
                          className={
                            styles["shop-header-header__promotions-header"]
                          }
                        >
                          Ưu đãi đang diễn ra
                        </div>

                        {isLoadingPromotions && (
                          <div
                            className={
                              styles["shop-header-header__promotions-empty"]
                            }
                          >
                            Đang tải danh sách khuyến mãi...
                          </div>
                        )}

                        {!isLoadingPromotions && promotionsError && (
                          <div
                            className={
                              styles["shop-header-header__promotions-empty"]
                            }
                          >
                            <span>{promotionsError}</span>
                            <button
                              type="button"
                              className={
                                styles[
                                  "shop-header-header__promotions-retry-button"
                                ]
                              }
                              onClick={() => {
                                void fetchPromotions();
                              }}
                            >
                              Thử lại
                            </button>
                          </div>
                        )}

                        {!isLoadingPromotions &&
                          !promotionsError &&
                          promotionItems &&
                          promotionItems.length > 0 && (
                            <>
                              <ul
                                className={
                                  styles["shop-header-header__promotions-list"]
                                }
                              >
                                {promotionItems.slice(0, 6).map((promo) => (
                                  <li
                                    key={promo.id}
                                    className={
                                      styles[
                                        "shop-header-header__promotions-item"
                                      ]
                                    }
                                  >
                                    <button
                                      type="button"
                                      className={
                                        styles[
                                          "shop-header-header__promotions-item-button"
                                        ]
                                      }
                                      onClick={() => {
                                        if (promo.type === "PRODUCT_SET") {
                                          router.push(
                                            `/products?promotionId=${encodeURIComponent(
                                              promo.id,
                                            )}`,
                                          );
                                        } else {
                                          router.push(
                                            `/promotions#id-${encodeURIComponent(
                                              promo.id,
                                            )}`,
                                          );
                                        }
                                        setIsPromotionsOpen(false);
                                      }}
                                    >
                                      {promo.badgeText && (
                                        <span
                                          className={
                                            styles[
                                              "shop-header-header__promotions-badge"
                                            ]
                                          }
                                        >
                                          {promo.badgeText}
                                        </span>
                                      )}
                                      <div
                                        className={
                                          styles[
                                            "shop-header-header__promotions-text"
                                          ]
                                        }
                                      >
                                        <span
                                          className={
                                            styles[
                                              "shop-header-header__promotions-title"
                                            ]
                                          }
                                        >
                                          {promo.title}
                                        </span>
                                        {promo.subtitle && (
                                          <span
                                            className={
                                              styles[
                                                "shop-header-header__promotions-subtitle"
                                              ]
                                            }
                                          >
                                            {promo.subtitle}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                              <button
                                type="button"
                                className={
                                  styles[
                                    "shop-header-header__promotions-footer"
                                  ]
                                }
                                onClick={() => {
                                  router.push("/promotions");
                                  setIsPromotionsOpen(false);
                                }}
                              >
                                Xem tất cả khuyến mãi
                              </button>
                            </>
                          )}

                        {!isLoadingPromotions &&
                          !promotionsError &&
                          promotionItems &&
                          promotionItems.length === 0 && (
                            <div
                              className={
                                styles["shop-header-header__promotions-empty"]
                              }
                            >
                              Hiện chưa có chương trình khuyến mãi nào đang diễn ra.
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    styles["shop-header-header__nav-link"],
                    isActive && styles["shop-header-header__nav-link--active"],
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Search */}
        <div className={styles["shop-header-header__center"]} ref={searchRef}>
          <form
            className={styles["shop-header-header__search"]}
            onSubmit={handleSubmitSearch}
            role="search"
          >
            <span className={styles["shop-header-header__search-icon"]}>
              <MdSearch aria-hidden="true" />
            </span>
            <input
              className={styles["shop-header-header__search-input"]}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => searchQuery.length >= 3 && setShowSearchDropdown(true)}
              placeholder="Tìm kiếm, tai nghe, ampli..."
              aria-label="Tìm kiếm sản phẩm âm thanh"
            />
            
            {showSearchDropdown && (
              <div className={styles["shop-header-header__search-dropdown"]}>
                {isAiSearchMode ? (
                  <div className={styles["shop-header-header__search-ai-container"]}>
                    <div className={styles["shop-header-header__search-ai-header"]}>
                      <div className={styles["shop-header-header__search-ai-title"]}>
                        <MdAutoAwesome />
                        <span>Chế độ Tư vấn AI</span>
                      </div>
                      <button 
                        type="button"
                        className={styles["shop-header-header__search-ai-exit"]}
                        onClick={() => setIsAiSearchMode(false)}
                      >
                        Quay lại tìm nhanh
                      </button>
                    </div>
                    <AiAdviceSearch />
                  </div>
                ) : (
                  <>
                    <div className={styles["shop-header-header__search-dropdown-header"]}>
                      {isSearching ? "Đang tìm kiếm..." : "Sản phẩm tìm thấy"}
                    </div>
                    {searchResults.length > 0 ? (
                      <>
                        {searchResults.map((p) => (
                          <div 
                            key={p.id} 
                            className={styles["shop-header-header__search-result-item"]}
                            onClick={() => {
                              router.push(`/products/${p.id}`);
                              setShowSearchDropdown(false);
                              setSearchQuery("");
                            }}
                          >
                            <div className={styles["shop-header-header__search-result-image"]}>
                              {p.imageUrl && (
                                <Image 
                                  src={p.imageUrl} 
                                  alt={p.name} 
                                  fill 
                                  className={styles["shop-header-header__search-result-img"]}
                                />
                              )}
                            </div>
                            <div className={styles["shop-header-header__search-result-info"]}>
                              <div className={styles["shop-header-header__search-result-name"]}>
                                {p.name}
                              </div>
                              <div className={styles["shop-header-header__search-result-meta"]}>
                                <span className={styles["shop-header-header__search-result-price"]}>
                                  {formatPrice(p.salePrice ?? p.price)}
                                </span>
                                {p.brandName && (
                                  <span className={styles["shop-header-header__search-result-brand"]}>
                                    {p.brandName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className={styles["shop-header-header__search-dropdown-footer"]}>
                          <span 
                            className={styles["shop-header-header__search-view-all"]}
                            onClick={handleSubmitSearch}
                          >
                            Xem tất cả kết quả
                          </span>
                        </div>
                      </>
                    ) : (
                      !isSearching && (
                        <div className={styles["shop-header-header__search-dropdown-header"]} style={{ textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
                          Không tìm thấy sản phẩm
                        </div>
                      )
                    )}

                    {/* AI Search Entry Point */}
                    <div className={styles["shop-header-header__search-ai-cta"]}>
                      <button 
                        type="button"
                        className={styles["shop-header-header__search-ai-cta-btn"]}
                        onClick={() => setIsAiSearchMode(true)}
                      >
                        <MdAutoAwesome className={styles["shop-header-header__search-ai-cta-icon"]} />
                        <div className={styles["shop-header-header__search-ai-cta-text"]}>
                          <strong>Tìm kiếm thông minh bằng AI</strong>
                          <span>Tư vấn theo nhu cầu của bạn</span>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Cart / User */}
        <div className={styles["shop-header-header__right"]}>
          {isAuthenticated && (
            <>
              <div
                className={styles["shop-header-header__notif-wrapper"]}
                ref={notificationRef}
              >
                <button
                  type="button"
                  className={clsx(
                    styles["shop-header-header__notif-button"],
                    hasPendingPayment &&
                      styles["shop-header-header__notif-button--active"],
                  )}
                  onClick={() => {
                    void handleOpenPaymentPopup();
                  }}
                  aria-label="Thông báo thanh toán"
                >
                  <MdNotifications />
                  {hasPendingPayment && (
                    <span className={styles["shop-header-header__notif-badge"]} />
                  )}
                </button>

                <PaymentNotificationPopup
                  isOpen={isPaymentPopupOpen}
                  isLoading={isLoadingPaymentPopup}
                  session={pendingPaymentSession}
                  isCancelling={isCancellingPayment}
                  onClose={() => setIsPaymentPopupOpen(false)}
                  onContinue={handleContinuePendingPayment}
                  onCancel={() => {
                    void handleCancelPendingPayment();
                  }}
                />
              </div>

              <button
                type="button"
                className={styles["shop-header-header__wishlist-button"]}
                onClick={() => router.push("/account/wishlist")}
                aria-label="Danh sách yêu thích"
              >
                <MdFavoriteBorder />
                {wishlistCount !== null && wishlistCount > 0 && (
                  <span className={styles["shop-header-header__wishlist-badge"]}>
                    {wishlistCount > 9 ? "9+" : wishlistCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                className={styles["shop-header-header__cart-button"]}
                onClick={handleCartClick}
                aria-label="Giỏ hàng"
              >
                <MdShoppingCart aria-hidden="true" />
                {cartItemCount > 0 && (
                  <span className={styles["shop-header-header__cart-badge"]}>
                    {cartItemCount > 9 ? "9+" : cartItemCount}
                  </span>
                )}
              </button>
            </>
          )}

          <div className={styles["shop-header-header__user"]}>
            {isAuthenticated ? (
              <button
                type="button"
                className={styles["shop-header-header__user-button"]}
                onClick={() => setIsUserMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
              >
                <div className={styles["shop-header-header__user-avatar"]}>
                  {profileImage || session?.user?.image ? (
                    <Image
                      src={profileImage || session!.user!.image!}
                      alt={displayName}
                      fill
                      sizes="30px"
                      priority
                      className={styles["shop-header-header__user-avatar-img"]}
                    />
                  ) : (
                    firstLetter
                  )}
                </div>
                <div className={styles["shop-header-header__user-text"]}>
                  <span className={styles["shop-header-header__user-greeting"]}>
                    Xin chào,
                  </span>
                  <span className={styles["shop-header-header__user-name"]}>
                    {displayName}
                  </span>
                </div>
                <MdExpandMore
                  className={styles["shop-header-header__user-caret"]}
                  aria-hidden="true"
                />
              </button>
            ) : (
              <div className={styles["shop-header-header__auth-actions"]}>
                <button
                  type="button"
                  className={styles["shop-header-header__login-button"]}
                  onClick={handleLoginClick}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  className={styles["shop-header-header__register-button"]}
                  onClick={handleRegisterClick}
                >
                  Đăng ký
                </button>
              </div>
            )}

            {isAuthenticated && isUserMenuOpen && (
              <div
                className={styles["shop-header-header__user-menu"]}
                role="menu"
              >
                <button
                  type="button"
                  className={styles["shop-header-header__user-menu-item"]}
                  onClick={() => handleAccountClick()}
                  role="menuitem"
                >
                  Tài khoản của tôi
                </button>
                <button
                  type="button"
                  className={styles["shop-header-header__user-menu-item"]}
                  onClick={() => handleAccountClick("orders")}
                  role="menuitem"
                >
                  Đơn hàng của tôi
                </button>
                <button
                  type="button"
                  className={styles["shop-header-header__user-menu-item"]}
                  onClick={() => handleAccountClick("wishlist")}
                  role="menuitem"
                >
                  Danh sách yêu thích
                </button>
                <button
                  type="button"
                  className={styles["shop-header-header__user-menu-item"]}
                  onClick={() => handleAccountClick("vouchers")}
                  role="menuitem"
                >
                  Ví voucher
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    className={styles["shop-header-header__user-menu-item"]}
                    onClick={onAdminClick || (() => router.push("/admin/dashboard"))}
                    role="menuitem"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 4, paddingTop: 8 }}
                  >
                    Trang quản trị
                  </button>
                )}
                <button
                  type="button"
                  className={styles["shop-header-header__user-menu-item"]}
                  onClick={handleLogoutClick}
                  role="menuitem"
                  style={{ color: "#ef4444" }}
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className={styles["shop-header-header__drawer-overlay"]} onClick={() => setIsMobileMenuOpen(false)}>
          <div className={styles["shop-header-header__drawer"]} onClick={(e) => e.stopPropagation()}>
            <div className={styles["shop-header-header__drawer-header"]}>
              {isAuthenticated ? (
                <div className={styles["shop-header-header__drawer-user"]}>
                  <div className={styles["shop-header-header__user-avatar"]}>
                    {profileImage || session?.user?.image ? (
                      <Image
                        src={profileImage || session!.user!.image!}
                        alt={displayName}
                        fill
                        sizes="40px"
                        className={styles["shop-header-header__user-avatar-img"]}
                      />
                    ) : (
                      firstLetter
                    )}
                  </div>
                  <div className={styles["shop-header-header__drawer-user-info"]}>
                    <span className={styles["shop-header-header__drawer-user-name"]}>{displayName}</span>
                    <span className={styles["shop-header-header__drawer-user-role"]}>{isAdmin ? "Quản trị viên" : "Khách hàng"}</span>
                  </div>
                </div>
              ) : (
                <div className={styles["shop-header-header__brand-text"]}>
                  <span className={styles["shop-header-header__brand-name"]}>Đức Uy Audio</span>
                </div>
              )}
              <button className={styles["shop-header-header__drawer-close"]} onClick={() => setIsMobileMenuOpen(false)}>
                <MdClose />
              </button>
            </div>

            <nav className={styles["shop-header-header__drawer-nav"]}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    styles["shop-header-header__drawer-link"],
                    pathname === item.href && styles["shop-header-header__drawer-link--active"]
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              {isAuthenticated && (
                <>
                  <Link 
                    href="/account/wishlist" 
                    className={styles["shop-header-header__drawer-link"]}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Yêu thích
                  </Link>
                  <Link 
                    href="/cart" 
                    className={styles["shop-header-header__drawer-link"]}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Giỏ hàng ({cartItemCount})
                  </Link>
                </>
              )}
            </nav>
            
            {!isAuthenticated && (
              <div className={styles["shop-header-header__auth-actions"]} style={{ marginTop: "auto" }}>
                <button 
                  className={styles["shop-header-header__login-button"]} 
                  style={{ flex: 1 }}
                  onClick={handleLoginClick}
                >
                  Đăng nhập
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default ShopHeader;
