/**
 * VANTA GARAGE — Multi-currency pricing API.
 *
 * GET    /api/store/pricing?productId=X&currency=ZAR  — Get price in a specific currency
 * POST   /api/store/admin/products/:id/price          — Admin: set price in a currency
 *
 * Prices are stored in cents. Exchange rates: 1 base currency unit = exchangeRate of target currency.
 * Historical orders preserve the exchange rate at time of purchase.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { getPriceForProduct, createPrice, convertPrice } from "@/lib/store/pricing-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    const currency = url.searchParams.get("currency") ?? "ZAR";

    if (!productId) {
      return fail({ status: 400, body: { error: { code: "missing_product_id", message: "productId required." } } });
    }

    const price = await getPriceForProduct(Number(productId), currency);
    if (!price) {
      return fail({ status: 404, body: { error: { code: "price_not_found", message: "No price found for this product and currency." } } });
    }

    return ok({ productId: Number(productId), currency: price.currency, priceCents: price.priceCents, exchangeRate: price.exchangeRate });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireStoreAdmin(request);
    const body = (await request.json()) as Record<string, unknown>;

    const productId = Number(body.productId);
    const currency = String(body.currency ?? "ZAR");
    const priceCents = Number(body.priceCents);
    const exchangeRate = body.exchangeRate === undefined ? null : Number(body.exchangeRate);
    const effectiveFrom = String(body.effectiveFrom ?? new Date().toISOString());
    const effectiveTo = body.effectiveTo === undefined ? null : String(body.effectiveTo);

    if (!productId || !currency || priceCents === undefined) {
      return fail({ status: 400, body: { error: { code: "missing_fields", message: "productId, currency, and priceCents required." } } });
    }

    const price = await createPrice({ productId, currency, priceCents, exchangeRate, effectiveFrom, effectiveTo });
    return ok({ price }, 201);
  } catch (err) {
    return fail(err);
  }
}