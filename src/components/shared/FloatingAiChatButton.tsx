"use client";

/**
 * FloatingAiChatButton – Nút tư vấn AI nổi, cố định góc dưới phải màn hình.
 *
 * - Ẩn trên các trang admin (/admin/*), auth (/login, /register, /forgot-password,
 *   /reset-password, /verify-account), trang /tu-van-ai (đã đang ở trang chat),
 *   trang checkout (/checkout/*).
 * - Điều hướng đến /tu-van-ai khi nhấn.
 * - Mounted ở RootLayout để xuất hiện trên tất cả các trang shop.
 */

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { MdAutoAwesome } from "react-icons/md";
import styles from "./FloatingAiChatButton.module.css";

const HIDDEN_PATH_PREFIXES = [
  "/admin",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-account",
  "/checkout",
  "/tu-van-ai",
];

export default function FloatingAiChatButton() {
  const pathname = usePathname();
  const router = useRouter();

  const shouldHide = HIDDEN_PATH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (shouldHide) return null;

  return (
    <button
      type="button"
      className={styles["floating-ai-chat-button"]}
      onClick={() => router.push("/tu-van-ai")}
      aria-label="Mở trợ lý tư vấn AI"
    >
      <span
        className={styles["floating-ai-chat-button__icon"]}
        aria-hidden="true"
      >
        <MdAutoAwesome />
      </span>
      <span className={styles["floating-ai-chat-button__label"]}>Tư vấn AI</span>
      <span className={styles["floating-ai-chat-button__pulse"]} />
    </button>
  );
}
