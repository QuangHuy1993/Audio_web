import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCategorySeoAndAiFields } from "@/services/ai-category-seo-service";

export const runtime = "nodejs";

type UpsertCategoryBody = {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  aiDescription?: string | null;
  aiTags?: string[];
};

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền xoá danh mục." },
      { status: 403 },
    );
  }

  if (!id) {
    return NextResponse.json({ error: "Thiếu mã danh mục." }, { status: 400 });
  }

  try {
    // Tìm tất cả danh mục cần xoá: danh mục hiện tại + các danh mục con trực tiếp
    const categoriesToDelete = await prisma.category.findMany({
      where: {
        OR: [{ id }, { parentId: id }],
      },
      select: {
        id: true,
      },
    });

    if (categoriesToDelete.length === 0) {
      return NextResponse.json(
        { error: "Danh mục không tồn tại hoặc đã bị xoá." },
        { status: 404 },
      );
    }

    const categoryIds = categoriesToDelete.map((category) => category.id);

    await prisma.$transaction([
      // Ngắt liên kết các sản phẩm với những danh mục này, KHÔNG xoá sản phẩm
      prisma.product.updateMany({
        where: {
          categoryId: {
            in: categoryIds,
          },
        },
        data: {
          categoryId: null,
        },
      }),
      // Xoá toàn bộ danh mục liên quan (cha + con)
      prisma.category.deleteMany({
        where: {
          id: {
            in: categoryIds,
          },
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Danh mục không tồn tại hoặc đã bị xoá." },
        { status: 404 },
      );
    }

    
    console.error("Failed to delete category", error);

    return NextResponse.json(
      { error: "Không thể xoá danh mục. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền cập nhật danh mục." },
      { status: 403 },
    );
  }

  if (!id) {
    return NextResponse.json({ error: "Thiếu mã danh mục." }, { status: 400 });
  }

  let jsonBody: UpsertCategoryBody;

  try {
    jsonBody = (await request.json()) as UpsertCategoryBody;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const name = jsonBody.name?.trim();
  const description = jsonBody.description?.trim();
  const parentId = jsonBody.parentId?.trim() || null;

  let seoTitle = jsonBody.seoTitle?.trim() ?? null;
  let seoDescription = jsonBody.seoDescription?.trim() ?? null;
  let aiDescription = jsonBody.aiDescription?.trim() ?? null;
  let aiTags =
    jsonBody.aiTags
      ?.map((tag) => tag.trim())
      .filter((tag) => tag.length > 0) ?? [];

  if (!name) {
    return NextResponse.json(
      { error: "Tên danh mục là bắt buộc." },
      { status: 400 },
    );
  }

  try {
    const existingRaw = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingRaw) {
      return NextResponse.json(
        { error: "Danh mục không tồn tại hoặc đã bị xoá." },
        { status: 404 },
      );
    }

    const existing = existingRaw as unknown as {
      name: string;
      description: string | null;
      parentId: string | null;
      seoTitle: string | null;
      seoDescription: string | null;
      aiDescription: string | null;
      aiTags: string[] | null;
    };

    const effectiveName = name ?? existing.name;
    const effectiveDescription =
      description ?? existing.description ?? undefined;

    const hasManualAiFields =
      Boolean(seoTitle) ||
      Boolean(seoDescription) ||
      Boolean(aiDescription) ||
      aiTags.length > 0;

    const alreadyHasAiFields =
      Boolean(existing.seoTitle) ||
      Boolean(existing.seoDescription) ||
      Boolean(existing.aiDescription) ||
      (existing.aiTags && existing.aiTags.length > 0);

    const shouldGenerateAiFields = !hasManualAiFields && !alreadyHasAiFields;

    if (shouldGenerateAiFields) {
      const generated = await generateCategorySeoAndAiFields({
        name: effectiveName,
        description: effectiveDescription,
        parentName: null,
      });

      seoTitle = generated.seoTitle ?? seoTitle;
      seoDescription = generated.seoDescription ?? seoDescription;
      aiDescription = generated.aiDescription ?? aiDescription;
      aiTags =
        generated.aiTags && generated.aiTags.length > 0
          ? generated.aiTags
          : aiTags;
    }

    const dataForUpdate: Prisma.CategoryUpdateInput = {
      name: effectiveName,
      description: effectiveDescription ?? null,
      parent: {
        connect: parentId ? { id: parentId } : undefined,
        disconnect: parentId ? undefined : true,
      },
    };

    // Các field SEO/AI mới chưa được Prisma Client typings cập nhật ở môi trường lint,
    // nên cần ép kiểu thủ công để linter không chặn build. Khi bạn chạy `prisma generate`,
    // type thực tế sẽ đồng bộ với schema và các field này là hợp lệ.
    (dataForUpdate as unknown as Record<string, unknown>).seoTitle =
      seoTitle ?? existing.seoTitle ?? null;
    (dataForUpdate as unknown as Record<string, unknown>).seoDescription =
      seoDescription ?? existing.seoDescription ?? null;
    (dataForUpdate as unknown as Record<string, unknown>).aiDescription =
      aiDescription ?? existing.aiDescription ?? null;
    (dataForUpdate as unknown as Record<string, unknown>).aiTags =
      aiTags.length > 0 ? aiTags : existing.aiTags ?? [];

    const updated = await prisma.category.update({
      where: { id },
      data: dataForUpdate,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parentId: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      data: {
        ...updated,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Danh mục không tồn tại hoặc đã bị xoá." },
        { status: 404 },
      );
    }

    console.error("Failed to update category", error);

    return NextResponse.json(
      { error: "Không thể cập nhật danh mục. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

