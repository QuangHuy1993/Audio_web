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

    // 1. Fetch products for context
    // We try to fetch products that are somewhat relevant to the budget if possible,
    // or just a larger set to give the AI more options.
    const budgetValue = parseInt(budget.replace(/\./g, "").replace(/ VND/i, "")) || 0;

    const productsRaw = await prisma.product.findMany({
      where: { 
        status: "ACTIVE", 
        stock: { gt: 0 },
      },
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
      // Reduced context size to avoid GROQ TPM limits (6000 tokens)
      take: 35,
      orderBy: budgetValue > 0 ? [
        { price: 'desc' } // Just a heuristic to get varied products
      ] : { createdAt: 'desc' },
    });

    // Convert Decimal to Number for easier handling
    const products = productsRaw.map(p => ({
      ...p,
      price: Number(p.price),
      salePrice: p.salePrice ? Number(p.salePrice) : null,
      imageUrl: p.images[0]?.url ?? null
    }));

    // 2. Build system prompt for structured recommendation
    // Truncate descriptions to save tokens
    const catalogText = products.map((p, i) => 
      `${i+1}. ID: ${p.id} | ${p.name} (${p.brand?.name}) - ${p.salePrice ?? p.price} VND | Mô tả: ${p.aiDescription?.substring(0, 120)}...`
    ).join("\n");

    const systemPrompt = `
Bạn là chuyên gia tư vấn âm thanh cao cấp của Đức Uy Audio. 
Nhiệm vụ: Dựa trên nhu cầu khách hàng, hãy chọn ra tối đa 3 sản phẩm phù hợp NHẤT từ danh sách sản phẩm hiện có bên dưới.

THÔNG TIN KHÁCH HÀNG:
- Ngân sách: ${budget} VNĐ
- Loại phòng: ${roomType}
- Gu âm nhạc: ${musicTaste}
- Yêu cầu thêm: ${extraRequests ?? "Không có"}

DANH SÁCH SẢN PHẨM HIỆN CÓ TẠI CỬA HÀNG (CHỈ ĐƯỢC CHỌN TRONG ĐÂY):
${catalogText}

QUY TẮC BẮT BUỘC:
1. CHỈ ĐƯỢC CHỌN sản phẩm có trong danh sách TRÊN. Tuyệt đối không tự bịa ra sản phẩm khác (như JBL, Bose... nếu không có trong danh sách).
2. Trả lời duy nhất một khối JSON theo cấu trúc:
{
  "expertVerdict": "Lời giải thích chuyên sâu (tối đa 3 câu). Giải thích tại sao cấu hình này phù hợp với gu nhạc và phòng của khách.",
  "recommendedProductIds": ["id1", "id2", "id3"]
}
3. Cố gắng chọn sản phẩm có tổng giá trị gần bằng hoặc thấp hơn ngân sách khách hàng.
4. Nếu ngân sách khách hàng quá cao mà sản phẩm hiện có chỉ là giá thấp, hãy chọn những cái tốt nhất hiện có và giải thích rõ.
5. Luôn ưu tiên độ chính xác về ID sản phẩm.
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

  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith("GROQ_429:")) {
      const match = error.message.match(/try again in ([0-9.]+)s/i);
      if (match) {
        const secs = Math.ceil(parseFloat(match[1]));
        return NextResponse.json(
          { error: `Hệ thống AI đang quá tải. Vui lòng thử lại sau ${secs} giây.` },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Hệ thống AI đang bị quá tải. Vui lòng thử lại sau một chút." },
        { status: 429 }
      );
    }
    console.error("[AI Recommend API Error]:", error);
    return NextResponse.json({ error: "Đã có lỗi xảy ra." }, { status: 500 });
  }
}
