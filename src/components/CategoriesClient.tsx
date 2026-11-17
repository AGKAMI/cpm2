"use client";


import Link from "next/link";
import React, { useEffect, useState } from "react";
import { vantaApi, type VantaCategory } from "@/lib/store/client"; import { type Product } from "@/lib/store-types";
import { StoreShell } from "@/components/StoreShell";
import { CategoriesSkeleton } from "@/components/skeleton";
import { PageHeading } from "@/components/PageHeading";
import { formatPrice } from "@/lib/store/client";
import { HeartToggle } from "@/components/HeartToggle";

/**
 * Stock color tier, relative to the stock baseline (`stockInitial`) set when
 * the product was created (or last restocked):
 *   0            → bad  ("Sold out")
 *   < 5          → bad  (always red, regardless of ratio)
 *   > 2/3 of baseline → ok    (green)
 *   > 1/3 of baseline → warn  (orange)
 *   otherwise         → bad   (red)
 * Legacy rows with no baseline (0) fall back to the old flat thresholds.
 */
export function stockTier(stock: number, initial: number): "ok" | "warn" | "bad" {
  if (stock === 0) return "bad";
  if (stock < 5) return "bad";
  if (initial > 0) {
    const ratio = stock / initial;
    if (ratio > 2 / 3) return "ok";
    if (ratio > 1 / 3) return "warn";
    return "bad";
  }
  return stock <= 3 ? "warn" : "ok";
}

export function stockLabel(stock: number, tier: "ok" | "warn" | "bad"): string {
  if (stock === 0) return "Sold out";
  return tier === "ok" ? `In stock · ${stock}` : `Only ${stock} left`;
}

const ICONS: Record<string, string> = {
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  sliders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1"/><circle cx="16" cy="6" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="18" cy="18" r="2.2"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>`,
};

/** Placeholder image built from a product name (SVG data URL).
 *  Always renders a photo, even when the product has no uploaded cover image. */
function coverImageFromName(name: string, w = 200, h = 260): string {
  const esc = (s: string): string =>
    s.replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
    ));
  const grad = "#1f2937 0%, #374151 50%, #1f2937 100%";
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="${grad}"/>` +
    `<text x="${w / 2}" y="${h / 2 + 10}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="1">${esc(name.length > 20 ? name.slice(0, 20) + "…" : name)}</text>` +
    `</svg>`
  )}`;
}

export function CategoriesClient({
  categories,
  products,
  coverMap = {},
}: {
  categories: VantaCategory[];
  products: Product[];
  coverMap?: Record<number, string>;
}) {
  const [q, setQ] = useState("");
  const [excl, setExcl] = useState("all");
  const [avail, setAvail] = useState("all");
  const [promo, setPromo] = useState(false);
  const [max, setMax] = useState(200);
  const [fopen, setFopen] = useState(false);
  const [sort, setSort] = useState("feat");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [clientCoverMap, setClientCoverMap] = useState<Record<number, string>>(coverMap);

  // covers are resolved server-side (CategoriesPage) — phones paint the
  // image on first load, no async race.


  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 250);
    return () => clearTimeout(t);
  }, []);

  const nf = Number(excl !== "all") + Number(avail !== "all") + (promo ? 1 : 0) + (max < 200 ? 1 : 0);

  const filtered = products.filter((c) => {
    const priceOk = c.basePriceCents / 100 <= max;
    const exclOk =
      excl === "all" ||
      (excl === "any" && c.exclusivity !== "standard") ||
      (excl === "ltd" && c.exclusivity === "limited_edition") ||
      (excl === "one" && c.exclusivity === "one_of_one");
    const availOk =
      avail === "all" ||
      (avail === "in" && c.stockQuantity > 0) ||
      (avail === "low" && c.stockQuantity > 0 && c.stockQuantity <= 3);
    const promoOk = !promo || c.exclusivity !== "standard";
    const qOk =
      !debouncedQ ||
      (c.name + " " + c.description).toLowerCase().includes(debouncedQ.toLowerCase());
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
      <>
        {loading ? (
          <CategoriesSkeleton />
        ) : (
          <section className="pad mb-6 px-4">
          <span className="eyebrow">Browse the floor</span>
          <h2 className="serif font-bold text-[34px] leading-[0.95] mt-1 mb-4 tracking-tight">
            CPM2 vehicle catalogue
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
              Filters{nf ? " · " + nf : ""}
            </button>
          </div>
          <div className="hs mt-3 px-4 gap-2 flex-wrap" style={{ scrollPaddingLeft: "16px" }}>
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
                <span className="text-[11.5px]" dangerouslySetInnerHTML={{ __html: ICONS.tag }} />
                On offer
              </>,
              promo,
              () => setPromo(!promo),
            )}
          </div>

          {fopen && (
            <div className="fp mt-4 px-4">
              <div className="rounded-[20px] border border-border bg-secondary/40 p-4 flex flex-col gap-5">
                <div>
                  <label className="l flex justify-between mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Price <b id="mxl" className="text-gold">
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
                  <label className="l block mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
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
                  <label className="l block mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Stock
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
                <div className="flex gap-[8px] pt-1 border-t border-border">
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

          <div id="res" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 px-4">
            {sorted.length ? (
              sorted.map((c, index) => (
                <Link
                  key={c.id}
                  href={`/store/products/${c.id}`}
                  className="product-card group block col-span-1"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="relative overflow-hidden rounded-[24px] border border-border mb-4 aspect-[4/5]">
                    <img
                      src={coverImageFromName(c.name, 200, 260)}
                      alt={c.name}
                      className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${c.stockQuantity === 0 ? "out-of-stock-media" : ""}`}
                      loading="lazy"
                      decoding="async"
                      width={200}
                      height={260}
                      style={{ objectFit: "cover", display: "block" }}
                    />
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {c.stockQuantity === 0 && (
                        <span className="vanta-card-badge out">Out of stock</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 px-1">
                    <h4 className="font-bold text-sm text-ink leading-snug">{c.name}</h4>
                    <div className="flex items-baseline flex-wrap gap-2 mt-2">
                      <HeartToggle productId={c.id} />
                      <span className="price-primary text-base font-bold tabular-nums">
                        {formatPrice(c.basePriceCents, c.currency)}
                      </span>
                      <span
                        className={`stock-indicator ${stockTier(c.stockQuantity, c.stockInitial ?? 0)}`}>
                        {stockLabel(c.stockQuantity, stockTier(c.stockQuantity, c.stockInitial ?? 0))}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty text-center py-10 text-muted-foreground stagger-item col-span-5">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2 block">search</span>
                <p>No vehicles match your filters.</p>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  </StoreShell>
  );
}
