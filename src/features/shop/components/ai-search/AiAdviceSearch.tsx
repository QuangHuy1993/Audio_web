"use client";

import React, { useState } from "react";
import { MdAutoAwesome, MdSearch, MdInfoOutline, MdChevronRight } from "react-icons/md";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { getCloudinaryUrl } from "@/utils/cloudinary-url";
import type { ProductAdviceSearchResponseDto } from "@/types/ai";
import styles from "./AiAdviceSearch.module.css";

const AiAdviceSearch: React.FC = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProductAdviceSearchResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || loading) return;

    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/shop/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Không thể thực hiện tìm kiếm.");
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchBox}>
        <div className={styles.inputWrapper}>
          <MdAutoAwesome className={styles.aiIcon} />
          <input
            className={styles.input}
            placeholder="Ví dụ: Loa phòng khách 30m2 nghe nhạc Jazz dưới 50 triệu..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button 
            className={styles.searchBtn} 
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
          >
            {loading ? <div className={styles.spinner} /> : <MdSearch />}
            <span>Tư vấn AI</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.loadingState}
          >
            <div className={styles.loadingPulse} />
            <p>Đức Uy AI đang phân tích yêu cầu của bạn...</p>
          </motion.div>
        )}

        {error && (
          <motion.div 
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={styles.errorState}
          >
            <MdInfoOutline />
            <span>{error}</span>
          </motion.div>
        )}

        {!loading && result && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={styles.resultSection}
          >
            <div className={styles.explanationBox}>
              <div className={styles.aiHeader}>
                <MdAutoAwesome />
                <span>Phân tích từ Đức Uy AI</span>
              </div>
              <p className={styles.explanationText}>{result.explanation}</p>
              
              <div className={styles.criteriaTags}>
                {result.criteria.category && (
                  <span className={styles.criteriaTag}>Danh mục: {result.criteria.category}</span>
                )}
                {result.criteria.brand && (
                  <span className={styles.criteriaTag}>Hãng: {result.criteria.brand}</span>
                )}
                {result.criteria.intent && (
                  <span className={styles.criteriaTag}>Mục tiêu: {result.criteria.intent}</span>
                )}
              </div>
            </div>

            <div className={styles.productsGrid}>
              <h4 className={styles.gridTitle}>Sản phẩm đề xuất cho bạn ({result.products.length})</h4>
              <div className={styles.grid}>
                {result.products.map((p) => (
                  <Link key={p.id} href={`/products/${p.id}`} className={styles.productCard}>
                    <div className={styles.productImg}>
                      {p.primaryImageUrl ? (
                        <Image 
                          src={getCloudinaryUrl(p.primaryImageUrl, { width: 300 }) ?? p.primaryImageUrl} 
                          alt={p.name}
                          fill
                          sizes="150px"
                        />
                      ) : (
                        <div className={styles.placeholder} />
                      )}
                    </div>
                    <div className={styles.productInfo}>
                      <h5 className={styles.productName}>{p.name}</h5>
                      <p className={styles.productPrice}>
                        {new Intl.NumberFormat("vi-VN").format(p.salePrice ?? p.price)}đ
                      </p>
                    </div>
                    <MdChevronRight className={styles.cardArrow} />
                  </Link>
                ))}
              </div>
              {result.products.length === 0 && (
                <div className={styles.emptyResults}>
                  Rất tiếc, AI không tìm thấy sản phẩm nào khớp hoàn toàn với mô tả này trong kho hàng hiện tại. 
                  Hãy thử điều chỉnh lại ngân sách hoặc yêu cầu của bạn nhé!
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AiAdviceSearch;
