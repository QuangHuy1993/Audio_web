import { callGroqJson } from "@/lib/groq-json";

type CategorySeoAiInput = {
  name: string;
  description?: string | null;
  parentName?: string | null;
};

type CategorySeoAiOutput = {
  seoTitle?: string;
  seoDescription?: string;
  aiDescription?: string;
  aiTags?: string[];
};

const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

/**
 * Gọi Groq (llama-3.1-8b-instant) để sinh nội dung SEO + mô tả AI cho danh mục.
 * Nếu thiếu GROQ_API_KEY hoặc API lỗi, hàm trả về object rỗng để không chặn luồng tạo/cập nhật danh mục.
 */
export async function generateCategorySeoAndAiFields(
  input: CategorySeoAiInput,
): Promise<CategorySeoAiOutput> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return {};
  }

  const model = process.env.GROQ_MODEL_NAME ?? DEFAULT_GROQ_MODEL;

  // Để tránh bị vượt token do phần mô tả đầu vào quá dài hoặc chứa quá nhiều chi tiết,
  // ta vẫn cắt ngắn description đưa vào prompt, nhưng nới giới hạn lên để cho phép
  // admin mô tả dài hơn (khoảng ~150–180 từ). Việc này KHÔNG ảnh hưởng tới dữ liệu
  // lưu trong DB, chỉ giúp model tập trung sinh nội dung.
  const trimmedDescription =
    input.description && input.description.length > 900
      ? `${input.description.slice(0, 900)}...`
      : input.description ?? null;

  const commonContextLines = [
    "Bạn là trợ lý viết nội dung cho hệ thống thương mại điện tử thiết bị âm thanh.",
    "Nhiệm vụ: sinh nội dung chuẩn SEO và mô tả cho AI tư vấn, ngắn gọn, rõ ràng, đủ chi tiết.",
    "",
    "Thông tin danh mục:",
    `- Tên danh mục: ${input.name}`,
    `- Mô tả (rút gọn): ${trimmedDescription ?? "Không có"}`,
    `- Danh mục cha: ${input.parentName ?? "Không có"}`,
    "",
    "Trả lời duy nhất bằng JSON theo đúng cấu trúc yêu cầu, không thêm text ngoài JSON.",
    "",
  ].join("\n");

  const seoPrompt = [
    commonContextLines,
    "Sinh nội dung SEO, trả về đúng JSON sau (không thêm gì ngoài JSON):",
    "{",
    '  "seoTitle": string,       // 50-60 ký tự, tiếng Việt, có từ khóa chính của danh mục, tự nhiên, có thể thêm brand (ví dụ Đức Uy Audio) khi hợp lý.',
    '  "seoDescription": string  // BẮT BUỘC 155-160 ký tự: tóm tắt đặc điểm nổi bật, lợi ích chính, kêu gọi xem thêm. Tiếng Việt, câu hoàn chỉnh, không cắt cụt.',
    "}",
  ].join("\n");

  const aiPrompt = [
    commonContextLines,
    "Sinh nội dung cho AI tư vấn sản phẩm, trả về đúng JSON sau (không thêm gì ngoài JSON):",
    "{",
    '  "aiDescription": string,  // 2-3 câu: mục đích sử dụng, không gian phù hợp (phòng khách, phòng nghe, ...), trải nghiệm âm thanh. Đủ chi tiết để AI gợi ý sản phẩm đúng nhu cầu.',
    '  "aiTags": string[]        // 4-6 thẻ slug tiếng Việt không dấu, GẮN CHẶT với tên và nội dung danh mục: dùng từ đồng nghĩa/liên quan (ví dụ Loa kệ -> loa-ke, loa-bookshelf, loa-treo-tuong; Ampli đèn -> ampli-den, ampli-tube). Dạng: "loa-ke", "phong-khach", "hi-fi".',
    "}",
  ].join("\n");

  const output: CategorySeoAiOutput = {};

  // Call 1: SEO (tiêu đề + mô tả ngắn)
  const seoJson = await callGroqJson<{
    seoTitle?: unknown;
    seoDescription?: unknown;
  }>({
    apiKey,
    model,
    prompt: seoPrompt,
    maxTokens: 800,
    debugLabel: "[Groq][CategorySEO][SEO]",
  });

  if (seoJson) {
    if (typeof seoJson.seoTitle === "string") {
      output.seoTitle = seoJson.seoTitle.trim();
    }
    if (typeof seoJson.seoDescription === "string") {
      output.seoDescription = seoJson.seoDescription.trim();
    }
  }

  // Call 2: AI description + tags
  const aiJson = await callGroqJson<{
    aiDescription?: unknown;
    aiTags?: unknown;
  }>({
    apiKey,
    model,
    prompt: aiPrompt,
    maxTokens: 1000,
    debugLabel: "[Groq][CategorySEO][AI]",
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

