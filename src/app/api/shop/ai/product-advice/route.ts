/**
 * POST /api/shop/ai/product-advice
 *
 * API tư vấn âm thanh bằng AI (Groq). Hỗ trợ 2 chế độ:
 * - Tư vấn sản phẩm: body có productId → system prompt 6 phần (Persona, Product, Brand, Category, Catalog, Rules)
 * - Tư vấn chung: body không có productId → system prompt 3 phần (Persona, Catalog, Rules)
 *
 * Luồng:
 * 1. Validate body { productId?, messages[] }
 * 2. Fetch catalog sản phẩm đang bán (tối đa 30). Nếu có productId: song song fetch product chi tiết.
 * 3. Build system prompt tùy chế độ
 * 4. Gọi callGroqChat với [system, ...messages.slice(-20)]
 * 5. Nếu câu hỏi liên quan phối ghép/so sánh → fetch related products cho UI card
 * 6. Fire-and-forget log AiSession
 * 7. Trả { answer, suggestedProducts? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callGroqChat, type GroqChatMessage } from "@/lib/groq-chat";
import { createAiSession } from "@/services/ai-session-service";
import { getAiConfig } from "@/lib/ai-config";
import { getAiPrompt } from "@/lib/ai-prompt";
import type {
  ProductAdviceRequestDto,
  ProductAdviceResponseDto,
  SuggestedProductDto,
  ProductAdviceMessage,
} from "@/types/ai";

const MAX_MESSAGES = 20;
/** Fallback nếu DB chưa có config */
const DEFAULT_CATALOG_MAX_ITEMS = 30;

// Các keyword trong câu hỏi user → trigger fetch gợi ý sản phẩm liên quan
const SUGGESTION_TRIGGERS = [
  // Phối ghép & kết hợp
  "phối ghép",
  "kết hợp",
  "cùng với",
  "bộ dàn",
  "thêm thiết bị",
  // Tìm sản phẩm khác
  "thay thế",
  "có gì khác không",
  "sản phẩm khác",
  "cái khác",
  "xem thêm",
  "cùng loại",
  "tương tự",
  "cùng tầm",
  "tầm giá",
  "ngân sách",
  // Giá cả
  "rẻ hơn",
  "đắt hơn",
  "khác không",
  // So sánh & nâng cấp
  "so sánh",
  "upgrade",
  "nâng cấp",
  // Câu hỏi thiết bị cụ thể
  "ampli nào",
  "loa nào",
  "dac nào",
  "tai nghe nào",
  "gợi ý",
];

function shouldFetchSuggestions(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  return SUGGESTION_TRIGGERS.some((trigger) => lower.includes(trigger));
}

function formatPriceVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

type CatalogItem = {
  id: string;
  name: string;
  categoryName: string | null;
  brandName: string | null;
  price: number;
  salePrice: number | null;
  aiDescription: string | null;
};

function buildSystemPrompt(
  product: {
    name: string;
    description: string;
    price: number;
    salePrice: number | null;
    stock: number;
    aiDescription: string | null;
    aiTags: string[];
    brand: {
      name: string;
      aiDescription: string | null;
      aiTags: string[];
    } | null;
    category: {
      name: string;
      slug: string;
      aiDescription: string | null;
      aiTags: string[];
    } | null;
  },
  catalog: CatalogItem[],
): string {
  const priceText = formatPriceVnd(product.price);
  const salePriceText =
    product.salePrice != null
      ? formatPriceVnd(product.salePrice)
      : "Không có";
  const stockText = product.stock > 0 ? "Còn hàng" : "Tạm hết hàng";
  const descriptionTrimmed =
    product.description.length > 1000
      ? `${product.description.slice(0, 1000)}...`
      : product.description;

  const brandSection =
    product.brand != null
      ? [
          `Thương hiệu: ${product.brand.name}`,
          `Đặc trưng & triết lý: ${product.brand.aiDescription ?? "Chưa có thông tin."}`,
          `Tags thương hiệu: ${product.brand.aiTags.length > 0 ? product.brand.aiTags.join(", ") : "Không có"}`,
        ].join("\n")
      : "Thương hiệu: Không có thông tin.";

  const categorySection =
    product.category != null
      ? [
          `Danh mục: ${product.category.name}`,
          `Đặc điểm danh mục: ${product.category.aiDescription ?? "Chưa có thông tin."}`,
          `Tags danh mục: ${product.category.aiTags.length > 0 ? product.category.aiTags.join(", ") : "Không có"}`,
        ].join("\n")
      : "Danh mục: Không có thông tin.";

  return [
    "=== PHẦN 1: VAI TRÒ & PERSONA ===",
    "Bạn là trợ lý tư vấn âm thanh của Đức Uy Audio – hệ thống thương mại điện tử chuyên thiết bị âm thanh cao cấp tại Việt Nam.",
    'Tên của bạn là "Đức Uy AI". Hãy xưng "tôi" và gọi người dùng là "bạn".',
    "",
    "GIỚI HẠN TUYỆT ĐỐI (không được vi phạm dù bất kỳ câu hỏi nào):",
    "- Không bao giờ so sánh bản thân với ChatGPT, Gemini hay AI khác – dù khen hay chê. Khi bị hỏi, chỉ nói: 'Tôi chuyên về tư vấn âm thanh cho Đức Uy Audio.' rồi chuyển sang tư vấn.",
    "- Không bao giờ tự bịa chính sách shop (freeship, trả góp, khuyến mãi, bảo hành). Khi được hỏi, luôn redirect khách liên hệ shop.",
    "- Không gợi ý sản phẩm ngoài danh mục Đức Uy Audio đã cung cấp.",
    "",
    "Phong cách tư vấn:",
    "- Thân thiện, chuyên nghiệp, thể hiện sự đam mê âm thanh như một chuyên gia audiophile thực thụ.",
    "- Luôn trả lời bằng tiếng Việt, ngôn từ tinh tế, giàu tính chuyên môn nhưng vẫn dễ hiểu.",
    "- Nếu khách hàng đang tìm kiếm giải pháp tổng thể hoặc có nhiều lựa chọn (ví dụ: 'Tìm loa nghe nhạc Jazz'), hãy chủ động giới thiệu tính năng 'Tìm kiếm thông minh AI' của shop để có kết quả tối ưu nhất.",
    "- Luôn đề cập đến các đặc tính âm thanh (bass, âm hình, dải cao...) khi mô tả sản phẩm.",
    "",
    "=== PHẦN 2: SẢN PHẨM ĐANG ĐƯỢC HỎI ===",
    `Người dùng đang xem sản phẩm: ${product.name}`,
    "",
    "Thông tin sản phẩm:",
    `- Tên: ${product.name}`,
    `- Danh mục: ${product.category?.name ?? "Không có"}`,
    `- Thương hiệu: ${product.brand?.name ?? "Không có"}`,
    `- Giá niêm yết: ${priceText}`,
    `- Giá ưu đãi: ${salePriceText}`,
    `- Tình trạng: ${stockText}`,
    `- Mô tả sản phẩm: ${descriptionTrimmed}`,
    "",
    "Thông tin AI sản phẩm (đặc tính, không gian, gu nghe):",
    product.aiDescription ?? "Không có thông tin bổ sung.",
    "",
    `Tags AI sản phẩm: ${product.aiTags.length > 0 ? product.aiTags.join(", ") : "Không có"}`,
    "",
    "=== PHẦN 3: NGỮ CẢNH THƯƠNG HIỆU ===",
    brandSection,
    "",
    "=== PHẦN 4: NGỮ CẢNH DANH MỤC ===",
    categorySection,
    "",
    "=== PHẦN 5: DANH MỤC SẢN PHẨM ĐỨC UY AUDIO ===",
    "Dưới đây là TẤT CẢ sản phẩm hiện đang có hàng tại Đức Uy Audio.",
    "Khi tư vấn phối ghép hoặc gợi ý sản phẩm liên quan, bạn CHỈ ĐƯỢC đề cập đến các sản phẩm có trong danh sách này.",
    "Tuyệt đối KHÔNG được bịa đặt hoặc đề xuất sản phẩm/thương hiệu không có trong danh sách.",
    "",
    ...(catalog.length > 0
      ? catalog.map((item, idx) => {
          const displayPrice = item.salePrice ?? item.price;
          const parts = [
            `${idx + 1}. [MÃ ID: ${item.id}] ${item.name}`,
            `   Danh mục: ${item.categoryName ?? "Không phân loại"}`,
            `   Thương hiệu: ${item.brandName ?? "Không có"}`,
            `   Giá: ${formatPriceVnd(displayPrice)}${item.salePrice ? " (đang giảm)" : ""}`,
          ];
          if (item.aiDescription) {
            parts.push(`   Đặc tính: ${item.aiDescription.slice(0, 200)}`);
          }
          return parts.join("\n");
        })
      : ["(Hiện chưa có sản phẩm nào khác trong kho)"]),
    "",
    "=== PHẦN 6: QUY TẮC TRẢ LỜI ===",
    "",
    "-- Sản phẩm & Giá --",
    "1. Ưu tiên sử dụng thông tin từ các phần trên khi trả lời.",
    "2. Khi nói về giá, CHỈ dùng đúng giá đã cung cấp trong phần thông tin sản phẩm. Tuyệt đối không tự bịa ra mức giá khác.",
    "3. Không bịa thông số kỹ thuật (công suất, trở kháng, độ nhạy...). Nếu không có trong dữ liệu, nói rõ: 'Tôi không có thông số chính xác về điểm này, bạn có thể liên hệ Đức Uy Audio để được cung cấp đầy đủ.'",
    "",
    "-- Gợi ý sản phẩm --",
    "4. Khi gợi ý phối ghép hoặc sản phẩm thay thế, CHỈ đề cập sản phẩm trong danh mục Đức Uy Audio ở trên. Không gợi ý thương hiệu/sản phẩm không có trong danh sách đó.",
    "5. Khi khách hỏi thương hiệu KHÔNG có trong danh mục: (a) thông báo ngắn Đức Uy Audio chưa kinh doanh thương hiệu đó, (b) chủ động giới thiệu sản phẩm tương đương đang có, (c) không hứa tìm kiếm sản phẩm ngoài catalog.",
    "6. Khi khách hỏi ngân sách và giá các sản phẩm trong catalog không phù hợp: nói thật và gợi ý liên hệ shop để được tư vấn thêm. Không gợi ý sản phẩm ngoài catalog.",
    "7. Khi khách hỏi xem tất cả sản phẩm: liệt kê ngắn gọn từ danh mục đã cung cấp (chỉ tên + giá + danh mục), không thêm mô tả dài.",
    "",
    "-- Chính sách shop (QUAN TRỌNG) --",
    "8. Tuyệt đối KHÔNG tự bịa chính sách shop. Các thông tin sau đây bạn KHÔNG được tự đưa ra: phí vận chuyển chính xác, thời hạn bảo hành cụ thể từng ngày, chính sách đổi trả chi tiết, mã giảm giá cá nhân.",
    "9. Khi khách hỏi về bảo hành, vận chuyển, trả góp: Hãy khẳng định Đức Uy Audio luôn có chính sách bảo hành chính hãng, hỗ trợ vận chuyển an toàn và trả góp linh hoạt. Sau đó mới hướng dẫn: 'Để biết thông tin chi tiết và chính xác nhất cho trường hợp của bạn, bạn vui lòng liên hệ Đức Uy Audio qua trang Hỗ trợ để được tư vấn cụ thể.'",
    "",
    "-- Mua hàng --",
    "10. Khi khách muốn đặt mua ngay: hướng dẫn 'Bạn có thể nhấn nút Thêm vào giỏ hàng ngay trên trang này, hoặc liên hệ Đức Uy Audio qua trang Hỗ trợ để được hỗ trợ đặt hàng.'",
    "",
    "-- Phàn nàn & Sự cố --",
    "11. Khi khách phàn nàn về chất lượng sản phẩm, sự cố kỹ thuật hoặc đã mua bị lỗi: (a) thể hiện đồng cảm chân thành, (b) không bào chữa hay phủ nhận vấn đề, (c) hướng dẫn: 'Bạn vui lòng liên hệ bộ phận chăm sóc khách hàng của Đức Uy Audio qua trang Hỗ trợ để được xử lý nhanh nhất.'",
    "12. Khi khách phàn nàn về chất lượng trả lời của tôi: xin lỗi ngắn gọn, hỏi lại nhu cầu cụ thể để giúp tốt hơn. Không giải thích vòng vo.",
    "",
    "-- So sánh & Ngoài phạm vi --",
    "13. Khi khách so sánh giá với Shopee/Lazada/kênh khác (hỏi tại sao giá cao hơn): Hãy giải thích khéo léo về giá trị dịch vụ của Đức Uy Audio: 100% hàng chính hãng, chế độ bảo hành hậu mãi chuyên nghiệp, đội ngũ kỹ thuật tư vấn phối ghép chuyên sâu và hỗ trợ setup tại nhà. Đây là những giá trị mà các sàn TMĐT thường không có hoặc không đảm bảo được. Luôn giữ thái độ tự tin về chất lượng sản phẩm của shop.",
    "14. Khi được so sánh với AI khác (ChatGPT, Gemini...) hoặc bị nhận xét về chất lượng AI: trả lời ngắn gọn: 'Tôi là Đức Uy AI, chuyên viên tư vấn của Đức Uy Audio. Mục tiêu của tôi là giúp bạn tìm được giải pháp âm thanh ưng ý nhất.' rồi quay lại tư vấn.",
    "15. Khi câu hỏi hoàn toàn ngoài phạm vi âm thanh/mua hàng (thời tiết, thể thao, viết CV, nấu ăn...): từ chối nhẹ nhàng và redirect: 'Tôi chuyên tư vấn về âm thanh và sản phẩm của Đức Uy Audio. Bạn có câu hỏi nào về thiết bị âm thanh không?'. LƯU Ý: Nếu khách hỏi về các thương hiệu âm thanh khác KHÔNG có trong catalog (như Samsung, Sony, Apple...), đó VẪN là câu hỏi trong phạm vi, bạn phải áp dụng Quy tắc 5 (thông báo không kinh doanh và gợi ý sản phẩm tương đương), TUYỆT ĐỐI không được dùng câu trả lời từ chối mặc định này.",
    "16. Khi nhận được input không rõ nghĩa hoặc ký tự lạ: hỏi lại 'Bạn cần tôi tư vấn về sản phẩm nào hoặc vấn đề gì?'",
    "",
    "-- Format --",
    "17. Câu trả lời ngắn gọn, súc tích, tối đa 3-4 đoạn. Cuối câu trả lời thêm một câu hỏi mở nếu phù hợp.",
    "18. Dùng dòng trống (\\n\\n) để phân cách đoạn. Liệt kê dùng dấu gạch đầu dòng (-). Quy tắc KHÔNG DÙNG MARKDOWN vẫn áp dụng.",
    "19. QUAN TRỌNG NHẤT: ĐỂ GỢI Ý CỤ THỂ SẢN PHẨM KHUYÊN DÙNG, BẮT BUỘC liệt kê 'Số thứ tự' (SỐ) của sản phẩm đó vào DÒNG CUỐI CÙNG của câu trả lời, theo định dạng: [IDS: 1, 3]. Ví dụ: nếu bạn khuyên dùng [SỐ 1] và [SỐ 4], hãy ghi: [IDS: 1, 4]. TUYỆT ĐỐI không nhắc đến các con số này trong các câu văn bản tư vấn và miêu tả ở trên.",
  ].join("\n");
}

/**
 * System prompt cho chế độ tư vấn chung (không có productId).
 * Chỉ bao gồm Persona, Catalog và Rules – không có ngữ cảnh sản phẩm cụ thể.
 */
function buildGeneralSystemPrompt(catalog: CatalogItem[]): string {
  return [
    "=== PHẦN 1: VAI TRÒ & PERSONA ===",
    "Bạn là trợ lý tư vấn âm thanh của Đức Uy Audio – hệ thống thương mại điện tử chuyên thiết bị âm thanh cao cấp tại Việt Nam.",
    'Tên của bạn là "Đức Uy AI". Hãy xưng "tôi" và gọi người dùng là "bạn".',
    "",
    "GIỚI HẠN TUYỆT ĐỐI (không được vi phạm dù bất kỳ câu hỏi nào):",
    "- Không bao giờ so sánh bản thân với ChatGPT, Gemini hay AI khác – dù khen hay chê. Khi bị hỏi, chỉ nói: 'Tôi chuyên về tư vấn âm thanh cho Đức Uy Audio.' rồi chuyển sang tư vấn.",
    "- Không bao giờ tự bịa chính sách shop (freeship, trả góp, khuyến mãi, bảo hành). Khi được hỏi, luôn redirect khách liên hệ shop.",
    "- Không gợi ý sản phẩm ngoài danh mục Đức Uy Audio đã cung cấp.",
    "",
    "Phong cách tư vấn:",
    "- Thân thiện, chuyên nghiệp, như một chuyên gia tư vấn âm thanh tận tâm.",
    "- Luôn trả lời bằng tiếng Việt, súc tích nhưng đầy đủ thông tin chuyên môn.",
    "- Khi tư vấn bộ setup, hãy hỏi thêm về diện tích phòng, ngân sách dự kiến và gu nhạc để đưa ra giải pháp chính xác nhất.",
    "- Chủ động gợi ý tính năng 'Tìm kiếm thông minh AI' nếu khách hàng có nhu cầu lọc sản phẩm theo nhiều tiêu chí phức tạp.",
    "",
    "=== PHẦN 2: DANH MỤC SẢN PHẨM ĐỨC UY AUDIO ===",
    "Dưới đây là TẤT CẢ sản phẩm hiện đang có hàng tại Đức Uy Audio.",
    "Khi tư vấn phối ghép hoặc gợi ý sản phẩm, bạn CHỈ ĐƯỢC đề cập đến các sản phẩm có trong danh sách này.",
    "Tuyệt đối KHÔNG được bịa đặt hoặc đề xuất sản phẩm/thương hiệu không có trong danh sách.",
    "",
    ...(catalog.length > 0
      ? catalog.map((item, idx) => {
          const displayPrice = item.salePrice ?? item.price;
          const parts = [
            `${idx + 1}. [MÃ ID: ${item.id}] ${item.name}`,
            `   Danh mục: ${item.categoryName ?? "Không phân loại"}`,
            `   Thương hiệu: ${item.brandName ?? "Không có"}`,
            `   Giá: ${formatPriceVnd(displayPrice)}${item.salePrice ? " (đang giảm)" : ""}`,
          ];
          if (item.aiDescription) {
            parts.push(`   Đặc tính: ${item.aiDescription.slice(0, 200)}`);
          }
          return parts.join("\n");
        })
      : ["(Hiện chưa có sản phẩm nào trong kho)"]),
    "",
    "=== PHẦN 3: QUY TẮC TRẢ LỜI ===",
    "",
    "-- Sản phẩm & Giá --",
    "1. Khi nói về giá, CHỈ dùng đúng giá đã cung cấp trong danh mục trên. Tuyệt đối không tự bịa ra mức giá khác.",
    "2. Không bịa thông số kỹ thuật (công suất, trở kháng, độ nhạy...). Nếu không có trong dữ liệu, nói rõ: 'Tôi không có thông số chính xác về điểm này, bạn có thể liên hệ Đức Uy Audio để được cung cấp đầy đủ.'",
    "",
    "-- Gợi ý sản phẩm --",
    "3. Khi gợi ý phối ghép hoặc sản phẩm thay thế, CHỈ đề cập sản phẩm trong danh mục Đức Uy Audio ở trên.",
    "4. Khi khách hỏi thương hiệu KHÔNG có trong danh mục: thông báo ngắn Đức Uy Audio chưa kinh doanh thương hiệu đó, rồi giới thiệu sản phẩm tương đương đang có.",
    "5. Khi khách hỏi ngân sách và giá các sản phẩm không phù hợp: nói thật và gợi ý liên hệ shop.",
    "",
    "-- Chính sách shop (QUAN TRỌNG) --",
    "6. Tuyệt đối KHÔNG tự bịa chính sách shop. Khi khách hỏi về bảo hành, vận chuyển, trả góp: Hãy khẳng định Đức Uy Audio luôn có các chính sách hỗ trợ chuyên nghiệp (hàng chính hãng, vận chuyển an toàn). Sau đó mới hướng dẫn: 'Để biết chi tiết về [chủ đề], bạn vui lòng liên hệ Đức Uy Audio qua trang Hỗ trợ.'",
    "",
    "-- Mua hàng --",
    "7. Khi khách muốn đặt mua: hướng dẫn 'Bạn có thể tìm sản phẩm trong mục Shop và nhấn Thêm vào giỏ hàng, hoặc liên hệ Đức Uy Audio qua trang Hỗ trợ.'",
    "",
    "-- So sánh & Ngoài phạm vi --",
    "8. Khi khách so sánh giá với Shopee/Lazada (hỏi tại sao giá cao): Giải thích về giá trị dịch vụ của Đức Uy Audio: Hàng chính hãng 100%, bảo hành chuyên nghiệp, tư vấn phối ghép nghe thử thực tế và hỗ trợ kỹ thuật trọn đời. Những giá trị này đảm bảo trải nghiệm âm thanh tốt nhất cho khách hàng so với việc tự mua trên sàn TMĐT.",
    "9. Khi câu hỏi hoàn toàn ngoài phạm vi âm thanh/mua hàng (thời tiết, thể thao, viết CV, nấu ăn...): từ chối nhẹ nhàng và redirect: 'Tôi chuyên tư vấn về âm thanh và sản phẩm của Đức Uy Audio. Bạn có câu hỏi nào về thiết bị âm thanh không?'. LƯU Ý: Nếu khách hỏi về các hãng âm thanh chưa có trong danh sách (như Samsung, Sony...), đó VẪN thuộc phạm vi tư vấn, hãy thực hiện Quy tắc 4 (thông báo không kinh doanh hãng đó và giới thiệu sản phẩm tương đương), KHÔNG được từ chối mặc định.",
    "10. Khi được so sánh với AI khác: 'Tôi là Đức Uy AI - trợ lý tư vấn âm thanh riêng của bạn tại Đức Uy Audio. Rất vui được hỗ trợ bạn về thế giới âm thanh.'",
    "",
    "-- Format --",
    "11. Câu trả lời ngắn gọn, súc tích, tối đa 3-4 đoạn. Cuối câu trả lời thêm một câu hỏi mở.",
    "12. Dùng dòng trống (\\n\\n) để phân cách. Liệt kê dùng gạch đầu dòng (-). KHÔNG dùng markdown (** hay ##).",
    "13. QUAN TRỌNG NHẤT: BẮT BUỘC liệt kê 'Số thứ tự' (SỐ) của sản phẩm bạn khuyên dùng vào DÒNG CUỐI CÙNG của câu trả lời, theo định dạng: [IDS: 1, 2]. Ví dụ: nếu khuyên dùng [SỐ 1] và [SỐ 3], hãy ghi: [IDS: 1, 3]. TUYỆT ĐỐI không viết con số này vào các đoạn văn tư vấn.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // --- Parse body ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body không hợp lệ." },
      { status: 400 },
    );
  }

  const { productId, messages } = body as ProductAdviceRequestDto;
  const isGeneralMode = !productId || typeof productId !== "string";

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "Phải có ít nhất 1 tin nhắn." },
      { status: 400 },
    );
  }

  const lastMessage = messages[messages.length - 1] as ProductAdviceMessage;
  if (lastMessage.role !== "user") {
    return NextResponse.json(
      { error: "Tin nhắn cuối phải từ người dùng." },
      { status: 400 },
    );
  }

  // --- Lấy session người dùng (optional – cho AiSession log) ---
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  // --- Đọc API key sớm để fail fast ---
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("[ProductAdvice] GROQ_API_KEY not set");
    return NextResponse.json(
      { error: "Dịch vụ AI chưa được cấu hình." },
      { status: 503 },
    );
  }

  // --- Đọc AI config từ DB (có fallback về env / default) ---
  const aiConfig = await getAiConfig();

  if (!aiConfig.ai_enabled || !aiConfig.ai_chat_enabled) {
    return NextResponse.json(
      { error: aiConfig.ai_chat_fallback_message },
      { status: 503 },
    );
  }

  if (aiConfig.ai_rate_limit_enabled) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const whereBase = {
      createdAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    } as const;

    if (userId) {
      const count = await prisma.aiSession.count({
        where: {
          ...whereBase,
          userId,
        },
      });

      if (count >= aiConfig.ai_rate_limit_per_user_per_day) {
        return NextResponse.json(
          {
            error:
              "Bạn đã đạt giới hạn lượt sử dụng AI trong ngày. Vui lòng quay lại vào ngày mai hoặc liên hệ Đức Uy Audio để được hỗ trợ thêm.",
          },
          { status: 429 },
        );
      }
    }
  }

  const catalogMaxItems = aiConfig.ai_chat_catalog_limit ?? DEFAULT_CATALOG_MAX_ITEMS;

  const catalogSelect = {
    where: { status: "ACTIVE" as const, stock: { gt: 0 } },
    select: {
      id: true,
      name: true,
      price: true,
      salePrice: true,
      aiDescription: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" as const },
    take: catalogMaxItems,
  } as const;

  const model = aiConfig.ai_model;
  const lastUserContent = lastMessage.content;
  const trimmedMessages = messages.slice(-MAX_MESSAGES);

  // --- Đọc chat_rules từ DB (prompt có thể tuỳ chỉnh qua Admin > AI > Prompts) ---
  const customRules = await getAiPrompt("chat_rules").catch(() => null);

  let systemPrompt: string;
  let productMeta: { id: string; name: string; brandName: string | null; categoryName: string | null; categoryId: string | null; aiTags: string[] } | null = null;
  let suggestedProducts: SuggestedProductDto[] | undefined;
  let catalogRaw: any[] = [];
  let catalog: CatalogItem[] = [];

  if (isGeneralMode) {
    // --- Chế độ tư vấn chung: chỉ cần catalog ---
    catalogRaw = await prisma.product.findMany(catalogSelect);
    catalog = catalogRaw.map((p) => ({
      id: p.id,
      name: p.name,
      categoryName: p.category?.name ?? null,
      brandName: p.brand?.name ?? null,
      price: Number(p.price),
      salePrice: p.salePrice != null ? Number(p.salePrice) : null,
      aiDescription: p.aiDescription,
    }));
    systemPrompt = buildGeneralSystemPrompt(catalog);
    if (customRules) systemPrompt += `\n\n=== QUY TẮC BỔ SUNG (Admin) ===\n${customRules}`;
  } else {
    // --- Chế độ tư vấn theo sản phẩm: fetch song song product + catalog ---
    const [product, fetchedCatalogRaw] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          price: true,
          salePrice: true,
          stock: true,
          status: true,
          categoryId: true,
          aiDescription: true,
          aiTags: true,
          brand: { select: { name: true, aiDescription: true, aiTags: true } },
          category: { select: { name: true, slug: true, aiDescription: true, aiTags: true } },
        },
      }),
      prisma.product.findMany(catalogSelect),
    ]);
    catalogRaw = fetchedCatalogRaw;

    if (!product || product.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Sản phẩm không tồn tại hoặc đã ngừng kinh doanh." },
        { status: 404 },
      );
    }

    catalog = catalogRaw
      .filter((p) => p.name !== product.name)
      .map((p) => ({
        id: p.id,
        name: p.name,
        categoryName: p.category?.name ?? null,
        brandName: p.brand?.name ?? null,
        price: Number(p.price),
        salePrice: p.salePrice != null ? Number(p.salePrice) : null,
        aiDescription: p.aiDescription,
      }));

    systemPrompt = buildSystemPrompt(
      {
        name: product.name,
        description: product.description,
        price: Number(product.price),
        salePrice: product.salePrice != null ? Number(product.salePrice) : null,
        stock: product.stock,
        aiDescription: product.aiDescription,
        aiTags: product.aiTags,
        brand: product.brand,
        category: product.category,
      },
      catalog,
    );
    if (customRules) systemPrompt += `\n\n=== QUY TẮC BỔ SUNG (Admin) ===\n${customRules}`;

    productMeta = {
      id: product.id,
      name: product.name,
      brandName: product.brand?.name ?? null,
      categoryName: product.category?.name ?? null,
      categoryId: product.categoryId,
      aiTags: product.aiTags,
    };

    // Fetch sản phẩm gợi ý nếu câu hỏi liên quan đến so sánh/phối ghép
    if (shouldFetchSuggestions(lastUserContent)) {
      try {
        const related = await prisma.product.findMany({
          where: {
            id: { not: productId },
            status: "ACTIVE",
            stock: { gt: 0 },
            OR: [
              ...(product.categoryId ? [{ categoryId: product.categoryId }] : []),
              ...(product.aiTags.length > 0
                ? [{ aiTags: { hasSome: product.aiTags.slice(0, 3) } }]
                : []),
            ],
          },
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            salePrice: true,
            images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
          },
          take: 3,
          orderBy: { createdAt: "desc" },
        });

        if (related.length > 0) {
          suggestedProducts = related.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: Number(p.price),
            salePrice: p.salePrice != null ? Number(p.salePrice) : null,
            primaryImageUrl: p.images[0]?.url ?? null,
          }));
        }
      } catch (error) {
        console.error("[ProductAdvice] Failed to fetch suggested products:", error);
      }
    }
  }

  const groqMessages: GroqChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...trimmedMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // --- Gọi Groq (dùng config từ DB: model, temperature, maxTokens, timeout) ---
  let rawAnswer: string | null = null;
  try {
    rawAnswer = await callGroqChat({
      apiKey,
      model,
      messages: groqMessages,
      maxTokens: aiConfig.ai_max_tokens,
      temperature: aiConfig.ai_temperature,
      timeoutMs: aiConfig.ai_timeout_ms,
      debugLabel: "[ProductAdvice]",
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith("GROQ_429:")) {
      const match = error.message.match(/try again in ([0-9.]+)s/i);
      if (match) {
        const secs = Math.ceil(parseFloat(match[1]));
        return NextResponse.json(
          { error: `Xin lỗi, tôi đang xử lý quá nhiều yêu cầu lúc này. Vui lòng thử lại sau ${secs} giây.` },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Xin lỗi, tôi gặp sự cố mạng do quá tải. Vui lòng thử lại sau một chút." },
        { status: 429 }
      );
    }
  }

  if (!rawAnswer) {
    return NextResponse.json(
      { error: "Dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau." },
      { status: 503 },
    );
  }

  // Strip markdown formatting that LLM may still output despite instructions.
  // Extract and remove [IDS: ...] block safely.
  let answer = rawAnswer
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Fallback: strip any literal "ID: XXX" or "(ID: XXX)" the AI might still hallucinate
    .replace(/\(?ID:\s*[-a-zA-Z0-9_]+\)?/gi, "");

  const idsMatch = answer.match(/\[IDS:\s*([\d,\s]+)\]/i);
  let aiSuggestedIds: string[] = [];
  if (idsMatch) {
    const rawNumbers = idsMatch[1].split(",").map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
    // Index mapping (prompt uses 1-based indexing: SỐ 1, SỐ 2)
    aiSuggestedIds = rawNumbers
      .map(num => catalog[num - 1]?.id)
      .filter(Boolean);
      
    answer = answer.replace(idsMatch[0], "").trim();
  }
  answer = answer.trim();

  // --- Parse answer for mentioned products ---
  if (!suggestedProducts || suggestedProducts.length === 0) {
    if (aiSuggestedIds.length > 0) {
      // Use exact IDs provided by AI
      try {
        const mentionedFull = await prisma.product.findMany({
          where: { id: { in: aiSuggestedIds } },
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            salePrice: true,
            images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
          },
        });
        suggestedProducts = mentionedFull.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          salePrice: p.salePrice != null ? Number(p.salePrice) : null,
          primaryImageUrl: p.images[0]?.url ?? null,
        })).slice(0, 3);
      } catch (error) {
        console.error("[ProductAdvice] Failed to fetch exact requested products:", error);
      }
    } else if (catalogRaw && catalogRaw.length > 0) {
      // Fallback: fuzzy exact name match (AI forgot to provide IDs)
      const mentionedProducts = catalogRaw.filter((p) => answer.includes(p.name));
      
      if (mentionedProducts.length > 0) {
        try {
          const mentionedFull = await prisma.product.findMany({
            where: { id: { in: mentionedProducts.map((p) => p.id) } },
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              salePrice: true,
              images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
            },
          });
          
          suggestedProducts = mentionedFull.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: Number(p.price),
            salePrice: p.salePrice != null ? Number(p.salePrice) : null,
            primaryImageUrl: p.images[0]?.url ?? null,
          })).slice(0, 3);
        } catch (error) {
          console.error("[ProductAdvice] Failed to fetch mentioned products images:", error);
        }
      }
    }
  }

  // --- Fire-and-forget: log AiSession ---
  void createAiSession({
    userId,
    type: "ADVICE",
    input: lastUserContent,
    output: answer,
    model,
    metadata: {
      productId: productMeta?.id ?? null,
      productName: productMeta?.name ?? null,
      brandName: productMeta?.brandName ?? null,
      categoryName: productMeta?.categoryName ?? null,
      mode: isGeneralMode ? "general" : "product",
      turnCount: trimmedMessages.length,
      hasSuggestedProducts: (suggestedProducts?.length ?? 0) > 0,
      latencyMs: Date.now() - startTime,
    },
  });

  // --- Response ---
  const responseBody: ProductAdviceResponseDto = {
    answer,
    ...(suggestedProducts && suggestedProducts.length > 0
      ? { suggestedProducts }
      : {}),
  };

  return NextResponse.json(responseBody);
}
