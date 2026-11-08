import { Metadata } from "next";
import { StoreHomeClient } from "@/components/StoreHomeClient";

export const metadata: Metadata = {
  title: "VANTA GARAGE - CPM2 vehicles for sale",
  description: "Premium CPM2 vehicle storefront. Ready-to-purchase cars, limited editions, One of One builds.",
};

export default function HomePage() {
  return <StoreHomeClient />;
}
