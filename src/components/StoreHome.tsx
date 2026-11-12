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
import { listMedia } from "@/lib/store/products";
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
  const featured = (products as VantaProduct[]).filter((p) => p.isFeatured);
  const allProducts = products as VantaProduct[];
  const allCategories = categories as VantaCategory[];
  const allPromotions = promotions as VantaPromotion[];

  // Resolve media URLs on the server — no client-side media fetches
  const productsWithMedia = await Promise.all(
    featured.map(async (p) => {
      const media = await listMedia(p.id);
      return { ...p, coverImage: media[0]?.publicUrl ?? null };
    })
  );

  // Compute derived data on the server
  const arrivals = [...allProducts]
    .filter((p: VantaProduct) => p.isNew)
    .slice(0, 8);
  const saleItems = [...allProducts]
    .filter((p: VantaProduct) => p.isSale)
    .slice(0, 8);

  return (
    <StoreHomeClient
      featured={productsWithMedia}
      allProducts={allProducts}
      categories={allCategories}
      promotions={allPromotions}
      newArrivals={arrivals as VantaProduct[]}
      onSale={saleItems as VantaProduct[]}
    />
  );
}
