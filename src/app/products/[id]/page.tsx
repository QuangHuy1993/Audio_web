import type { Metadata } from "next";
import ProductDetailPage from "@/features/shop/components/product-detail/ProductDetailPage";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ id: string }>;
};

async function fetchProductMeta(id: string) {
  try {
    return await prisma.product.findUnique({
      where: { id, status: "ACTIVE" },
      select: {
        name: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        images: {
          where: { isPrimary: true },
          select: { url: true },
          take: 1,
        },
      },
    });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProductMeta(id);

  if (!product) {
    return {
      title: "Sản phẩm không tồn tại | Đức Uy Audio",
    };
  }

  return {
    title: product.seoTitle ?? `${product.name} | Đức Uy Audio`,
    description:
      product.seoDescription ??
      (typeof product.description === "string"
        ? product.description.slice(0, 160)
        : ""),
    openGraph: {
      title: product.seoTitle ?? product.name,
      description: product.seoDescription ?? "",
      images: product.images?.[0]?.url ? [{ url: product.images[0].url }] : [],
      type: "website",
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <ProductDetailPage id={id} />;
}
