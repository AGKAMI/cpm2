/**
 * CategoryProductsClient — a category's product list, reference-style:
 * image, name, price, units in stock, stars and a direct "Buy now" on every
 * card (checkout straight from the list, like the reference store).
 */

import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { formatPrice, type VantaProduct } from "@/lib/store/client";
import { approxStarsForCents } from "@/lib/store/pricing";

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
          <div className="grid gap-3">
            {products.map((p) => {
              const stars = approxStarsForCents(p.basePriceCents);
              const soldOut = p.stockQuantity === 0;
              return (
                <article
                  key={p.id}
                  className="flex gap-3 rounded-xl border border-border bg-background p-3"
                >
                  <Link
                    href={`/store/products/${p.id}`}
                    className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary"
                  >
                    {p.coverUrl ? (
                      <img
                        src={p.coverUrl}
                        alt={p.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-bold text-ink-faint">
                        {p.name.charAt(0)}
                      </div>
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/store/products/${p.id}`} className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-foreground">{p.name}</h2>
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {soldOut ? "Sold out" : `${p.stockQuantity} unit${p.stockQuantity === 1 ? "" : "s"} in stock`}
                    </p>
                    {stars ? (
                      <p className="text-[11px] text-ink-faint">{stars} stars</p>
                    ) : null}
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="text-sm font-bold text-foreground">
                        {formatPrice(p.basePriceCents, p.currency)}
                      </span>
                      {soldOut ? (
                        <span className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-ink-faint">
                          Sold out
                        </span>
                      ) : (
                        <Link
                          href={`/store/checkout/${p.id}`}
                          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white"
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
