"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaHeadphonesAlt } from "react-icons/fa";
import styles from "./DataLoadingOverlay.module.css";

export type DataLoadingOverlayProps = {
  isActive: boolean;
  title?: string;
  subtitle?: string;
  bottomText?: string;
};

const panelVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.25 },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.98,
    transition: { duration: 0.2 },
  },
};

const dotTransition = {
  duration: 0.8,
  repeat: Infinity,
  ease: "easeInOut",
  repeatType: "reverse",
} as const;

export const DataLoadingOverlay: React.FC<DataLoadingOverlayProps> = ({
  isActive,
  title = "Đức Uy Audio",
  subtitle = "Đang tải dữ liệu người dùng...",
  bottomText = "Đang đồng bộ thông tin từ hệ thống...",
}) => {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className={styles["data-loading-overlay-overlay"]}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className={styles["data-loading-overlay-overlay__panel"]}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className={styles["data-loading-overlay-overlay__header"]}>
              <div className={styles["data-loading-overlay-overlay__logo"]}>
                <FaHeadphonesAlt
                  className={styles["data-loading-overlay-overlay__logo-icon"]}
                  aria-hidden="true"
                />
              </div>
              <div
                className={
                  styles["data-loading-overlay-overlay__title-group"]
                }
              >
                <p className={styles["data-loading-overlay-overlay__title"]}>
                  {title}
                </p>
                <p className={styles["data-loading-overlay-overlay__subtitle"]}>
                  {subtitle}
                </p>
              </div>
            </div>

            <div className={styles["data-loading-overlay-overlay__dots-row"]}>
              <motion.span
                className={`${styles["data-loading-overlay-overlay__dot"]} ${styles["data-loading-overlay-overlay__dot--primary"]}`}
                animate={{ y: [0, -6, 0] }}
                transition={{ ...dotTransition, delay: 0 }}
              />
              <motion.span
                className={`${styles["data-loading-overlay-overlay__dot"]} ${styles["data-loading-overlay-overlay__dot--accent"]}`}
                animate={{ y: [0, -6, 0] }}
                transition={{ ...dotTransition, delay: 0.12 }}
              />
              <motion.span
                className={`${styles["data-loading-overlay-overlay__dot"]} ${styles["data-loading-overlay-overlay__dot--neutral"]}`}
                animate={{ y: [0, -6, 0] }}
                transition={{ ...dotTransition, delay: 0.24 }}
              />
            </div>

            <div className={styles["data-loading-overlay-overlay__footer"]}>
              <span>{bottomText}</span>
              <div className={styles["data-loading-overlay-overlay__bar"]}>
                <div
                  className={`${styles["data-loading-overlay-overlay__bar-inner"]} ${styles["data-loading-overlay-overlay__bar-inner--indeterminate"]}`}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DataLoadingOverlay;

