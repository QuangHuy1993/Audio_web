"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { MdArrowForward, MdAddShoppingCart, MdCompare } from "react-icons/md";
import { getCloudinaryUrl } from "@/utils/cloudinary-url";
import { toast } from "sonner";
import { useCartContext } from "@/features/shop/context/CartContext";
import type { SuggestedProductDto } from "@/types/ai";
import styles from "./ProductAiSuggestionCard.module.css";

type Props = {
  products: SuggestedProductDto[];
};

function formatPriceVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProductAiSuggestionCard({ products }: Props) {
  const { refreshCartCount } = useCartContext();
  const [isAdding, setIsAdding] = React.useState<string | null>(null);

  if (products.length === 0) return null;

  const handleAddToCart = async (e: React.MouseEvent, p: SuggestedProductDto) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isAdding) return;
    
    try {
      setIsAdding(p.id);
      const res = await fetch("/api/shop/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: p.id, quantity: 1 }),
      });

      if (!res.ok) {
        throw new Error("Không thể thêm vào giỏ hàng");
      }

      refreshCartCount();
      toast.success(`Đã thêm ${p.name} vào giỏ hàng`);
    } catch {
      toast.error("Vui lòng đăng nhập để thêm vào giỏ hàng");
    } finally {
      setIsAdding(null);
    }
  };

  const handleCompare = (e: React.MouseEvent, p: SuggestedProductDto) => {
    e.preventDefault();
    e.stopPropagation();
    // Logic so sánh có thể mở modal so sánh hoặc lưu vào danh sách so sánh tạm
    toast.info(`Tính năng so sánh cho ${p.name} đang được cập nhật`);
  };

  return (
    <div className={styles["product-ai-suggestion-card"]}>
      <p className={styles["product-ai-suggestion-card__label"]}>
        Sản phẩm gợi ý:
      </p>
      <div className={styles["product-ai-suggestion-card__grid"]}>
        {products.map((p) => {
          const imageUrl = p.primaryImageUrl
            ? getCloudinaryUrl(p.primaryImageUrl, { width: 120, quality: "auto:eco" })
            : null;
          const displayPrice = p.salePrice ?? p.price;

          return (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className={styles["product-ai-suggestion-card__item"]}
            >
              <div className={styles["product-ai-suggestion-card__thumb"]}>
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={p.name}
                    width={80}
                    height={80}
                    className={styles["product-ai-suggestion-card__img"]}
                  />
                ) : (
                  <div className={styles["product-ai-suggestion-card__img-placeholder"]} />
                )}
              </div>
              <div className={styles["product-ai-suggestion-card__info"]}>
                <p className={styles["product-ai-suggestion-card__name"]}>{p.name}</p>
                <p className={styles["product-ai-suggestion-card__price"]}>
                  {formatPriceVnd(displayPrice)}
                </p>
                
                <div className={styles["product-ai-suggestion-card__actions"]}>
                  <button 
                    type="button"
                    className={styles["product-ai-suggestion-card__action-btn"]}
                    onClick={(e) => handleAddToCart(e, p)}
                    disabled={isAdding === p.id}
                    title="Thêm vào giỏ"
                  >
                    <MdAddShoppingCart />
                  </button>
                  <button 
                    type="button"
                    className={styles["product-ai-suggestion-card__action-btn"]}
                    onClick={(e) => handleCompare(e, p)}
                    title="So sánh"
                  >
                    <MdCompare />
                  </button>
                </div>
              </div>
              <span className={styles["product-ai-suggestion-card__arrow"]}>
                <MdArrowForward aria-hidden="true" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
