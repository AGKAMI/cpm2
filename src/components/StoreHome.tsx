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

export type StoreHomeData = {
  featured: VantaProduct[];
  allProducts: VantaProduct[];
  categories: VantaCategory[];
  newArrivals: VantaProduct[];
  onSale: VantaProduct[];
};

/**
 * Build the home dataset: resolve covers on the server, then split products
 * into mutually exclusive sections (featured / new / sale / rest).
 */
async function buildStore(products: VantaProduct[], categories: VantaCategory[]): Promise<StoreHomeData> {
  const coverMap = await listCoverImageMap(products.map((p) => p.id));
  const withMedia = products.map((p) => ({ ...p, coverImage: coverMap.get(p.id) ?? null }));
  // A product with NO uploaded media must still appear — ProductCard renders a
  // generated name thumbnail when coverImage is null.
  const featured = withMedia.filter((p) => p.isFeatured);
  const arrivals = withMedia
    .filter((p: VantaProduct) => p.isNew && !p.isFeatured)
    .slice(0, 8);
  const saleItems = withMedia
    .filter((p: VantaProduct) => p.isSale && !p.isFeatured && !p.isNew)
    .slice(0, 8);
  const rest = withMedia.filter(
    (p: VantaProduct) => !p.isFeatured && !p.isNew && !p.isSale
  );
  return { featured, allProducts: rest, categories, newArrivals: arrivals, onSale: saleItems };
}

export async function StoreHome({
  products,
  categories,
  promotions,
}: {
  products: unknown[];
  categories: unknown[];
  promotions: unknown[];
}) {
  const allPromotions = promotions as VantaPromotion[];
  const {
    featured,
    allProducts,
    categories: cats,
    newArrivals,
    onSale,
  } = await buildStore(products as VantaProduct[], categories as VantaCategory[]);
  return (
    <StoreHomeClient
      featured={featured}
      allProducts={allProducts}
      categories={cats}
      promotions={allPromotions}
      newArrivals={newArrivals}
      onSale={onSale}
    />
  );
}
