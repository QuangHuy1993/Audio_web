"use client";

/**
 * AiChatPanel – Khung chat AI tư vấn âm thanh tái sử dụng.
 *
 * Mục đích: cung cấp UI chat thống nhất cho mọi điểm tích hợp (trang chi tiết
 * sản phẩm, trang /tu-van-ai, trang hỗ trợ).
 *
 * Props:
 * - sessionKey: key trong AiChatContext (productId hoặc "general")
 * - productName: tên sản phẩm để hiển thị trong placeholder và lời chào
 * - suggestions: danh sách chip gợi ý nhanh
 * - compact: true = nhúng vào tab (ProductDetailPage), false = full panel
 *
 * Luồng gửi tin nhắn:
 * 1. Append user message vào context ngay lập tức (optimistic)
 * 2. POST /api/shop/ai/product-advice với sessionKey là productId (hoặc vắng mặt nếu "general")
 * 3. Append AI reply vào context
 * 4. Nếu có suggestedProducts trong response → hiển thị ProductAiSuggestionCard
 */

import React, { useEffect, useRef, useState } from "react";
import { MdSmartToy, MdDeleteOutline, MdAutoAwesome, MdArrowUpward } from "react-icons/md";
import { useAiChatContext } from "@/features/shop/context/AiChatContext";
import type {
  AiMessage,
  ProductAdviceMessage,
  ProductAdviceResponseDto,
  SuggestedProductDto,
} from "@/types/ai";
import ProductAiSuggestionCard from "../product-detail/ProductAiSuggestionCard";
import styles from "./AiChatPanel.module.css";

const GENERAL_SESSION_KEY = "general";
const GENERAL_SESSION_NAME = "Tư vấn âm thanh";

type AiChatPanelProps = {
  /** productId hoặc "general" cho chế độ tư vấn tổng quát */
  sessionKey: string;
  /** Tên sản phẩm — hiển thị trong placeholder và lời chào */
  productName?: string;
  /** Chip gợi ý nhanh phía trên input */
  suggestions?: string[];
  /** true = nhúng vào tab (chiều cao tự co), false = full panel chiếm toàn bộ */
  compact?: boolean;
};

const DEFAULT_SUGGESTIONS = [
  "Gợi ý bộ setup phòng nghe",
  "So sánh loa bookshelf và floor-standing",
  "Tư vấn theo ngân sách",
  "Xử lý âm học phòng nghe",
];

export default function AiChatPanel({
  sessionKey,
  productName,
  suggestions,
  compact = false,
}: AiChatPanelProps) {
  const { sessions, ensureSession, appendMessage, clearSession } = useAiChatContext();

  const resolvedName =
    productName ?? (sessionKey === GENERAL_SESSION_KEY ? GENERAL_SESSION_NAME : sessionKey);
  const resolvedSuggestions = suggestions ?? DEFAULT_SUGGESTIONS;

  const chatSession = sessions[sessionKey] ?? null;
  const aiMessages: AiMessage[] = chatSession?.messages ?? [];

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProductDto[]>([]);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Khởi tạo session (phải trong useEffect)
  useEffect(() => {
    ensureSession(sessionKey, resolvedName);
  }, [sessionKey, resolvedName, ensureSession]);

  // Scroll xuống cuối khi có tin nhắn mới
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [aiMessages]);

  const handleSend = async (overrideText?: string) => {
    const text = overrideText ?? input.trim();
    if (!text || isLoading || !chatSession) return;

    const userUiMsg: AiMessage = { id: `u-${Date.now()}`, role: "user", text };
    const userHistMsg: ProductAdviceMessage = { role: "user", content: text };

    appendMessage(sessionKey, userUiMsg, userHistMsg);
    if (!overrideText) setInput("");
    setIsLoading(true);
    setSuggestedProducts([]);

    const messagesForApi: ProductAdviceMessage[] = [
      ...chatSession.conversationHistory,
      userHistMsg,
    ];

    try {
      const res = await fetch("/api/shop/ai/product-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(sessionKey !== GENERAL_SESSION_KEY ? { productId: sessionKey } : {}),
          messages: messagesForApi,
        }),
      });

      if (!res.ok) throw new Error("AI không phản hồi.");

      const data = (await res.json()) as ProductAdviceResponseDto;
      const aiUiMsg: AiMessage = { id: `a-${Date.now()}`, role: "ai", text: data.answer };
      const aiHistMsg: ProductAdviceMessage = { role: "assistant", content: data.answer };

      appendMessage(sessionKey, aiUiMsg, aiHistMsg);

      if (data.suggestedProducts && data.suggestedProducts.length > 0) {
        setSuggestedProducts(data.suggestedProducts);
      }
    } catch {
      const errorMsg: AiMessage = {
        id: `err-${Date.now()}`,
        role: "ai",
        text: "Xin lỗi, tôi gặp sự cố khi xử lý câu hỏi của bạn. Vui lòng thử lại sau.",
      };
      appendMessage(sessionKey, errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleChipClick = (text: string) => {
    void handleSend(text);
  };

  const handleClearSession = () => {
    clearSession(sessionKey);
    setSuggestedProducts([]);
  };

  const placeholder =
    sessionKey === GENERAL_SESSION_KEY
      ? "Hỏi về setup hifi, thông số kỹ thuật, hay âm học phòng nghe..."
      : `Nhập câu hỏi về ${resolvedName}...`;

  return (
    <div
      className={[
        styles["ai-chat-panel"],
        compact ? styles["ai-chat-panel--compact"] : styles["ai-chat-panel--full"],
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Banner tiếp tục hội thoại */}
      {aiMessages.length > 1 && (
        <div className={styles["ai-chat-panel__history-bar"]}>
          <span className={styles["ai-chat-panel__history-text"]}>
            Tiếp tục hội thoại từ phiên trước
          </span>
          <button
            type="button"
            className={styles["ai-chat-panel__clear-btn"]}
            onClick={handleClearSession}
            aria-label="Xóa hội thoại"
          >
            <MdDeleteOutline aria-hidden="true" />
            Xóa hội thoại
          </button>
        </div>
      )}

      {/* Vùng tin nhắn */}
      <div ref={chatContainerRef} className={styles["ai-chat-panel__messages"]}>
        {aiMessages.map((msg) => (
          <div
            key={msg.id}
            className={[
              styles["ai-chat-panel__message"],
              msg.role === "user"
                ? styles["ai-chat-panel__message--user"]
                : styles["ai-chat-panel__message--ai"],
            ].join(" ")}
          >
            {msg.role === "ai" && (
              <div className={styles["ai-chat-panel__avatar"]}>
                <MdSmartToy aria-hidden="true" />
              </div>
            )}
            <div
              className={[
                styles["ai-chat-panel__bubble"],
                msg.role === "user"
                  ? styles["ai-chat-panel__bubble--user"]
                  : styles["ai-chat-panel__bubble--ai"],
              ].join(" ")}
            >
              {msg.text.split("\n\n").map((para, pIdx) => (
                <p key={pIdx} className={styles["ai-chat-panel__bubble-para"]}>
                  {para.split("\n").map((line, lIdx, arr) => (
                    <React.Fragment key={lIdx}>
                      {line}
                      {lIdx < arr.length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </p>
              ))}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div
            className={[
              styles["ai-chat-panel__message"],
              styles["ai-chat-panel__message--ai"],
            ].join(" ")}
          >
            <div className={styles["ai-chat-panel__avatar"]}>
              <MdSmartToy aria-hidden="true" />
            </div>
            <div
              className={[
                styles["ai-chat-panel__bubble"],
                styles["ai-chat-panel__bubble--ai"],
              ].join(" ")}
            >
              <div className={styles["ai-chat-panel__typing"]}>
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}

        {/* Sản phẩm gợi ý */}
        {!isLoading && suggestedProducts.length > 0 && (
          <div className={styles["ai-chat-panel__suggestions-card"]}>
            <ProductAiSuggestionCard products={suggestedProducts} />
          </div>
        )}
      </div>

      {/* Vùng input */}
      <div className={styles["ai-chat-panel__footer"]}>
        {/* Chip gợi ý nhanh - Ẩn sau khi bắt đầu chat */}
        {aiMessages.length <= 1 && (
          <div className={styles["ai-chat-panel__chips"]}>
            {resolvedSuggestions.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                className={styles["ai-chat-panel__chip"]}
                onClick={() => handleChipClick(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className={styles["ai-chat-panel__input-wrap"]}>
          <span
            className={styles["ai-chat-panel__input-icon"]}
            aria-hidden="true"
          >
            <MdAutoAwesome />
          </span>
          <input
            ref={inputRef}
            type="text"
            className={styles["ai-chat-panel__input"]}
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            aria-label="Nhập câu hỏi"
          />
          <button
            type="button"
            className={styles["ai-chat-panel__send-btn"]}
            onClick={() => void handleSend()}
            disabled={!input.trim() || isLoading}
            aria-label="Gửi câu hỏi"
          >
            <MdArrowUpward />
          </button>
        </div>

        <p className={styles["ai-chat-panel__disclaimer"]}>
          Câu trả lời từ Đức Uy AI chỉ mang tính tham khảo. Liên hệ shop để được tư vấn chuyên sâu.
        </p>
      </div>
    </div>
  );
}
