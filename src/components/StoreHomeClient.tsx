"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { vantaApi, formatPrice, type VantaProduct } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";

export function StoreHomeClient() {
  const [featured, setFeatured] = useState<VantaProduct[]>([]);
  const [newArrivals, setNewArrivals] = useState<VantaProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [f, n] = await Promise.all([
        vantaApi.products({ featured: true }),
        vantaApi.products({}),
      ]);
      setFeatured(f.products);
      setNewArrivals(n.products.slice(0, 8));
      setLoading(false);
    })();
  }, []);

  return (
    <StoreShell>
      <PageHeading folio="01" title="VANTA GARAGE" />
      {loading ? (
        <p className="text-muted-foreground">Loading catalogue…</p>
      ) : (
        <>
          {featured.length > 0 && (
            <section className="mb-12">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
                Featured
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {featured.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
              New arrivals
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {newArrivals.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        </>
      )}
    </StoreShell>
  );
}

function ProductCard({ product }: { product: VantaProduct }) {
  return (
    <article className="panel rounded-xl border border-border p-4 transition-colors hover:border-primary/50">
      <div className="aspect-video rounded-lg bg-muted overflow-hidden mb-3">
        <span className="block h-full w-full text-center text-[10px] text-muted-foreground">
          Vehicle image
        </span>
      </div>
      <h3 className="text-sm font-medium text-foreground truncate">{product.name}</h3>
      <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{product.description}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-primary font-semibold">{formatPrice(product.basePriceCents, product.currency)}</span>
        {product.exclusivity !== "standard" && (
          <span className="text-[10px] uppercase tracking-[0.15em] text-accent-foreground border border-accent px-2 py-0.5 rounded">
            {product.exclusivity.replace("_", " ")}
          </span>
        )}
      </div>
      <Link href={`/store/products/${product.id}`} className="w-full">
        <Button variant="outline" size="sm" className="w-full">
          View
        </Button>
      </Link>
    </article>
  );
}
