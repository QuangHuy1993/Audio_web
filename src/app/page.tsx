"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ShopHeader from "@/components/layout/ShopHeader";
import ShopFooter from "@/components/layout/ShopFooter";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import Link from "next/link";
import { getHomeData } from "@/actions/home";
import {
  MdBolt,
  MdCheckCircle,
  MdAutoAwesome,
  MdAddShoppingCart,
  MdArrowForward,
  MdVerifiedUser,
  MdConstruction,
  MdLocalShipping,
  MdSupportAgent,
  MdGraphicEq,
} from "react-icons/md";
import styles from "./page.module.css";

const HERO_SPEAKER_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD2FxXMaExS4YsAoSXKKRo8eXkyCDwGVDMwyd6PxMr_OoWIwx-6zxe6IAh8AJ4rVMgsSsY9NXYnUXH9YQ_pyuhHpOfu_nYOV-Ux1clfGvh5xJ69zI14PYi8_7ISRJSpDE0nwpD8FzbdrRSf-nLEXZbd7Gn4ohfn90w11kUkzq78sBBh3OUAW-4Fq0aOL_ZzYX0eV6JFDL5EzIuLeE-6oM40MVFBGiz9MT4bGaC5cEcvS4SEc01ijxsFxRQ7dQWqfl6cjw4S6VHmqP6N";

const FEATURED_PRODUCTS: any[] = [];

const SOLUTION_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCjMiGiP-vMsLNeUQh4LGZRcYjpKk_jdlvrYhvd3xI7ia6QLhC9n-mQFcalOYm72UG060IFeH3juXrZjW7tpTL11POr7EUhZOE_6XEGDypyA8YhJOa-Is2ORg19NFPBljG3lrg4dhhF2DNpWV6D7NMXfPZff5tdZnaWYaHambMAaODE2xMi0Wj50vXTl_T_fFj6UipAYXEw_2BkT9qGfN932h4bBDgWrnTBv5ebyIxRJg6KTQOBHpwAUEBskTtw0s1DSVFz_dLhEV7c",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuADFvmSqWBBQx1aIXdWW1eSIwtRnCiSPWH8plmBbu7Jbv-LAVCOfXAozd5vNg0fEwJAiyuCj8p5YDa5mWoeBe0IFVGVX5L5ymuZyu1LmpTe2BCKWvGkyA_3HyMqtPuA_Fy2gWFeIKCR7y2MmAkQL2aI9xczXCP2vqHV86LVoK_t0ATnO9G0v6phiYc2p1ySHSQC2HQg7APYN15QBmBYt0r9paQt9heZOYe0sGPpeFiaaHrol8PHqI3IuhpdjWa9xqoQemlFhHD4eK-8",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD4lawSCI2C1XHrHGcOpVpJWGhtrwyPQT_sgW8WdqNKXhBJ6vYjT4ucDKERR8VAx21S2wYFyYAFVce8R2HzGXrvYAUKdgQuiw1Tpnf9mljfgF8Q_w9AO7iGWrT8xtjPjr6Orj9drPOHnBdYFWl2n5rUeIVZb--Zu9pLpxVdLDJ4WLzEyon1B47PGjyd4YPGkkEeo1fJ5stUtTvWrK2q9NNs1xBeXfj0neZQtdaBrfZ26amutNIG8iHEfwgPdvthewH4J8dsyx_3WXpe",
];

const BRAND_PARTNERS = [
  {
    name: "Yamaha",
    tagline: "Hi-end AV & Stereo",
  },
  {
    name: "Denon",
    tagline: "Amplifier & Receiver",
  },
  {
    name: "Klipsch",
    tagline: "Horn-loaded Loudspeakers",
  },
  {
    name: "JBL",
    tagline: "Studio & Live Sound",
  },
  {
    name: "Sennheiser",
    tagline: "Audiophile Headphones",
  },
  {
    name: "Bowers & Wilkins",
    tagline: "Reference Loudspeakers",
  },
];

export default function HomePage() {
  const [isTransitionActive, setIsTransitionActive] = useState(true);
  const router = useRouter();

  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [categorizedProducts, setCategorizedProducts] = useState<any[]>([]);

  // Helper cho render card
  const renderProductCard = (product: any) => {
    const imageUrl = product.images?.[0]?.url || "/placeholder.png";
    const priceNum = Number(product.price);
    const salePriceNum = product.salePrice ? Number(product.salePrice) : null;
    const hasDiscount = salePriceNum !== null && salePriceNum < priceNum;
    const displayPrice = hasDiscount ? salePriceNum : priceNum;
    const formatVnd = (val: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(val);
    const discountPct = hasDiscount ? Math.round(((priceNum - salePriceNum) / priceNum) * 100) : 0;

    return (
      <Link
        href={`/products/${product.id}`}
        key={product.id}
        className={styles["home-page-page__product-card"]}
      >
        <div
          className={styles["home-page-page__product-image"]}
          style={{ backgroundImage: `url("${imageUrl}")` }}
        >
          <div
            className={styles["home-page-page__product-image-badges"]}
          >
            {hasDiscount && (
              <span
                className={`${styles["home-page-page__product-image-badge"]} ${styles["home-page-page__product-image-badge--discount"]}`}
              >
                -{discountPct}%
              </span>
            )}
            {(product.aiTags || []).slice(0, 1).map((tag: string) => (
              <span
                key={tag}
                className={`${styles["home-page-page__product-image-badge"]} ${styles["home-page-page__product-image-badge--accent"]}`}
              >
                {tag}
              </span>
            ))}
          </div>

          <button
            type="button"
            className={styles["home-page-page__product-add-cart"]}
            onClick={(e) => {
              e.preventDefault(); 
            }}
          >
            <MdAddShoppingCart />
          </button>
        </div>

        <div className={styles["home-page-page__product-content"]}>
          <p className={styles["home-page-page__product-category"]}>
            {product.category?.name || "Danh mục"}
          </p>
          <h4 className={styles["home-page-page__product-title"]}>
            {product.name}
          </h4>
          <div className={styles["home-page-page__product-price-row"]}>
            <span
              className={styles["home-page-page__product-price-main"]}
            >
              {formatVnd(displayPrice)}
            </span>
            {hasDiscount && (
              <span
                className={styles["home-page-page__product-price-old"]}
              >
                {formatVnd(priceNum)}
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  };

  // AI Form state
  const [budget, setBudget] = useState(50);
  const [roomType, setRoomType] = useState("");
  const [musicTaste, setMusicTaste] = useState("Bolero");
  const [extraRequests, setExtraRequests] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<{
    expertVerdict: string;
    recommendedProducts: any[];
  } | null>(null);

  useEffect(() => {
    getHomeData().then((data) => {
      if (data?.featuredProducts) {
        setFeaturedProducts(data.featuredProducts);
      }
      if (data?.categorizedProducts) {
        setCategorizedProducts(data.categorizedProducts);
      }
    });

    const timeoutId = window.setTimeout(() => {
      setIsTransitionActive(false);
    }, 1100);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const handleAiAnalyze = async () => {
    setIsAnalyzing(true);
    setRecommendation(null);
    try {
      const res = await fetch("/api/shop/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget: `${budget}.000.000`,
          roomType,
          musicTaste,
          extraRequests,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setRecommendation(data);
    } catch (error) {
      console.error("AI Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className={`app-homepage-bg ${styles["home-page-page"]}`}>
      <PageTransitionOverlay
        isActive={isTransitionActive}
        subtitle="Đang chuẩn bị trải nghiệm âm thanh dành riêng cho bạn..."
        bottomText="Đức Uy Audio đang tinh chỉnh không gian Hi-end của bạn..."
      />
      <ShopHeader />

      <main className={styles["home-page-page__inner"]}>
        {/* Hero */}
        <section className={styles["home-page-page__hero"]}>
          <div className={styles["home-page-page__hero-grid"]}>
            <div>
              <div className={styles["home-page-page__hero-badge"]}>
                <span className={styles["home-page-page__hero-badge-icon"]}>
                  <MdBolt />
                </span>
                TƯ VẤN AI DUY NHẤT TẠI VIỆT NAM
              </div>

              <h1 className={styles["home-page-page__hero-title"]}>
                Nâng tầm trải nghiệm{" "}
                <span className={styles["home-page-page__hero-title-highlight"]}>
                  âm thanh
                </span>
              </h1>
              <p className={styles["home-page-page__hero-description"]}>
                Khám phá hệ thống âm thanh Hi-end đỉnh cao được tối ưu hóa bằng trí tuệ
                nhân tạo, mang rạp hát chuyên nghiệp về ngôi nhà của bạn.
              </p>

              <div className={styles["home-page-page__hero-actions"]}>
                <button
                  type="button"
                  className={styles["home-page-page__hero-button-primary"]}
                  onClick={() => router.push("/tu-van-ai")}
                >
                  Bắt đầu tư vấn cùng AI
                </button>
                <button
                  type="button"
                  className={styles["home-page-page__hero-button-secondary"]}
                  onClick={() => router.push("/products")}
                >
                  Xem sản phẩm nổi bật
                </button>
              </div>
            </div>

            <div className={styles["home-page-page__hero-visual"]}>
              <div className={styles["home-page-page__hero-visual-glow"]} />
              <div
                className={styles["home-page-page__hero-visual-main"]}
                style={{ backgroundImage: `url("${HERO_SPEAKER_IMAGE}")` }}
              >
                <div
                  className={styles["home-page-page__hero-visual-product-badge"]}
                >
                  <div style={{ display: "flex", gap: 12 }}>
                    <span
                      style={{
                        color: "var(--accent)",
                        fontSize: 28,
                        display: "inline-flex",
                      }}
                    >
                      <MdGraphicEq />
                    </span>
                    <div>
                      <p
                        className={
                          styles["home-page-page__hero-visual-product-title"]
                        }
                      >
                        Sản phẩm của tháng
                      </p>
                      <p
                        className={
                          styles["home-page-page__hero-visual-product-subtitle"]
                        }
                      >
                        Klipsch Heritage Series - Limited Edition
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className={styles["home-page-page__benefits-section"]}>
          <div className={styles["home-page-page__benefits-grid"]}>
            <div className={styles["home-page-page__benefit-item"]}>
              <div className={styles["home-page-page__benefit-icon"]}>
                <MdVerifiedUser />
              </div>
              <div>
                <p className={styles["home-page-page__benefit-text-title"]}>
                  Bảo hành chính hãng
                </p>
                <p className={styles["home-page-page__benefit-text-subtitle"]}>
                  Cam kết 100% linh kiện
                </p>
              </div>
            </div>

            <div className={styles["home-page-page__benefit-item"]}>
              <div className={styles["home-page-page__benefit-icon"]}>
                <MdConstruction />
              </div>
              <div>
                <p className={styles["home-page-page__benefit-text-title"]}>
                  Setup miễn phí
                </p>
                <p className={styles["home-page-page__benefit-text-subtitle"]}>
                  Kỹ thuật viên tại nhà
                </p>
              </div>
            </div>

            <div className={styles["home-page-page__benefit-item"]}>
              <div className={styles["home-page-page__benefit-icon"]}>
                <MdLocalShipping />
              </div>
              <div>
                <p className={styles["home-page-page__benefit-text-title"]}>
                  Giao hàng an toàn
                </p>
                <p className={styles["home-page-page__benefit-text-subtitle"]}>
                  Bọc chống sốc chuyên dụng
                </p>
              </div>
            </div>

            <div className={styles["home-page-page__benefit-item"]}>
              <div className={styles["home-page-page__benefit-icon"]}>
                <MdSupportAgent />
              </div>
              <div>
                <p className={styles["home-page-page__benefit-text-title"]}>
                  Hỗ trợ trọn đời
                </p>
                <p className={styles["home-page-page__benefit-text-subtitle"]}>
                  Tư vấn kỹ thuật 24/7
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* AI advisor */}
        <section className={styles["home-page-page__ai-section"]}>
          <div className={styles["home-page-page__ai-header"]}>
            <h2 className={styles["home-page-page__ai-title"]}>
              Tư vấn hệ thống âm thanh AI
            </h2>
            <p className={styles["home-page-page__ai-subtitle"]}>
              Nhận ngay gợi ý cấu hình âm thanh phù hợp với không gian và ngân sách của
              bạn chỉ trong 30 giây.
            </p>
          </div>

          <div className={styles["home-page-page__ai-grid"]}>
            <div className={styles["home-page-page__ai-form-card"]}>
              <div className={styles["home-page-page__ai-form-group"]}>
                <div className={styles["home-page-page__ai-form-label-row"]}>
                  <label className={styles["home-page-page__ai-form-label"]}>
                    Ngân sách dự kiến (VNĐ)
                  </label>
                  <span className={styles["home-page-page__ai-form-value"]}>
                    {budget}.000.000 VNĐ
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={500}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className={styles["home-page-page__ai-range"]}
                />
              </div>

              <div className={styles["home-page-page__ai-form-row"]}>
                <div className={styles["home-page-page__ai-form-group"]}>
                  <label className={styles["home-page-page__ai-form-label"]}>
                    Diện tích phòng
                  </label>
                  <select
                    className={styles["home-page-page__ai-select"]}
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                  >
                    <option value="">Dưới 20m²</option>
                    <option value="20-40">20m² - 40m²</option>
                    <option value="40-60">40m² - 60m²</option>
                    <option value="60+">Trên 60m²</option>
                  </select>
                </div>

                <div className={styles["home-page-page__ai-form-group"]}>
                  <label className={styles["home-page-page__ai-form-label"]}>
                    Gu âm nhạc
                  </label>
                  <div className={styles["home-page-page__ai-music-tags"]}>
                    {["Bolero", "Pop/Ballad", "Jazz", "Classical"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={`${styles["home-page-page__ai-music-tag"]} ${
                          musicTaste === tag
                            ? styles["home-page-page__ai-music-tag--active"]
                            : styles["home-page-page__ai-music-tag--inactive"]
                        }`}
                        onClick={() => setMusicTaste(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles["home-page-page__ai-form-group"]}>
                <label className={styles["home-page-page__ai-form-label"]}>
                  Yêu cầu bổ sung
                </label>
                <textarea
                  className={styles["home-page-page__ai-textarea"]}
                  placeholder="Mô tả thêm về phòng khách hoặc sở thích đặc biệt..."
                  value={extraRequests}
                  onChange={(e) => setExtraRequests(e.target.value)}
                />
              </div>

              <button
                type="button"
                className={styles["home-page-page__ai-submit"]}
                onClick={handleAiAnalyze}
                disabled={isAnalyzing}
              >
                <span className={styles["home-page-page__ai-submit-icon"]}>
                  <MdAutoAwesome />
                </span>
                {isAnalyzing ? "Đang phân tích..." : "Phân tích & Gợi ý ngay"}
              </button>
            </div>

            <div className={styles["home-page-page__ai-result-card"]}>
              <div className={styles["home-page-page__ai-result-badge"]}>
                KẾT QUẢ AI
              </div>
              <h3 className={styles["home-page-page__ai-result-title"]}>
                {recommendation ? "Gợi Ý Chuyên Gia" : "Kết Quả AI Sẽ Hiện Ở Đây"}
              </h3>

              <div className={styles["home-page-page__ai-result-list"]}>
                {recommendation ? (
                  recommendation.recommendedProducts.map((p) => (
                    <div key={p.id} className={styles["home-page-page__ai-result-item"]}>
                      <span className={styles["home-page-page__ai-result-item-icon"]}>
                        <MdCheckCircle />
                      </span>
                      <span>
                        {p.brandName} {p.name}
                      </span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className={styles["home-page-page__ai-result-item"]}>
                      <span className={styles["home-page-page__ai-result-item-icon"]}>
                        <MdCheckCircle />
                      </span>
                      <span>Hệ thống đang chờ thông tin từ bạn...</span>
                    </div>
                  </>
                )}
              </div>

              <div className={styles["home-page-page__ai-result-note"]}>
                {recommendation
                  ? recommendation.expertVerdict
                  : "AI sẽ dựa trên Ngân sách, Diện tích và Gu âm nhạc của bạn để đề xuất combo phối ghép tối ưu nhất (Loa, Ampli, Dây dẫn)."}
              </div>

              {recommendation && (
                <button
                  type="button"
                  className={styles["home-page-page__ai-result-button"]}
                  onClick={() => router.push("/products")}
                >
                  Xem chi tiết các sản phẩm
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Featured products */}
        <section className={styles["home-page-page__featured-section"]}>
          <div className={styles["home-page-page__featured-header"]}>
            <div>
              <h2 className={styles["home-page-page__featured-title"]}>
                Sản phẩm nổi bật
              </h2>
              <p className={styles["home-page-page__featured-subtitle"]}>
                Những thiết bị âm thanh được giới mộ điệu săn đón nhất 2026.
              </p>
            </div>
            <button
              type="button"
              className={styles["home-page-page__featured-link"]}
            >
              Xem tất cả
              <MdArrowForward />
            </button>
          </div>

          <div className={styles["home-page-page__featured-grid"]}>
            {featuredProducts.map(renderProductCard)}
          </div>
        </section>

        {/* Categorized Products */}
        {categorizedProducts.map((category) => (
          <section key={category.id} className={styles["home-page-page__featured-section"]} style={{ marginTop: 40 }}>
            <div className={styles["home-page-page__featured-header"]}>
              <div>
                <h2 className={styles["home-page-page__featured-title"]}>
                  Danh mục: {category.name}
                </h2>
                <p className={styles["home-page-page__featured-subtitle"]}>
                  Top sản phẩm nổi bật thuộc danh mục {category.name}.
                </p>
              </div>
              <button
                type="button"
                className={styles["home-page-page__featured-link"]}
                onClick={() => router.push(`/products?category=${category.slug}`)}
              >
                Xem tất cả
                <MdArrowForward />
              </button>
            </div>

            <div className={styles["home-page-page__featured-grid"]}>
              {category.products.map(renderProductCard)}
            </div>
          </section>
        ))}

        {/* Solutions */}
        <section className={styles["home-page-page__solutions-section"]}>
          <h2 className={styles["home-page-page__solutions-title"]}>
            Giải pháp theo nhu cầu
          </h2>
          <div className={styles["home-page-page__solutions-grid"]}>
            <div className={styles["home-page-page__solution-card"]}>
              <div
                className={styles["home-page-page__solution-image"]}
                style={{ backgroundImage: `url("${SOLUTION_IMAGES[0]}")` }}
              />
              <div className={styles["home-page-page__solution-overlay"]} />
              <div className={styles["home-page-page__solution-content"]}>
                <h3 className={styles["home-page-page__solution-title"]}>
                  Phòng khách xem phim
                </h3>
                <p className={styles["home-page-page__solution-description"]}>
                  Trải nghiệm âm thanh vòm Dolby Atmos chuẩn cinema.
                </p>
                <button
                  type="button"
                  className={styles["home-page-page__solution-button"]}
                  onClick={() => router.push('/products?search=xem+phim')}
                >
                  Khám phá
                </button>
              </div>
            </div>

            <div className={styles["home-page-page__solution-card"]}>
              <div
                className={styles["home-page-page__solution-image"]}
                style={{ backgroundImage: `url("${SOLUTION_IMAGES[1]}")` }}
              />
              <div className={styles["home-page-page__solution-overlay"]} />
              <div className={styles["home-page-page__solution-content"]}>
                <h3 className={styles["home-page-page__solution-title"]}>
                  Phòng ngủ nghe nhạc
                </h3>
                <p className={styles["home-page-page__solution-description"]}>
                  Giai điệu thư giãn cho giấc ngủ hoàn hảo.
                </p>
                <button
                  type="button"
                  className={styles["home-page-page__solution-button"]}
                  onClick={() => router.push('/products?search=nghe+nhạc')}
                >
                  Khám phá
                </button>
              </div>
            </div>

            <div className={styles["home-page-page__solution-card"]}>
              <div
                className={styles["home-page-page__solution-image"]}
                style={{ backgroundImage: `url("${SOLUTION_IMAGES[2]}")` }}
              />
              <div className={styles["home-page-page__solution-overlay"]} />
              <div className={styles["home-page-page__solution-content"]}>
                <h3 className={styles["home-page-page__solution-title"]}>
                  Phòng nghe chuyên dụng
                </h3>
                <p className={styles["home-page-page__solution-description"]}>
                  Dành cho những Audiophile khắt khe nhất.
                </p>
                <button
                  type="button"
                  className={styles["home-page-page__solution-button"]}
                  onClick={() => router.push('/products?search=chuyên+dụng')}
                >
                  Khám phá
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Brands strip */}
        <section className={styles["home-page-page__brands-section"]}>
          <div className={styles["home-page-page__brands-header"]}>
            <h2 className={styles["home-page-page__brands-title"]}>
              Đối tác thương hiệu âm thanh
            </h2>
            <p className={styles["home-page-page__brands-subtitle"]}>
              Hợp tác cùng những nhà sản xuất hàng đầu thế giới để mang đến trải nghiệm
              hi-end trọn vẹn.
            </p>
          </div>

          <div className={styles["home-page-page__brands-row"]}>
            {BRAND_PARTNERS.map((brand) => (
              <div
                key={brand.name}
                className={styles["home-page-page__brand-card"]}
              >
                <span className={styles["home-page-page__brand-name"]}>
                  {brand.name}
                </span>
                <span className={styles["home-page-page__brand-tagline"]}>
                  {brand.tagline}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Coupon */}
        <section className={styles["home-page-page__coupon-section"]}>
          <div className={styles["home-page-page__coupon-card"]}>
            <div className={styles["home-page-page__coupon-inner"]}>
              <div className={styles["home-page-page__coupon-left"]}>
                <div className={styles["home-page-page__coupon-badge"]}>
                  <p className={styles["home-page-page__coupon-badge-label"]}>
                    Mã giảm giá
                  </p>
                  <p className={styles["home-page-page__coupon-badge-code"]}>
                    SUMMER2024
                  </p>
                </div>
                <div>
                  <h4 className={styles["home-page-page__coupon-text-title"]}>
                    -20% cho đơn hàng đầu tiên
                  </h4>
                  <p className={styles["home-page-page__coupon-text-subtitle"]}>
                    Áp dụng cho tất cả sản phẩm Hi-end trong tháng 8.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className={styles["home-page-page__coupon-button"]}
              >
                Sao chép mã
              </button>
            </div>
          </div>
        </section>
      </main>
      <ShopFooter />
    </div>
  );
}
