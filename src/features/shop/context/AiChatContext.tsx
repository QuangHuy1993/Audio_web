"use client";

/**
 * AiChatContext – Quản lý lịch sử hội thoại AI theo từng sản phẩm.
 *
 * Mục đích:
 * - Giữ lịch sử chat khi người dùng navigate giữa các trang sản phẩm.
 * - Mỗi sản phẩm có một session riêng (key = productId).
 * - Dùng sessionStorage để persist trong cùng tab, tự xóa session > 2 giờ.
 *
 * Quan trọng: `ensureSession` phải gọi từ useEffect, KHÔNG gọi trong render
 * để tránh lỗi "setState during render". Đọc session qua `sessions[productId]`.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { AiMessage, AiChatSession, ProductAdviceMessage } from "@/types/ai";

const INIT_AI_MESSAGE = (productName: string): AiMessage => ({
  id: "init",
  role: "ai",
  text: `Xin chào! Tôi là trợ lý AI của Đức Uy Audio. Hãy hỏi tôi bất kỳ điều gì về ${productName} – phối ghép, không gian phù hợp, so sánh, hay cách tối ưu âm thanh.`,
});

const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 giờ
const STORAGE_KEY = "ai-chat-sessions";

type AiChatContextValue = {
  /** Map session theo productId – dùng để đọc trong render. */
  sessions: Record<string, AiChatSession>;
  /**
   * Khởi tạo session nếu chưa có. Chỉ gọi từ useEffect, không gọi trong render.
   */
  ensureSession: (productId: string, productName: string) => void;
  appendMessage: (
    productId: string,
    uiMessage: AiMessage,
    historyMessage?: ProductAdviceMessage,
  ) => void;
  clearSession: (productId: string) => void;
  clearAllSessions: () => void;
};

const AiChatContext = createContext<AiChatContextValue | undefined>(undefined);

type AiChatProviderProps = {
  children: React.ReactNode;
};

export function AiChatProvider({ children }: AiChatProviderProps) {
  const [sessions, setSessions] = useState<Record<string, AiChatSession>>({});
  const [hydrated, setHydrated] = useState(false);

  // Hydrate từ sessionStorage khi mount (client-side only)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, AiChatSession>;
        const now = Date.now();
        const valid = Object.fromEntries(
          Object.entries(parsed).filter(
            ([, s]) => now - s.lastUpdated < SESSION_MAX_AGE_MS,
          ),
        );
        setSessions(valid);
      }
    } catch {
      // Bỏ qua nếu sessionStorage không khả dụng hoặc parse lỗi
    }
    setHydrated(true);
  }, []);

  // Sync sang sessionStorage khi sessions thay đổi (chỉ sau khi đã hydrate)
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // Bỏ qua lỗi ghi (ví dụ: quota exceeded)
    }
  }, [sessions, hydrated]);

  /**
   * Khởi tạo session cho sản phẩm nếu chưa có.
   * An toàn: chỉ set state khi session thực sự chưa tồn tại.
   * Phải gọi từ useEffect, không được gọi trong render.
   */
  const ensureSession = useCallback(
    (productId: string, productName: string) => {
      setSessions((prev) => {
        if (prev[productId]) return prev; // đã có, không thay đổi
        const newSession: AiChatSession = {
          productId,
          productName,
          messages: [INIT_AI_MESSAGE(productName)],
          conversationHistory: [],
          lastUpdated: Date.now(),
        };
        return { ...prev, [productId]: newSession };
      });
    },
    [],
  );

  const appendMessage = useCallback(
    (
      productId: string,
      uiMessage: AiMessage,
      historyMessage?: ProductAdviceMessage,
    ) => {
      setSessions((prev) => {
        const existing = prev[productId];
        if (!existing) return prev;

        return {
          ...prev,
          [productId]: {
            ...existing,
            messages: [...existing.messages, uiMessage],
            conversationHistory: historyMessage
              ? [...existing.conversationHistory, historyMessage]
              : existing.conversationHistory,
            lastUpdated: Date.now(),
          },
        };
      });
    },
    [],
  );

  const clearSession = useCallback((productId: string) => {
    setSessions((prev) => {
      const existing = prev[productId];
      if (!existing) return prev;
      return {
        ...prev,
        [productId]: {
          ...existing,
          messages: [INIT_AI_MESSAGE(existing.productName)],
          conversationHistory: [],
          lastUpdated: Date.now(),
        },
      };
    });
  }, []);

  const clearAllSessions = useCallback(() => {
    setSessions({});
  }, []);

  const value: AiChatContextValue = {
    sessions,
    ensureSession,
    appendMessage,
    clearSession,
    clearAllSessions,
  };

  return (
    <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>
  );
}

export function useAiChatContext(): AiChatContextValue {
  const context = useContext(AiChatContext);

  if (!context) {
    return {
      sessions: {},
      ensureSession: () => undefined,
      appendMessage: () => undefined,
      clearSession: () => undefined,
      clearAllSessions: () => undefined,
    };
  }

  return context;
}
