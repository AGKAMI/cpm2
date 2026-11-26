import { sweepExpiredReservationsThrottled } from "@/lib/store/jobs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameSectionList, resolveSection } from "@/components/GameSectionList";
import { StoreShell } from "@/components/StoreShell";
import {
  enrichProductsWithCovers,
  listCategories,
  listProducts,
} from "@/lib/store/products";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const key = resolveSection(section);
  return { title: `${key ? key : "CPM 1"} — CPM STORE` };
}

export default async function Cpm1SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const { section } = await params;
  const key = resolveSection(section);
  if (!key) notFound();
  const { category } = await searchParams;
  const activeCategory = Array.isArray(category) ? category[0] : category;

  const [productRows, categories] = await Promise.all([
    enrichProductsWithCovers(
      await listProducts({ onlyPublished: true }).catch(() => []),
    ).catch(() => []),
    listCategories("cpm1").catch(() => []),
  ]);
  const products = productRows;
  // Expire stale reservations on real traffic (throttled to once/60s
  // process-wide, idempotent per order). The queue/cron path never ran it.
  void sweepExpiredReservationsThrottled();

  return (
    <StoreShell>
      <GameSectionList
        game="cpm1"
        section={key}
        products={products}
        categories={categories}
        activeCategorySlug={activeCategory}
      />
    </StoreShell>
  );
}