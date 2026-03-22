import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateProductSeoAndAiFields } from "@/services/ai-product-seo-service";

export const runtime = "nodejs";

type ProductAiGenerateBody = {
  name?: string;
  description?: string | null;
  brandId?: string | null;
  categoryId?: string | null;
  price?: number | null;
  currency?: string | null;
};

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền sử dụng tính năng AI cho sản phẩm." },
      { status: 403 },
    );
  }

  let jsonBody: ProductAiGenerateBody;

  try {
    jsonBody = (await request.json()) as ProductAiGenerateBody;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const name = jsonBody.name?.trim() ?? "";
  const description = jsonBody.description?.trim() ?? null;
  const brandId = jsonBody.brandId?.trim() || null;
  const categoryId = jsonBody.categoryId?.trim() || null;
  const currency = jsonBody.currency?.trim() || "VND";

  const rawPrice =
    typeof jsonBody.price === "number" && Number.isFinite(jsonBody.price)
      ? jsonBody.price
      : null;

  if (!name) {
    return NextResponse.json(
      { error: "Tên sản phẩm là bắt buộc trước khi sinh nội dung AI." },
      { status: 400 },
    );
  }

  const [brand, category] = await Promise.all([
    brandId
      ? prisma.brand.findUnique({
          where: { id: brandId },
          select: {
            name: true,
            seoDescription: true,
            aiDescription: true,
            aiTags: true,
          },
        })
      : Promise.resolve(null),
    categoryId
      ? prisma.category.findUnique({
          where: { id: categoryId },
          select: {
            name: true,
            seoDescription: true,
            aiDescription: true,
            aiTags: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const generated = await generateProductSeoAndAiFields({
    name,
    description: description ?? "",
    brandName: brand?.name ?? null,
    categoryName: category?.name ?? null,
    priceVnd: currency === "VND" && rawPrice != null ? rawPrice : null,
    brandSeoDescription: brand?.seoDescription ?? null,
    brandAiDescription: brand?.aiDescription ?? null,
    brandAiTags: brand?.aiTags ?? null,
    categorySeoDescription: category?.seoDescription ?? null,
    categoryAiDescription: category?.aiDescription ?? null,
    categoryAiTags: category?.aiTags ?? null,
  });

  if (!generated.aiDescription) {
    const basePieces = [
      name,
      category?.name ?? undefined,
      brand?.name ?? undefined,
    ].filter(Boolean);
    const baseLine = basePieces.join(" - ");
    generated.aiDescription = `Phù hợp cho người nghe muốn trải nghiệm ${baseLine.toLowerCase()}, ưu tiên không gian gia đình và giải trí hằng ngày.`;
  }

  if (
    !generated.seoTitle &&
    !generated.seoDescription &&
    !generated.aiDescription &&
    (!generated.aiTags || generated.aiTags.length === 0)
  ) {
    return NextResponse.json(
      {
        error:
          "Không thể sinh nội dung SEO/AI cho sản phẩm. Vui lòng thử lại sau.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ data: generated });
}

