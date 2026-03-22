import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  uploadImage,
  validateImageFile,
  CLOUDINARY_MAX_FILE_SIZE_BYTES,
} from "@/services/cloudinary-service";
import {
  generateProductSeoAndAiFields,
  type ProductSeoAiOutput,
} from "@/services/ai-product-seo-service";

export const runtime = "nodejs";

const DEFAULT_PAGE_SIZE = 10;

type ProductStatusFilter = "all" | "ACTIVE" | "DRAFT" | "HIDDEN";
type StockStatusFilter = "all" | "out" | "low" | "ok";

type CreateProductBody = {
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  discountPercent?: number;
  currency?: string;
  stock?: number;
  status?: "ACTIVE" | "DRAFT" | "HIDDEN";
  brandId?: string | null;
  categoryId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  aiDescription?: string | null;
  aiTags?: string[];
};

const CLOUDINARY_PRODUCTS_FOLDER = "audio-ai/products";

function parseProductFormBody(form: FormData): {
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPercent: number;
  currency: string;
  stock: number;
  status: "ACTIVE" | "DRAFT" | "HIDDEN";
  brandId: string | null;
  categoryId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  aiDescription: string | null;
  aiTags: string[];
  primaryImageFile: File | null;
  secondaryImageFiles: File[];
} {
  const getText = (key: string) =>
    ((form.get(key) as string | null)?.trim() ?? "") || "";

  const name = getText("name");
  const slug = getText("slug");
  const description = getText("description");
  const currency = getText("currency") || "VND";
  const statusRaw = getText("status") || "ACTIVE";
  const status =
    statusRaw === "DRAFT" || statusRaw === "HIDDEN" ? statusRaw : "ACTIVE";

  const priceRaw = Number(getText("price") || "0");
  const price = Number.isFinite(priceRaw) ? priceRaw : 0;

  const discountRaw = Number(getText("discountPercent") || "0");
  const discountPercent = Number.isFinite(discountRaw) ? discountRaw : 0;

  const stockRaw = Number(getText("stock") || "0");
  const stock = Number.isFinite(stockRaw)
    ? Math.max(0, Math.trunc(stockRaw))
    : 0;

  const brandIdValue = getText("brandId");
  const categoryIdValue = getText("categoryId");

  const seoTitle = getText("seoTitle") || null;
  const seoDescription = getText("seoDescription") || null;
  const aiDescription = getText("aiDescription") || null;

  let aiTags: string[] = [];
  const aiTagsRaw = form.get("aiTags");
  if (typeof aiTagsRaw === "string") {
    try {
      const parsed = JSON.parse(aiTagsRaw) as unknown;
      aiTags = Array.isArray(parsed)
        ? (parsed as string[])
            .map((t) => String(t).trim())
            .filter(Boolean)
        : [];
    } catch {
      aiTags = [];
    }
  }

  // Support new split keys (primaryImage / secondaryImages) and backward-compat old "images"
  const primaryRaw = form.get("primaryImage");
  let primaryImageFile: File | null =
    primaryRaw instanceof File && primaryRaw.size > 0 ? primaryRaw : null;

  let secondaryImageFiles = form
    .getAll("secondaryImages")
    .filter((f): f is File => f instanceof File && f.size > 0);

  // Backward-compat: if neither split key used, fall back to "images"
  if (!primaryImageFile && secondaryImageFiles.length === 0) {
    const oldFiles = form
      .getAll("images")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (oldFiles.length > 0) {
      [primaryImageFile] = oldFiles;
      secondaryImageFiles = oldFiles.slice(1);
    }
  }

  return {
    name,
    slug,
    description,
    price,
    discountPercent,
    currency,
    stock,
    status,
    brandId: brandIdValue || null,
    categoryId: categoryIdValue || null,
    seoTitle,
    seoDescription,
    aiDescription,
    aiTags,
    primaryImageFile,
    secondaryImageFiles,
  };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");
  const search = searchParams.get("search")?.trim() ?? "";
  const statusParam =
    (searchParams.get("status") as ProductStatusFilter | null) ?? "all";
  const stockStatusParam =
    (searchParams.get("stockStatus") as StockStatusFilter | null) ?? "all";

  const page = Math.max(Number(pageParam ?? "1") || 1, 1);
  const isAiBatchMode = searchParams.get("mode") === "ai-batch";
  const maxPageSize = isAiBatchMode ? 200 : 50;
  const pageSize = Math.max(
    Math.min(
      Number(pageSizeParam ?? DEFAULT_PAGE_SIZE.toString()) || DEFAULT_PAGE_SIZE,
      maxPageSize,
    ),
    1,
  );

  const where: Prisma.ProductWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  if (statusParam !== "all") {
    where.status = statusParam;
  }

  if (stockStatusParam === "out") {
    where.stock = 0;
  } else if (stockStatusParam === "low") {
    where.stock = { gt: 0, lte: 3 };
  } else if (stockStatusParam === "ok") {
    where.stock = { gt: 3 };
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

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        brand: {
          select: {
            name: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
        images: {
          select: {
            url: true,
            isPrimary: true,
            sortOrder: true,
          },
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
            { id: "asc" },
          ],
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const data = products.map((product) => {
    const primaryImage = product.images[0];
    const primaryImageUrl = primaryImage?.url ?? null;

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      brandName: product.brand?.name ?? null,
      categoryName: product.category?.name ?? null,
      price: Number(product.price),
      currency: product.currency,
      stock: product.stock,
      status: product.status,
      primaryImageUrl,
      seoTitle: product.seoTitle ?? null,
      seoDescription: product.seoDescription ?? null,
      aiDescription: product.aiDescription ?? null,
      aiTags: product.aiTags,
    };
  });

  return NextResponse.json({
    data,
    total,
    page,
    pageSize,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền tạo sản phẩm mới." },
      { status: 403 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  let name: string;
  let slug: string;
  let description: string;
  let currency: string;
  let status: "ACTIVE" | "DRAFT" | "HIDDEN";
  let price: number;
  let discountPercent: number;
  let stock: number;
  let brandId: string | null;
  let categoryId: string | null;
  let seoTitle: string | null;
  let seoDescription: string | null;
  let aiDescription: string | null;
  let aiTags: string[];
  let primaryImageFile: File | null = null;
  let secondaryImageFiles: File[] = [];

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

    const body = parseProductFormBody(form);
    name = body.name;
    slug = body.slug;
    description = body.description;
    currency = body.currency;
    status = body.status;
    price = body.price;
    discountPercent = body.discountPercent;
    stock = body.stock;
    brandId = body.brandId;
    categoryId = body.categoryId;
    seoTitle = body.seoTitle;
    seoDescription = body.seoDescription;
    aiDescription = body.aiDescription;
    aiTags = body.aiTags;
    primaryImageFile = body.primaryImageFile;
    secondaryImageFiles = body.secondaryImageFiles;

    const allFiles = [
      ...(primaryImageFile ? [primaryImageFile] : []),
      ...secondaryImageFiles,
    ];
    for (const file of allFiles) {
      const validation = validateImageFile(file.type, file.size, {
        maxSizeBytes: CLOUDINARY_MAX_FILE_SIZE_BYTES,
      });
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 },
        );
      }
    }
  } else {
    let jsonBody: CreateProductBody;
    try {
      jsonBody = (await request.json()) as CreateProductBody;
    } catch {
      return NextResponse.json(
        { error: "Dữ liệu gửi lên không hợp lệ." },
        { status: 400 },
      );
    }

    name = jsonBody.name?.trim() ?? "";
    slug = jsonBody.slug?.trim() ?? "";
    description = jsonBody.description?.trim() ?? "";
    currency = jsonBody.currency?.trim() || "VND";
    status = jsonBody.status ?? "ACTIVE";

    const rawPrice = typeof jsonBody.price === "number" ? jsonBody.price : NaN;
    price = Number.isFinite(rawPrice) ? rawPrice : 0;

    const rawDiscount =
      typeof jsonBody.discountPercent === "number"
        ? jsonBody.discountPercent
        : NaN;
    discountPercent = Number.isFinite(rawDiscount) ? rawDiscount : 0;

    const rawStock = typeof jsonBody.stock === "number" ? jsonBody.stock : NaN;
    stock = Number.isFinite(rawStock)
      ? Math.max(0, Math.trunc(rawStock))
      : 0;

    brandId = jsonBody.brandId?.trim() || null;
    categoryId = jsonBody.categoryId?.trim() || null;

    seoTitle = jsonBody.seoTitle?.trim() || null;
    seoDescription = jsonBody.seoDescription?.trim() || null;
    aiDescription = jsonBody.aiDescription?.trim() || null;
    aiTags =
      jsonBody.aiTags
        ?.map((tag) => tag.trim())
        .filter((tag) => tag.length > 0) ?? [];
  }

  if (!name || !slug) {
    return NextResponse.json(
      { error: "Tên sản phẩm và slug là bắt buộc." },
      { status: 400 },
    );
  }

  if (!price || price <= 0) {
    return NextResponse.json(
      { error: "Giá sản phẩm phải lớn hơn 0." },
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

  const normalizedDiscount =
    discountPercent > 0 && discountPercent <= 100 ? discountPercent : 0;
  const salePrice =
    normalizedDiscount > 0
      ? Number(
          (price * (1 - normalizedDiscount / 100)).toFixed(
            currency === "VND" ? 0 : 2,
          ),
        )
      : null;

  try {
    const shouldGenerateAiFields =
      !seoTitle && !seoDescription && !aiDescription && aiTags.length === 0;

    if (shouldGenerateAiFields) {
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

      const generated: ProductSeoAiOutput = await generateProductSeoAndAiFields({
        name,
        description,
        brandName: brand?.name ?? null,
        categoryName: category?.name ?? null,
        priceVnd: currency === "VND" ? price : null,
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
        generated.aiDescription = `Sản phẩm phù hợp cho hệ thống nghe nhìn với cấu hình xoay quanh ${baseLine.toLowerCase()}, chú trọng trải nghiệm cân bằng giữa nghe nhạc và xem phim.`;
      }

      if (generated.seoTitle && !seoTitle) {
        seoTitle = generated.seoTitle;
      }
      if (generated.seoDescription && !seoDescription) {
        seoDescription = generated.seoDescription;
      }
      if (generated.aiDescription && !aiDescription) {
        aiDescription = generated.aiDescription;
      }
      if (generated.aiTags && generated.aiTags.length > 0 && aiTags.length === 0) {
        aiTags = generated.aiTags;
      }
    }

    const created = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        price,
        salePrice,
        currency,
        stock,
        status,
        brandId,
        categoryId,
        seoTitle,
        seoDescription,
        aiDescription,
        aiTags,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        salePrice: true,
        currency: true,
        stock: true,
        status: true,
        brandId: true,
        categoryId: true,
        seoTitle: true,
        seoDescription: true,
        aiDescription: true,
        aiTags: true,
        createdAt: true,
      },
    });

    // Nếu tồn kho khởi tạo > 0, ghi lại log nhập kho ban đầu để phục vụ quản lý kho.
    if (created.stock > 0) {
      await prisma.inventoryLog.create({
        data: {
          productId: created.id,
          change: created.stock,
          reason: "Khởi tạo tồn kho khi tạo sản phẩm mới",
          source: "ADMIN_CREATE_PRODUCT",
          referenceId: created.id,
        },
      });
    }

    const imagesToUpload: { file: File; isPrimary: boolean; sortOrder: number }[] = [
      ...(primaryImageFile ? [{ file: primaryImageFile, isPrimary: true, sortOrder: 0 }] : []),
      ...secondaryImageFiles.map((file, idx) => ({
        file,
        isPrimary: false,
        sortOrder: primaryImageFile ? idx + 1 : idx,
      })),
    ];

    if (imagesToUpload.length > 0) {
      const productId = created.id;
      (async () => {
        try {
          await Promise.all(
            imagesToUpload.map(async ({ file, isPrimary, sortOrder }) => {
              const arrayBuffer = await file.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const result = await uploadImage(buffer, {
                folder: CLOUDINARY_PRODUCTS_FOLDER,
              });

              await prisma.productImage.create({
                data: {
                  productId,
                  url: result.secureUrl,
                  alt: file.name || null,
                  isPrimary,
                  sortOrder,
                },
              });
            }),
          );
        } catch (e) {
          console.error(
            "[POST /api/admin/products] Background product images upload failed:",
            e,
          );
        }
      })();
    }

    return NextResponse.json(
      {
        data: {
          ...created,
          price: Number(created.price),
          salePrice:
            created.salePrice != null ? Number(created.salePrice) : null,
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
        { error: "Slug sản phẩm này đã tồn tại trong hệ thống." },
        { status: 409 },
      );
    }

    console.error("Failed to create product", error);
    return NextResponse.json(
      { error: "Không thể tạo sản phẩm mới. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

