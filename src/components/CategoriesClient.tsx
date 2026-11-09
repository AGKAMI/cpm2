"use client";

import Link from "next/link";
import React from "react";
import { useEffect, useState } from "react";
import { vantaApi, type VantaCategory, type VantaProduct } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { formatPrice } from "@/lib/store/client";

const ICONS: Record<string, string> = {
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  sliders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1"/><circle cx="16" cy="6" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="18" cy="18" r="2.2"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>`,
};

export function CategoriesClient() {
  const [categories, setCategories] = useState<VantaCategory[]>([]);
  const [products, setProducts] = useState<VantaProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [excl, setExcl] = useState("all");
  const [avail, setAvail] = useState("all");
  const [promo, setPromo] = useState(false);
  const [max, setMax] = useState(4000);
  const [fopen, setFopen] = useState(false);
  const [sort, setSort] = useState("feat");
  const [cardImages, setCardImages] = useState<Record<number, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const [cats, prods] = await Promise.all([
          vantaApi.categories(),
          vantaApi.products({}),
        ]);
        setCategories(cats.categories || []);
        setProducts(prods.products);
        setError(null);
        const ids = prods.products.map((p) => p.id).slice(0, 20);
        const covers = await Promise.all(
          ids.map((id) =>
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load categories.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const nf = Number(excl !== "all") + Number(avail !== "all") + (promo ? 1 : 0) + (max < 4000 ? 1 : 0);

  const filtered = products.filter((c) => {
    const priceOk = c.basePriceCents / 100 <= max;
    const exclOk =
      excl === "all" ||
      (excl === "any" && c.exclusivity !== "standard") ||
      (excl === "ltd" && c.exclusivity === "limited") ||
      (excl === "one" && c.exclusivity === "one_of_one");
    const availOk =
      avail === "all" ||
      (avail === "in" && c.stockQuantity > 0) ||
      (avail === "low" && c.stockQuantity > 0 && c.stockQuantity <= 3);
    const promoOk = !promo || c.exclusivity !== "standard";
    const qOk =
      !q ||
      (c.name + " " + c.description).toLowerCase().includes(q.toLowerCase());
    return priceOk && exclOk && availOk && promoOk && qOk;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "lh") return a.basePriceCents - b.basePriceCents;
    if (sort === "hl") return b.basePriceCents - a.basePriceCents;
    if (sort === "new") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });

  const chip = (label: React.ReactNode, active: boolean, onClick: () => void) => (
    <div
      onClick={onClick}
      className={`chip ${active ? "active" : ""} flex items-center gap-1 h-[34px] px-[14px] rounded-[9999px] border border-border bg-secondary text-muted-foreground font-bold text-[11.5px] cursor-pointer transition-all duration-160`}
    >
      {label}
    </div>
  );

  return (
    <StoreShell>
      {loading ? (
        <div className="p-6" aria-hidden="true">
          <PageHeading folio="CT" title="Categories" backHref="/store" />
          <div className="h-3 w-24 rounded-sm bg-background mb-4 animate-pulse" />
          <div className="h-3 w-48 rounded-sm bg-background mb-2 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="panel rounded-xl border border-border p-4 stagger-item" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="aspect-video rounded-lg bg-background mb-3 animate-pulse" />
                <div className="h-3 w-3/4 rounded-sm bg-background mb-2 animate-pulse" />
                <div className="h-2 w-full rounded-sm bg-background animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="p-6 text-center">
          <p className="rounded-md border border-destructive bg-background px-4 py-3 text-xs text-destructive">
            {error}
          </p>
        </div>
      ) : (
        <>
          <section className="pad mb-4 px-4">
            <span className="eyebrow">Browse the floor</span>
            <h2 className="serif font-bold text-[30px] leading-none mt-1 mb-3">
              Categories
            </h2>
            <div className="search-input flex items-center gap-2 h-[46px] px-[14px] rounded-[15px] bg-secondary border border-border">
              <span
                className="text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: ICONS.search }}
              />
              <input
                id="q"
                placeholder="Search model, make or edition"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="flex-1 bg-transparent border-0 outline-0 text-foreground text-sm"
              />
              <button
                className={`filter-btn ${fopen ? "active" : ""} flex items-center gap-2 h-[34px] px-[12px] rounded-[11px] border-0 font-bold text-[11px]`}
                onClick={() => setFopen(!fopen)}
              >
                <span
                  className="text-[12px]"
                  dangerouslySetInnerHTML={{ __html: ICONS.sliders }}
                />
                Filters{nf ? " \u00b7 " + nf : ""}
              </button>
            </div>
            <div className="hs mt-3 px-4 gap-2 overflow-x-auto scrollbar-hide" style={{ scrollPaddingLeft: "16px" }}>
              {chip("All", excl === "all", () => setExcl("all"))}
              {chip("Limited", excl === "ltd", () => setExcl("ltd"))}
              {chip("One of One", excl === "one", () => setExcl("one"))}
              {chip(
                "In stock",
                avail === "in",
                () => setAvail(avail === "in" ? "all" : "in"),
              )}
              {chip(
                <>
                  <span className="text-[11px]" dangerouslySetInnerHTML={{ __html: ICONS.tag }} />
                  On offer
                </>,
                promo,
                () => setPromo(!promo),
              )}
            </div>

            {fopen && (
              <div className="fp mt-4 px-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="l flex justify-between mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Price range <b id="mxl" className="text-gold">
                      Up to R {max.toLocaleString()}
                    </b>
                  </label>
                  <input
                    id="mx"
                    type="range"
                    min="1000"
                    max="4000"
                    step="50"
                    value={max}
                    onChange={(e) => setMax(parseInt(e.target.value, 10))}
                    className="range-slider w-full h-[4px] rounded-[2px] bg-border appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="l flex justify-between mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Exclusivity
                  </label>
                  <div className="chips flex gap-2 flex-wrap">
                    {["all", "any", "ltd", "one"].map((v) => (
                      <div
                        key={v}
                        onClick={() => setExcl(v)}
                        className={`chip ${excl === v ? "active" : ""} flex items-center gap-1 h-[34px] px-[14px] rounded-[9999px] border border-border bg-secondary text-muted-foreground font-bold text-[11.5px] cursor-pointer transition-all duration-160`}
                      >
                        {v === "all"
                          ? "All"
                          : v === "any"
                            ? "Any exclusive"
                            : v === "ltd"
                              ? "Limited Edition"
                              : "One of One"}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="l flex justify-between mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Stock & availability
                  </label>
                  <div className="chips flex gap-2 flex-wrap">
                    {["all", "in", "low"].map((v) => (
                      <div
                        key={v}
                        onClick={() => setAvail(v)}
                        className={`chip ${avail === v ? "active" : ""} flex items-center gap-1 h-[34px] px-[14px] rounded-[9999px] border border-border bg-secondary text-muted-foreground font-bold text-[11.5px] cursor-pointer transition-all duration-160`}
                      >
                        {v === "all"
                          ? "Everything"
                          : v === "in"
                            ? "In stock"
                            : "Low stock"}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="l flex justify-between mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Promotions
                  </label>
                  <div className="chips flex gap-2">
                    <div
                      onClick={() => setPromo(!promo)}
                      className={`chip ${promo ? "active" : ""} flex items-center gap-1 h-[34px] px-[14px] rounded-[9999px] border border-border bg-secondary text-muted-foreground font-bold text-[11.5px] cursor-pointer transition-all duration-160`}
                    >
                      <span
                        className="text-[11px]"
                        dangerouslySetInnerHTML={{ __html: ICONS.tag }}
                      />{" "}
                      Discounted only
                    </div>
                  </div>
                </div>
                <div style={{ gridColumn: "1 / -1" }} className="flex gap-[8px]">
                  <button
                    onClick={() => {
                      setExcl("all");
                      setAvail("all");
                      setPromo(false);
                      setMax(4000);
                      setQ("");
                    }}
                    className="btn btn-line sm flex-1 h-[38px] text-[11.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground rounded-[12px] px-[14px] w-auto"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setFopen(false)}
                    className="btn btn-gold-gradient flex-2 h-[38px] rounded-full text-[11.5px] font-bold tracking-wider"
                  >
                    Show {sorted.length} results
                  </button>
                </div>
              </div>
            )}

            <div className="rh flex justify-between items-center mb-2 px-4">
              <span><b>{sorted.length}</b> vehicle{sorted.length === 1 ? "" : "s"}</span>
              <select
                className="admin-input bg-transparent border border-border text-foreground font-bold text-[11px] px-2 py-1 rounded-[10px] outline-0 w-auto"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="feat">Sort: Featured</option>
                <option value="new">Newest first</option>
                <option value="lh">Price: low → high</option>
                <option value="hl">Price: high → low</option>
              </select>
            </div>

            <div id="res" className="carousel px-4">
              <button
                onClick={() => {
                  const el = document.getElementById("res");
                  el?.scrollBy({ left: -340, behavior: "smooth" });
                }}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-14 w-10 rounded-r-lg bg-[#0a0a0a]/80 border border-border flex items-center justify-center text-gold hover:bg-[#0a0a0a] transition-colors hidden md:flex"
                aria-label="Scroll left"
              >
                <span className="text-[14px]">‹</span>
              </button>
              <div
                className="flex flex-nowrap gap-4 snap-x snap-mandatory pb-4"
                style={{ scrollPaddingLeft: "16px", scrollPaddingRight: "16px" }}
              >
                {sorted.length ? (
                  sorted.map((c, index) => (
                    <Link
                      key={c.id}
                      href={`/store/products/${c.id}`}
                      className="product-card group cursor-pointer snap-start stagger-item min-w-[320px] max-w-[340px]"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <div className="relative overflow-hidden rounded-[18px] border border-border">
                        {cardImages[c.id] ? (
                                                      <>
                                                        <img src={cardImages[c.id]} alt={c.name} className="w-full h-[220px] object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                                                      </>
                                                    ) : (
                                                      <div className="w-full h-[220px] bg-surface-deep relative aspect-[4/3]">
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                                                        <span className="absolute bottom-3 left-3 text-[10px] text-white/50 uppercase tracking-[0.2em]">No photo</span>
                                                      </div>
                                                    )}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {c.exclusivity !== "standard" && (
                                                        <span className={`badge-exclusive ${c.exclusivity === "one_of_one" ? "badge-one" : "badge-limited"}`}>
                                                          {c.exclusivity === "one_of_one" ? "One of One" : "Limited"}
                                                        </span>
                                                    )}
                        {c.isNew && (
                          <span className="badge-exclusive badge-new">New</span>
                                                    )}
                        {c.isSale && (
                          <span className="badge-exclusive badge-sale">Sale</span>
                                                    )}
                        {c.isFeatured && (
                          <span className="badge-exclusive badge-featured">Featured</span>
                                                    )}
                      </div>
                    </div>
                    <div className="mt-3 px-1">
                      <h4 className="font-bold text-sm">{c.name}</h4>
                      <p className="text-[10px] text-muted-foreground mb-1">{c.availabilityState}</p>
                      <div className="flex items-baseline flex-wrap gap-2">
                        <span className="price-primary">{formatPrice(c.basePriceCents, c.currency)}</span>
                        <span className={`stock-indicator ${c.stockQuantity === 0 ? "bad" : c.stockQuantity <= 3 ? "warn" : "ok"}`}>
                          {c.stockQuantity === 0 ? "Sold out · Waitlist" : c.stockQuantity <= 3 ? `Only ${c.stockQuantity} left` : `In stock · ${c.stockQuantity}`}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="empty text-center py-10 text-muted-foreground stagger-item">
                  <span className="text-[28px] mb-2 block">🔍</span>
                  <p>No vehicles match your filters.</p>
                </div>
              )}
                {sorted.length > 0 && (
                  <button
                    onClick={() => {
                      const el = document.getElementById("res");
                      el?.scrollBy({ left: 340, behavior: "smooth" });
                    }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-14 w-10 rounded-l-lg bg-[#0a0a0a]/80 border border-border flex items-center justify-center text-gold hover:bg-[#0a0a0a] transition-colors hidden md:flex"
                    aria-label="Scroll right"
                  >
                    <span className="text-[14px]">›</span>
                  </button>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </StoreShell>
  );
}
