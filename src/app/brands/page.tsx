"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ShopHeader from "@/components/layout/ShopHeader";
import ShopFooter from "@/components/layout/ShopFooter";
import type { BrandFilterItemDto } from "@/types/shop";
import styles from "./page.module.css";

export default function BrandsPage() {
  const router = useRouter();
  const [items, setItems] = useState<BrandFilterItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch("/api/shop/brands");
        if (!res.ok) {
          throw new Error("Failed to load brands");
        }
        const data = (await res.json()) as { items: BrandFilterItemDto[] };
        setItems(data.items ?? []);
      } catch {
        setError("Không thể tải danh sách thương hiệu. Vui lòng thử lại sau.");
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, []);

  return (
    <div className={styles["brands-page-page"]}>
      <ShopHeader />
      <main className={styles["brands-page-page__content"]}>
        <section className={styles["brands-page-page__hero"]}>
          <h1 className={styles["brands-page-page__title"]}>
            Thương hiệu âm thanh
          </h1>
          <p className={styles["brands-page-page__subtitle"]}>
            Khám phá các thương hiệu đang được phân phối tại Đức Uy Audio. Bấm
            vào từng thương hiệu để xem toàn bộ sản phẩm tương ứng.
          </p>
        </section>

        <section className={styles["brands-page-page__grid-section"]}>
          {isLoading && (
            <div className={styles["brands-page-page__state"]}>
              Đang tải danh sách thương hiệu...
            </div>
          )}

          {!isLoading && error && (
            <div className={styles["brands-page-page__state"]}>{error}</div>
          )}

          {!isLoading && !error && items.length === 0 && (
            <div className={styles["brands-page-page__state"]}>
              Hiện chưa có thương hiệu nào có sản phẩm hiển thị.
            </div>
          )}

          {!isLoading && !error && items.length > 0 && (
            <div className={styles["brands-page-page__grid"]}>
              {items.map((brand) => (
                <button
                  key={brand.id}
                  type="button"
                  className={styles["brands-page-page__card"]}
                  onClick={() =>
                    router.push(`/products?brandId=${encodeURIComponent(brand.id)}`)
                  }
                >
                  <div className={styles["brands-page-page__card-logo"]}>
                    {brand.logoUrl ? (
                      <Image
                        src={brand.logoUrl}
                        alt={brand.name}
                        width={56}
                        height={56}
                      />
                    ) : (
                      <span className={styles["brands-page-page__card-logo-text"]}>
                        {brand.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className={styles["brands-page-page__card-body"]}>
                    <span className={styles["brands-page-page__card-name"]}>
                      {brand.name}
                    </span>
                    <span className={styles["brands-page-page__card-count"]}>
                      {brand.productCount} sản phẩm
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
      <ShopFooter />
    </div>
  );
}

