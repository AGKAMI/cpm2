/**
 * StoreHome — Server Component.
 *
 * Receives pre-fetched products/categories/promotions from the page,
 * resolves media URLs on the server, and passes everything down to
 * StoreHomeClient as props — zero client-side SWR waterfall.
 */

import {
  type VantaCategory,
  type VantaProduct,
  type VantaPromotion,
} from "@/lib/store/client";
import { listCoverImageMap } from "@/lib/store/products";
import { StoreHomeClient } from "@/components/StoreHomeClient";

export async function StoreHome({
  products,
  categories,
  promotions,
}: {
  products: unknown[];
  categories: unknown[];
  promotions: unknown[];
}) {
  const allProducts = products as VantaProduct[];
  const allCategories = categories as VantaCategory[];
  const allPromotions = promotions as VantaPromotion[];

  // Resolve media URLs on the server — one batched round-trip for ALL products,
  // not just featured (featured-only left every other section on "No photo").
  const coverMap = await listCoverImageMap(allProducts.map((p) => p.id));
  const productsWithMedia = allProducts.map((p) => ({
    ...p,
    coverImage: coverMap.get(p.id) ?? null,
  }));
  const featuredWithMedia = productsWithMedia.filter((p) => p.isFeatured);

  // Compute derived data on the server
  const arrivals = productsWithMedia
    .filter((p: VantaProduct) => p.isNew)
    .slice(0, 8);
  const saleItems = productsWithMedia
    .filter((p: VantaProduct) => p.isSale)
    .slice(0, 8);

  return (
    <StoreHomeClient
      featured={featuredWithMedia}
      allProducts={productsWithMedia}
      categories={allCategories}
      promotions={allPromotions}
      newArrivals={arrivals as VantaProduct[]}
      onSale={saleItems as VantaProduct[]}
    />
  );
}
