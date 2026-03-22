"use client";

import { MdAutoAwesome, MdClose } from "react-icons/md";
import styles from "./FloatingAiButton.module.css";
import { useRouter, usePathname } from "next/navigation";

export default function FloatingAiButton() {
  const router = useRouter();
  const pathname = usePathname();
  const isAiPage = pathname === "/tu-van-ai";

  const handleClick = () => {
    if (isAiPage) {
      router.back();
    } else {
      router.push("/tu-van-ai");
    }
  };

  return (
    <button
      className={styles.floatingButton}
      onClick={handleClick}
      aria-label={isAiPage ? "Đóng tư vấn" : "Tư vấn AI"}
    >
      <div className={styles.pulse} />
      <div className={styles.iconWrapper}>
        {isAiPage ? <MdClose /> : <MdAutoAwesome />}
      </div>
      <span className={styles.tooltip}>{isAiPage ? "Đóng" : "Tư vấn AI"}</span>
    </button>
  );
}
