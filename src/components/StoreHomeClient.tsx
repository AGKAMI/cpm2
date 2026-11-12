"use client";

/**
 * StoreHomeClient — Client Component.
 *
 * Receives all data as props from StoreHome (Server Component).
 * Handles carousel state, heart toggles, and interactivity only.
 * Zero client-side data fetching.
 */

import Image from "next/image";
import Link from "next/link";
import React, { useCallback, useRef, useState } from "react";
import {
  formatPrice,
  type VantaCategory,
  type VantaProduct,
  type VantaPromotion,
} from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { HeartToggle } from "@/components/HeartToggle";

export function StoreHomeClient({
  featured,
  allProducts,
  categories,
  promotions,
  newArrivals,
  onSale,
}: {
  featured: VantaProduct[];
  allProducts: VantaProduct[];
  categories: VantaCategory[];
  promotions: VantaPromotion[];
  newArrivals: VantaProduct[];
  onSale: VantaProduct[];
}) {
  const [cardImages, setCardImages] = useState<Record<number, string>>({});
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Media already resolved on server — build lookup map
  const coverMap: Record<number, string> = {};
  featured.forEach((p) => {
    if ((p as { coverImage?: string }).coverImage) {
      coverMap[p.id] = (p as { coverImage?: string }).coverImage!;
    }
  });

  // --- Featured carousel handlers ---
  const handleScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el || featured.length === 0) return;
    const items = el.querySelectorAll(".featured-carousel-item");
    if (items.length === 0) return;
    const firstItem = items[0] as HTMLElement;
    const itemWidth = firstItem.offsetWidth;
    if (itemWidth === 0) return;
    const gap = parseFloat(getComputedStyle(el).gap) || 0;
    const step = itemWidth + gap;
    const index = Math.round(el.scrollLeft / step);
    setActiveIndex(Math.max(0, Math.min(index, featured.length - 1)));
  }, [featured.length]);

  const goTo = useCallback((index: number) => {
    const el = carouselRef.current;
    if (!el) return;
    const items = el.querySelectorAll(".featured-carousel-item");
    const target = items[index] as HTMLElement;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", inline: "start" });
    }
  }, [featured]);

  const scrollPrev = useCallback(() => {
    if (activeIndex > 0) {
      goTo(activeIndex - 1);
    }
  }, [activeIndex, goTo]);

  const scrollNext = useCallback(() => {
    if (activeIndex < featured.length - 1) {
      goTo(activeIndex + 1);
    }
  }, [activeIndex, featured.length, goTo]);

  const content = (
    <>
      <section className="hero relative px-4 pt-6 pb-8">
        <span className="eyebrow">VANTA GARAGE</span>
        <h1 className="font-serif font-bold text-[32px] leading-[1.05] mb-3 tracking-tight">
          Custom builds on the floor.
        </h1>
        <p className="text-ink-mid max-w-[30ch]">
          {featured.length} vehicles ready to drive.{" "}
          {(featured as VantaProduct[]).filter(
            (c: VantaProduct) => c.exclusivity !== "standard"
          ).length} limited editions.
        </p>
      </section>

      {featured.length > 0 && (
        <section className="vanta-section" aria-label="Featured vehicles">
          <div className="vanta-section-header">
            <div>
              <span className="eyebrow">Featured</span>
              <h3 className="font-serif font-bold text-[20px] leading-none mt-[6px]">
                Featured Vehicles
              </h3>
            </div>
            <Link href="/store/categories" className="vanta-section-see-all">
              See all
            </Link>
          </div>
          <div className="relative">
            <div className="featured-nav">
              <button
                onClick={scrollPrev}
                disabled={activeIndex === 0}
                aria-label="Previous featured vehicle"
                className="featured-prev"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={scrollNext}
                disabled={activeIndex >= featured.length - 1}
                aria-label="Next featured vehicle"
                className="featured-next"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div
              ref={carouselRef}
              className="featured-carousel"
              onScroll={handleScroll}
              role="region"
              aria-label="Featured vehicles"
            >
              {featured.map((c: VantaProduct) => (
                <ProductCard
                  key={c.id}
                  product={c}
                  coverImage={coverMap[c.id] ?? c.imageUrl ?? undefined}
                  variant="featured"
                />
              ))}
            </div>
            <div className="featured-pagination">
              {featured.map((_: VantaProduct, i: number) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Slide to featured vehicle ${i + 1}`}
                  className={`featured-dot ${activeIndex === i ? "active" : ""}`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {promotions.length > 0 && (
        <section className="vanta-section">
          <div className="vanta-section-header">
            <div>
              <span className="eyebrow">Promotions</span>
              <h3 className="font-serif font-bold text-[20px] leading-none mt-[6px]">
                Current Promotions
              </h3>
            </div>
            <Link href="/store/categories" className="vanta-section-see-all">
              See all
            </Link>
          </div>
          <div className="flex flex-col gap-6">
            {promotions.map((promo: VantaPromotion) => (
              <Link
                key={promo.id}
                href={promo.ctaLink || "/store/categories"}
                className="cursor-pointer block"
              >
                <div
                  className={`promotion-card relative overflow-hidden rounded-[22px] p-6 border border-border bg-raised shadow-sm hover:shadow-md transition-shadow duration-200 ease-out`}
                  style={{
                    backgroundColor:
                      promo.backgroundColor ||
                      "var(--color-paper-raised)",
                    color: promo.accentColor
                      ? "var(--color-paper-sunken)"
                      : undefined,
                  }}
                >
                  {promo.imageUrl && (
                    <>
                      <Image
                        src={promo.imageUrl}
                        alt={promo.title}
                        className="absolute inset-y-0 right-0 h-full w-[55%] object-cover pointer-events-none"
                        width={400}
                        height={220}
                        style={{ objectFit: "cover" }}
                        loading="eager"
                      />
                      <div
                        className="absolute inset-y-0 right-0 w-[55%] pointer-events-none"
                        style={{
                          background: `linear-gradient(90deg, ${promo.backgroundColor || "var(--color-paper-raised)"} 0%, transparent 100%)`,
                        }}
                      />
                    </>
                  )}
                  <div className="relative z-10">
                    <span
                      className="eyebrow"
                      style={{ color: promo.accentColor || "#d4af4f" }}
                    >
                      {promo.subtitle || "Special offer"}
                    </span>
                    <h3 className="font-serif font-bold text-[24px] leading-none mb-1">
                      {promo.title}
                    </h3>
                    {promo.description && (
                      <p className="text-[11px] text-ink mb-3">
                        {promo.description}
                      </p>
                    )}
                    {(promo.discountPercent || promo.discountCode) && (
                      <p className="text-[11px] mb-3">
                        {promo.discountCode ? (
                          <>
                            Code <b className="text-[11px] font-bold tracking-[0.12em]">{promo.discountCode}</b>{" "}
                            {promo.discountPercent > 0 ? `· ${promo.discountPercent}% off` : ""}
                          </>
                        ) : (
                          `${promo.discountPercent}% off`
                        )}
                      </p>
                    )}
                    <button className="btn rounded-full px-4 py-2 text-[11px] font-bold tracking-wider">
                      {promo.ctaText || "Shop now"} <span className="text-[10px] ml-1">▸</span>
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <section className="vanta-section">
          <div className="vanta-section-header">
            <h3 className="font-serif font-bold text-[20px] leading-none">
              Featured categories
            </h3>
            <Link href="/store/categories" className="vanta-section-see-all">
              All
            </Link>
          </div>
          <div className="vanta-card-list">
            {categories.slice(0, 8).map((cat: VantaCategory) => (
              <div
                key={cat.id}
                className="vanta-card group"
                style={{ minWidth: "72px", flex: "0 0 auto" }}
              >
                <Link
                  href={`/store/categories?category=${cat.slug}`}
                  className="block h-full w-full text-center"
                >
                  <div className="vanta-card-media" style={{ aspectRatio: "1" }}>
                    <span className="text-[11px] font-bold text-center text-ink-soft absolute inset-0 flex items-center justify-center">
                      {cat.name.charAt(0)}
                    </span>
                  </div>
                  <div className="vanta-card-body">
                    <p className="vanta-card-subtitle">{cat.name}</p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {newArrivals.length > 0 && (
        <section className="vanta-section">
          <div className="vanta-section-header">
            <div>
              <span className="eyebrow">This month</span>
              <h3 className="font-serif font-bold text-[20px] leading-none mt-[6px]">
                New arrivals
              </h3>
            </div>
            <Link href="/store/categories" className="vanta-section-see-all">
              See all
            </Link>
          </div>
          <div className="vanta-card-list">
            {newArrivals.map((c: VantaProduct) => (
              <ProductCard
                key={c.id}
                product={c}
                coverImage={coverMap[c.id] || c.imageUrl || ""}
                variant="standard"
              />
            ))}
          </div>
        </section>
      )}

      {onSale.length > 0 && (
        <section className="vanta-section">
          <div className="vanta-section-header">
            <div>
              <span className="eyebrow">Limited time</span>
              <h3 className="font-serif font-bold text-[20px] leading-none mt-[6px]">
                On sale
              </h3>
            </div>
            <Link href="/store/categories" className="vanta-section-see-all">
              See all
            </Link>
          </div>
          <div className="vanta-card-list">
            {onSale.map((c: VantaProduct) => (
              <ProductCard
                key={c.id}
                product={c}
                coverImage={coverMap[c.id] || c.imageUrl || ""}
                variant="standard"
              />
            ))}
          </div>
        </section>
      )}

      <div className="foot mb-4 px-4 text-center text-[10px] text-ink-soft tracking-[0.08em]">
        KAMI&rsquo;S VANTA GARAGE · VERIFIED CPM2 BUILDS<br />
        <span className="opacity-70">Secured by VANTA Guard</span>
      </div>
    </>
  );

  const [error, setError] = useState<string | null>(null);

  return (
    <StoreShell dock={null}>
      {content}
      {error && (
        <div className="p-6 text-center">
          <p className="rounded-md border border-destructive bg-background px-4 py-3 text-xs text-destructive">
            {error}
          </p>
        </div>
      )}
    </StoreShell>
  );
}

/**
 * Memoized product card — only re-renders when its own props change,
 * not when the parent StoreHomeClient re-renders.
 */
const ProductCard = React.memo(
  ({
    product,
    coverImage,
    variant,
  }: {
    product: VantaProduct;
    coverImage?: string;
    variant?: "featured" | "standard";
  }) => {
    const isFeatured = variant === "featured";
    const showSubtitle = isFeatured
      ? product.name.toUpperCase()
      : product.availabilityState;
    const hasArrow = isFeatured;

    return (
      <div key={product.id} className="vanta-card group">
        <Link href={`/store/products/${product.id}`} className="block h-full w-full">
          <div className="vanta-card-media">
            {coverImage ? (
              <Image
                src={coverImage}
                alt={product.name}
                loading="lazy"
                width={300}
                height={200}
                style={{ width: 300, height: 200, objectFit: "cover" }}
              />
            ) : (
              <div className="no-photo">No photo</div>
            )}
            <div className="vanta-card-badges">
              {product.isNew && <span className="vanta-card-badge new">New</span>}
              {product.isFeatured && <span className="vanta-card-badge featured">Featured</span>}
              {product.isSale && <span className="vanta-card-badge sale">Sale</span>}
              {product.exclusivity !== "standard" && (
                <span className="vanta-card-badge exclusive">
                  {product.exclusivity.replace("_", " ")}
                </span>
              )}
            </div>
          </div>
          <div className="vanta-card-body">
            <div className="flex items-end justify-between gap-2">
              <div>
                {showSubtitle && (
                  <p className="vanta-card-subtitle">{showSubtitle}</p>
                )}
                <h3 className="vanta-card-title">{product.name}</h3>
                <div className="flex items-end gap-2">
                  <HeartToggle productId={product.id} />
                  <span className="vanta-card-price">
                    {formatPrice(product.basePriceCents, product.currency)}
                  </span>
                </div>
              </div>
              {hasArrow && (
                <div className="w-10 h-10 rounded-full bg-brand-gold flex items-center justify-center text-primary-foreground">
                  <span className="text-[12px]">▸</span>
                </div>
              )}
            </div>
          </div>
        </Link>
      </div>
    );
  }
);
ProductCard.displayName = "ProductCard";

/* --- Loading skeleton -----------------------------------------------------
   Mirrors the real page structure section-for-section, reusing the same
   .vanta-* classes with pulsing fills so skeleton geometry matches the
   loaded layout by construction. */

function SkeletonBar({ className }: { className: string }) {
  return <div className={`bg-paper-raised animate-pulse ${className}`} />;
}

function SkeletonVantaCard({
  width,
  square,
  small,
}: {
  width?: string;
  square?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className="vanta-card"
      style={{ flex: "0 0 auto", ...(width ? { width } : undefined) }}
    >
      <div
        className="vanta-card-media"
        style={square ? { aspectRatio: "1" } : undefined}
      >
        <div className="absolute inset-0 bg-paper-raised animate-pulse" />
      </div>
      <div
        className="vanta-card-body"
        style={small ? { padding: "8px 4px 4px 4px" } : undefined}
      >
        {small ? (
          <SkeletonBar className="h-2.5 w-full rounded" />
        ) : (
          <>
            <SkeletonBar className="h-4 w-3/4 rounded" />
            <SkeletonBar className="h-2.5 w-1/2 rounded" />
            <div className="vanta-card-footer">
              <SkeletonBar className="w-5 h-5 rounded-full" />
              <SkeletonBar className="h-[18px] w-14 rounded" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SkeletonFeaturedCard() {
  return (
    <div
      className="vanta-card"
      style={{ flex: "0 0 auto", width: "min(340px, 82%)" }}
    >
      <div className="vanta-card-media">
        <div className="absolute inset-0 bg-paper-raised animate-pulse" />
        <div className="vanta-card-badges">
          <SkeletonBar className="h-[15px] w-12 rounded border border-border" />
        </div>
      </div>
      <div className="vanta-card-body">
        <div className="flex items-end justify-between gap-2">
          <div className="flex-1 min-w-0">
            <SkeletonBar className="h-2.5 w-20 rounded mb-1.5" />
            <SkeletonBar className="h-4 w-3/4 rounded mb-2" />
            <div className="flex items-end gap-2">
              <SkeletonBar className="w-5 h-5 rounded-full" />
              <SkeletonBar className="h-[18px] w-16 rounded" />
            </div>
          </div>
          <SkeletonBar className="w-10 h-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function SkeletonSectionHeader({ seeAll = true }: { seeAll?: boolean }) {
  return (
    <div className="vanta-section-header">
      <div>
        <SkeletonBar className="h-2.5 w-16 rounded mb-1.5" />
        <SkeletonBar className="h-5 w-40 rounded" />
      </div>
      {seeAll && <SkeletonBar className="h-3 w-12 rounded" />}
    </div>
  );
}
