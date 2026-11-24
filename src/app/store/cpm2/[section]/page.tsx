import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameSectionList, resolveSection } from "@/components/GameSectionList";
import { listProducts } from "@/lib/store/products";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const key = resolveSection(section);
  return { title: `${key ? key : "CPM 2"} — CPM STORE` };
}

export default async function Cpm2SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const key = resolveSection(section);
  // CPM2 has no services catalogue — anything other than accounts/cars is 404.
  if (!key || key === "services") notFound();

  const products = await listProducts({ onlyPublished: true }).catch(() => []);
  return <GameSectionList game="cpm2" section={key} products={products} />;
}