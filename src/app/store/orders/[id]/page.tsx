import { Metadata } from "next";
import { OrderPageClient } from "@/components/OrderPageClient";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return { title: `Order - VANTA GARAGE` };
}

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16: params is a Promise — must be awaited.
  const { id } = await params;
  return <OrderPageClient orderId={id} />;
}
