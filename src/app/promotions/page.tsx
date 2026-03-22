"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ShopHeader from "@/components/layout/ShopHeader";
import ShopFooter from "@/components/layout/ShopFooter";
import type { PromotionSummaryDto } from "@/types/shop";
import styles from "./page.module.css";

export default function PromotionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<PromotionSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch("/api/shop/promotions");
        if (!res.ok) {
          throw new Error("Failed to load promotions");
        }
        const data = (await res.json()) as { items: PromotionSummaryDto[] };
        setItems(data.items ?? []);
      } catch {
        setError("Không thể tải danh sách khuyến mãi. Vui lòng thử lại sau.");
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, []);

  return (
    <div className={styles["promotions-page-page"]}>
      <ShopHeader />
      <main className={styles["promotions-page-page__content"]}>
        <section className={styles["promotions-page-page__hero"]}>
          <h1 className={styles["promotions-page-page__title"]}>
            Chương trình khuyến mãi
          </h1>
          <p className={styles["promotions-page-page__subtitle"]}>
            Tổng hợp các mã giảm giá và ưu đãi đang diễn ra tại Đức Uy Audio.
            Bạn có thể lưu lại mã và áp dụng trong bước thanh toán.
          </p>
        </section>

        <section className={styles["promotions-page-page__list-section"]}>
          {isLoading && (
            <div className={styles["promotions-page-page__state"]}>
              Đang tải danh sách khuyến mãi...
            </div>
          )}

          {!isLoading && error && (
            <div className={styles["promotions-page-page__state"]}>{error}</div>
          )}

          {!isLoading && !error && items.length === 0 && (
            <div className={styles["promotions-page-page__state"]}>
              Hiện chưa có chương trình khuyến mãi nào đang diễn ra.
            </div>
          )}

          {!isLoading && !error && items.length > 0 && (
            <ul className={styles["promotions-page-page__list"]}>
              {items.map((promo) => (
                <li
                  key={promo.id}
                  id={`id-${promo.id}`}
                  className={styles["promotions-page-page__item"]}
                >
                  <div className={styles["promotions-page-page__item-header"]}>
                    {promo.badgeText && (
                      <span
                        className={
                          styles["promotions-page-page__item-badge"]
                        }
                      >
                        {promo.badgeText}
                      </span>
                    )}
                    <h2 className={styles["promotions-page-page__item-title"]}>
                      {promo.title}
                    </h2>
                  </div>
                  {promo.subtitle && (
                    <p className={styles["promotions-page-page__item-subtitle"]}>
                      {promo.subtitle}
                    </p>
                  )}
                  {promo.type === "PRODUCT_SET" && (
                    <button
                      type="button"
                      className={
                        styles["promotions-page-page__item-action-button"]
                      }
                      onClick={() =>
                        router.push(
                          `/products?promotionId=${encodeURIComponent(
                            promo.id,
                          )}`,
                        )
                      }
                    >
                      Xem sản phẩm áp dụng
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <ShopFooter />
    </div>
  );
}

