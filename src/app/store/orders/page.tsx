import { Metadata } from "next";
import { OrdersClient } from "@/components/OrdersClient";

export const metadata: Metadata = {
  title: "My Orders - VANTA GARAGE",
};

export default function OrdersPage() {
  return <OrdersClient />;
}
