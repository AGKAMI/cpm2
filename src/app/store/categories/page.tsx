import { Metadata } from "next";
import { CategoriesClient } from "@/components/CategoriesClient";

export const metadata: Metadata = {
  title: "Categories — VANTA GARAGE",
};

export default function CategoriesPage() {
  return <CategoriesClient />;
}
