import { Metadata } from "next";
import { CategoriesClient } from "@/components/CategoriesClient";

export const metadata: Metadata = {
  title: "Categories - VANTA GARAGE",
};

export const dynamic = "force-dynamic";

export default function CategoriesPage() {
  return <CategoriesClient />;
}
