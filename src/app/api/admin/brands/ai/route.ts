import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateBrandSeoAndAiFields } from "@/services/ai-brand-seo-service";

export const runtime = "nodejs";

type BrandAiGenerateBody = {
  name?: string;
  description?: string | null;
};

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền sử dụng tính năng AI cho thương hiệu." },
      { status: 403 },
    );
  }

  let jsonBody: BrandAiGenerateBody;

  try {
    jsonBody = (await request.json()) as BrandAiGenerateBody;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const name = jsonBody.name?.trim() ?? "";
  const description = jsonBody.description?.trim() ?? null;

  if (!name) {
    return NextResponse.json(
      { error: "Tên thương hiệu là bắt buộc trước khi sinh nội dung AI." },
      { status: 400 },
    );
  }

  const generated = await generateBrandSeoAndAiFields({
    name,
    description,
  });

  if (
    !generated.seoTitle &&
    !generated.seoDescription &&
    !generated.aiDescription &&
    (!generated.aiTags || generated.aiTags.length === 0)
  ) {
    return NextResponse.json(
      {
        error:
          "Không thể sinh nội dung SEO/AI cho thương hiệu. Vui lòng thử lại sau.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    data: generated,
  });
}
