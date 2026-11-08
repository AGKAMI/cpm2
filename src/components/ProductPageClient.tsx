"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { vantaApi, formatPrice, type VantaProduct } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";

const EXCLUSIVITY_LABELS: Record<string, string> = {
  limited: "Limited Edition",
  one_of_one: "One of One",
  standard: "Standard Build",
};

const SPEC_ROWS: Array<{
  key: keyof VantaProduct | "airSuspension" | "unlockedBodykits";
  label: string;
  fmt: (v: VantaProduct) => string;
}> = [
  { key: "specHp", label: "Power", fmt: (p) => (p.specHp ? `${p.specHp} hp` : "—") },
  { key: "specTopSpeed", label: "Top speed", fmt: (p) => (p.specTopSpeed ? `${p.specTopSpeed} km/h` : "—") },
  { key: "specZeroHundred", label: "0–100 km/h", fmt: (p) => p.specZeroHundred ?? "—" },
  { key: "specDrive", label: "Drive", fmt: (p) => p.specDrive ?? "—" },
  { key: "airSuspension", label: "Air suspension", fmt: (p) => (p.airSuspension ? "Included" : "—") },
  { key: "unlockedBodykits", label: "Bodykit unlocks", fmt: (p) => (p.unlockedBodykits ? "Yes" : "—") },
];

export function ProductPageClient({ productId }: { productId: string }) {
  const [product, setProduct] = useState<VantaProduct | null>(null);
  const [media, setMedia] = useState<{ publicUrl: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const [pRes, mRes] = await Promise.all([
          vantaApi.products({}),
          vantaApi.media(Number(productId)),
        ]);
        const p = pRes.products.find((x) => x.id === Number(productId));
        if (!p) return;
        setProduct(p);
        setMedia(mRes.media.map((m) => ({ publicUrl: m.publicUrl })));
      } catch {
        // swallowed — page stays in loading
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [productId]);

  // Track carousel width in state — refs must not be read during render.
  useEffect(() => {
    const el = carouselRef.current;
    if (loading || !el) return;
    const observer = new ResizeObserver(() => setCarouselWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  const translateX = activeImage * -carouselWidth;

  if (loading)
      return (
        <StoreShell>
          <PageHeading folio="01" title="Vehicle" meta={""} backHref="/store/categories" />
          <div className="panel rounded-xl border border-border p-6" aria-hidden="true">
            <div className="aspect-video rounded-lg bg-background mb-4 animate-pulse" />
            <div className="h-3 w-1/2 rounded-sm bg-background mb-2 animate-pulse" />
            <div className="h-3 w-1/3 rounded-sm bg-background animate-pulse" />
          </div>
        </StoreShell>
      );
  if (!product) return <StoreShell><p className="text-muted-foreground">Vehicle not found.</p></StoreShell>;

  const exclusivityLabel = EXCLUSIVITY_LABELS[product.exclusivity] ?? product.exclusivity;
  const isExclusive = product.exclusivity !== "standard";
  const cover = media[0]?.publicUrl;

  return (
    <StoreShell>
      <PageHeading folio="01" title={product.name} meta={formatPrice(product.basePriceCents, product.currency)} />

      {/* Hero image carousel */}
      <section className="mb-6 px-4">
        <div
          ref={carouselRef}
          className="relative aspect-[4/5] rounded-[28px] overflow-hidden border border-border bg-background"
        >
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(${translateX}px)`, width: `${media.length * 100}%` }}
          >
            {media.map((m, i) => (
              <img
                key={i}
                src={m.publicUrl}
                alt={product.name}
                className="w-[25vw] min-w-[25vw] h-full object-cover"
                loading={i === 0 ? "eager" : "lazy"}
              />
            ))}
          </div>
          {media.length > 1 && (
            <>
              <button
                onClick={() => setActiveImage((a) => (a > 0 ? a - 1 : media.length - 1))}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                aria-label="Previous image"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={() => setActiveImage((a) => (a < media.length - 1 ? a + 1 : 0))}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                aria-label="Next image"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
                {media.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === activeImage ? "bg-gold w-5" : "bg-white/30"}`}
                    aria-label={`Image ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-1">
            {isExclusive && (
                          <span className="rounded-full px-3 py-1.5 border border-gold bg-black/60 text-gold text-[10px] font-bold uppercase tracking-[0.15em]">
                            {exclusivityLabel}
                          </span>
                        )}
                        {product.isNew && (
                          <span className="rounded-full px-3 py-1.5 border border-blue-500 bg-black/60 text-blue-400 text-[10px] font-bold uppercase tracking-[0.15em]">
                            New
                          </span>
                        )}
                        {product.isSale && (
                          <span className="rounded-full px-3 py-1.5 border border-red-500 bg-black/60 text-red-400 text-[10px] font-bold uppercase tracking-[0.15em]">
                            Sale
                          </span>
                        )}
                        {product.isFeatured && (
                          <span className="rounded-full px-3 py-1.5 border border-gold bg-black/60 text-gold text-[10px] font-bold uppercase tracking-[0.15em]">
                            Featured
                          </span>
                        )}
                        {product.stockQuantity === 0 && (
              <span className="rounded-full px-3 py-1.5 border border-destructive bg-black/60 text-destructive text-[10px] font-bold uppercase tracking-[0.15em]">
                Sold out
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 px-4">
        {/* Left column: details */}
        <div className="flex flex-col gap-6">
          <section className="panel rounded-xl border border-border p-6">
            <div className="flex items-baseline justify-between gap-2 mb-5">
              <span className="text-2xl font-bold text-primary">{formatPrice(product.basePriceCents, product.currency)}</span>
              {isExclusive && (
                <span className="text-[10px] uppercase tracking-[0.15em] text-background bg-gold px-2 py-0.5 rounded text-ink font-extrabold">
                  {exclusivityLabel}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 pb-5 border-b border-border">
              <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Stock</span>
              <span
                className={`text-sm font-medium ${
                  product.stockQuantity === 0 ? "text-destructive" : "text-foreground"
                }`}
              >
                {product.stockQuantity === 0 ? "Sold out" : `${product.stockQuantity} left`}
              </span>
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">Specs</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {SPEC_ROWS.map((row) => (
                <div key={String(row.key)} className="flex justify-between pb-2 border-b border-border/50 last:border-0">
                  <span className="text-ink-soft">{row.label}</span>
                  <span className="text-foreground font-medium">{row.fmt(product)}</span>
                </div>
              ))}
            </div>
          </section>

          {product.description && (
            <section className="panel rounded-xl border border-border p-6">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">Description</h3>
              <p className="text-sm leading-relaxed text-ink-soft">{product.description}</p>
            </section>
          )}
        </div>

        {/* Right column: purchase */}
        <div className="flex flex-col gap-6">
          <section className="panel rounded-xl border border-border p-6 sticky top-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">Purchase</h3>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">Vehicle</span>
                <span className="text-sm font-medium text-foreground">{product.name}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">Price</span>
                <span className="text-lg font-bold text-primary">{formatPrice(product.basePriceCents, product.currency)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2 pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-xl font-bold text-primary">{formatPrice(product.basePriceCents, product.currency)}</span>
              </div>
            </div>
            <Link href={`/store/checkout/${product.id}`}>
              <Button
                variant="primary"
                className="w-full h-12 text-lg font-bold"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                disabled={product.stockQuantity === 0 || checkoutBusy}
              >
                {checkoutBusy ? "Processing…" : product.stockQuantity === 0 ? "Sold out" : "Buy now"}
              </Button>
            </Link>
            <Button
              variant="outline"
              className="w-full h-10 text-xs font-bold mt-2"
              onClick={() => {
                const text = `VANTA GARAGE — ${product.name} — ${formatPrice(product.basePriceCents, product.currency)}\n${product.description}\n\nOrder here: ${typeof window !== "undefined" ? window.location.origin : ""}/store/products/${product.id}`;
                const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                if (typeof window !== "undefined") window.open(url, "_blank");
              }}
            >
              Share to WhatsApp
            </Button>
            <p className="mt-4 text-[10px] text-muted-foreground text-center">
              Secured checkout · EFT or card via PayFast
            </p>
          </section>
        </div>
      </div>
    </StoreShell>
  );
}
