/**
 * Pure catalogue helpers shared by the admin manager and the storefront.
 *
 * These are intentionally free of React and DB imports: the admin's
 * game/search/category/sort controls and the storefront's category selection
 * are the same rules the tests exercise, so a filter can't drift between UI
 * and verification.
 */

import { effectiveUnitPriceCents } from "./pricing.ts";

export type ProductGame = "cpm1" | "cpm2";
export type GameFilter = "all" | ProductGame;

export type CatalogueFilters = {
  game: GameFilter;
  search: string;
  categoryId: string;
  sort: string;
};

type CatalogueRow = {
  id: number;
  name: string;
  game?: ProductGame;
  categoryId?: number | null;
  basePriceCents: number;
  stockQuantity: number;
};

/**
 * Admin catalogue rows: game separation first, then search and category,
 * then an explicit sort. "all" sees both games; a chosen game never leaks
 * rows from the other one (legacy rows with no game default to CPM2, exactly
 * as the DB column and storefront do).
 */
export function filterAndSortCatalogue<T extends CatalogueRow>(
  products: T[],
  { game, search, categoryId, sort }: CatalogueFilters,
): T[] {
  const q = search.trim().toLowerCase();
  const rows = products.filter((p) => {
    const productGame = p.game ?? "cpm2";
    if (game === "cpm1" && productGame !== "cpm1") return false;
    if (game === "cpm2" && productGame !== "cpm2") return false;
    if (categoryId && String(p.categoryId ?? "") !== categoryId) return false;
    if (q && !`${p.name} #${p.id}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  return [...rows].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return a.id - b.id;
      case "name":
        return byName(a, b);
      case "price_asc":
        return a.basePriceCents - b.basePriceCents;
      case "price_desc":
        return b.basePriceCents - a.basePriceCents;
      case "stock_asc":
        return a.stockQuantity - b.stockQuantity;
      case "stock_desc":
        return b.stockQuantity - a.stockQuantity;
      case "category":
        return (a.categoryId ?? 0) - (b.categoryId ?? 0);
      default:
        return b.id - a.id; // newest
    }
  });
}

type CategoryProduct = {
  id: number;
  categoryId?: number | null;
  game?: ProductGame;
  isPublished?: boolean;
};

/** Only published products in the selected category's own game. */
export function productsForCategory<T extends CategoryProduct>(
  products: T[],
  category: { id: number; game?: ProductGame },
): T[] {
  const game = category.game ?? "cpm2";
  return products.filter(
    (p) =>
      p.isPublished !== false &&
      (p.game ?? "cpm2") === game &&
      p.categoryId === category.id,
  );
}

export type HubPromo = {
  id: number;
  discountPercent: number;
  backgroundColor: string;
  accentColor: string;
  pillColor: string;
  title: string;
  game: ProductGame;
};

type HubProduct = {
  id: number;
  basePriceCents: number;
  discountPercent: number;
  game?: ProductGame;
};

/**
 * Products with a LIVE product-attached promotion, for the home discovery
 * shelf. This is deliberately promo-driven, not `is_sale`-driven: setting a
 * promotion must make the product appear with its overridden price, colours
 * and Promoted pill without touching the product row.
 */
export function promotedProducts<T extends HubProduct>(
  products: T[],
  promoById: Map<number, HubPromo>,
  limit = 4,
): Array<{ product: T; promo: HubPromo; priceCents: number }> {
  const rows: Array<{ product: T; promo: HubPromo; priceCents: number }> = [];
  for (const product of products) {
    const promo = promoById.get(product.id);
    if (!promo) continue;
    if (promo.game && promo.game !== (product.game ?? "cpm2")) continue;
    rows.push({
      product,
      promo,
      priceCents: effectiveUnitPriceCents(product, promo),
    });
  }
  return rows.slice(0, limit);
}
