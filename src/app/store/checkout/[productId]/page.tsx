import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/store/products";
import { CheckoutClient } from "@/components/CheckoutClient";

export async function generateMetadata({ params }: { params: Promise<{ productId: string }> }): Promise<Metadata> {
  const { productId } = await params;
  const product = await getProduct(Number(productId));
  return {
    title: `Checkout - ${product?.name ?? "Vehicle"} - VANTA GARAGE`,
  };
}

export default async function CheckoutPage({ params }: { params: Promise<{ productId: string }> }) {
  // Next 16: params is a Promise — must be awaited.
  const { productId } = await params;
  const product = await getProduct(Number(productId));
  if (!product) return notFound();
  return <CheckoutClient productId={product.id} />;
}
