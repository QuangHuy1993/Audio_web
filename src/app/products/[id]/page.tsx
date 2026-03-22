import type { Metadata } from "next";
import ProductDetailPage from "@/features/shop/components/product-detail/ProductDetailPage";

type Props = {
  params: Promise<{ id: string }>;
};

async function fetchProductMeta(id: string) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const res = await fetch(`${baseUrl}/api/shop/products/${id}`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;
    return res.json();
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
