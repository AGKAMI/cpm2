"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { vantaApi, formatPrice, type VantaProduct } from "@/lib/store/client";

export function ProductGallery({ productId }: { productId: number }) {
  const [product, setProduct] = useState<VantaProduct | null>(null);
  const [media, setMedia] = useState<{ publicUrl: string }[]>([]);
  const [activeMedia, setActiveMedia] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const [pRes, mRes] = await Promise.all([
          vantaApi.products({}),
          vantaApi.media(productId),
        ]);
        const p = pRes.products.find((x) => x.id === productId);
        setProduct(p ?? null);
        setMedia(mRes.media.map((m) => ({ publicUrl: m.publicUrl })));
        setActiveMedia(mRes.media[0]?.publicUrl);
      } catch {
        // fall through
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [productId]);

  if (loading || !product) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-background rounded-xl border border-border">
        <div className="h-48 w-48 rounded-full bg-background animate-pulse mb-4" />
        <p className="text-muted-foreground">Loading vehicle…</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main image */}
      <div className="relative aspect-[4/3] rounded-xl border border-border bg-background overflow-hidden shadow-lg">
        <Image
          src={(activeMedia || media[0]?.publicUrl) || ""}
          alt={product.name}
          className="h-full w-full object-cover"
          loading="eager"
          priority
          width={800}
          height={600}
          style={{ objectFit: "cover" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {/* Corner tags */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
          {product.isNew && (
            <span className="bd-new">New</span>
          )}
          {product.isSale && (
            <span className="bd-sale">Sale</span>
          )}
          {product.isFeatured && (
            <span className="bd-featured">Featured</span>
          )}
          {product.exclusivity === "limited_edition" && (
            <span className="bd-ltd">Limited</span>
          )}
          {product.exclusivity === "one_of_one" && (
            <span className="bd-one">One of One</span>
          )}
        </div>
        {/* Thumbnail strip */}
        {media.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-background/80 flex gap-2 overflow-x-auto">
            {media.map((m) => (
              <button
                key={m.publicUrl}
                onClick={() => setActiveMedia(m.publicUrl)}
                className={`h-12 w-16 rounded-md object-cover border-2 transition-all duration-200 ${
                  activeMedia === m.publicUrl ? "border-racing" : "border-border"
                }`}
              >
                <Image src={m.publicUrl} alt="" className="h-full w-full object-cover" width={100} height={60} style={{ objectFit: "cover" }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-ink">{product.name}</h1>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-background bg-brand-gold border border-brand-gold px-2 py-0.5 rounded">
            {product.exclusivity.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-primary">{formatPrice(product.basePriceCents, product.currency)}</span>
          <span className="text-lg font-medium text-ink-faint">{formatPrice(Math.floor(product.basePriceCents * 1.15), product.currency)}</span>
        </div>
        <p className="text-muted-foreground line-clamp-3">{product.description}</p>

        <div className="flex gap-2">
          {product.airSuspension && (
            <span className="text-xs border border-border px-2 py-0.5 rounded text-muted-foreground">Air suspension</span>
          )}
          {product.unlockedBodykits && (
            <span className="text-xs border border-border px-2 py-0.5 rounded text-muted-foreground">Unlocked bodykits</span>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="primary" size="lg" className="w-full">
            Book test drive
          </Button>
          <Button variant="outline" size="lg" className="w-full">
            Financing
          </Button>
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-[11px] text-ink-faint uppercase tracking-[0.15em]">
            Delivery available · 60-day return policy · Financing available
          </p>
        </div>
      </div>
    </div>
  );
}
