import { Metadata } from "next";
import { ProductPageClient } from "@/components/ProductPageClient";

export async function generateMetadata({
  params,
}: {
  // Next 16 hands a Promise to generateMetadata too, same as the page.
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Product ${id} - VANTA GARAGE` };
}

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16: params is a Promise — must be awaited.
  const { id } = await params;
  return <ProductPageClient productId={id} />;
}
