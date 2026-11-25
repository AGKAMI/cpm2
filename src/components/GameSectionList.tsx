/**
 * Product listing for one sub-catalogue of one game
 * (/store/cpm1/accounts, /store/cpm2/cars, /store/cpm1/services, ...).
 *
 * Sections are resolved from the product itself, not from the category tree,
 * so this works the moment a product is published with the right game+kind --
 * no admin category setup required.
 */

import Link from "next/link";
import type { VantaProduct } from "@/lib/store/client";
import { formatPrice } from "@/lib/store/client";
import { approxStarsForCents } from "@/lib/store/pricing";

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
  if (section === "accounts") return inGame.filter((p) => p.kind === "account");
  if (section === "services") return inGame.filter((p) => p.kind === "service");
  // cars = the rest of the game's catalogue
  return inGame.filter((p) => p.kind !== "account" && p.kind !== "service");
}

const SECTION_META: Record<SectionKey, { title: string; blurb: string }> = {
  accounts: {
    title: "Accounts",
    blurb: "Ready-to-play accounts, delivered instantly.",
  },
  cars: { title: "Cars", blurb: "The car catalogue for this game." },
  services: {
    title: "Services",
    blurb: "Work done on your account — injections, callipers, headlights and more.",
  },
};

export function GameSectionList({
  game,
  section,
  products,
}: {
  game: "cpm1" | "cpm2";
  section: SectionKey;
  products: VantaProduct[];
}) {
  const meta = SECTION_META[section];
  const items = productsForSection(products, game, section);

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
                  className={`flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background transition-colors hover:border-primary/60 ${
                    soldOut ? "opacity-50" : ""
                  }`}
                >
                  <div className="aspect-video w-full overflow-hidden border-b border-border bg-secondary">
                    {p.coverUrl ?? p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.coverUrl ?? p.imageUrl ?? ""} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      // No photo uploaded yet: an honest section glyph, not the
                      // product name's first letter (which looked like a logo).
                      <span className="grid h-full w-full place-items-center gap-1 text-ink-faint">
                        {section === "cars" ? (
                          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                            <path d="M3 13.5 4.6 8.8A2 2 0 0 1 6.5 7.4h11a2 2 0 0 1 1.9 1.4L21 13.5" />
                            <path d="M3 13.5h18v4.2a.8.8 0 0 1-.8.8h-1.4a.8.8 0 0 1-.8-.8v-.9H6v.9a.8.8 0 0 1-.8.8H3.8a.8.8 0 0 1-.8-.8z" />
                            <circle cx="7.5" cy="14.2" r="1.1" />
                            <circle cx="16.5" cy="14.2" r="1.1" />
                          </svg>
                        ) : (
                          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                            <rect x="4" y="10.5" width="16" height="9" rx="1.5" />
                            <path d="M4 10.5 6 7h12l2 3.5M8.5 14.5h7" />
                          </svg>
                        )}
                        <span className="text-[9px] font-bold uppercase tracking-[0.14em]">
                          {section === "cars" ? "Photo pending" : "No image"}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-2.5">
                    <span className="line-clamp-2 text-[12px] font-bold leading-tight text-foreground">
                      {p.name}
                    </span>
                    <span className="mt-auto text-[12px] font-bold tabular-nums text-foreground">
                      {soldOut
                        ? "Sold out"
                        : `${formatPrice(p.basePriceCents, p.currency)}${
                            approxStarsForCents(p.basePriceCents)
                              ? ` (${approxStarsForCents(p.basePriceCents)} stars)`
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