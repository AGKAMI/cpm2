"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { vantaApi, formatPrice, type VantaProduct, type VantaCategory, type VantaCustomer, type TelegramUser } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";

export function StoreHomeClient() {
  const [featured, setFeatured] = useState<VantaProduct[]>([]);
  const [newArrivals, setNewArrivals] = useState<VantaProduct[]>([]);
  const [onSale, setOnSale] = useState<VantaProduct[]>([]);
  const [bestSellers, setBestSellers] = useState<VantaProduct[]>([]);
  const [categories, setCategories] = useState<VantaCategory[]>([]);
  const [cardImages, setCardImages] = useState<Record<number, string>>({});
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [customer, setCustomer] = useState<VantaCustomer | null>(null);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);

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

        // Fetch this customer's orders — used to gate data-dependent sections.
        if (profile.customer?.playerId) {
          try {
            const ordersRes = await fetch(
              `/api/store/orders?playerId=${encodeURIComponent(profile.customer.playerId)}`,
              { credentials: "include" },
            );
            if (ordersRes.ok) {
              const ordersData = await ordersRes.json();
              setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
            }
          } catch {
            // No orders / not authenticated — sections stay hidden.
          }
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

        // Best sellers = featured items (as proxy until we have sales data)
        const sellers = [...all.products]
          .filter((p) => p.isFeatured)
          .slice(0, 6);
        setBestSellers(sellers);

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

  const dock = (
    <div className="dyn gap-4">
      <div
        onClick={() => {}}
        className="rk cursor-pointer"
        data-a="tab"
        data-t="orders"
      >
        <span className="n gtext">🚛</span>
        <div>
          <b>Free delivery slot</b>
          <small>Saturday · 14:00 SAST</small>
        </div>
      </div>
      <div
        onClick={() => {}}
        className="rk cursor-pointer"
        data-a="promoc"
      >
        <span className="n gtext">🏷️</span>
        <div>
          <b>Trade-in credit</b>
          <small>R200 off your second build</small>
        </div>
      </div>
    </div>
  );

  const content = (
    <>
      <section className="hero px-4 pt-4 pb-4 relative">
        <div className="hero-wm absolute right-0 top-0 opacity-20 pointer-events-none">
          <div
            dangerouslySetInnerHTML={{
              __html: `<svg viewBox="0 0 100 114" width="200" height="228" style="flex:none;display:block"><path d="M12,8H88L94,14V60Q94,90 50,108Q6,90 6,60V14Z" fill="none" stroke="#d4af4f" stroke-width="2" opacity=".15"/></svg>`,
            }}
          />
        </div>
        <span className="eyebrow">Good evening</span>
        <span className="eyebrow">Good evening</span>
        <h1 className="pt font-serif font-bold text-[28px] leading-[1.02] mb-2">
          Welcome back,<br /> {telegramUser?.displayName || customer?.inGameName || "there"}
        </h1>
        <p className="text-sm text-ink-soft max-w-[230px]">
          The showroom is open — <b className="text-foreground">{featured.length}</b> custom builds on the floor, <b className="text-foreground">{featured.filter((c) => c.exclusivity !== "standard").length}</b> exclusive.
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
                        <span className="bd bd-one mb-1 text-[9px] font-bold">{c.exclusivity}</span>
                      )}
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <small className="text-white/80 uppercase tracking-[0.06em]">{c.name.toUpperCase()}</small>
                        <h3 className="font-serif font-bold text-xl leading-none mt-1">{c.name}</h3>
                        <div className="mt-2 font-bold text-lg">{formatPrice(c.basePriceCents, c.currency)}</div>
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
          <div className="dots justify-center mt-2 gap-2" data-dots="feat">
            {featured.map((_, i) => (
              <i key={i} className={`w-2 h-2 rounded-full bg-border transition-all ${i === 0 ? "bg-gold w-5" : ""}`} />
            ))}
          </div>
        </>
      )}

      <section className="promo mb-6 px-4 relative overflow-hidden rounded-[22px] p-5 border border-[rgba(212,175,79,0.45)] bg-[radial-gradient(120%_140%_at_100%_0%,rgba(216,180,90,.22),transparent_55%)]">
        <div className="wm absolute right-[-14px] bottom-[-22px] opacity-90 pointer-events-none">
          <div
            dangerouslySetInnerHTML={{
              __html: `<svg viewBox="0 0 100 114" width="120" height="137" style="flex:none;display:block"><path d="M12,8H88L94,14V60Q94,90 50,108Q6,90 6,60V14Z" fill="none" stroke="#d4af4f" stroke-width="2" opacity=".2"/></svg>`,
            }}
          />
        </div>
        <span className="eyebrow">Founders weekend</span>
        <h3 className="font-serif font-bold text-[24px] leading-none mb-1">10% off every Limited Edition</h3>
        <p className="text-[11px] text-ink-soft mb-3">Code <b className="text-gold tracking-[0.12em]">VANTA10</b> · ends Sunday 23:59</p>
        <button className="btn btn-gold-gradient rounded-full px-4 py-2 text-[11px] font-bold tracking-wider">
          Shop exclusives <span className="text-[10px] ml-1">▸</span>
        </button>
      </section>

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
                    <span className="pr font-bold">{formatPrice(c.basePriceCents, c.currency)}</span>
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
                    <span className="pr font-bold">{formatPrice(c.basePriceCents, c.currency)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {orders.length > 0 && (
        <section className="sec mb-6 px-4">
          <div className="sh flex justify-between items-center mb-3">
            <div>
              <span className="eyebrow">This month</span>
              <h3 className="font-serif font-bold text-[20px] leading-none mt-[6px]">Best sellers</h3>
            </div>
          </div>
        <div className="pad flex flex-col gap-3 px-4">
          {bestSellers.map((c, i) => (
            <Link key={c.id} href={`/store/products/${c.id}`} className="rk cursor-pointer">
              <div className="n gtext w-6 text-center text-[14px]">{i + 1}</div>
              <div className="media w-20 h-20 rounded-[18px] border border-border flex-shrink-0">
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
                <span className="pr font-bold">{formatPrice(c.basePriceCents, c.currency)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      )}

      {customer && orders.length > 0 && (
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
                <span className="pr font-bold">{formatPrice(c.basePriceCents, c.currency)}</span>
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
      <section className="hero px-4 pt-4 pb-4 relative">
        <div className="animate-pulse">
          <div className="h-4 w-1/4 bg-surface-deep rounded mb-2" />
          <div className="h-8 w-3/4 bg-surface-deep rounded mb-1" />
          <div className="h-8 w-1/2 bg-surface-deep rounded" />
        </div>
      </section>
      <section className="px-4">
        <div className="animate-pulse">
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
    <StoreShell dock={dock}>
      {loaded ? content : loadingSkeleton}
      {error && (
        <div className="p-6 text-center">
          <p className="rounded-md border border-destructive bg-background px-4 py-3 text-xs text-destructive">{error}</p>
        </div>
      )}
    </StoreShell>
  );
}
