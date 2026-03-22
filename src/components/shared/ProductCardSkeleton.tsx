"use client";

import React from "react";
import styles from "./ProductCardSkeleton.module.css";

const ProductCardSkeleton: React.FC = () => {
  return (
    <div className={styles.card}>
      <div className={`${styles.skeleton} ${styles.image}`} />
      <div className={styles.content}>
        <div className={`${styles.skeleton} ${styles.brand}`} />
        <div className={`${styles.skeleton} ${styles.title}`} />
        <div className={`${styles.skeleton} ${styles.price}`} />
      </div>
      <div className={styles.footer}>
        <div className={`${styles.skeleton} ${styles.button}`} />
      </div>
    </div>
  );
};

export default ProductCardSkeleton;
