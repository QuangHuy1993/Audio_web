import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCategorySeoAndAiFields } from "@/services/ai-category-seo-service";

export const runtime = "nodejs";

type CategoryAiGenerateBody = {
  name?: string;
  description?: string | null;
  parentId?: string | null;
};

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền sử dụng tính năng AI cho danh mục." },
      { status: 403 },
    );
  }

  let jsonBody: CategoryAiGenerateBody;

  try {
    jsonBody = (await request.json()) as CategoryAiGenerateBody;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const name = jsonBody.name?.trim() ?? "";
  const description = jsonBody.description?.trim() ?? "";
  const parentId = jsonBody.parentId?.trim() || null;

  if (!name) {
    return NextResponse.json(
      { error: "Tên danh mục là bắt buộc trước khi sinh nội dung AI." },
      { status: 400 },
    );
  }

  let parentName: string | null = null;

  if (parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: parentId },
      select: { name: true },
    });

    parentName = parent?.name ?? null;
  }

  const generated = await generateCategorySeoAndAiFields({
    name,
    description: description || null,
    parentName,
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
          "Không thể sinh nội dung SEO/AI cho danh mục. Mô tả hiện tại có thể quá dài hoặc quá chi tiết, khiến AI bị giới hạn token. Vui lòng rút gọn phần mô tả danh mục (khoảng 1–2 câu súc tích) rồi thử lại.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    data: generated,
  });
}

