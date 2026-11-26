import { sweepExpiredReservationsThrottled } from "@/lib/store/jobs";
import { Metadata } from "next";
import { Suspense } from "react";
import { StoreHub } from "@/components/StoreHub";
import { StoreShell } from "@/components/StoreShell";
import { StoreHomeSkeleton } from "@/components/skeleton";
import { listCategories, listProducts, productPromotionMap } from "@/lib/store/products";
import type { StoreHubPromo } from "@/components/StoreHub";

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
  const [products, categories, cpm1Promos, cpm2Promos] = await Promise.all([
    listProducts({ onlyPublished: true }),
    listCategories(),
    productPromotionMap("cpm1"),
    productPromotionMap("cpm2"),
  ]);
  // The live product promotions, flattened for the hub: the homepage shelves
  // must show the Promoted pill and the promotional price like the listing
  // cards do (the API enriches its payload the same way).
  const promoById = new Map<number, StoreHubPromo>();
  for (const [game, map] of [["cpm1", cpm1Promos], ["cpm2", cpm2Promos]] as const) {
    for (const [productId, promo] of map) {
      promoById.set(productId, {
        id: promo.id,
        discountPercent: promo.discountPercent,
        backgroundColor: promo.backgroundColor,
        accentColor: promo.accentColor,
        pillColor: promo.pillColor,
        title: promo.title,
        game,
      });
    }
  }
  // Expire stale reservations on real traffic (throttled to once/60s
  // process-wide, idempotent per order). The queue/cron path never ran it.
  void sweepExpiredReservationsThrottled();

  return (
    <StoreShell>
      <StoreHub products={products} categories={categories} promoById={promoById} />
    </StoreShell>
  );
}

export default function StorePage() {
  return (
    <Suspense fallback={<StoreHomeSkeleton />}>
      <StoreContent />
    </Suspense>
  );
}
