"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaHeadphonesAlt } from "react-icons/fa";
import styles from "./PageTransitionOverlay.module.css";

export type PageTransitionOverlayProps = {
  isActive: boolean;
  title?: string;
  subtitle?: string;
  bottomText?: string;
};

const overlayVariants = {
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const contentVariants: {
  hidden: { opacity: number; y: number; scale: number };
  visible: {
    opacity: number;
    y: number;
    scale: number;
    transition: { duration: number; ease: "easeOut" };
  };
  exit: {
    opacity: number;
    y: number;
    scale: number;
    transition: { duration: number; ease: "easeIn" };
  };
} = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.35,
      ease: "easeOut" as const,
    },
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.98,
    transition: {
      duration: 0.25,
      ease: "easeIn" as const,
    },
  },
};

export const PageTransitionOverlay: React.FC<PageTransitionOverlayProps> = ({
  isActive,
  title = "Đức Uy Audio",
  subtitle = "Trải nghiệm âm thanh cao cấp",
  bottomText = "Đang chuẩn bị trải nghiệm âm thanh độ phân giải cao...",
}) => {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className={styles["page-transition-overlay-overlay"]}
          initial="visible"
          animate="visible"
          exit="exit"
          variants={overlayVariants}
        >
          <motion.div
            className={styles["page-transition-overlay-overlay__content"]}
            variants={contentVariants}
          >
            <div
              className={styles["page-transition-overlay-overlay__brand-block"]}
            >
              <div
                className={
                  styles["page-transition-overlay-overlay__brand-icon-wrapper"]
                }
              >
                <FaHeadphonesAlt
                  className={
                    styles["page-transition-overlay-overlay__brand-icon"]
                  }
                  aria-hidden="true"
                />
              </div>

              <div
                className={
                  styles["page-transition-overlay-overlay__brand-text-group"]
                }
              >
                <h1
                  className={
                    styles["page-transition-overlay-overlay__brand-title"]
                  }
                >
                  {title.split(" ").slice(0, -1).join(" ") || title}{" "}
                  <span
                    className={
                      styles["page-transition-overlay-overlay__brand-title-highlight"]
                    }
                  >
                    {title.split(" ").slice(-1)}
                  </span>
                </h1>
                <p
                  className={
                    styles["page-transition-overlay-overlay__brand-subtitle"]
                  }
                >
                  {subtitle}
                </p>
              </div>
            </div>

            <div
              className={
                styles["page-transition-overlay-overlay__dots-container"]
              }
            >
              <motion.span
                className={
                  styles["page-transition-overlay-overlay__dot-primary"]
                }
                animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatType: "loop",
                  delay: 0,
                }}
              />
              <motion.span
                className={
                  styles["page-transition-overlay-overlay__dot-accent"]
                }
                animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatType: "loop",
                  delay: 0.12,
                }}
              />
              <motion.span
                className={
                  styles["page-transition-overlay-overlay__dot-neutral"]
                }
                animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatType: "loop",
                  delay: 0.24,
                }}
              />
            </div>

            <p
              className={
                styles["page-transition-overlay-overlay__bottom-text"]
              }
            >
              {bottomText}
            </p>
          </motion.div>

          <div
            className={styles["page-transition-overlay-overlay__texture-layer"]}
            aria-hidden="true"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PageTransitionOverlay;

