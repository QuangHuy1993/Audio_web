import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callGroqJson } from "@/lib/groq-json";
import { createAiSession } from "@/services/ai-session-service";
import { getAiConfig } from "@/lib/ai-config";
import type { ProductComparisonRequestDto, ProductComparisonResponseDto } from "@/types/ai";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = (await request.json()) as ProductComparisonRequestDto;
    const { productIds, criteria } = body;

    if (!Array.isArray(productIds) || productIds.length < 2) {
      return NextResponse.json(
        { error: "Cần ít nhất 2 sản phẩm để so sánh." },
        { status: 400 },
      );
    }

    if (productIds.length > 4) {
      return NextResponse.json(
        { error: "Chỉ hỗ trợ so sánh tối đa 4 sản phẩm cùng lúc." },
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

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        salePrice: true,
        aiDescription: true,
        aiTags: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    if (products.length < 2) {
      return NextResponse.json(
        { error: "Không tìm thấy đủ sản phẩm để so sánh." },
        { status: 404 },
      );
    }

    const productsContext = products
      .map((p, idx) => {
        return `
Sản phẩm ${idx + 1}:
- ID: ${p.id}
- Tên: ${p.name}
- Thương hiệu: ${p.brand?.name ?? "Không rõ"}
- Danh mục: ${p.category?.name ?? "Không rõ"}
- Giá: ${new Intl.NumberFormat("vi-VN").format(Number(p.salePrice ?? p.price))}đ
- Đặc tính AI: ${p.aiDescription ?? "Chưa có"}
- Tags: ${p.aiTags.join(", ")}
- Mô tả: ${p.description.slice(0, 500)}...
`;
      })
      .join("\n---\n");

    const prompt = `
Bạn là chuyên gia âm thanh từ Đức Uy Audio. Hãy so sánh các sản phẩm sau đây dựa trên dữ liệu kỹ thuật và đặc tính âm thanh.

DỮ LIỆU SẢN PHẨM:
${productsContext}

YÊU CẦU:
1. So sánh chi tiết theo các tiêu chí${criteria && criteria.length > 0 ? `: ${criteria.join(", ")}` : " như Chất âm, Thiết kế, Công nghệ, Tầm giá và Đối tượng sử dụng"}.
2. Trả về kết quả dưới dạng JSON object có cấu trúc sau:
{
  "comparisonData": [
    {
      "criteria": "Tên tiêu chí",
      "values": [
        { "productId": "ID sản phẩm", "value": "Nội dung so sánh ngắn gọn" }
      ]
    }
  ],
  "summary": "Đoạn văn tóm tắt ngắn gọn lời khuyên chọn sản phẩm nào cho nhu cầu nào."
}

LƯU Ý:
- Nội dung value cho mỗi sản phẩm phải súc tích, tối đa 20 từ.
- Trả về đúng định dạng JSON, không kèm giải thích bên ngoài.
- Luôn tập trung vào giá trị thực tế cho người nghe nhạc.
`;

    const result = await callGroqJson<ProductComparisonResponseDto>({
      apiKey: process.env.GROQ_API_KEY!,
      model: aiConfig.ai_model,
      prompt,
      maxTokens: 2048,
      debugLabel: "[AI-Compare]",
    });

    if (!result) {
      return NextResponse.json(
        { error: "Không thể thực hiện so sánh lúc này. Vui lòng thử lại sau." },
        { status: 500 },
      );
    }

    // Log AI session
    void createAiSession({
      userId,
      type: "COMPARISON",
      input: `So sánh: ${products.map((p) => p.name).join(" vs ")}`,
      output: result.summary,
      model: aiConfig.ai_model,
      metadata: {
        productIds,
        latencyMs: Date.now() - startTime,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[AI-Compare] Error:", error);
    return NextResponse.json(
      { error: "Nội bộ server gặp lỗi." },
      { status: 500 },
    );
  }
}
