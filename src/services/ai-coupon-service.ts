import { callGroqJson } from "@/lib/groq-json";

const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

export type CouponAiInput = {
  /**
   * Loại giảm giá admin đã chọn trên form. AI phải sinh cấu hình đúng theo loại này.
   * Nếu có preferredType thì ưu tiên dùng, bỏ qua type do AI trả về.
   */
  preferredType?: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING" | null;

  /**
   * Tên chiến dịch hoặc ngữ cảnh ngắn gọn, ví dụ:
   * - "Sale loa soundbar cuối tuần"
   * - "Ưu đãi khách mới đặt đơn đầu tiên"
   */
  campaignTitle?: string | null;

  /**
   * Tổng quan mục tiêu (không bắt buộc):
   * - "Tăng đơn mới"
   * - "Đẩy loa tồn kho"
   * - "Khuyến khích đơn trên 10 triệu"
   */
  goalDescription?: string | null;

  /** Giảm theo % (nếu admin nhập), ví dụ 10, 15, 20 */
  discountPercent?: number | null;

  /** Giảm số tiền cố định (VND), ví dụ 200000, 500000 */
  discountFixedVnd?: number | null;

  /** Có miễn/giảm phí ship không */
  freeShipping?: boolean | null;

  /**
   * Đơn tối thiểu để áp dụng (VND).
   * Nếu admin không nhập, AI có thể gợi ý.
   */
  minOrderAmountVnd?: number | null;

  /**
   * Mức giảm tối đa (VND) khi dùng %.
   * Nếu không nhập, AI có thể gợi ý theo ngữ cảnh.
   */
  maxDiscountVnd?: number | null;

  /**
   * Giới hạn số lần sử dụng tổng (toàn hệ thống).
   * null = không giới hạn / để AI đề xuất.
   */
  usageLimit?: number | null;
  /**
   * Giới hạn số lần 1 người dùng có thể dùng mã này.
   * null = không giới hạn / để AI đề xuất.
   */
  usageLimitPerUser?: number | null;

  /**
   * Ngày bắt đầu mong muốn (ISO string). Có thể là ngay hôm nay.
   * Nếu null, AI có thể đề xuất "bắt đầu ngay".
   */
  preferredStartsAt?: string | null;

  /**
   * Ngày kết thúc mong muốn (ISO string) nếu admin đã chọn.
   * Nếu null nhưng có validDays, AI nên suy ra ngày kết thúc.
   */
  preferredEndsAt?: string | null;

  /**
   * Số ngày muốn áp dụng (ví dụ 3 ngày, 7 ngày),
   * dùng để AI chọn khoảng thời gian hợp lý nếu chưa có endsAt cụ thể.
   */
  validDays?: number | null;
};

export type CouponAiOutput = {
  /**
   * Mã coupon gợi ý:
   * - Chỉ gồm A–Z, 0–9, dấu gạch ngang.
   * - Viết hoa, không dấu cách.
   */
  code: string;

  /**
   * Mô tả ngắn cho admin / trang checkout:
   * - Tiếng Việt, 1–2 câu.
   * - Nêu rõ % hoặc số tiền, điều kiện đơn tối thiểu, thời gian áp dụng.
   */
  description: string;

  /**
   * Kiểu coupon map thẳng vào enum CouponType trong Prisma:
   * - "PERCENTAGE" | "FIXED" | "FREE_SHIPPING"
   */
  type: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";

  /** Giá trị giảm:
   * - Nếu PERCENTAGE → % giảm (0–100).
   * - Nếu FIXED → số tiền VND.
   * - Nếu FREE_SHIPPING → mức hỗ trợ phí ship tối đa (VND) hoặc null nếu miễn toàn bộ.
   */
  value: number | null;

  /** Mức giảm tối đa (VND) nếu là % */
  maxDiscountVnd: number | null;

  /** Đơn tối thiểu (VND) để áp dụng */
  minOrderAmountVnd: number | null;

  /** Giới hạn tổng số lượt sử dụng (null = không giới hạn) */
  usageLimit: number | null;
  /** Giới hạn số lượt dùng cho mỗi khách hàng */
  usageLimitPerUser: number | null;

  /** Gợi ý ngày bắt đầu/kết thúc dạng ISO string (client sẽ map sang Date) */
  suggestedStartsAt: string | null;
  suggestedEndsAt: string | null;
};

type RawCouponAiJson = {
  code?: unknown;
  description?: unknown;
  type?: unknown;
  value?: unknown;
  maxDiscountVnd?: unknown;
  minOrderAmountVnd?: unknown;
  usageLimit?: unknown;
  usageLimitPerUser?: unknown;
  suggestedStartsAt?: unknown;
  suggestedEndsAt?: unknown;
};

const VALID_TYPES = ["PERCENTAGE", "FIXED", "FREE_SHIPPING"] as const;

function toSafeNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === "string") {
    const parsed = Number(input.replace(/_/g, "").trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function sanitizeCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const upper = raw.toUpperCase().trim();
  const cleaned = upper.replace(/[^A-Z0-9-]/g, "");
  return cleaned.slice(0, 40);
}

/**
 * Gọi Groq để AI gợi ý đầy đủ thông tin coupon dựa trên vài input cơ bản.
 * Thích hợp cho UX: admin chỉ nhập % / số tiền / freeship + (tùy chọn) thời gian,
 * bấm "AI gợi ý" để sinh:
 * - Mã coupon (code),
 * - Mô tả,
 * - type + value + minOrderAmount + maxDiscount + usageLimit + khoảng thời gian.
 */
export async function generateCouponSuggestion(
  input: CouponAiInput,
): Promise<CouponAiOutput | null> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return null;
  }

  const model = process.env.GROQ_MODEL_NAME ?? DEFAULT_GROQ_MODEL;

  const lines: string[] = [];

  const enforcedType =
    input.preferredType && VALID_TYPES.includes(input.preferredType)
      ? input.preferredType
      : null;

  lines.push(
    "Bạn là trợ lý backend cho hệ thống thương mại điện tử thiết bị âm thanh Đức Uy Audio.",
    "Nhiệm vụ: dựa trên vài thông tin admin nhập (mục tiêu, mức giảm, thời gian), hãy GỢI Ý cấu hình mã giảm giá (coupon) hoàn chỉnh.",
    "",
    "YÊU CẦU:",
    "- Mã coupon dễ hiểu, ngắn, không chứa tiếng Việt có dấu, chỉ dùng A-Z, 0-9, '-' (ví dụ: LOA_WEEKEND10, NEWUSER-200K).",
    enforcedType
      ? `- Admin ĐÃ CHỌN loại giảm giá: ${enforcedType}. Bạn BẮT BUỘC trả về "type" đúng giá trị "${enforcedType}" và sinh value/code/description phù hợp với loại này.`
      : "- Tự chọn type phù hợp (PERCENTAGE, FIXED, FREE_SHIPPING) nếu admin chưa rõ, nhưng phải KHỚP với các con số đã cho.",
    "- Nếu admin nhập cả discountPercent và discountFixedVnd thì ưu tiên discountPercent, coi discountFixedVnd là gợi ý tham khảo.",
    "- Tự đề xuất minOrderAmount, maxDiscountVnd, usageLimit, usageLimitPerUser nếu chưa có, theo hướng an toàn (không quá hào phóng).",
    "- usageLimitPerUser nên để là 1 nếu là ưu đãi khách mới hoặc flash sale, hoặc bỏ trống nếu là ưu đãi chung.",
    "- Nếu có validDays mà chưa có preferredEndsAt, hãy đề xuất khoảng thời gian từ preferredStartsAt (hoặc hôm nay) + validDays.",
    "- Mô tả ngắn gọn bằng tiếng Việt, 1–2 câu, nêu rõ điều kiện quan trọng (đơn tối thiểu, thời gian, đối tượng nếu có).",
    "",
    "THÔNG TIN ĐẦU VÀO:",
    `- preferredType (loại admin chọn): ${enforcedType ?? "Không chọn - AI tự chọn"}`,
    `- campaignTitle: ${input.campaignTitle ?? "Không có"}`,
    `- goalDescription: ${input.goalDescription ?? "Không có"}`,
    `- discountPercent: ${input.discountPercent ?? "null"}`,
    `- discountFixedVnd: ${input.discountFixedVnd ?? "null"}`,
    `- freeShipping: ${input.freeShipping ?? false}`,
    `- minOrderAmountVnd: ${input.minOrderAmountVnd ?? "null"}`,
    `- maxDiscountVnd: ${input.maxDiscountVnd ?? "null"}`,
    `- usageLimit: ${input.usageLimit ?? "null"}`,
    `- usageLimitPerUser: ${input.usageLimitPerUser ?? "null"}`,
    `- preferredStartsAt: ${input.preferredStartsAt ?? "null"}`,
    `- preferredEndsAt: ${input.preferredEndsAt ?? "null"}`,
    `- validDays: ${input.validDays ?? "null"}`,
    "",
    "TRẢ LỜI DUY NHẤT BẰNG JSON, KHÔNG THÊM TEXT NÀO KHÁC.",
    "CẤU TRÚC JSON BẮT BUỘC:",
    "{",
    '  "code": string,                  // chỉ A-Z, 0-9, "-" (không dấu, không khoảng trắng)',
    '  "description": string,           // 1-2 câu tiếng Việt mô tả ưu đãi, điều kiện, thời gian',
    '  "type": "PERCENTAGE" | "FIXED" | "FREE_SHIPPING",',
    '  "value": number | null,          // PERCENTAGE: % giảm; FIXED: tiền VND; FREE_SHIPPING: tiền VND hỗ trợ phí ship tối đa (hoặc null nếu miễn toàn bộ)',
    '  "maxDiscountVnd": number | null, // chỉ dùng cho PERCENTAGE, ngược lại có thể null',
    '  "minOrderAmountVnd": number | null,',
    '  "usageLimit": number | null,     // null = không giới hạn',
    '  "usageLimitPerUser": number | null, // null = không giới hạn',
    '  "suggestedStartsAt": string | null, // ISO 8601 (ví dụ "2026-02-26T00:00:00.000Z") hoặc null nếu bắt đầu ngay',
    '  "suggestedEndsAt": string | null    // ISO 8601 hoặc null nếu không giới hạn thời gian',
    "}",
  );

  const prompt = lines.join("\n");

  const json = await callGroqJson<RawCouponAiJson>({
    apiKey,
    model,
    prompt,
    maxTokens: 800,
    debugLabel: "[Groq][CouponAI][Suggestion]",
  });

  if (!json) {
    return null;
  }

  const rawType =
    typeof json.type === "string" ? json.type.toUpperCase().trim() : "";
  const aiType = VALID_TYPES.includes(rawType as (typeof VALID_TYPES)[number])
    ? (rawType as CouponAiOutput["type"])
    : null;

  const type: CouponAiOutput["type"] =
    enforcedType ??
    aiType ??
    ((): CouponAiOutput["type"] => {
      if (input.freeShipping) return "FREE_SHIPPING";
      if (input.discountPercent != null && input.discountPercent > 0) {
        return "PERCENTAGE";
      }
      if (input.discountFixedVnd != null && input.discountFixedVnd > 0) {
        return "FIXED";
      }
      return "PERCENTAGE";
    })();

  const value = toSafeNumber(json.value);
  const maxDiscountVnd = toSafeNumber(json.maxDiscountVnd);
  const minOrderAmountVnd = toSafeNumber(json.minOrderAmountVnd);
  const usageLimit = toSafeNumber(json.usageLimit);
  const usageLimitPerUser = toSafeNumber(json.usageLimitPerUser);

  const code = sanitizeCode(json.code);
  const description =
    typeof json.description === "string"
      ? json.description.trim()
      : "";

  const suggestedStartsAt =
    typeof json.suggestedStartsAt === "string"
      ? json.suggestedStartsAt.trim()
      : null;
  const suggestedEndsAt =
    typeof json.suggestedEndsAt === "string"
      ? json.suggestedEndsAt.trim()
      : null;

  if (!code || !description) {
    return null;
  }

  return {
    code,
    description,
    type,
    value: value ?? null,
    maxDiscountVnd: maxDiscountVnd ?? null,
    minOrderAmountVnd: minOrderAmountVnd ?? null,
    usageLimit: usageLimit ?? null,
    usageLimitPerUser: usageLimitPerUser ?? null,
    suggestedStartsAt,
    suggestedEndsAt,
  };
}

