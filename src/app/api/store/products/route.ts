/**
 * VANTA GARAGE — product catalogue API.
 * GET /api/store/products?q=...&featured=1
 */

import { fail, ok } from "@/lib/route";
import {
  searchProducts,
  listProducts,
  listGalleryMap,
  listCoverImageMap,
} from "@/lib/store/products";
import { approxStarsForCents, discountedPriceCents, hasDiscount } from "@/lib/store/pricing";
import { zarPerStar } from "@/lib/store/stars";

export const dynamic = "force-dynamic";

/** Media rows hold the URL exactly as admin upload stored it — usually the
 *  relative /api/store/admin/uploads path. Bots (WhatsApp/Telegram) fetch
 *  images themselves, so they need an ABSOLUTE URL; the storefront next/image
 *  can use either. Data-URL media (legacy rows) can never be fetched by a bot
 *  — it is dropped rather than shipped as a fake URL. */
function absoluteImageUrl(raw: string, origin: string): string | null {
  if (!raw) return null;
  if (raw.startsWith("https://")) return raw;
  if (raw.startsWith("http://")) return raw;
  if (raw.startsWith("data:")) return null;
  if (!raw.startsWith("/")) return null;
  return `${origin}${raw}`;
}

export async function GET(request: Request) {
  try {
    // Public: the storefront browses this catalogue from any browser —
    // no Telegram Mini App required. Only mutations are gated.
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const featured = url.searchParams.get("featured") === "1";
    // Bots browse per-game: `?game=cpm1` / `?game=cpm2` (default: both).
    const game = url.searchParams.get("game");
    if (game && game !== "cpm1" && game !== "cpm2") {
      return fail({
        status: 400,
        body: { error: { code: "bad_game", message: "game must be cpm1 or cpm2." } },
      });
    }

    let products = featured
      ? await listProducts({ onlyPublished: true, featuredOnly: true })
      : q
      ? await searchProducts(q)
      : await listProducts({ onlyPublished: true });

    if (game) products = products.filter((p) => p.game === game);

    // Bot-facing enrichment — one cover query + one gallery query for the
    // whole page, not per product (each Turso round-trip is ~300ms).
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
    const ids = products.map((p) => p.id);
    const [covers, galleries] = await Promise.all([
      listCoverImageMap(ids),
      listGalleryMap(ids),
    ]);

    const enriched = products.map((p) => {
      const gallery = (galleries.get(p.id) ?? [])
        .map((u) => absoluteImageUrl(u, origin))
        .filter((u): u is string => u !== null);
      const coverRaw = covers.get(p.id) ?? p.imageUrl ?? "";
      const coverUrl = absoluteImageUrl(coverRaw, origin);
      const finalPrice = hasDiscount(p)
        ? discountedPriceCents(p.basePriceCents, p.discountPercent)
        : p.basePriceCents;
      return {
        ...p,
        coverUrl,
        galleryUrls: gallery.length > 0 ? gallery : coverUrl ? [coverUrl] : [],
        // Quote with the CONFIGURED rate (STARS_ZAR_PER_STAR), so the
        // catalogue, the invoice and the checkout hint all agree.
        starsPrice: approxStarsForCents(finalPrice, zarPerStar()),
      };
    });

    return ok({ products: enriched, total: enriched.length });
  } catch (err) {
    return fail(err);
  }
}
