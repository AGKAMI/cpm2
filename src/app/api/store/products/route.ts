/**
 * VANTA GARAGE — product catalogue API.
 * GET /api/store/products?q=...&featured=1
 */

import { fail, ok } from "@/lib/route";
import {
  searchProducts,
  listProducts,
  listCategories,
} from "@/lib/store/products";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Public: the storefront browses this catalogue from any browser —
    // no Telegram Mini App required. Only mutations are gated.
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const featured = url.searchParams.get("featured") === "1";

    const products = featured
      ? await listProducts({ onlyPublished: true, featuredOnly: true })
      : q
      ? await searchProducts(q)
      : await listProducts({ onlyPublished: true });

    return ok({ products, total: products.length });
  } catch (err) {
    return fail(err);
  }
}
