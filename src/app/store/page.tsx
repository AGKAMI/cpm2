import { Metadata } from "next";
import { StoreHomeClient } from "@/components/StoreHomeClient";
import { StoreShell } from "@/components/StoreShell";

export const metadata: Metadata = {
  title: "VANTA GARAGE - CPM2 vehicles for sale",
  description: "Premium CPM2 vehicle storefront. Ready-to-purchase cars, limited editions, One of One builds.",
};

// Force dynamic rendering so client components hydrate and fetch data
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <StoreShell>
      <StoreHomeClient />
    </StoreShell>
  );
}
