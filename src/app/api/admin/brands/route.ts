import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateBrandSeoAndAiFields } from "@/services/ai-brand-seo-service";
import {
  uploadImage,
  validateImageFile,
  CLOUDINARY_MAX_FILE_SIZE_BYTES,
} from "@/services/cloudinary-service";

export const runtime = "nodejs";

const DEFAULT_PAGE_SIZE = 10;
const CLOUDINARY_BRANDS_FOLDER = "audio-ai/brands";

type UpsertBrandBody = {
  name?: string;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
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
  const segment = searchParams.get("segment")?.trim() ?? "";

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

  const where: Prisma.BrandWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
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

  if (segment && segment !== "all") {
    where.aiTags = {
      has: segment,
    };
  }

  type BrandWithCount = Awaited<ReturnType<typeof prisma.brand.findMany>>[number] & {
    seoTitle?: string | null;
    seoDescription?: string | null;
    _count?: { products: number };
  };

  const [brandsRaw, total, allForStats] = await Promise.all([
    prisma.brand.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { products: true } },
      },
    }),
    prisma.brand.count({ where }),
    prisma.brand.findMany({
      where,
      include: {
        _count: { select: { products: true } },
      },
    }),
  ]);

  const brands = brandsRaw as BrandWithCount[];

  const statsSource = allForStats as BrandWithCount[];

  const aiOptimizedTotal = statsSource.filter(
    (b) =>
      (b.seoTitle || b.seoDescription || b.aiDescription) &&
      (b.aiTags?.length ?? 0) > 0,
  ).length;

  const seoConfiguredTotal = statsSource.filter(
    (b) => (b.seoTitle ?? null) && (b.seoDescription ?? null),
  ).length;

  const totalProducts = statsSource.reduce(
    (sum, b) => sum + (b._count?.products ?? 0),
    0,
  );

  return NextResponse.json({
    data: brands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      description: b.description,
      logoUrl: b.logoUrl,
      seoTitle: b.seoTitle ?? null,
      seoDescription: b.seoDescription ?? null,
      aiDescription: b.aiDescription,
      aiTags: b.aiTags,
      productCount: b._count?.products ?? 0,
    })),
    total,
    page,
    pageSize,
    aiOptimizedTotal,
    seoConfiguredTotal,
    totalProducts,
  });
}

function parseFormBody(form: FormData): {
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  aiDescription: string | null;
  aiTags: string[];
  logoFile: File | null;
} {
  const name = (form.get("name") as string | null)?.trim() ?? "";
  const slug = (form.get("slug") as string | null)?.trim() ?? "";
  const description = (form.get("description") as string | null)?.trim() ?? null;
  const seoTitle = (form.get("seoTitle") as string | null)?.trim() ?? null;
  const seoDescription = (form.get("seoDescription") as string | null)?.trim() ?? null;
  const aiDescription = (form.get("aiDescription") as string | null)?.trim() ?? null;
  let aiTags: string[] = [];
  const aiTagsRaw = form.get("aiTags");
  if (typeof aiTagsRaw === "string") {
    try {
      const parsed = JSON.parse(aiTagsRaw) as unknown;
      aiTags = Array.isArray(parsed)
        ? (parsed as string[]).map((t) => String(t).trim()).filter(Boolean)
        : [];
    } catch {
      // ignore
    }
  }
  const logoFile = form.get("logo") as File | null;
  return {
    name,
    slug,
    description,
    seoTitle: seoTitle || null,
    seoDescription: seoDescription || null,
    aiDescription: aiDescription || null,
    aiTags,
    logoFile: logoFile && logoFile.size > 0 ? logoFile : null,
  };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền tạo thương hiệu mới." },
      { status: 403 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let name: string;
  let slug: string;
  let description: string | null;
  let logoUrl: string | null = null;
  let seoTitle: string | null;
  let seoDescription: string | null;
  let aiDescription: string | null;
  let aiTags: string[];
  let logoFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Dữ liệu gửi lên không hợp lệ." },
        { status: 400 },
      );
    }
    const body = parseFormBody(form);
    name = body.name;
    slug = body.slug;
    description = body.description;
    seoTitle = body.seoTitle;
    seoDescription = body.seoDescription;
    aiDescription = body.aiDescription;
    aiTags = body.aiTags;
    logoFile = body.logoFile;
    if (logoFile) {
      const validation = validateImageFile(logoFile.type, logoFile.size, {
        maxSizeBytes: CLOUDINARY_MAX_FILE_SIZE_BYTES,
      });
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }
  } else {
    let jsonBody: UpsertBrandBody;
    try {
      jsonBody = (await request.json()) as UpsertBrandBody;
    } catch {
      return NextResponse.json(
        { error: "Dữ liệu gửi lên không hợp lệ." },
        { status: 400 },
      );
    }
    name = jsonBody.name?.trim() ?? "";
    slug = jsonBody.slug?.trim() ?? "";
    description = jsonBody.description?.trim() ?? null;
    logoUrl = jsonBody.logoUrl?.trim() ?? null;
    seoTitle = jsonBody.seoTitle?.trim() ?? null;
    seoDescription = jsonBody.seoDescription?.trim() ?? null;
    aiDescription = jsonBody.aiDescription?.trim() ?? null;
    aiTags =
      jsonBody.aiTags
        ?.map((tag) => tag.trim())
        .filter((tag) => tag.length > 0) ?? [];
  }

  if (!name || !slug) {
    return NextResponse.json(
      { error: "Tên thương hiệu và slug là bắt buộc." },
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
      const generated = await generateBrandSeoAndAiFields({
        name,
        description,
      });
      seoTitle = generated.seoTitle ?? seoTitle;
      seoDescription = generated.seoDescription ?? seoDescription;
      aiDescription = generated.aiDescription ?? aiDescription;
      aiTags =
        generated.aiTags && generated.aiTags.length > 0
          ? generated.aiTags
          : aiTags;
    }

    const createLogoUrl = logoFile ? null : logoUrl;
    const createData = {
      name,
      slug,
      description,
      logoUrl: createLogoUrl,
      seoTitle: seoTitle ?? null,
      seoDescription: seoDescription ?? null,
      aiDescription: aiDescription ?? null,
      aiTags,
    } as Prisma.BrandCreateInput;

    const created = await prisma.brand.create({
      data: createData,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        aiDescription: true,
        aiTags: true,
        createdAt: true,
      },
    });

    if (logoFile) {
      const brandId = created.id;
      (async () => {
        try {
          const arrayBuffer = await logoFile!.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const result = await uploadImage(buffer, {
            folder: CLOUDINARY_BRANDS_FOLDER,
          });
          await prisma.brand.update({
            where: { id: brandId },
            data: { logoUrl: result.secureUrl },
          });
        } catch (e) {
          console.error("[POST /api/admin/brands] Background logo upload failed:", e);
        }
      })();
    }

    const createdOut = created as typeof created & {
      seoTitle: string | null;
      seoDescription: string | null;
    };
    createdOut.seoTitle = seoTitle;
    createdOut.seoDescription = seoDescription;

    return NextResponse.json(
      {
        data: {
          ...createdOut,
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
        { error: "Slug thương hiệu này đã tồn tại trong hệ thống." },
        { status: 409 },
      );
    }
    console.error("Failed to create brand", error);
    return NextResponse.json(
      { error: "Không thể tạo thương hiệu mới. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}
