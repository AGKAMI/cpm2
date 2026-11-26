/**
 * Product listing for one sub-catalogue of one game
 * (/store/cpm1/accounts, /store/cpm2/cars, /store/cpm1/services, ...).
 *
 * Sections are resolved from the product itself, not from the category tree,
 * so this works the moment a product is published with the right game+kind --
 * no admin category setup required.
 */

import Link from "next/link";
import type { VantaCategory, VantaProduct } from "@/lib/store/client";
import { formatPrice } from "@/lib/store/client";
import { approxStarsForCents } from "@/lib/store/pricing";
import { productsForCategory } from "@/lib/store/catalogue.ts";

export type SectionKey = "accounts" | "cars" | "services";

export function resolveSection(key: string): SectionKey | null {
  if (key === "accounts" || key === "cars" || key === "services") return key;
  return null;
}

/**
 * Which products belong to this section, for this game.
 *
 * Sections are an EXPLICIT product kind, never a name match: guessing services
 * from the product name swept real cars (Toyota Fortuner) into the services
 * shelf. So services = kind 'service', accounts = kind 'account', and cars is
 * the default catch-all for everything else in that game.
 */
export function productsForSection(
  products: VantaProduct[],
  game: "cpm1" | "cpm2",
  section: SectionKey,
): VantaProduct[] {
  const inGame = products.filter((p) => (p.game ?? "cpm2") === game && p.isPublished);
  // KAMI's standing rule: a product whose image does not render is NOT shown.
  // An imageless card is a broken card — it is hidden here, not prettied with
  // a placeholder. (coverUrl is set by the page's cover enrichment; products
  // with no published media, or a data-URL cover the CDN cannot proxy, have
  // none.)
  const visible = inGame.filter((p) => Boolean((p as { coverUrl?: string | null }).coverUrl));
  if (section === "accounts") return visible.filter((p) => p.kind === "account");
  if (section === "services") return visible.filter((p) => p.kind === "service");
  // cars = the rest of the game's catalogue
  return visible.filter((p) => p.kind !== "account" && p.kind !== "service");
}

const SECTION_META: Record<SectionKey, { title: string; blurb: string }> = {
  accounts: {
    title: "Accounts",
    blurb: "Ready-to-play accounts, delivered instantly.",
  },
  cars: { title: "Cars", blurb: "The car catalogue for this game." },
  services: {
    title: "Services",
    blurb: "Work done on your account: injections, callipers, headlights and more.",
  },
};

export function GameSectionList({
  game,
  section,
  products,
  categories = [],
  activeCategorySlug,
}: {
  game: "cpm1" | "cpm2";
  section: SectionKey;
  products: VantaProduct[];
  /** Categories for THIS game only, supplied by the server page. */
  categories?: VantaCategory[];
  activeCategorySlug?: string;
}) {
  const meta = SECTION_META[section];
  const inSection = productsForSection(products, game, section);
  const activeCategory = categories.find((c) => c.slug === activeCategorySlug);
  const items = activeCategory
    ? productsForCategory(inSection, activeCategory)
    : inSection;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24">
      <header className="py-6">
        <Link
          href={`/store/${game}`}
          className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft hover:text-foreground"
        >
          ← {game === "cpm1" ? "CPM 1" : "CPM 2"}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-foreground">{meta.title}</h1>
        <p className="mt-1 text-[12px] text-ink-faint">{meta.blurb}</p>
      </header>

      {categories.length > 0 && (
        <nav aria-label="Categories" className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`/store/${game}/${section}`}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
              activeCategory
                ? "border-border text-muted-foreground"
                : "border-primary bg-primary/10 text-foreground"
            }`}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/store/${game}/${section}?category=${encodeURIComponent(cat.slug)}`}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                activeCategorySlug === cat.slug
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/60"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </nav>
      )}

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12px] text-ink-faint">
          Nothing listed here yet.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => {
            const soldOut = p.stockQuantity <= 0;
            return (
              <li key={p.id}>
                <Link
                  href={`/store/products/${p.id}`}
                  className={`flex h-full flex-col overflow-hidden rounded-xl border transition-colors ${
                    p.promo
                      ? "promo-card hover:brightness-110"
                      : "border-border bg-background hover:border-primary/60"
                  } ${soldOut ? "opacity-50" : ""}`}
                  style={
                    p.promo
                      ? {
                          // The promotion's own Primary/Secondary colours —
                          // NOT the theme's black/white accents.
                          background: `linear-gradient(160deg, ${p.promo.backgroundColor}, ${p.promo.accentColor}22)`,
                          borderColor: p.promo.accentColor,
                        }
                      : undefined
                  }
                >
                  {p.promo && (
                    <div className="flex justify-center pt-1.5">
                      <span
                        className="promo-pill"
                        style={{ ["--pill-hue" as string]: p.promo.pillColor }}
                      >
                        Promoted
                      </span>
                    </div>
                  )}
                  <div className="aspect-video w-full overflow-hidden border-b border-border bg-secondary">
                    {/* Only products whose image renders reach this list. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.coverUrl ?? ""} alt={p.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-2.5">
                    <span className="line-clamp-2 text-[11px] font-bold leading-tight text-foreground">
                      {p.name}
                    </span>
                    <span className="mt-auto text-[11px] font-bold tabular-nums text-foreground">
                      {soldOut
                        ? "Sold out"
                        : p.promoPriceCents != null
                          ? `${formatPrice(p.promoPriceCents, p.currency)}${
                              (p.promoStarsPrice ?? approxStarsForCents(p.promoPriceCents))
                                ? ` (${p.promoStarsPrice ?? approxStarsForCents(p.promoPriceCents)} stars)`
                                : ""
                            }`
                          : `${formatPrice(p.basePriceCents, p.currency)}${
                              (p.starsPrice ?? approxStarsForCents(p.basePriceCents))
                                ? ` (${p.starsPrice ?? approxStarsForCents(p.basePriceCents)} stars)`
                                : ""
                            }`}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
