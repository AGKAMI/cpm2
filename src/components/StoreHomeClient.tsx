"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
        <>
          <div className="hs mb-4 px-4" data-sc="feat">
            {featured.map((c) => (
              <Link key={c.id} href={`/store/products/${c.id}`} className="fc group cursor-pointer">
                <div className="media r1611 relative overflow-hidden rounded-[24px] border border-border">
                  {cardImages[c.id] ? (
                    <img src={cardImages[c.id]} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-surface-deep flex items-center justify-center">
                      <span className="text-[10px] text-ink-faint uppercase tracking-[0.2em]">No photo</span>
                    </div>
                  )}
                  <div className="ov absolute inset-0 flex flex-col justify-between p-3 text-white">
                    <div>
                      {c.exclusivity !== "standard" && (
                        <span className="badge-exclusive text-[9px] font-bold">{c.exclusivity.replace("_", " ")}</span>
                      )}
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <small className="text-white/80 uppercase tracking-[0.06em]">{c.name.toUpperCase()}</small>
                        <h3 className="font-serif font-bold text-xl leading-none mt-1">{c.name}</h3>
                        <div className="mt-2 font-bold tabular-nums text-lg">
                          <HeartToggle productId={c.id} />
                          {formatPrice(c.basePriceCents, c.currency)}
                        </div>
                      </div>
                      <div className="go w-10 h-10 rounded-full bg-gold flex items-center justify-center text-ink">
                        <span className="text-[12px]">▸</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
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
                className={`relative overflow-hidden rounded-[22px] p-5 border border-[rgba(255,255,255,0.15)]`}
                style={{
                  backgroundColor: promo.backgroundColor || "#1c1c1f",
                  color: promo.accentColor ? "#ffffff" : undefined,
                }}
              >
                {promo.imageUrl && (
                  <img
                    src={promo.imageUrl}
                    alt={promo.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
                  />
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
                    <p className="text-[11px] text-ink-soft mb-3">
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
        <section className="sec mb-6 px-4">
          <div className="sh flex justify-between items-end mb-3">
            <h3 className="font-serif font-bold text-[20px] leading-none">Featured categories</h3>
            <Link href="/store/categories" className="text-[11px] font-bold text-gold uppercase tracking-[0.06em]">All</Link>
          </div>
          <div className="hs px-4 gap-3" style={{ scrollPaddingLeft: "16px" }}>
            {categories.slice(0, 8).map((cat) => (
              <Link key={cat.id} href={`/store/categories?category=${cat.slug}`} className="circ cursor-pointer">
                <div className="media w-18 h-18 rounded-full border border-border flex-shrink-0 relative overflow-hidden bg-surface-deep">
                  <span className="text-[11px] font-bold text-center text-ink-soft absolute inset-0 flex items-center justify-center">{cat.name.charAt(0)}</span>
                </div>
                <span className="mt-1 block text-[10px] font-bold text-center">{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {newArrivals.length > 0 && (
        <section className="sec mb-6 px-4">
          <div className="sh flex justify-between items-end mb-3">
            <div>
              <span className="eyebrow">This month</span>
              <h3 className="font-serif font-bold text-[20px] leading-none mt-[6px]">New arrivals</h3>
            </div>
            <Link href="/store/categories" className="text-[11px] font-bold text-gold uppercase tracking-[0.06em]">See all</Link>
          </div>
          <div className="hs px-4 gap-4" style={{ scrollPaddingLeft: "16px" }}>
            {newArrivals.map((c) => (
              <Link key={c.id} href={`/store/products/${c.id}`} className="nc cursor-pointer">
                <div className="relative">
                  <div className="media r43 rounded-[18px] border border-border overflow-hidden">
                    {cardImages[c.id] ? (
                      <img src={cardImages[c.id]} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-surface-deep flex items-center justify-center">
                        <span className="text-[10px] text-ink-faint uppercase tracking-[0.2em]">No photo</span>
                      </div>
                    )}
                    <div className="tl absolute top-2 left-2">
                      {c.isNew && <span className="bd bd-new text-[9px] font-bold px-2 py-1 rounded">New</span>}
                    </div>
                  </div>
                  <h4 className="font-bold text-sm">{c.name}</h4>
                  <p className="text-[10px] text-ink-soft">{c.availabilityState}</p>
                  <div className="vc-f mt-1">
                    <HeartToggle productId={c.id} />
                    <span className="pr font-bold tabular-nums">{formatPrice(c.basePriceCents, c.currency)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {onSale.length > 0 && (
        <section className="sec mb-6 px-4">
          <div className="sh flex justify-between items-end mb-3">
            <div>
              <span className="eyebrow">Limited time</span>
              <h3 className="font-serif font-bold text-[20px] leading-none mt-[6px]">On sale</h3>
            </div>
            <Link href="/store/categories" className="text-[11px] font-bold text-gold uppercase tracking-[0.06em]">See all</Link>
          </div>
          <div className="hs px-4 gap-4" style={{ scrollPaddingLeft: "16px" }}>
            {onSale.map((c) => (
              <Link key={c.id} href={`/store/products/${c.id}`} className="nc cursor-pointer">
                <div className="relative">
                  <div className="media r43 rounded-[18px] border border-border overflow-hidden">
                    {cardImages[c.id] ? (
                      <img src={cardImages[c.id]} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-surface-deep flex items-center justify-center">
                        <span className="text-[10px] text-ink-faint uppercase tracking-[0.2em]">No photo</span>
                      </div>
                    )}
                    <div className="tl absolute top-2 left-2">
                      {c.isSale && <span className="bd bd-sale text-[9px] font-bold px-2 py-1 rounded">Sale</span>}
                    </div>
                  </div>
                  <h4 className="font-bold text-sm">{c.name}</h4>
                  <p className="text-[10px] text-ink-soft">{c.availabilityState}</p>
                  <div className="vc-f mt-1">
                    <HeartToggle productId={c.id} />
                    <span className="pr font-bold tabular-nums">{formatPrice(c.basePriceCents, c.currency)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {customer && (
        <section className="sec mb-8 px-4">
        <div className="sh mb-4">
          <div>
            <span className="eyebrow">Personalised</span>
            <h3 className="font-serif font-bold text-[20px] leading-none mt-[6px]">Picked for you, {telegramUser?.displayName || customer?.inGameName || "you"}</h3>
          </div>
        </div>
        <p className="text-[11px] text-ink-soft mt-[-4px] mb-3 px-4">Because you viewed the featured builds</p>
        <div className="pad flex flex-col gap-3 px-4">
          {featured.slice(0, 4).map((c) => (
            <Link key={c.id} href={`/store/products/${c.id}`} className="rk cursor-pointer">
              <div className="media w-16 h-16 rounded-[16px] border border-border flex-shrink-0">
                {cardImages[c.id] ? (
                  <img src={cardImages[c.id]} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-surface-deep flex items-center justify-center">
                    <span className="text-[10px] text-ink-faint uppercase tracking-[0.2em]">No photo</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm">{c.name}</h4>
                <p className="text-[10px] text-ink-soft">{c.availabilityState}</p>
                <span className="pr font-bold tabular-nums">{formatPrice(c.basePriceCents, c.currency)}</span>
              </div>
              <span className="text-gold text-[14px]">▸</span>
            </Link>
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

const loadingSkeleton = (
    <>
      <section className="hero px-4 pt-6 pb-8 relative">
        <div className="animate-pulse">
          <div className="h-4 w-1/4 bg-surface-deep rounded mb-2" />
          <div className="h-8 w-3/4 bg-surface-deep rounded mb-1" />
          <div className="h-8 w-1/2 bg-surface-deep rounded" />
        </div>
      </section>
      <section className="px-4">
        <div className="animate-pulse">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="product-card">
                <div className="relative overflow-hidden rounded-[18px] border border-border">
                  <div className="w-full h-[220px] bg-surface-deep" />
                  <div className="absolute bottom-2 left-2 right-2 p-2 bg-black/60">
                    <div className="h-4 w-3/4 bg-surface-deep rounded mb-1" />
                    <div className="h-6 w-1/2 bg-gold rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="sec mb-6 px-4 animate-pulse">
        <div className="h-5 w-1/4 bg-surface-deep rounded mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="panel p-4">
              <div className="h-3 w-1/3 bg-surface-deep rounded mb-1" />
              <div className="h-5 w-1/2 bg-surface-deep rounded" />
            </div>
          ))}
        </div>
      </section>
      <section className="sec mb-6 px-4 animate-pulse">
        <div className="h-5 w-1/4 bg-surface-deep rounded mb-3" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="product-card">
              <div className="relative overflow-hidden rounded-[18px] border border-border">
                <div className="w-full h-[220px] bg-surface-deep" />
                <div className="absolute bottom-2 left-2 right-2 p-2 bg-black/60">
                  <div className="h-4 w-3/4 bg-surface-deep rounded mb-1" />
                  <div className="h-6 w-1/2 bg-gold rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="sec mb-6 px-4 animate-pulse">
        <div className="h-5 w-1/4 bg-surface-deep rounded mb-3" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="product-card">
              <div className="relative overflow-hidden rounded-[18px] border border-border">
                <div className="w-full h-[220px] bg-surface-deep" />
                <div className="absolute bottom-2 left-2 right-2 p-2 bg-black/60">
                  <div className="h-4 w-3/4 bg-surface-deep rounded mb-1" />
                  <div className="h-6 w-1/2 bg-destructive rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="sec mb-10 px-4 animate-pulse">
        <div className="h-5 w-1/4 bg-surface-deep rounded mb-3" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="product-card">
              <div className="relative overflow-hidden rounded-[18px] border border-border">
                <div className="w-full h-[220px] bg-surface-deep" />
                <div className="absolute bottom-2 left-2 right-2 p-2 bg-black/60">
                  <div className="h-4 w-3/4 bg-surface-deep rounded mb-1" />
                  <div className="h-6 w-1/2 bg-gold rounded" />
                </div>
              </div>
            </div>
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
