import { callGroqJson } from "@/lib/groq-json";

const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

export type BrandSeoAiInput = {
  name: string;
  description?: string | null;
};

export type BrandSeoAiOutput = {
  seoTitle?: string;
  seoDescription?: string;
  aiDescription?: string;
  aiTags?: string[];
};

/**
 * Gọi Groq để sinh nội dung SEO + mô tả AI cho thương hiệu (Brand).
 * Dùng cho trang thương hiệu và cho chatbot gợi ý theo phong cách/đặc trưng brand.
 * Nếu thiếu GROQ_API_KEY hoặc API lỗi, trả về object rỗng.
 */
export async function generateBrandSeoAndAiFields(
  input: BrandSeoAiInput,
): Promise<BrandSeoAiOutput> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return {};
  }

  const model = process.env.GROQ_MODEL_NAME ?? DEFAULT_GROQ_MODEL;

  const trimmedDescription =
    input.description && input.description.length > 900
      ? `${input.description.slice(0, 900)}...`
      : input.description ?? null;

  const commonContextLines = [
    "Bạn là trợ lý viết nội dung cho hệ thống thương mại điện tử thiết bị âm thanh.",
    "Đối tượng: THƯƠNG HIỆU (brand) thiết bị âm thanh. Nhiệm vụ: sinh nội dung chuẩn SEO và mô tả cho AI tư vấn, ngắn gọn, rõ ràng, đủ chi tiết.",
    "",
    "Thông tin thương hiệu:",
    `- Tên thương hiệu: ${input.name}`,
    `- Mô tả (rút gọn): ${trimmedDescription ?? "Không có"}`,
    "",
    "Trả lời duy nhất bằng JSON theo đúng cấu trúc yêu cầu, không thêm text ngoài JSON.",
    "",
  ].join("\n");

  const seoPrompt = [
    commonContextLines,
    "Sinh nội dung SEO cho trang giới thiệu thương hiệu, trả về đúng JSON sau (không thêm gì ngoài JSON):",
    "{",
    '  "seoTitle": string,       // 50-60 ký tự, tiếng Việt, tên thương hiệu + từ khóa (ampli, loa, thiết bị âm thanh...), có thể thêm Đức Uy Audio khi hợp lý.',
    '  "seoDescription": string  // BẮT BUỘC 155-160 ký tự: tóm tắt đặc điểm thương hiệu, phân khúc (bình dân/hi-end), điểm mạnh, kêu gọi xem sản phẩm. Tiếng Việt, câu hoàn chỉnh.',
    "}",
  ].join("\n");

  const aiPrompt = [
    commonContextLines,
    "Sinh nội dung cho AI tư vấn (chatbot) dùng để match thương hiệu với nhu cầu khách, trả về đúng JSON sau (không thêm gì ngoài JSON):",
    "{",
    '  "aiDescription": string,  // 2-3 câu: phong cách âm thanh (ấm, chi tiết, mạnh...), phân khúc giá, điểm mạnh công nghệ/thiết kế. Đủ để chatbot gợi ý "thương hiệu X phù hợp với ai thích âm ấm".',
    '  "aiTags": string[]        // 4-6 thẻ slug tiếng Việt không dấu, GẮN CHẶT với tên và đặc trưng brand: xuất xứ (nhat, han-quoc), phong cách (am-thanh-am, chi-tiet), phân khúc (hi-end, binh-dan). Dạng: "nhat", "am-thanh-am", "hi-end".',
    "}",
  ].join("\n");

  const output: BrandSeoAiOutput = {};

  const seoJson = await callGroqJson<{
    seoTitle?: unknown;
    seoDescription?: unknown;
  }>({
    apiKey,
    model,
    prompt: seoPrompt,
    maxTokens: 800,
    debugLabel: "[Groq][BrandSEO][SEO]",
  });

  if (seoJson) {
    if (typeof seoJson.seoTitle === "string") {
      output.seoTitle = seoJson.seoTitle.trim();
    }
    if (typeof seoJson.seoDescription === "string") {
      output.seoDescription = seoJson.seoDescription.trim();
    }
  }

  const aiJson = await callGroqJson<{
    aiDescription?: unknown;
    aiTags?: unknown;
  }>({
    apiKey,
    model,
    prompt: aiPrompt,
    maxTokens: 1000,
    debugLabel: "[Groq][BrandSEO][AI]",
  });

  if (aiJson) {
    if (typeof aiJson.aiDescription === "string") {
      output.aiDescription = aiJson.aiDescription.trim();
    }
    if (Array.isArray(aiJson.aiTags)) {
      output.aiTags = aiJson.aiTags
        .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
        .filter((tag) => tag.length > 0);
    }
  }

  return output;
}
