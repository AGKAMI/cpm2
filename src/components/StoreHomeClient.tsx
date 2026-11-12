"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { vantaApi, formatPrice, type VantaProduct, type VantaCategory, type VantaCustomer, type VantaPromotion, type TelegramUser } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { HeartToggle } from "@/components/HeartToggle";
import { NotificationBell } from "@/components/NotificationBell";

export function StoreHomeClient() {
  const [featured, setFeatured] = useState<VantaProduct[]>([]);
  const [newArrivals, setNewArrivals] = useState<VantaProduct[]>([]);
  const [onSale, setOnSale] = useState<VantaProduct[]>([]);
  const [categories, setCategories] = useState<VantaCategory[]>([]);
  const [cardImages, setCardImages] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [customer, setCustomer] = useState<VantaCustomer | null>(null);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [promotions, setPromotions] = useState<VantaPromotion[]>([]);
const carouselRef = useRef<HTMLDivElement>(null);
const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [f, all, cats, profile] = await Promise.all([
          vantaApi.products({ featured: true }),
          vantaApi.products({}),
          vantaApi.categories(),
          vantaApi.profile(),
        ]);
        setFeatured(f.products);
        setCategories(cats.categories);
        setCustomer(profile.customer);
        setTelegramUser(profile.telegramUser);

        try {
          const promos = await vantaApi.promotions();
          setPromotions(Array.isArray(promos.promotions) ? promos.promotions : []);
        } catch {
          // Promotions not available — sections stay hidden.
        }

        // New arrivals = products with isNew flag, fallback to most recent
        const arrivals = [...all.products]
          .filter((p) => p.isNew)
          .slice(0, 8);
        if (arrivals.length === 0) {
          // Fallback to most recently created
          const recent = [...all.products]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 8);
          setNewArrivals(recent);
        } else {
          setNewArrivals(arrivals);
        }

        // On sale = products with isSale flag
        const saleItems = [...all.products]
          .filter((p) => p.isSale)
          .slice(0, 8);
        setOnSale(saleItems);

        // Compute media IDs from all products that will be displayed in sections.
        // Use all.products since arrivals/sale/best-sellers may be empty until
        // we have isNew/isSale/isFeatured flags set on products.
        const displayIds = [...new Set(all.products.map((p) => p.id))].slice(0, 20);
        const covers = await Promise.all(
          displayIds.map((id) =>
            vantaApi
              .media(id)
              .then((m): [number, string | undefined] => [id, m.media[0]?.publicUrl])
              .catch(() => null),
          ),
        );
        const entries = covers.filter(
          (c): c is [number, string] => c !== null && c[1] !== undefined,
        );
        setCardImages(Object.fromEntries(entries));

        const productIdsWithImages = new Set(entries.map(([id]) => id));

        // Only show categories that actually have products WITH images assigned.
        const categoryIdsWithProducts = new Set(
          all.products
            .filter((p) => productIdsWithImages.has(p.id))
            .map((p) => p.categoryId)
            .filter(Boolean),
        );
        setCategories(cats.categories.filter((cat) => categoryIdsWithProducts.has(cat.id)));

        setError(null);

      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load catalogue.");
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    })();
  }, []);

  // --- Featured carousel handlers ---
  const handleScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el || featured.length === 0) return;
    const items = el.querySelectorAll('.featured-carousel-item');
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
    const items = el.querySelectorAll('.featured-carousel-item');
    const target = items[index] as HTMLElement;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'start' });
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
          {featured.filter((c) => c.exclusivity !== "standard").length} limited editions.
        </p>
      </section>

      {featured.length > 0 && (
        <section className="vanta-section" aria-label="Featured vehicles">
          <div className="vanta-section-header">
            <div>
              <span className="eyebrow">Featured</span>
              <h3 className="font-serif font-bold text-[20px] leading-none mt-[6px]">Featured Vehicles</h3>
            </div>
            <Link href="/store/categories" className="vanta-section-see-all">See all</Link>
          </div>
          <div className="relative">
            <div className="featured-nav">
              <button
                onClick={scrollPrev}
                disabled={activeIndex === 0}
                aria-label="Previous featured vehicle"
                className="featured-prev"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={scrollNext}
                disabled={activeIndex >= featured.length - 1}
                aria-label="Next featured vehicle"
                className="featured-next"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            {featured.map((c) => (
              <div key={c.id} className="vanta-card group">
                <Link href={`/store/products/${c.id}`} className="block h-full w-full">
                  <div className="vanta-card-media">
                    {cardImages[c.id] ? (
                      <img src={cardImages[c.id]} alt={c.name} loading="lazy" />
                    ) : (
                      <div className="no-photo">No photo</div>
                    )}
                    <div className="vanta-card-badges">
                      {c.isNew && <span className="vanta-card-badge new">New</span>}
                      {c.isFeatured && <span className="vanta-card-badge featured">Featured</span>}
                      {c.isSale && <span className="vanta-card-badge sale">Sale</span>}
                      {c.exclusivity !== "standard" && (
                        <span className="vanta-card-badge exclusive">{c.exclusivity.replace("_", " ")}</span>
                      )}
                    </div>
                  </div>
                  <div className="vanta-card-body">
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="vanta-card-subtitle">{c.name.toUpperCase()}</p>
                        <h3 className="vanta-card-title">{c.name}</h3>
                        <div className="flex items-end gap-2">
                          <HeartToggle productId={c.id} />
                          <span className="vanta-card-price">{formatPrice(c.basePriceCents, c.currency)}</span>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-brand-gold flex items-center justify-center text-primary-foreground">
                        <span className="text-[12px]">▸</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
            </div>
            <div className="featured-pagination">
              {featured.map((_, i) => (
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
        <section className="promo mb-6 px-4 relative overflow-hidden rounded-[22px] p-5">
          {promotions.map((promo) => (
            <Link
              key={promo.id}
              href={promo.ctaLink || "/store/categories"}
              className="block cursor-pointer"
            >
              <div
                className={`promotion-card relative overflow-hidden rounded-[22px] p-5 border border-border bg-raised shadow-sm hover:shadow-md transition-shadow duration-200 ease-out`}
                style={{
                  backgroundColor: promo.backgroundColor || "var(--color-paper-raised)",
                  color: promo.accentColor ? "var(--color-paper-sunken)" : undefined,
                }}
              >
                {promo.imageUrl && (
                  <>
                    <img
                      src={promo.imageUrl}
                      alt={promo.title}
                      className="absolute inset-y-0 right-0 h-full w-[55%] object-cover pointer-events-none"
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
        </section>
      )}

      {categories.length > 0 && (
        <section className="vanta-section">
          <div className="vanta-section-header">
            <h3 className="font-serif font-bold text-[20px] leading-none">Featured categories</h3>
            <Link href="/store/categories" className="vanta-section-see-all">All</Link>
          </div>
          <div className="vanta-card-list">
            {categories.slice(0, 8).map((cat) => (
              <div key={cat.id} className="vanta-card group" style={{ minWidth: "72px", flex: "0 0 auto" }}>
                <Link href={`/store/categories?category=${cat.slug}`} className="block h-full w-full text-center">
                  <div className="vanta-card-media" style={{ aspectRatio: "1" }}>
                    <span className="text-[11px] font-bold text-center text-ink-soft absolute inset-0 flex items-center justify-center">{cat.name.charAt(0)}</span>
                  </div>
                  <div className="vanta-card-body" style={{ padding: "8px 4px 4px 4px" }}>
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
              <h3 className="font-serif font-bold text-[20px] leading-none mt-[6px]">New arrivals</h3>
            </div>
            <Link href="/store/categories" className="vanta-section-see-all">See all</Link>
          </div>
          <div className="vanta-card-list">
            {newArrivals.map((c) => (
              <div key={c.id} className="vanta-card group">
                <Link href={`/store/products/${c.id}`} className="block h-full w-full">
                  <div className="vanta-card-media">
                    {cardImages[c.id] ? (
                      <img src={cardImages[c.id]} alt={c.name} loading="lazy" />
                    ) : (
                      <div className="no-photo">No photo</div>
                    )}
                    <div className="vanta-card-badges">
                      {c.isNew && <span className="vanta-card-badge new">New</span>}
                      {c.isFeatured && <span className="vanta-card-badge featured">Featured</span>}
                      {c.isSale && <span className="vanta-card-badge sale">Sale</span>}
                    </div>
                  </div>
                  <div className="vanta-card-body">
                    <h3 className="vanta-card-title">{c.name}</h3>
                    <p className="vanta-card-subtitle">{c.availabilityState}</p>
                    <div className="vanta-card-footer">
                      <HeartToggle productId={c.id} />
                      <span className="vanta-card-price">{formatPrice(c.basePriceCents, c.currency)}</span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {onSale.length > 0 && (
        <section className="vanta-section">
          <div className="vanta-section-header">
            <div>
              <span className="eyebrow">Limited time</span>
              <h3 className="font-serif font-bold text-[20px] leading-none mt-[6px]">On sale</h3>
            </div>
            <Link href="/store/categories" className="vanta-section-see-all">See all</Link>
          </div>
          <div className="vanta-card-list">
            {onSale.map((c) => (
              <div key={c.id} className="vanta-card group">
                <Link href={`/store/products/${c.id}`} className="block h-full w-full">
                  <div className="vanta-card-media">
                    {cardImages[c.id] ? (
                      <img src={cardImages[c.id]} alt={c.name} loading="lazy" />
                    ) : (
                      <div className="no-photo">No photo</div>
                    )}
                    <div className="vanta-card-badges">
                      {c.isNew && <span className="vanta-card-badge new">New</span>}
                      {c.isFeatured && <span className="vanta-card-badge featured">Featured</span>}
                      {c.isSale && <span className="vanta-card-badge sale">Sale</span>}
                    </div>
                  </div>
                  <div className="vanta-card-body">
                    <h3 className="vanta-card-title">{c.name}</h3>
                    <p className="vanta-card-subtitle">{c.availabilityState}</p>
                    <div className="vanta-card-footer">
                      <HeartToggle productId={c.id} />
                      <span className="vanta-card-price">{formatPrice(c.basePriceCents, c.currency)}</span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {customer && (
        <section className="vanta-section">
        <div className="vanta-section-header">
          <div>
            <span className="eyebrow">Personalised</span>
            <h3 className="font-serif font-bold text-[20px] leading-none mt-[6px]">Picked for you, {telegramUser?.displayName || customer?.inGameName || "you"}</h3>
          </div>
        </div>
        <p className="vanta-card-subtitle" style={{ marginTop: "-4px", marginBottom: "8px", marginLeft: "16px" }}>Because you viewed the featured builds</p>
        <div className="vanta-card-list" style={{ paddingLeft: "16px", paddingRight: "16px" }}>
          {featured.slice(0, 4).map((c) => (
            <div key={c.id} className="vanta-card group">
              <Link href={`/store/products/${c.id}`} className="block h-full w-full">
                <div className="vanta-card-media">
                  {cardImages[c.id] ? (
                    <img src={cardImages[c.id]} alt={c.name} loading="lazy" />
                  ) : (
                    <div className="no-photo">No photo</div>
                  )}
                </div>
                <div className="vanta-card-body">
                  <h3 className="vanta-card-title">{c.name}</h3>
                  <p className="vanta-card-subtitle">{c.availabilityState}</p>
                  <div className="vanta-card-footer">
                    <HeartToggle productId={c.id} />
                    <span className="vanta-card-price">{formatPrice(c.basePriceCents, c.currency)}</span>
                  </div>
                </div>
              </Link>
            </div>
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

/* --- Loading skeleton -----------------------------------------------------
   Mirrors the real page structure section-for-section, reusing the same
   .vanta-* classes with pulsing fills so skeleton geometry matches the
   loaded layout by construction. */

function SkeletonBar({ className }: { className: string }) {
  return <div className={`bg-paper-raised animate-pulse ${className}`} />;
}

function SkeletonVantaCard({ width, square, small }: { width: string; square?: boolean; small?: boolean }) {
  return (
    <div className="vanta-card" style={{ flex: "0 0 auto", width }}>
      <div className="vanta-card-media" style={square ? { aspectRatio: "1" } : undefined}>
        <div className="absolute inset-0 bg-paper-raised animate-pulse" />
      </div>
      <div className="vanta-card-body" style={small ? { padding: "8px 4px 4px 4px" } : undefined}>
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
    <div className="vanta-card" style={{ flex: "0 0 auto", width: "min(340px, 82%)" }}>
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

const loadingSkeleton = (
    <>
      <section className="hero relative px-4 pt-6 pb-8">
        <SkeletonBar className="h-2.5 w-24 rounded mb-3" />
        <SkeletonBar className="h-8 w-3/4 rounded mb-2" />
        <SkeletonBar className="h-3 w-48 rounded" />
      </section>

      <section className="vanta-section" aria-label="Featured vehicles">
        <SkeletonSectionHeader />
        <div className="relative">
          <div className="featured-carousel">
            <SkeletonFeaturedCard />
            <SkeletonFeaturedCard />
          </div>
          <div className="featured-pagination">
            <span className="featured-dot active" />
            <span className="featured-dot" />
          </div>
        </div>
      </section>

      <section className="promo mb-6 px-4">
        <div className="relative overflow-hidden rounded-[22px] p-5 border border-border" style={{ minHeight: "160px" }}>
          <SkeletonBar className="h-2.5 w-20 rounded mb-2" />
          <SkeletonBar className="h-5 w-40 rounded mb-1.5" />
          <SkeletonBar className="h-3 w-56 rounded" />
          <SkeletonBar className="mt-4 h-9 w-28 rounded" />
        </div>
      </section>

      <section className="vanta-section">
        <SkeletonSectionHeader seeAll={false} />
        <div className="vanta-card-list">
          {[...Array(6)].map((_, i) => (
            <SkeletonVantaCard key={i} width="72px" square small />
          ))}
        </div>
      </section>

      <section className="vanta-section">
        <SkeletonSectionHeader />
        <div className="vanta-card-list">
          {[...Array(3)].map((_, i) => (
            <SkeletonVantaCard key={i} width="200px" />
          ))}
        </div>
      </section>

      <section className="vanta-section">
        <SkeletonSectionHeader />
        <div className="vanta-card-list">
          {[...Array(3)].map((_, i) => (
            <SkeletonVantaCard key={i} width="200px" />
          ))}
        </div>
      </section>

      <section className="vanta-section">
        <SkeletonSectionHeader seeAll={false} />
        <div className="vanta-card-list">
          {[...Array(3)].map((_, i) => (
            <SkeletonVantaCard key={i} width="200px" />
          ))}
        </div>
      </section>
    </>
  );

  return (
    <StoreShell dock={null}>
      {loaded ? content : loadingSkeleton}
      {error && (
        <div className="p-6 text-center">
          <p className="rounded-md border border-destructive bg-background px-4 py-3 text-xs text-destructive">{error}</p>
        </div>
      )}
    </StoreShell>
  );
}
