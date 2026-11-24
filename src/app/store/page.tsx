import { Metadata } from "next";
import { Suspense } from "react";
import { StoreHub } from "@/components/StoreHub";
import { StoreHomeSkeleton } from "@/components/skeleton";
import { listProducts, listCategories } from "@/lib/store/products";

export const metadata: Metadata = {
  title: "CPM STORE",
  description:
    "Premium vehicle storefront. Ready-to-purchase cars, limited editions, One of One builds.",
};

export const dynamic = "force-dynamic";

async function StoreContent() {
  // HUB, not a shop window. No products render on the home page — the customer
  // picks a game, then a sub-catalogue, and only then sees listings. Products
  // still load because the discovery shelves need promotions, and future
  // "new additions" will slice from the same list.
  const [products, categories] = await Promise.all([
    listProducts({ onlyPublished: true }),
    listCategories(),
  ]);
  return (
    <StoreHub products={products} categories={categories} />
  );
}

export default function StorePage() {
  return (
    <Suspense fallback={<StoreHomeSkeleton />}>
      <StoreContent />
    </Suspense>
  );
}