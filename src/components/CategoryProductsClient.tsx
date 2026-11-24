/**
 * CategoryProductsClient — a category's product list, reference-style:
 * compact grid cards (max 5 per row, wrapping), image, name, price with stars
 * inline, units in stock, and a direct "Buy now" on every card (checkout
 * straight from the list, like the reference store).
 */

import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { formatPrice, type VantaProduct } from "@/lib/store/client";
import { approxStarsForCents } from "@/lib/store/pricing";
import { AccountNotice } from "@/components/AccountNotice";

export function CategoryProductsClient({
  categoryName,
  game,
  products,
}: {
  categoryName: string;
  game?: "cpm1" | "cpm2";
  products: VantaProduct[];
}) {
  return (
    <StoreShell dock={null}>
      <section className="px-4 py-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-lg font-bold text-foreground">{categoryName}</h1>
          {game ? (
            <span className="text-[10px] uppercase tracking-wide text-ink-faint">
              {game === "cpm1" ? "CPM 1" : "CPM 2"}
            </span>
          ) : null}
        </div>

        {products.length === 0 ? (
          <p className="rounded-md border border-border bg-background p-6 text-center text-sm text-ink-soft">
            Nothing on this shelf yet — check back soon.
          </p>
        ) : (
          /* Max 5 cards per row; extra cards append to the next row.
             2-up on phones (like the reference store), scaling to 5 on wide. */
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {products.map((p) => {
              const stars = approxStarsForCents(p.basePriceCents);
              const soldOut = p.stockQuantity === 0;
              return (
                <article
                  key={p.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-border bg-background"
                >
                  <Link
                    href={`/store/products/${p.id}`}
                    className="block aspect-[4/3] overflow-hidden border-b border-border bg-secondary"
                  >
                    {p.coverUrl ? (
                      <img
                        src={p.coverUrl}
                        alt={p.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-ink-faint">
                        {p.name.charAt(0)}
                      </div>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col p-2.5">
                    <Link href={`/store/products/${p.id}`} className="min-w-0">
                      <h2 className="truncate text-xs font-semibold text-foreground" title={p.name}>
                        {p.name}
                      </h2>
                    </Link>
                    <p className="mt-0.5 text-[11px] text-ink-soft">
                      {soldOut
                        ? "Sold out"
                        : `${p.stockQuantity.toLocaleString("en-ZA")} unit${p.stockQuantity === 1 ? "" : "s"} in stock`}
                    </p>
                    {p.kind === "account" ? <AccountNotice compact /> : null}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-1 pt-2">
                      <span className="text-sm font-bold text-foreground">
                        {formatPrice(p.basePriceCents, p.currency)}
                        {stars ? (
                          <span className="ml-1 text-[11px] font-normal text-ink-soft">
                            ({stars} stars)
                          </span>
                        ) : null}
                      </span>
                      {soldOut ? (
                        <span className="rounded-md bg-secondary px-2.5 py-1 text-[11px] font-medium text-ink-faint">
                          Sold out
                        </span>
                      ) : (
                        <Link
                          href={`/store/checkout/${p.id}`}
                          className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                          Buy now
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </StoreShell>
  );
}
