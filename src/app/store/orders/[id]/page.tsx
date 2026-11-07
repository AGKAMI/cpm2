import { Metadata } from "next";
import { OrderPageClient } from "@/components/OrderPageClient";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return { title: `Order — VANTA GARAGE` };
}

export default function OrderPage({ params }: { params: { id: string } }) {
  return <OrderPageClient orderId={params.id} />;
}
