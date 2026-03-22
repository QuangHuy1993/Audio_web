/**
 * Types cho tính năng AI tư vấn sản phẩm.
 * Dùng cho API POST /api/shop/ai/product-advice và client-side chat context.
 */

export type ProductAdviceMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ProductAdviceRequestDto = {
  /** Khi có: tư vấn theo sản phẩm cụ thể. Khi vắng mặt: chế độ tư vấn chung. */
  productId?: string;
  messages: ProductAdviceMessage[];
};

export type SuggestedProductDto = {
  id: string;
  name: string;
  slug: string;
  price: number;
  salePrice: number | null;
  primaryImageUrl: string | null;
};

export type ProductAdviceResponseDto = {
  answer: string;
  suggestedProducts?: SuggestedProductDto[];
};

/**
 * Type dùng cho AiChatContext: tin nhắn hiển thị trên UI.
 * Khác với ProductAdviceMessage (dùng để gửi lên API).
 */
export type AiMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
};

/**
 * Session chat theo từng sản phẩm, lưu trong AiChatContext.
 */
export type AiChatSession = {
  productId: string;
  productName: string;
  messages: AiMessage[];
  conversationHistory: ProductAdviceMessage[];
  lastUpdated: number;
};

// ========= Product Comparison DTOs =========

export type ProductComparisonRequestDto = {
  productIds: string[];
  criteria?: string[]; // e.g. ["Chất âm", "Thiết kế", "Tính năng"]
};

export type ProductComparisonResponseDto = {
  comparisonData: {
    criteria: string;
    values: {
      productId: string;
      value: string;
    }[];
  }[];
  summary: string;
};

// ========= Product Advice Search DTOs =========

export type ProductSearchCriteria = {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  intent?: string; // e.g. "Nghe nhạc vàng", "Phòng 30m2"
};

export type ProductAdviceSearchRequestDto = {
  query: string;
};

export type ProductAdviceSearchResponseDto = {
  criteria: ProductSearchCriteria;
  products: SuggestedProductDto[];
  explanation: string;
};
