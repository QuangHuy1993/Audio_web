import { callGroqJson } from "@/lib/groq-json";

const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

export type ProductSeoAiInput = {
  name: string;
  description: string;
  categoryName?: string | null;
  brandName?: string | null;
  priceVnd?: number | null;
  brandSeoDescription?: string | null;
  brandAiDescription?: string | null;
  brandAiTags?: string[] | null;
  categorySeoDescription?: string | null;
  categoryAiDescription?: string | null;
  categoryAiTags?: string[] | null;
};

export type ProductSeoAiOutput = {
  seoTitle?: string;
  seoDescription?: string;
  aiDescription?: string;
  aiTags?: string[];
};

/**
 * Gọi Groq để sinh nội dung SEO + mô tả AI cho sản phẩm (Product).
 * Tận dụng đầy đủ ngữ cảnh từ Brand + Category:
 * - Thông tin SEO/AI đã được sinh cho thương hiệu và danh mục.
 * - Thông tin chi tiết của sản phẩm (tên, mô tả, giá).
 *
 * Hàm chỉ gọi LLM **một lần** để lấy đủ 4 trường, giảm độ trễ so với 2 lần call.
 * Nếu thiếu GROQ_API_KEY hoặc API lỗi, trả về object rỗng.
 */
export async function generateProductSeoAndAiFields(
  input: ProductSeoAiInput,
): Promise<ProductSeoAiOutput> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return {};
  }

  const model = process.env.GROQ_MODEL_NAME ?? DEFAULT_GROQ_MODEL;

  const trimmedProductDescription =
    input.description.length > 900
      ? `${input.description.slice(0, 900)}...`
      : input.description;

  const priceLine =
    input.priceVnd != null && input.priceVnd > 0
      ? `- Giá tham khảo: khoảng ${(input.priceVnd / 1_000_000).toFixed(
          1,
        )} triệu VND`
      : "";

  const brandContextLines: string[] = [];
  if (
    input.brandName ||
    input.brandSeoDescription ||
    input.brandAiDescription ||
    (input.brandAiTags && input.brandAiTags.length > 0)
  ) {
    brandContextLines.push(
      "Thông tin THƯƠNG HIỆU (nếu có):",
      `- Tên thương hiệu: ${input.brandName ?? "Không có"}`,
      input.brandSeoDescription
        ? `- SEO description brand: ${input.brandSeoDescription}`
        : "- SEO description brand: Không có",
      input.brandAiDescription
        ? `- AI description brand: ${input.brandAiDescription}`
        : "- AI description brand: Không có",
      input.brandAiTags && input.brandAiTags.length > 0
        ? `- AI tags brand: ${input.brandAiTags.join(", ")}`
        : "- AI tags brand: Không có",
      "",
    );
  }

  const categoryContextLines: string[] = [];
  if (
    input.categoryName ||
    input.categorySeoDescription ||
    input.categoryAiDescription ||
    (input.categoryAiTags && input.categoryAiTags.length > 0)
  ) {
    categoryContextLines.push(
      "Thông tin DANH MỤC (nếu có):",
      `- Tên danh mục: ${input.categoryName ?? "Không có"}`,
      input.categorySeoDescription
        ? `- SEO description category: ${input.categorySeoDescription}`
        : "- SEO description category: Không có",
      input.categoryAiDescription
        ? `- AI description category: ${input.categoryAiDescription}`
        : "- AI description category: Không có",
      input.categoryAiTags && input.categoryAiTags.length > 0
        ? `- AI tags category: ${input.categoryAiTags.join(", ")}`
        : "- AI tags category: Không có",
      "",
    );
  }

  const productContextLines = [
    "Thông tin SẢN PHẨM cụ thể:",
    `- Tên sản phẩm: ${input.name}`,
    `- Danh mục: ${input.categoryName ?? "Không có"}`,
    `- Thương hiệu: ${input.brandName ?? "Không có"}`,
    ...(priceLine ? [priceLine] : []),
    `- Mô tả sản phẩm (rút gọn): ${trimmedProductDescription}`,
  ];

  const promptLines = [
    "Bạn là trợ lý viết nội dung cho hệ thống thương mại điện tử thiết bị âm thanh Đức Uy Audio.",
    "Nhiệm vụ: từ thông tin thương hiệu + danh mục + sản phẩm, hãy sinh:",
    "- Nội dung SEO cho trang chi tiết sản phẩm.",
    "- Mô tả ngắn phục vụ AI tư vấn (chatbot) và bộ thẻ AI để match theo nhu cầu (phòng, gu nghe, ngân sách...).",
    "",
    ...brandContextLines,
    ...categoryContextLines,
    ...productContextLines,
    "",
    "YÊU CẦU QUAN TRỌNG:",
    "- Ưu tiên nhất quán với ngữ nghĩa đã có ở brand/category nếu hợp lý (phân khúc, phong cách âm thanh, không gian).",
    "- Không lặp lại y nguyên description marketing dài; hãy tóm tắt súc tích, giàu từ khóa ngữ nghĩa.",
    "- Không thêm text ngoài JSON. Không giải thích, không ghi chú.",
    "",
    "Trả lời DUY NHẤT bằng JSON với cấu trúc sau:",
    "{",
    '  "seoTitle": string,       // ~50-60 ký tự, tiếng Việt: tên sản phẩm + loại thiết bị + thương hiệu + 1-2 từ khóa chính, có thể thêm "Đức Uy Audio" khi phù hợp.',
    '  "seoDescription": string, // 155-170 ký tự: tóm tắt đặc điểm nổi bật, công suất/kích thước, không gian phù hợp (phòng bao nhiêu m2), use case (nghe nhạc, xem phim...), kêu gọi xem chi tiết. Câu hoàn chỉnh, không cắt cụt.',
    '  "aiDescription": string,  // 2-4 câu: mô tả ngữ nghĩa cho chatbot: không gian, gu nhạc, kiểu người dùng phù hợp, điểm mạnh nổi bật. Không nhắc giá cụ thể, không nhắc SEO.',
    '  "aiTags": string[]        // 4-10 thẻ slug tiếng Việt không dấu, tập trung vào: không gian (phong-20-30m2, phong-khach), use case (nghe-nhac, xem-phim, home-cinema), kỹ thuật (2-kenh, soundbar, bluetooth), phân khúc (hi-end, tam-trung). Mỗi tag lowercase, dùng "-" nối từ.',
    "}",
  ].join("\n");

  const json = await callGroqJson<{
    seoTitle?: unknown;
    seoDescription?: unknown;
    aiDescription?: unknown;
    aiTags?: unknown;
  }>({
    apiKey,
    model,
    prompt: promptLines,
    maxTokens: 900,
    debugLabel: "[Groq][ProductSEO][Combined]",
  });

  const output: ProductSeoAiOutput = {};

  if (json) {
    if (typeof json.seoTitle === "string") {
      output.seoTitle = json.seoTitle.trim();
    }
    if (typeof json.seoDescription === "string") {
      output.seoDescription = json.seoDescription.trim();
    }

    if (typeof json.aiDescription === "string") {
      output.aiDescription = json.aiDescription.trim();
    } else if (Array.isArray(json.aiDescription)) {
      const parts = json.aiDescription
        .map((line) => (typeof line === "string" ? line.trim() : ""))
        .filter((line) => line.length > 0);
      if (parts.length > 0) {
        output.aiDescription = parts.join(" ");
      }
    }

    if (Array.isArray(json.aiTags)) {
      output.aiTags = json.aiTags
        .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
        .filter((tag) => tag.length > 0);
    }
  }

  return output;
}
