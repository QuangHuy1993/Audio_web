import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callGroqChat, type GroqChatMessage } from "@/lib/groq-chat";
import { createAiSession } from "@/services/ai-session-service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfig } from "@/lib/ai-config";

const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? null;

    const body = await request.json();
    const { budget, roomType, musicTaste, extraRequests } = body;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Dịch vụ AI chưa được cấu hình." }, { status: 503 });
    }

    const aiConfig = await getAiConfig();
    if (!aiConfig.ai_enabled) {
      return NextResponse.json(
        { error: "Dịch vụ AI hiện đang tạm ngưng." },
        { status: 503 }
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
            { status: 429 }
          );
        }
      }
    }

    // 1. Fetch products for context (limit to some active products)
    const productsRaw = await prisma.product.findMany({
      where: { status: "ACTIVE", stock: { gt: 0 } },
      select: {
        id: true,
        name: true,
        price: true,
        salePrice: true,
        aiDescription: true,
        aiTags: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
        images: {
          where: { isPrimary: true },
          select: { url: true },
          take: 1
        }
      },
      take: 20,
    });

    // Convert Decimal to Number for easier handling
    const products = productsRaw.map(p => ({
      ...p,
      price: Number(p.price),
      salePrice: p.salePrice ? Number(p.salePrice) : null,
      imageUrl: p.images[0]?.url ?? null
    }));

    // 2. Build system prompt for structured recommendation
    const catalogText = products.map((p, i) => 
      `${i+1}. ${p.name} - ${p.brand?.name} - ${p.category?.name} - Giá: ${p.salePrice ?? p.price} VND - Đặc tính: ${p.aiDescription}`
    ).join("\n");

    const systemPrompt = `
Bạn là chuyên gia tư vấn âm thanh của Đức Uy Audio. 
Nhiệm vụ: Dựa trên nhu cầu khách hàng, hãy chọn ra 3 sản phẩm phù hợp nhất từ danh sách bên dưới và đưa ra lời giải thích chuyên môn ngắn gọn.

THÔNG TIN KHÁCH HÀNG:
- Ngân sách: ${budget} VNĐ
- Loại phòng: ${roomType}
- Gu âm nhạc: ${musicTaste}
- Yêu cầu thêm: ${extraRequests ?? "Không có"}

DANH SÁCH SẢN PHẨM HIỆN CÓ:
${catalogText}

QUY TẮC TRẢ LỜI:
1. Chỉ chọn sản phẩm CÓ TRONG DANH SÁCH TRÊN.
2. Trả lời dưới dạng JSON với cấu trúc:
{
  "expertVerdict": "Lời giải thích chuyên sâu của bạn (tối đa 2 đoạn, không dùng markdown)",
  "recommendedProductIds": ["id1", "id2", "id3"]
}
3. Nếu không có đủ 3 sản phẩm phù hợp, hãy chọn ít nhất 1 cái tốt nhất.
4. Ưu tiên các sản phẩm có giá nằm trong hoặc gần khoảng ngân sách.
    `;

    const model = aiConfig.ai_model;
    const groqResponse = await callGroqChat({
      apiKey,
      model,
      messages: [{ role: "system", content: systemPrompt }],
      maxTokens: 1024,
      temperature: 0.3,
    });

    if (!groqResponse) {
       return NextResponse.json({ error: "Lỗi gọi AI." }, { status: 500 });
    }

    // Attempt to extract JSON from the response
    let aiResult;
    try {
      const jsonMatch = groqResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", groqResponse);
      return NextResponse.json({ error: "Lỗi xử lý kết quả AI." }, { status: 500 });
    }

    // 3. Match IDs to actual product data to return to client
    const recommendedProducts = products
      .filter(p => aiResult.recommendedProductIds.includes(p.id))
      .map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        salePrice: p.salePrice,
        brandName: p.brand?.name,
        categoryName: p.category?.name,
        imageUrl: p.imageUrl,
      }));

    const inputSummary = `Ngân sách: ${budget} | Phòng: ${roomType} | Nhạc: ${musicTaste} | Thêm: ${extraRequests ?? "Không có"}`;
    createAiSession({
      userId,
      type: "RECOMMENDATION",
      input: inputSummary,
      output: aiResult.expertVerdict ?? groqResponse,
      model: model,
      metadata: {
        recommendedProductIds: aiResult.recommendedProductIds,
        recommendedCount: recommendedProducts.length,
        budget,
        roomType,
        musicTaste,
      },
    });

    return NextResponse.json({
      expertVerdict: aiResult.expertVerdict,
      recommendedProducts
    });

  } catch (error) {
    console.error("[AI Recommend API Error]:", error);
    return NextResponse.json({ error: "Đã có lỗi xảy ra." }, { status: 500 });
  }
}
