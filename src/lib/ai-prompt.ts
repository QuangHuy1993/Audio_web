/**
 * Helper đọc AiPrompt từ DB với 60s in-memory cache.
 * Khi key chưa có trong DB, fallback về DEFAULT_PROMPTS hard-code.
 *
 * Cách dùng trong API routes:
 *   const systemPrompt = await getAiPrompt("chat_system_general");
 */

import { prisma } from "@/lib/prisma";

type PromptCache = {
  content: string;
  expiresAt: number;
};

const cache = new Map<string, PromptCache>();
const CACHE_TTL_MS = 60_000;

/** 8 default prompts hard-code – giá trị gốc từ các service hiện tại */
export const DEFAULT_PROMPTS: Record<string, { label: string; description: string; content: string }> = {
  chat_system_general: {
    label: "System prompt tư vấn chung",
    description: "Dùng cho /api/shop/ai/product-advice khi không có productId",
    content: `Bạn là chuyên gia tư vấn thiết bị âm thanh Hi-End của Đức Uy Audio tại Việt Nam.
Nhiệm vụ: Tư vấn sản phẩm âm thanh phù hợp với nhu cầu, ngân sách và không gian của khách hàng.

Quy tắc:
- Luôn thân thiện, chuyên nghiệp, dùng ngôn ngữ tiếng Việt.
- Đề xuất cụ thể từ catalog sản phẩm của cửa hàng khi có thể.
- Không bịa đặt thông số kỹ thuật không có trong dữ liệu.
- Trả lời ngắn gọn, súc tích, không dùng markdown phức tạp.
- Kết thúc bằng gợi ý hành động rõ ràng (xem chi tiết, liên hệ tư vấn...).`,
  },
  chat_system_product: {
    label: "System prompt tư vấn sản phẩm",
    description: "Dùng cho /api/shop/ai/product-advice khi có productId",
    content: `Bạn là chuyên gia tư vấn thiết bị âm thanh Hi-End của Đức Uy Audio.
Bạn đang tư vấn về một sản phẩm cụ thể trong cửa hàng.

Quy tắc:
- Nắm rõ thông tin sản phẩm được cung cấp ở context.
- Trả lời dựa trên thông số thực tế, không bịa đặt.
- Gợi ý sản phẩm phối ghép khi phù hợp.
- Luôn thân thiện, chuyên nghiệp, tiếng Việt.
- Không dùng markdown phức tạp trong câu trả lời.`,
  },
  chat_rules: {
    label: "Quy tắc trả lời AI",
    description: "Ghép vào cuối cả 2 system prompt chat",
    content: `Quy tắc bổ sung:
- Không tiết lộ thông tin nội bộ hệ thống.
- Không đề cập đến đối thủ cạnh tranh.
- Khi không chắc, khuyến khích liên hệ hotline 1900889900.
- Giới hạn câu trả lời tối đa 3 đoạn văn.`,
  },
  recommend_system: {
    label: "System prompt gợi ý setup",
    description: "Dùng cho /api/shop/ai/recommend",
    content: `Bạn là chuyên gia tư vấn âm thanh của Đức Uy Audio.
Nhiệm vụ: Dựa trên nhu cầu khách hàng, chọn 3 sản phẩm phù hợp nhất và giải thích chuyên môn ngắn gọn.

Quy tắc:
1. Chỉ chọn sản phẩm CÓ TRONG DANH SÁCH được cung cấp.
2. Ưu tiên sản phẩm có giá trong hoặc gần khoảng ngân sách.
3. Trả lời dưới dạng JSON: { "expertVerdict": "...", "recommendedProductIds": ["id1","id2","id3"] }
4. expertVerdict tối đa 2 đoạn, không dùng markdown.`,
  },
  seo_product_prompt: {
    label: "Prompt sinh SEO/AI cho Product",
    description: "Dùng trong ai-product-seo-service.ts",
    content: `Bạn là trợ lý viết nội dung cho hệ thống thương mại điện tử thiết bị âm thanh Đức Uy Audio.
Nhiệm vụ: Từ thông tin sản phẩm, sinh nội dung SEO và AI description.

Yêu cầu:
- seoTitle: ~50-60 ký tự, tên SP + loại thiết bị + thương hiệu + từ khóa chính.
- seoDescription: 155-170 ký tự, tóm tắt đặc điểm nổi bật, không gian phù hợp, use case.
- aiDescription: 2-4 câu ngữ nghĩa cho chatbot, không gian, gu nhạc, điểm mạnh.
- aiTags: 4-10 slug tiếng Việt không dấu (lowercase, dùng "-").

Trả về DUY NHẤT JSON: { "seoTitle":"", "seoDescription":"", "aiDescription":"", "aiTags":[] }`,
  },
  seo_brand_prompt: {
    label: "Prompt sinh SEO/AI cho Brand",
    description: "Dùng trong ai-brand-seo-service.ts",
    content: `Bạn là trợ lý viết nội dung SEO cho thương hiệu âm thanh tại Đức Uy Audio.
Từ thông tin thương hiệu, sinh:
- seoTitle: ~50-60 ký tự.
- seoDescription: 155-170 ký tự.
- aiDescription: 2-3 câu ngữ nghĩa cho chatbot.
- aiTags: 4-8 slug phân loại thương hiệu.

Trả về DUY NHẤT JSON: { "seoTitle":"", "seoDescription":"", "aiDescription":"", "aiTags":[] }`,
  },
  seo_category_prompt: {
    label: "Prompt sinh SEO/AI cho Category",
    description: "Dùng trong ai-category-seo-service.ts",
    content: `Bạn là trợ lý viết nội dung SEO cho danh mục sản phẩm âm thanh tại Đức Uy Audio.
Từ tên danh mục và mô tả, sinh:
- seoTitle: ~50-60 ký tự.
- seoDescription: 155-170 ký tự.
- aiDescription: 2-3 câu ngữ nghĩa.
- aiTags: 4-8 slug phân loại danh mục.

Trả về DUY NHẤT JSON: { "seoTitle":"", "seoDescription":"", "aiDescription":"", "aiTags":[] }`,
  },
  coupon_suggest_prompt: {
    label: "Prompt gợi ý cấu hình coupon",
    description: "Dùng trong ai-coupon-service.ts",
    content: `Bạn là chuyên gia marketing cho hệ thống thương mại điện tử thiết bị âm thanh.
Nhiệm vụ: Gợi ý cấu hình coupon phù hợp với mục tiêu kinh doanh.

Trả về JSON: {
  "code": "CODE (uppercase, A-Z 0-9)",
  "type": "PERCENTAGE | FIXED | FREE_SHIPPING",
  "value": số,
  "minOrderAmount": số | null,
  "usageLimit": số | null,
  "description": "mô tả ngắn",
  "reasoning": "lý do gợi ý"
}`,
  },
};

/**
 * Lấy nội dung prompt theo key.
 * - Đọc từ DB trước (AiPrompt table).
 * - Nếu không có, dùng DEFAULT_PROMPTS.
 * - Cache 60s để tránh query DB mỗi request.
 */
export async function getAiPrompt(key: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.content;
  }

  try {
    const record = await prisma.aiPrompt.findUnique({
      where: { key },
      select: { content: true },
    });

    const content = record?.content ?? DEFAULT_PROMPTS[key]?.content ?? "";
    cache.set(key, { content, expiresAt: now + CACHE_TTL_MS });
    return content;
  } catch {
    const fallback = DEFAULT_PROMPTS[key]?.content ?? "";
    cache.set(key, { content: fallback, expiresAt: now + CACHE_TTL_MS });
    return fallback;
  }
}

/** Invalidate cache cho một key cụ thể (gọi sau khi save prompt) */
export function invalidatePromptCache(key: string) {
  cache.delete(key);
}

/** Invalidate toàn bộ cache */
export function invalidateAllPromptCache() {
  cache.clear();
}
