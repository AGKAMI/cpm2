import { Metadata } from "next";
import { CategoriesClient } from "@/components/CategoriesClient";
import {
  listCategories,
  listProducts,
  listCoverImageMap,
  type ProductGame,
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

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ game?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const gameParam = params.game;
  // One garage: no game param shows every shelf (CPM1 + CPM2 together). An
  // explicit ?game= still scopes, for direct/bot links.
  const game: ProductGame | undefined =
    gameParam === "cpm1" || gameParam === "cpm2" ? gameParam : undefined;
  const [categories, products] = await Promise.all([
    listCategories(game),
    listProducts({ onlyPublished: true, game }),
  ]);
  const initialProducts = products.slice(0, 24);
  const coverMap: Record<number, string> = Object.fromEntries(
    (await listCoverImageMap(initialProducts.map((p) => p.id))).entries()
  );
  return (
    <CategoriesClient
      categories={categories}
      products={initialProducts}
      coverMap={coverMap}
      game={game}
    />
  );
}
