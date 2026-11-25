import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameSectionList, resolveSection } from "@/components/GameSectionList";
import { StoreShell } from "@/components/StoreShell";
import { enrichProductsWithCovers, listProducts } from "@/lib/store/products";

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
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const key = resolveSection(section);
  if (!key) notFound();

  const products = (await enrichProductsWithCovers(
    await listProducts({ onlyPublished: true }).catch(() => []),
  ).catch(() => []));
  return (
    <StoreShell>
      <GameSectionList game="cpm1" section={key} products={products} />
    </StoreShell>
  );
}