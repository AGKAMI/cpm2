import { Metadata } from "next";
import { CategoriesClient } from "@/components/CategoriesClient";
import {
  listCategories,
  listProducts,
} from "@/lib/store/products";

export const metadata: Metadata = {
  title: "Categories - VANTA GARAGE",
  description: "Browse CPM2 vehicle categories at VANTA GARAGE. Limited editions, One of One builds, and ready-to-purchase cars.",
  openGraph: {
    title: "Categories - VANTA GARAGE",
    description: "Browse CPM2 vehicle categories at VANTA GARAGE. Limited editions, One of One builds, and ready-to-purchase cars.",
    type: "website",
    url: "https://cpm2-bay.vercel.app/store/categories",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "Categories - VANTA GARAGE" }],
  },
  twitter: { card: "summary_large_image", title: "Categories - VANTA GARAGE", description: "Browse CPM2 vehicle categories at VANTA GARAGE.", images: ["/og-image.svg"] },
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [categories, products] = await Promise.all([
    listCategories(),
    listProducts({ onlyPublished: true }),
  ]);
  const initialProducts = products.slice(0, 24);
  return <CategoriesClient categories={categories} products={initialProducts} />;
}
