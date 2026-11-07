/**
 * VANTA GARAGE — product media list.
 * GET /api/store/media?productId=X
 * Returns published media for a product (image URLs for the storefront).
 */

import { ok, fail, readJson } from "@/lib/route";
import { listMedia } from "@/lib/store/products";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    if (!productId) {
      return fail({ status: 400, body: { error: { code: "missing_product_id", message: "productId required." } } });
    }
    const media = await listMedia(Number(productId));
    return ok({ media });
  } catch (err) {
    return fail(err);
  }
}
