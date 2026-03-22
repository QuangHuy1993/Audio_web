import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteImage,
  uploadImage,
  validateImageFile,
  CLOUDINARY_MAX_FILE_SIZE_BYTES,
} from "@/services/cloudinary-service";
import { adjustProductStock } from "@/services/inventory-service";

export const runtime = "nodejs";

const CLOUDINARY_PRODUCTS_FOLDER = "audio-ai/products";

type UpdateProductBody = {
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
  imageIdsToDelete?: string[];
  setPrimaryImageId?: string | null;
};

function parseUpdateFormBody(form: FormData): {
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
  imageIdsToDelete: string[];
  primaryImageFile: File | null;
  secondaryImageFiles: File[];
  setPrimaryImageId: string | null;
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

  let imageIdsToDelete: string[] = [];
  const imageIdsToDeleteRaw = form.get("imageIdsToDelete");
  if (typeof imageIdsToDeleteRaw === "string") {
    try {
      const parsed = JSON.parse(imageIdsToDeleteRaw) as unknown;
      imageIdsToDelete = Array.isArray(parsed)
        ? (parsed as string[])
            .map((t) => String(t).trim())
            .filter(Boolean)
        : [];
    } catch {
      imageIdsToDelete = [];
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

  const setPrimaryImageIdRaw = (form.get("setPrimaryImageId") as string | null)?.trim() || null;

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
    imageIdsToDelete,
    primaryImageFile,
    secondaryImageFiles,
    setPrimaryImageId: setPrimaryImageIdRaw,
  };
}

function extractCloudinaryPublicId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    const filename = parts[parts.length - 1]; // e.g. laeitmzxkwrdrznie2dv.webp
    const dotIndex = filename.lastIndexOf(".");
    const nameOnly = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
    // Include folder to be explicit: audio-ai/products/<publicId>
    const folderParts = parts.slice(1, parts.length - 1).join("/"); // skip initial 'image' or 'upload'
    return folderParts ? `${folderParts}/${nameOnly}` : nameOnly;
  } catch {
    return null;
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
      { error: "Bạn không có quyền xoá sản phẩm." },
      { status: 403 },
    );
  }

  if (!id) {
    return NextResponse.json(
      { error: "Thiếu mã sản phẩm." },
      { status: 400 },
    );
  }

  try {
    const [product, images] = await Promise.all([
      prisma.product.findUnique({
        where: { id },
        select: {
          id: true,
        },
      }),
      prisma.productImage.findMany({
        where: { productId: id },
        select: { url: true },
      }),
    ]);

    if (!product) {
      return NextResponse.json(
        { error: "Sản phẩm không tồn tại." },
        { status: 404 },
      );
    }

    const [cartItemsCount, wishlistItemsCount, orderItemsCount] =
      await Promise.all([
        prisma.cartItem.count({ where: { productId: id } }),
        prisma.wishlistItem.count({ where: { productId: id } }),
        prisma.orderItem.count({ where: { productId: id } }),
      ]);

    if (cartItemsCount > 0 || wishlistItemsCount > 0 || orderItemsCount > 0) {
      return NextResponse.json(
        {
          error:
            "Không thể xoá sản phẩm vì đang được tham chiếu trong giỏ hàng, danh sách yêu thích hoặc đơn hàng. Vui lòng xoá hoặc điều chỉnh các bản ghi liên quan trước.",
        },
        { status: 409 },
      );
    }

    await prisma.product.delete({
      where: { id },
    });

    if (images.length > 0) {
      (async () => {
        try {
          const publicIds = images
            .map((img) => extractCloudinaryPublicId(img.url))
            .filter((idValue): idValue is string => Boolean(idValue));

          await Promise.all(
            publicIds.map(async (publicId) => {
              try {
                await deleteImage(publicId);
              } catch (e) {
                
                console.error(
                  "[DELETE /api/admin/products/[id]] Failed to delete Cloudinary image:",
                  publicId,
                  e,
                );
              }
            }),
          );
        } catch (e) {
         
          console.error(
            "[DELETE /api/admin/products/[id]] Background Cloudinary cleanup failed:",
            e,
          );
        }
      })();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Sản phẩm không tồn tại." },
        { status: 404 },
      );
    }

    
    console.error("Failed to delete product", error);
    return NextResponse.json(
      { error: "Không thể xoá sản phẩm. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền xem sản phẩm." },
      { status: 403 },
    );
  }

  if (!id) {
    return NextResponse.json(
      { error: "Thiếu mã sản phẩm." },
      { status: 400 },
    );
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        brand: {
          select: { id: true, name: true },
        },
        category: {
          select: { id: true, name: true },
        },
        images: {
          select: {
            id: true,
            url: true,
            alt: true,
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
    });

    if (!product) {
      return NextResponse.json(
        { error: "Sản phẩm không tồn tại." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: Number(product.price),
        salePrice:
          product.salePrice != null ? Number(product.salePrice) : null,
        currency: product.currency,
        stock: product.stock,
        status: product.status,
        brandId: product.brandId ?? null,
        brandName: product.brand?.name ?? null,
        categoryId: product.categoryId ?? null,
        categoryName: product.category?.name ?? null,
        seoTitle: product.seoTitle ?? null,
        seoDescription: product.seoDescription ?? null,
        aiDescription: product.aiDescription ?? null,
        aiTags: product.aiTags,
        images: product.images.map((img) => ({
          id: img.id,
          url: img.url,
          alt: img.alt,
          isPrimary: img.isPrimary,
          sortOrder: img.sortOrder,
        })),
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch product detail", error);
    return NextResponse.json(
      { error: "Không thể tải thông tin sản phẩm." },
      { status: 500 },
    );
  }
}

/**
 * Cập nhật sản phẩm theo id.
 * - Content-Type: application/json -> chỉ cập nhật thông tin, không đẩy ảnh lên Cloudinary.
 * - Content-Type: multipart/form-data (có field "images") -> cập nhật thông tin + upload ảnh mới bất đồng bộ (không block response).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền cập nhật sản phẩm." },
      { status: 403 },
    );
  }

  if (!id) {
    return NextResponse.json(
      { error: "Thiếu mã sản phẩm." },
      { status: 400 },
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
  let setPrimaryImageId: string | null = null;
  let imageIdsToDelete: string[] = [];

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

    const body = parseUpdateFormBody(form);
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
    setPrimaryImageId = body.setPrimaryImageId;
    imageIdsToDelete = body.imageIdsToDelete;

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
    let jsonBody: UpdateProductBody;
    try {
      jsonBody = (await request.json()) as UpdateProductBody;
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
    imageIdsToDelete =
      jsonBody.imageIdsToDelete
        ?.map((idValue) => idValue.trim())
        .filter((idValue) => idValue.length > 0) ?? [];
    setPrimaryImageId = jsonBody.setPrimaryImageId?.trim() || null;
  }

  const slugPattern = /^[a-z0-9-]+$/;
  if (slug && !slugPattern.test(slug)) {
    return NextResponse.json(
      {
        error:
          "Slug chỉ được phép chứa chữ thường, số và dấu gạch ngang (a-z, 0-9, -).",
      },
      { status: 400 },
    );
  }

  if (price <= 0) {
    return NextResponse.json(
      { error: "Giá sản phẩm phải lớn hơn 0." },
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
    const [existing, existingImagesCount] = await Promise.all([
      prisma.product.findUnique({
        where: { id },
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
          images: {
            select: { sortOrder: true },
            orderBy: { sortOrder: "desc" },
            take: 1,
          },
        },
      }),
      prisma.productImage.count({ where: { productId: id } }),
    ]);

    if (!existing) {
      return NextResponse.json(
        { error: "Sản phẩm không tồn tại." },
        { status: 404 },
      );
    }

    if (slug && slug !== existing.slug) {
      const duplicate = await prisma.product.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Slug sản phẩm này đã tồn tại trong hệ thống." },
          { status: 409 },
        );
      }
    }

    let stockToWrite = stock;
    if (stock !== existing.stock) {
      const delta = stock - existing.stock;
      try {
        const adjustResult = await adjustProductStock({
          productId: id,
          delta,
          reason: "Điều chỉnh qua form sửa sản phẩm",
          source: "ADMIN_STOCK_ADJUST",
          referenceId: id,
        });
        stockToWrite = adjustResult.newStock;
      } catch (err) {
        if (
          err instanceof Error &&
          err.message === "PRODUCT_NOT_FOUND"
        ) {
          return NextResponse.json(
            { error: "Sản phẩm không tồn tại." },
            { status: 404 },
          );
        }
        throw err;
      }
    }

    const nextSortOrder =
      existing.images[0]?.sortOrder != null
        ? existing.images[0].sortOrder + 1
        : 0;

    let deletedImages: { id: string; url: string }[] = [];

    if (imageIdsToDelete.length > 0) {
      deletedImages = await prisma.productImage.findMany({
        where: {
          productId: id,
          id: { in: imageIdsToDelete },
        },
        select: {
          id: true,
          url: true,
        },
      });

      if (deletedImages.length > 0) {
        await prisma.productImage.deleteMany({
          where: {
            id: { in: deletedImages.map((img) => img.id) },
          },
        });
      }
    }

    // If a new primary image is uploaded: demote all existing images first
    if (primaryImageFile) {
      await prisma.productImage.updateMany({
        where: { productId: id },
        data: { isPrimary: false },
      });
    }

    // If an existing image should be set as primary (without uploading a new file)
    if (setPrimaryImageId && !primaryImageFile) {
      await prisma.productImage.updateMany({
        where: { productId: id },
        data: { isPrimary: false },
      });
      await prisma.productImage.update({
        where: { id: setPrimaryImageId },
        data: { isPrimary: true },
      });
    }

    await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(description !== undefined && { description }),
        price,
        salePrice,
        currency,
        stock: stockToWrite,
        status,
        ...(brandId !== undefined && { brandId }),
        ...(categoryId !== undefined && { categoryId }),
        seoTitle,
        seoDescription,
        aiDescription,
        aiTags,
      },
    });

    const newImagesToUpload: { file: File; isPrimary: boolean; sortOrder: number }[] = [
      ...(primaryImageFile ? [{ file: primaryImageFile, isPrimary: true, sortOrder: nextSortOrder }] : []),
      ...secondaryImageFiles.map((file, idx) => ({
        file,
        isPrimary: false,
        sortOrder: nextSortOrder + (primaryImageFile ? idx + 1 : idx),
      })),
    ];

    if (newImagesToUpload.length > 0) {
      (async () => {
        try {
          for (const { file, isPrimary, sortOrder } of newImagesToUpload) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const result = await uploadImage(buffer, {
              folder: CLOUDINARY_PRODUCTS_FOLDER,
            });

            await prisma.productImage.create({
              data: {
                productId: id,
                url: result.secureUrl,
                alt: file.name || null,
                isPrimary,
                sortOrder,
              },
            });
          }
        } catch (e) {
          console.error(
            "[PATCH /api/admin/products/[id]] Background product images upload failed:",
            e,
          );
        }
      })();
    }

    if (deletedImages.length > 0) {
      (async () => {
        try {
          const publicIds = deletedImages
            .map((img) => extractCloudinaryPublicId(img.url))
            .filter((idValue): idValue is string => Boolean(idValue));

          await Promise.all(
            publicIds.map(async (publicId) => {
              try {
                await deleteImage(publicId);
              } catch (e) {
                console.error(
                  "[PATCH /api/admin/products/[id]] Failed to delete Cloudinary image:",
                  publicId,
                  e,
                );
              }
            }),
          );
        } catch (e) {
          console.error(
            "[PATCH /api/admin/products/[id]] Background Cloudinary delete failed:",
            e,
          );
        }
      })();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Sản phẩm không tồn tại." },
        { status: 404 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Slug sản phẩm này đã tồn tại trong hệ thống." },
        { status: 409 },
      );
    }

    console.error("Failed to update product", error);
    return NextResponse.json(
      { error: "Không thể cập nhật sản phẩm. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

