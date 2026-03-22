"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import ShopHeader from "@/components/layout/ShopHeader";
import ShopFooter from "@/components/layout/ShopFooter";
import AiChatPanel from "@/features/shop/components/ai-chat/AiChatPanel";
import { 
  MdAutoAwesome, 
  MdStorefront, 
  MdInfo, 
  MdPsychology, 
  MdSpeaker, 
  MdCompare, 
  MdArchitecture, 
  MdCable, 
  MdLibraryMusic, 
  MdHeadsetMic 
} from "react-icons/md";
import styles from "./page.module.css";

const GENERAL_SUGGESTIONS = [
  "Gợi ý bộ setup phòng khách",
  "So sánh loa bookshelf và floor-standing",
  "Tư vấn theo ngân sách",
  "Xử lý âm học phòng nghe",
];

export default function TuVanAiPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles["tu-van-ai-page"]}>
      <ShopHeader />

      <main className={styles["tu-van-ai-page__main"]}>
        {/* Chat section */}
        <section className={styles["tu-van-ai-page__chat-section"]}>
          {/* Chat header */}
          <div className={styles["tu-van-ai-page__chat-header"]} ref={headerRef}>
            <div className={styles["tu-van-ai-page__chat-header-left"]}>
              <div className={styles["tu-van-ai-page__agent-avatar-wrap"]}>
                <div className={styles["tu-van-ai-page__agent-avatar"]}>
                  <MdAutoAwesome />
                </div>
                <span className={styles["tu-van-ai-page__agent-online-dot"]} />
              </div>
              <div>
                <h2 className={styles["tu-van-ai-page__agent-name"]}>
                  Đức Uy AI Assistant
                </h2>
                <p className={styles["tu-van-ai-page__agent-status"]}>
                  <span className={styles["tu-van-ai-page__agent-pulse"]} />
                  Chuyên gia Tư vấn
                </p>
              </div>
            </div>
            <div className={styles["tu-van-ai-page__chat-header-right"]}>
              <Link href="/products" className={styles["tu-van-ai-page__browse-btn"]}>
                <MdStorefront />
                Xem sản phẩm
              </Link>
              <button
                type="button"
                className={styles["tu-van-ai-page__sidebar-toggle"]}
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label="Thông tin trợ lý"
              >
                <MdInfo />
              </button>
            </div>
          </div>

          {/* Welcome banner (khi chưa có tin nhắn, hiển thị bên trên chat) */}
          <div className={styles["tu-van-ai-page__welcome"]}>
            <span className={styles["tu-van-ai-page__welcome-badge"]}>
              Phiên tư vấn mới
            </span>
            <h1 className={styles["tu-van-ai-page__welcome-title"]}>
              Tư vấn Âm thanh Cao cấp
            </h1>
            <p className={styles["tu-van-ai-page__welcome-desc"]}>
              Đức Uy AI sẵn sàng giúp bạn tìm bộ setup lý tưởng cho không gian của mình.
            </p>
          </div>

          {/* Panel chat chính */}
          <div className={styles["tu-van-ai-page__panel-wrap"]}>
            <AiChatPanel
              sessionKey="general"
              suggestions={GENERAL_SUGGESTIONS}
              compact={false}
            />
          </div>

          {/* Expert badge */}
          <div className={styles["tu-van-ai-page__expert-badge"]}>
            <MdPsychology />
            Chuyên gia Tư vấn
          </div>
        </section>

        {/* Sidebar thông tin (hiện trên desktop, toggle trên mobile) */}
        <aside
          className={[
            styles["tu-van-ai-page__sidebar"],
            sidebarOpen ? styles["tu-van-ai-page__sidebar--open"] : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className={styles["tu-van-ai-page__sidebar-inner"]}>
            <div className={styles["tu-van-ai-page__sidebar-section"]}>
              <h3 className={styles["tu-van-ai-page__sidebar-heading"]}>
                Đức Uy AI có thể giúp gì?
              </h3>
              <ul className={styles["tu-van-ai-page__sidebar-list"]}>
                {[
                  { icon: MdSpeaker, text: "Gợi ý bộ setup theo ngân sách" },
                  { icon: MdCompare, text: "So sánh sản phẩm chi tiết" },
                  { icon: MdArchitecture, text: "Tư vấn xử lý âm học phòng nghe" },
                  { icon: MdCable, text: "Hướng dẫn phối ghép ampli – loa – DAC" },
                  { icon: MdLibraryMusic, text: "Gợi ý setup theo gu nghe nhạc" },
                ].map((item, idx) => (
                  <li key={idx} className={styles["tu-van-ai-page__sidebar-item"]}>
                    <item.icon />
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles["tu-van-ai-page__sidebar-section"]}>
              <h3 className={styles["tu-van-ai-page__sidebar-heading"]}>
                Câu hỏi phổ biến
              </h3>
              <div className={styles["tu-van-ai-page__sidebar-pills"]}>
                {[
                  "Setup phòng nghe 15m²",
                  "Loa cho nhạc bolero",
                  "Ampli đèn hay bán dẫn?",
                  "Ngân sách 20 triệu",
                  "Cần thêm subwoofer không?",
                  "DAC ngoài có cần thiết?",
                ].map((q) => (
                  <span key={q} className={styles["tu-van-ai-page__sidebar-pill"]}>
                    {q}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles["tu-van-ai-page__sidebar-section"]}>
              <h3 className={styles["tu-van-ai-page__sidebar-heading"]}>
                Cần hỗ trợ trực tiếp?
              </h3>
              <Link href="/support" className={styles["tu-van-ai-page__support-link"]}>
                <MdHeadsetMic />
                Liên hệ Đức Uy Audio
              </Link>
            </div>
          </div>
        </aside>
      </main>

      <ShopFooter />
    </div>
  );
}
