"use server";

import { prisma } from "@/lib/prisma";

export async function getHomeData() {
  try {
    const featuredProducts = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      include: {
        category: true,
        images: { where: { isPrimary: true }, take: 1 },
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    });

    const plainProducts = featuredProducts.map((p) => ({
      ...p,
      price: Number(p.price),
      salePrice: p.salePrice != null ? Number(p.salePrice) : null,
      weightGrams: p.weightGrams != null ? Number(p.weightGrams) : null,
    }));

    const categoriesWithProducts = await prisma.category.findMany({
      where: {
        parentId: null,
      },
      orderBy: { name: 'asc' },
      include: {
        products: {
          where: { status: "ACTIVE" },
          take: 8,
          orderBy: { createdAt: "desc" },
          include: {
            category: true,
            images: { where: { isPrimary: true }, take: 1 },
          }
        }
      }
    });

    const categorizedProducts = categoriesWithProducts
      .filter(c => c.products.length > 0)
      .map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        products: c.products.map(p => ({
          ...p,
          price: Number(p.price),
          salePrice: p.salePrice != null ? Number(p.salePrice) : null,
          weightGrams: p.weightGrams != null ? Number(p.weightGrams) : null,
        }))
      }));

    return { featuredProducts: plainProducts, categorizedProducts };
  } catch (error) {
    console.error("Lỗi khi load dữ liệu home:", error);
    return { featuredProducts: [], categorizedProducts: [] };
  }
}
