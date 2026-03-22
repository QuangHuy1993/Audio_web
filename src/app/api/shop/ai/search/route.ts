import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callGroqJson } from "@/lib/groq-json";
import { createAiSession } from "@/services/ai-session-service";
import { getAiConfig } from "@/lib/ai-config";
import type { 
  ProductAdviceSearchRequestDto, 
  ProductAdviceSearchResponseDto,
  ProductSearchCriteria
} from "@/types/ai";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { query } = (await request.json()) as ProductAdviceSearchRequestDto;

    if (!query || query.trim().length < 5) {
      return NextResponse.json(
        { error: "Vui lòng nhập mô tả nhu cầu của bạn (ít nhất 5 ký tự)." },
        { status: 400 },
      );
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? null;

    const aiConfig = await getAiConfig();
    if (!aiConfig.ai_enabled) {
      return NextResponse.json(
        { error: "Dịch vụ AI hiện đang tạm ngưng." },
        { status: 503 },
      );
    }

    if (aiConfig.ai_rate_limit_enabled) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      if (userId) {
        const count = await prisma.aiSession.count({
          where: {
            userId,
            createdAt: { gte: todayStart, lte: todayEnd },
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

    // Fetch context to help AI map
    const [brands, categories] = await Promise.all([
      prisma.brand.findMany({ select: { name: true } }),
      prisma.category.findMany({ select: { name: true } }),
    ]);

    const prompt = `
Bạn là chuyên gia tư vấn âm thanh tại Đức Uy Audio. Một khách hàng đang tìm kiếm sản phẩm với yêu cầu: "${query}"

DỰA TRÊN CÁC THƯƠNG HIỆU HIỆN CÓ: ${brands.map(b => b.name).join(", ")}
DỰA TRÊN CÁC DANH MỤC HIỆN CÓ: ${categories.map(c => c.name).join(", ")}

YÊU CẦU:
1. Phân tích yêu cầu của khách để trích xuất các tiêu chí tìm kiếm.
2. Trả về đúng định dạng JSON sau:
{
  "criteria": {
    "category": "Tên danh mục phù hợp nhất (nếu có)",
    "brand": "Tên thương hiệu phù hợp nhất (nếu có)",
    "minPrice": number (hoặc null),
    "maxPrice": number (hoặc null),
    "tags": ["danh", "sách", "tag", "AI", "liên", "quan"],
    "intent": "Tóm tắt nhu cầu chính (vối dụ: Nghe nhạc Jazz phòng 30m2)"
  },
  "explanation": "Lời giải thích ngắn gọn tại sao bạn chọn các tiêu chí này và bạn kỳ vọng gì về các sản phẩm sắp gợi ý."
}

LƯU Ý:
- Chỉ chọn category/brand nếu chắc chắn khách yêu cầu hoặc rất phù hợp.
- Tags nên dựa trên các đặc tính âm thanh (bass mạnh, âm trong, hi-end, v.v.)
- Trả về đúng JSON, không kèm text ngoài.
`;

    const aiResult = await callGroqJson<{ criteria: ProductSearchCriteria; explanation: string }>({
      apiKey: process.env.GROQ_API_KEY!,
      model: aiConfig.ai_model,
      prompt,
      maxTokens: 1024,
      debugLabel: "[AI-Search-Parse]",
    });

    if (!aiResult) {
      return NextResponse.json(
        { error: "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau." },
        { status: 500 },
      );
    }

    const { criteria, explanation } = aiResult;

    // Prisma search based on criteria
    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        stock: { gt: 0 },
        AND: [
          criteria.category ? { category: { name: { contains: criteria.category, mode: "insensitive" } } } : {},
          criteria.brand ? { brand: { name: { contains: criteria.brand, mode: "insensitive" } } } : {},
          criteria.minPrice ? { price: { gte: criteria.minPrice } } : {},
          criteria.maxPrice ? { price: { lte: criteria.maxPrice } } : {},
          criteria.tags && criteria.tags.length > 0 ? { aiTags: { hasSome: criteria.tags } } : {},
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
      take: 6,
      orderBy: { createdAt: "desc" },
    });

    const formattedProducts = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      salePrice: p.salePrice ? Number(p.salePrice) : null,
      primaryImageUrl: p.images[0]?.url ?? null,
    }));

    // Log AI session
    void createAiSession({
      userId,
      type: "SEARCH",
      input: query,
      output: explanation,
      model: aiConfig.ai_model,
      metadata: {
        criteria,
        productCount: formattedProducts.length,
        latencyMs: Date.now() - startTime,
      },
    });

    const response: ProductAdviceSearchResponseDto = {
      criteria,
      products: formattedProducts,
      explanation,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[AI-Search] Error:", error);
    return NextResponse.json(
      { error: "Nội bộ server gặp lỗi." },
      { status: 500 },
    );
  }
}
