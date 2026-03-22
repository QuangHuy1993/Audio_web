"use client";

import React, { useState, useEffect } from "react";
import { MdCompare, MdClose, MdAutoAwesome, MdInfoOutline } from "react-icons/md";
import { motion, AnimatePresence } from "framer-motion";
import type { ProductComparisonResponseDto } from "@/types/ai";
import styles from "./AiProductComparison.module.css";

interface ProductInfo {
  id: string;
  name: string;
  image?: string;
}

interface AiProductComparisonProps {
  products: ProductInfo[];
  onClose: () => void;
}

const AiProductComparison: React.FC<AiProductComparisonProps> = ({ products, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProductComparisonResponseDto | null>(null);

  useEffect(() => {
    const fetchComparison = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/shop/ai/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productIds: products.map((p) => p.id),
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Không thể tải so sánh.");
        }

        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "Đã có lỗi xảy ra.");
      } finally {
        setLoading(false);
      }
    };

    if (products.length >= 2) {
      fetchComparison();
    }
  }, [products]);

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.iconBox}>
            <MdAutoAwesome className={styles.aiIcon} />
          </div>
          <div>
            <h3 className={styles.title}>So sánh thông minh by AI</h3>
            <p className={styles.subtitle}>Phân tích chuyên sâu dựa trên đặc tính âm thanh</p>
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
          <MdClose />
        </button>
      </div>

      <div className={styles.content}>
        {loading && (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Đang phân tích các sản phẩm...</p>
          </div>
        )}

        {error && (
          <div className={styles.errorState}>
            <MdInfoOutline className={styles.errorIcon} />
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={() => window.location.reload()}>
              Thử lại
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <div className={styles.resultView}>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.criteriaHeader}>Tiêu chí</th>
                    {products.map((p) => (
                      <th key={p.id} className={styles.productHeader}>
                        <div className={styles.productThumb}>
                           {p.image && <img src={p.image} alt={p.name} />}
                        </div>
                        <span className={styles.productName}>{p.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.comparisonData.map((row, idx) => (
                    <tr key={idx}>
                      <td className={styles.criteriaCell}>{row.criteria}</td>
                      {products.map((p) => {
                        const val = row.values.find((v) => v.productId === p.id)?.value || "-";
                        return (
                          <td key={p.id} className={styles.valueCell}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.summaryBox}>
              <h4 className={styles.summaryTitle}>
                <MdInfoOutline /> Tổng kết từ Đức Uy AI
              </h4>
              <p className={styles.summaryText}>{data.summary}</p>
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <p className={styles.disclaimer}>
          * Thông tin được tổng hợp từ dữ liệu kỹ thuật và phân tích của AI. 
          Vui lòng nghe thử trực tiếp tại showroom để có trải nghiệm chính xác nhất.
        </p>
      </div>
    </motion.div>
  );
};

export default AiProductComparison;
