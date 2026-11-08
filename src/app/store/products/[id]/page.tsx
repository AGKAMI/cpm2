import { Metadata } from "next";
import { ProductPageClient } from "@/components/ProductPageClient";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return { title: `Product - VANTA GARAGE` };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16: params is a Promise — must be awaited.
  const { id } = await params;
  return <ProductPageClient productId={id} />;
}
