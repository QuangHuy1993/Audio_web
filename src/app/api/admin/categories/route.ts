import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCategorySeoAndAiFields } from "@/services/ai-category-seo-service";

export const runtime = "nodejs";

const DEFAULT_PAGE_SIZE = 5;

type LevelFilter = "all" | "top" | "sub";

type UpsertCategoryBody = {
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  aiDescription?: string | null;
  aiTags?: string[];
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");
  const search = searchParams.get("search")?.trim() ?? "";
  const level = (searchParams.get("level") as LevelFilter | null) ?? "all";
  const parentId = searchParams.get("parentId");

  const page = Math.max(Number(pageParam ?? "1") || 1, 1);
  const isAiBatchMode = searchParams.get("mode") === "ai-batch";
  const maxPageSize = isAiBatchMode ? 200 : 50;
  const pageSize = Math.max(
    Math.min(
      Number(pageSizeParam ?? DEFAULT_PAGE_SIZE.toString()) || DEFAULT_PAGE_SIZE,
      maxPageSize
    ),
    1
  );

  const where: Prisma.CategoryWhereInput = {};
  const andConditions: Prisma.CategoryWhereInput[] = [];

  if (search) {
    andConditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (level === "top") {
    andConditions.push({ parentId: null });
  } else if (level === "sub") {
    if (parentId) {
      andConditions.push({ parentId });
    } else {
      andConditions.push({
        NOT: {
          parentId: null,
        },
      });
    }
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const noAiContent = searchParams.get("noAiContent") === "true";
  const hasAiContent = searchParams.get("hasAiContent") === "true";
  if (noAiContent && !hasAiContent) {
    where.OR = [
      ...(where.OR ?? []),
      { aiDescription: null },
      { aiDescription: "" },
    ];
  } else if (hasAiContent && !noAiContent) {
    where.aiDescription = { not: null };
  }

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: [
        { parentId: { sort: "asc", nulls: "first" } },
        { name: "asc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        parent: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    }),
    prisma.category.count({ where }),
  ]);

  // Nếu đang lấy danh mục con cho một parent cụ thể, không cần build lại cây,
  // chỉ trả về đúng các bản ghi đã filter theo parentId.
  const categoriesToUse =
    level === "sub" && parentId
      ? categories
      : (() => {
          // Sắp xếp lại theo thiết kế: mỗi danh mục cha đi kèm các danh mục con ngay bên dưới.
          const roots: typeof categories = [];
          const childrenByParentId = new Map<string, typeof categories>();

          categories.forEach((category) => {
            if (category.parentId == null) {
              roots.push(category);
              return;
            }

            const list = childrenByParentId.get(category.parentId) ?? [];
            list.push(category);
            childrenByParentId.set(category.parentId, list);
          });

          const orderedCategories: typeof categories = [];

          roots.forEach((root) => {
            orderedCategories.push(root);

            const children = childrenByParentId.get(root.id);
            if (children && children.length > 0) {
              children.sort((a, b) => a.name.localeCompare(b.name, "vi"));
              orderedCategories.push(...children);
              childrenByParentId.delete(root.id);
            }
          });

          childrenByParentId.forEach((children) => {
            children.sort((a, b) => a.name.localeCompare(b.name, "vi"));
            orderedCategories.push(...children);
          });

          return orderedCategories;
        })();

  return NextResponse.json({
    data: categoriesToUse.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentName: category.parent?.name ?? null,
      isTopLevel: category.parentId == null,
      productCount: category._count.products,
      seoTitle: category.seoTitle,
      seoDescription: category.seoDescription,
      aiDescription: category.aiDescription,
      aiTags: category.aiTags,
    })),
    total,
    page,
    pageSize,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền tạo danh mục mới." },
      { status: 403 },
    );
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

  const name = jsonBody.name?.trim() ?? "";
  const slug = jsonBody.slug?.trim() ?? "";
  const description = jsonBody.description?.trim() ?? "";
  const parentId = jsonBody.parentId?.trim() || null;

  let seoTitle = jsonBody.seoTitle?.trim() ?? null;
  let seoDescription = jsonBody.seoDescription?.trim() ?? null;
  let aiDescription = jsonBody.aiDescription?.trim() ?? null;
  let aiTags =
    jsonBody.aiTags
      ?.map((tag) => tag.trim())
      .filter((tag) => tag.length > 0) ?? [];

  if (!name || !slug) {
    return NextResponse.json(
      { error: "Tên danh mục và slug là bắt buộc." },
      { status: 400 },
    );
  }

  const slugPattern = /^[a-z0-9-]+$/;
  if (!slugPattern.test(slug)) {
    return NextResponse.json(
      {
        error:
          "Slug chỉ được phép chứa chữ thường, số và dấu gạch ngang (a-z, 0-9, -).",
      },
      { status: 400 },
    );
  }

  try {
    const shouldGenerateAiFields =
      !seoTitle && !seoDescription && !aiDescription && aiTags.length === 0;

    if (shouldGenerateAiFields) {
      const generated = await generateCategorySeoAndAiFields({
        name,
        description: description || null,
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

    const created = await prisma.category.create({
      data: {
        name,
        slug,
        description: description || null,
        parentId,
        seoTitle: seoTitle ?? null,
        seoDescription: seoDescription ?? null,
        aiDescription: aiDescription ?? null,
        aiTags,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parentId: true,
        seoTitle: true,
        seoDescription: true,
        aiDescription: true,
        aiTags: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        data: {
          ...created,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Slug danh mục này đã tồn tại trong hệ thống." },
        { status: 409 },
      );
    }

    // eslint-disable-next-line no-console
    console.error("Failed to create category", error);

    return NextResponse.json(
      { error: "Không thể tạo danh mục mới. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

