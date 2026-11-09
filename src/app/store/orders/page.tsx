import { Metadata } from "next";
import { OrdersClient } from "@/components/OrdersClient";

export const metadata: Metadata = {
  title: "My Orders - VANTA GARAGE",
};

export const dynamic = "force-dynamic";

export default function OrdersPage() {
  return <OrdersClient />;
}
