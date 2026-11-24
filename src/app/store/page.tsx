import { Metadata } from "next";
import { Suspense } from "react";
import { StoreHome } from "@/components/StoreHome";
import { StoreHomeSkeleton } from "@/components/skeleton";
import {
  listProducts,
  listCategories,
  listPromotions,
} from "@/lib/store/products";

export const metadata: Metadata = {
  title: "VANTA GARAGE - vehicles for sale",
  description:
    "Premium vehicle storefront. Ready-to-purchase cars, limited editions, One of One builds.",
};

export const dynamic = "force-dynamic";

async function StoreContent() {
  // ONE garage: every published product from both catalogues sits in the same
  // browse — no store chooser, no tabs. The game tag lives on the product for
  // admin/bot filtering; customers just see the shop.
  const [products, categories, promotions] = await Promise.all([
    listProducts({ onlyPublished: true }),
    listCategories(),
    listPromotions(),
  ]);
  return (
    <StoreHome
      products={products}
      categories={categories}
      promotions={promotions}
    />
  );
}

export default function StorePage() {
  return (
    <Suspense fallback={<StoreHomeSkeleton />}>
      <StoreContent />
    </Suspense>
  );
}