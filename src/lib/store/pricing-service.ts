/**
 * VANTA GARAGE — Multi-currency pricing service.
 *
 * Products carry a base price in ZAR (basePriceCents). Additional currency
 * pricing is stored in vanta_product_pricing with exchange rates that are
 * preserved at order time so historical prices never drift when rates change.
 *
 * All amounts are stored/returned in cents (minor currency unit).
 */

import { getStoreDb } from "../store-db";

export type ProductPrice = {
  id: number;
  productId: number;
  currency: string;
  priceCents: number;
  exchangeRate: number | null; // 1 base currency unit = exchangeRate of this currency
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
};

function rowToPricing(row: Record<string, unknown>): ProductPrice {
  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    currency: String(row.currency ?? "ZAR"),
    priceCents: Number(row.price_cents ?? 0),
    exchangeRate: row.exchange_rate === null || row.exchange_rate === undefined ? null : Number(row.exchange_rate),
    effectiveFrom: String(row.effective_from ?? ""),
    effectiveTo: row.effective_to === null || row.effective_to === undefined ? null : String(row.effective_to),
    createdAt: String(row.created_at ?? ""),
  };
}

export async function getProductPrices(productId: number): Promise<ProductPrice[]> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_product_pricing WHERE product_id = ? ORDER BY currency ASC`,
    args: [productId],
  });
  return result.rows.map(rowToPricing);
}

export async function createPrice(input: {
  productId: number;
  currency: string;
  priceCents: number;
  exchangeRate: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}): Promise<ProductPrice> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO vanta_product_pricing (product_id, currency, price_cents, exchange_rate, effective_from, effective_to, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [input.productId, input.currency, input.priceCents, input.exchangeRate ?? null, input.effectiveFrom, input.effectiveTo ?? null, now],
  });
  const id = result.lastInsertRowid;
  if (id === null) throw new Error("Product pricing insert returned no id");
  return rowToPricing({ id, product_id: input.productId, currency: input.currency, price_cents: input.priceCents, exchange_rate: input.exchangeRate, effective_from: input.effectiveFrom, effective_to: input.effectiveTo ?? null, created_at: now });
}

export async function getPriceForProduct(productId: number, currency: string, at?: string): Promise<ProductPrice | null> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const atOrNow = at ?? now;
  const result = await db.execute({
    sql: `SELECT * FROM vanta_product_pricing
          WHERE product_id = ? AND currency = ?
            AND effective_from <= ?
            AND (effective_to IS NULL OR effective_to >= ?)
          ORDER BY effective_from DESC
          LIMIT 1`,
    args: [productId, currency, atOrNow, atOrNow],
  });
  if (result.rows.length === 0) return null;
  return rowToPricing(result.rows[0]);
}

export async function convertPrice(amountCents: number, fromCurrency: string, toCurrency: string, exchangeRate?: number): Promise<number> {
  if (fromCurrency === toCurrency) return amountCents;
  // If no exchange rate provided, we cannot convert - return original
  if (!exchangeRate) return amountCents;
  // exchangeRate = 1 fromCurrency unit = exchangeRate toCurrency units
  return Math.round(amountCents * exchangeRate);
}

export async function getPriceInCurrency(productId: number, currency: string, at?: string): Promise<{ priceCents: number; exchangeRate: number | null; currency: string } | null> {
  const productPrice = await getPriceForProduct(productId, currency, at);
  if (!productPrice) return null;
  return {
    priceCents: productPrice.priceCents,
    exchangeRate: productPrice.exchangeRate,
    currency: productPrice.currency,
  };
}