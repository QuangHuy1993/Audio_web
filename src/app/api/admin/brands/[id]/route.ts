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

const CLOUDINARY_BRANDS_FOLDER = "audio-ai/brands";

type BrandExisting = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  aiDescription: string | null;
  aiTags: string[];
};

type BrandProductItem = {
  id: string;
  name: string;
  slug: string;
  price: { toNumber?: () => number };
  stock: number;
  status: string;
  category: { name: string } | null;
  images: Array<{ url: string }>;
};

function parsePatchForm(form: FormData): {
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
    description: description || null,
    seoTitle: seoTitle || null,
    seoDescription: seoDescription || null,
    aiDescription: aiDescription || null,
    aiTags,
    logoFile: logoFile && logoFile.size > 0 ? logoFile : null,
  };
}

type UpdateBrandBody = {
  name?: string;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  aiDescription?: string | null;
  aiTags?: string[];
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!id) {
    return NextResponse.json(
      { error: "Thiếu mã thương hiệu." },
      { status: 400 },
    );
  }

  const brand = await prisma.brand.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logoUrl: true,
      seoTitle: true,
      seoDescription: true,
      aiDescription: true,
      aiTags: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { products: true } },
      products: {
        take: 2,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          stock: true,
          status: true,
          category: { select: { name: true } },
          images: {
            take: 1,
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            select: { url: true },
          },
        },
      },
    },
  });

  if (!brand) {
    return NextResponse.json(
      { error: "Thương hiệu không tồn tại." },
      { status: 404 },
    );
  }

  const { products, _count, ...rest } = brand;
  const productCount = _count.products;

  return NextResponse.json({
    data: {
      ...rest,
      productCount,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        stock: p.stock,
        status: p.status,
        categoryName: p.category?.name ?? null,
        imageUrl: p.images[0]?.url ?? null,
      })),
      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền cập nhật thương hiệu." },
      { status: 403 },
    );
  }

  if (!id) {
    return NextResponse.json(
      { error: "Thiếu mã thương hiệu." },
      { status: 400 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let name: string;
  let slug: string;
  let description: string | null;
  let logoUrl: string | null;
  let seoTitle: string | null;
  let seoDescription: string | null;
  let aiDescription: string | null;
  let aiTags: string[];
  let logoFile: File | null = null;

  const existing = await prisma.brand.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logoUrl: true,
      seoTitle: true,
      seoDescription: true,
      aiDescription: true,
      aiTags: true,
    },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Thương hiệu không tồn tại." },
      { status: 404 },
    );
  }

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
    const body = parsePatchForm(form);
    name = body.name || existing.name;
    slug = (body.slug || existing.slug).toLowerCase();
    description = body.description ?? existing.description ?? null;
    logoUrl = existing.logoUrl;
    seoTitle = body.seoTitle ?? existing.seoTitle ?? null;
    seoDescription = body.seoDescription ?? existing.seoDescription ?? null;
    aiDescription = body.aiDescription ?? existing.aiDescription ?? null;
    aiTags = body.aiTags.length > 0 ? body.aiTags : existing.aiTags ?? [];
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
    let jsonBody: UpdateBrandBody;
    try {
      jsonBody = (await request.json()) as UpdateBrandBody;
    } catch {
      return NextResponse.json(
        { error: "Dữ liệu gửi lên không hợp lệ." },
        { status: 400 },
      );
    }
    name = jsonBody.name?.trim() ?? existing.name;
    slug = (jsonBody.slug?.trim() ?? existing.slug).toLowerCase();
    description = jsonBody.description?.trim() ?? existing.description ?? null;
    logoUrl = jsonBody.logoUrl?.trim() ?? existing.logoUrl ?? null;
    seoTitle = jsonBody.seoTitle?.trim() ?? existing.seoTitle ?? null;
    seoDescription =
      jsonBody.seoDescription?.trim() ?? existing.seoDescription ?? null;
    aiDescription =
      jsonBody.aiDescription?.trim() ?? existing.aiDescription ?? null;
    aiTags =
      jsonBody.aiTags
        ?.map((t) => t.trim())
        .filter((t) => t.length > 0) ?? existing.aiTags ?? [];
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

  const hasExistingSeoOrAi =
    Boolean(existing.seoTitle) ||
    Boolean(existing.seoDescription) ||
    Boolean(existing.aiDescription) ||
    (existing.aiTags && existing.aiTags.length > 0);

  const hasNewSeoOrAi =
    Boolean(seoTitle) ||
    Boolean(seoDescription) ||
    Boolean(aiDescription) ||
    aiTags.length > 0;

  const shouldGenerateAi = !hasNewSeoOrAi && !hasExistingSeoOrAi;

  if (shouldGenerateAi) {
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

  try {
    const updateData: Prisma.BrandUpdateInput = {
      name,
      slug,
      description,
      seoTitle: seoTitle ?? null,
      seoDescription: seoDescription ?? null,
      aiDescription: aiDescription ?? null,
      aiTags,
    };
    if (!logoFile) {
      updateData.logoUrl = logoUrl;
    }

    const updated = await prisma.brand.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        seoTitle: true,
        seoDescription: true,
        aiDescription: true,
        aiTags: true,
        updatedAt: true,
      },
    });

    if (logoFile) {
      (async () => {
        try {
          const arrayBuffer = await logoFile!.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const result = await uploadImage(buffer, {
            folder: CLOUDINARY_BRANDS_FOLDER,
          });
          await prisma.brand.update({
            where: { id },
            data: { logoUrl: result.secureUrl },
          });
        } catch (e) {
          console.error("[PATCH /api/admin/brands/:id] Background logo upload failed:", e);
        }
      })();
    }

    return NextResponse.json({
      data: {
        ...updated,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Slug thương hiệu này đã được sử dụng bởi thương hiệu khác." },
        { status: 409 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Thương hiệu không tồn tại." },
        { status: 404 },
      );
    }
    console.error("Failed to update brand", error);
    return NextResponse.json(
      { error: "Không thể cập nhật thương hiệu. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền xoá thương hiệu." },
      { status: 403 },
    );
  }

  if (!id) {
    return NextResponse.json(
      { error: "Thiếu mã thương hiệu." },
      { status: 400 },
    );
  }

  try {
    const brand = await prisma.brand.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!brand) {
      return NextResponse.json(
        { error: "Thương hiệu không tồn tại." },
        { status: 404 },
      );
    }

    await prisma.$transaction([
      prisma.product.updateMany({
        where: { brandId: id },
        data: { brandId: null },
      }),
      prisma.brand.delete({
        where: { id },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Thương hiệu không tồn tại." },
        { status: 404 },
      );
    }
    // eslint-disable-next-line no-console
    console.error("Failed to delete brand", error);
    return NextResponse.json(
      { error: "Không thể xoá thương hiệu. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}
