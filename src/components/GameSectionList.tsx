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

const SERVICE_HINTS = [
  "calliper",
  "headlight",
  "money injection",
  "coin injection",
  "injection",
  "unban",
  "boost",
  "service",
  "mod",
  "engine",
  "paint",
  "rim",
  "tune",
];

export type SectionKey = "accounts" | "cars" | "services";

export function resolveSection(key: string): SectionKey | null {
  if (key === "accounts" || key === "cars" || key === "services") return key;
  return null;
}

/** Which products belong to this section, for this game. */
export function productsForSection(
  products: VantaProduct[],
  game: "cpm1" | "cpm2",
  section: SectionKey,
): VantaProduct[] {
  const inGame = products.filter((p) => (p.game ?? "cpm2") === game && p.isPublished);
  if (section === "accounts") return inGame.filter((p) => p.kind === "account");
  if (section === "services") {
    return inGame.filter((p) => {
      const hay = (p.name ?? "").toLowerCase();
      return p.kind !== "account" && SERVICE_HINTS.some((h) => hay.includes(h));
    });
  }
  // cars = the rest of the game's catalogue
  return inGame.filter(
    (p) =>
      p.kind !== "account" &&
      !SERVICE_HINTS.some((h) => (p.name ?? "").toLowerCase().includes(h)),
  );
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
    <main className="mx-auto w-full max-w-3xl px-4 pb-24">
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
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-2xl font-bold text-ink-faint">
                        {p.name.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-2.5">
                    <span className="line-clamp-2 text-[12px] font-bold leading-tight text-foreground">
                      {p.name}
                    </span>
                    <span className="mt-auto text-[12px] font-bold tabular-nums text-foreground">
                      {soldOut ? "Sold out" : `R ${(p.basePriceCents / 100).toFixed(2)}`}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}