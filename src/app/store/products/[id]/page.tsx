import { Metadata } from "next";
import { ProductPageClient } from "@/components/ProductPageClient";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return { title: `Product — VANTA GARAGE` };
}

export default function ProductPage({ params }: { params: { id: string } }) {
  return <ProductPageClient productId={params.id} />;
}
