import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.length < 3) {
      return NextResponse.json({ products: [] });
    }

    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { brand: { name: { contains: query, mode: "insensitive" } } },
          { category: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        name: true,
        price: true,
        salePrice: true,
        brand: { select: { name: true } },
        images: {
          where: { isPrimary: true },
          select: { url: true },
          take: 1,
        },
      },
      take: 4,
    });

    const formattedProducts = products.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      salePrice: p.salePrice ? Number(p.salePrice) : null,
      brandName: p.brand?.name ?? "Unknown",
      imageUrl: p.images[0]?.url ?? null,
    }));

    return NextResponse.json({ products: formattedProducts });
  } catch (error) {
    console.error("[Quick Search API Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
