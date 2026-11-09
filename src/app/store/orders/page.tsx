import { Metadata } from "next";
import { OrdersClient } from "@/components/OrdersClient";
import { StoreShell } from "@/components/StoreShell";

export const metadata: Metadata = {
  title: "My Orders - VANTA GARAGE",
};

export const dynamic = "force-dynamic";

export default function OrdersPage() {
  return (
    <StoreShell>
      <OrdersClient />
    </StoreShell>
  );
}
