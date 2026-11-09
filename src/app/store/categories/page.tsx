import { Metadata } from "next";
import { CategoriesClient } from "@/components/CategoriesClient";
import { StoreShell } from "@/components/StoreShell";

export const metadata: Metadata = {
  title: "Categories - VANTA GARAGE",
};

export const dynamic = "force-dynamic";

export default function CategoriesPage() {
  return (
    <StoreShell>
      <CategoriesClient />
    </StoreShell>
  );
}
