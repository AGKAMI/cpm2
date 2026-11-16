/**
 * VANTA GARAGE — cart service.
 * Per-customer cart for bulk purchases. Items reference published products;
 * quantities are capped by live stock at read/add time (stock is still
 * reserved per-order at checkout, same as single-item checkout).
 */

import { getStoreDb } from "../store-db.ts";
import { getProduct, listCoverImageMap } from "./products.ts";
import { ApiError } from "../api.ts";

export type CartItem = {
  productId: number;
  name: string;
  coverImage: string | null;
  basePriceCents: number;
  currency: string;
  stockQuantity: number;
  quantity: number;
  exclusivity: string;
  addedAt: string;
};

export type CartSummary = {
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  currency: string;
};

const MAX_QTY_PER_PRODUCT = 5;

export async function getCart(customerId: number): Promise<CartSummary> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `
      SELECT c.product_id, c.quantity, c.created_at,
             p.name, p.base_price_cents, p.currency, p.stock_quantity,
             p.is_published, p.exclusivity
      FROM vanta_cart_items c
      JOIN vanta_products p ON c.product_id = p.id
      WHERE c.customer_id = ?
      ORDER BY c.created_at DESC
    `,
    args: [customerId],
  });

  const rows = result.rows;
  let items: CartItem[] = rows.map((row) => ({
    productId: Number(row.product_id),
    name: String(row.name ?? ""),
    coverImage: null,
    basePriceCents: Number(row.base_price_cents ?? 0),
    currency: String(row.currency ?? "ZAR"),
    stockQuantity: Number(row.stock_quantity ?? 0),
    quantity: Math.max(1, Number(row.quantity ?? 1)),
    exclusivity: String(row.exclusivity ?? "standard"),
    addedAt: String(row.created_at ?? ""),
  }));

  // One batched query for covers (same pattern as the store home page).
  if (items.length > 0) {
    const covers = await listCoverImageMap(items.map((i) => i.productId));
    items = items.map((i) => ({
      ...i,
      coverImage: covers.get(i.productId) ?? null,
    }));
  }

  const subtotalCents = items.reduce(
    (sum, i) => sum + i.basePriceCents * i.quantity,
    0,
  );

  return {
    items,
    itemCount: items.length,
    subtotalCents,
    currency: items[0]?.currency ?? "ZAR",
  };
}

export async function addToCart(
  customerId: number,
  productId: number,
  quantity = 1,
): Promise<CartSummary> {
  const product = await getProduct(productId);
  if (!product || !product.isPublished) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  }
  if (product.stockQuantity <= 0) {
    throw new ApiError(400, "OUT_OF_STOCK", "This vehicle is sold out.");
  }

  const db = await getStoreDb();
  const now = new Date().toISOString();
  const cap = Math.min(MAX_QTY_PER_PRODUCT, product.stockQuantity);
  const qty = Math.max(1, Math.min(quantity, cap));

  await db.execute({
    sql: `
      INSERT INTO vanta_cart_items (customer_id, product_id, quantity, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (customer_id, product_id)
      DO UPDATE SET
        quantity = MIN(vanta_cart_items.quantity + excluded.quantity, ?),
        updated_at = excluded.updated_at
    `,
    args: [customerId, productId, qty, now, now, cap],
  });

  return getCart(customerId);
}

export async function updateCartQuantity(
  customerId: number,
  productId: number,
  quantity: number,
): Promise<CartSummary> {
  const db = await getStoreDb();
  if (quantity <= 0) {
    return removeFromCart(customerId, productId);
  }
  const product = await getProduct(productId);
  const capped = Math.max(
    1,
    Math.min(quantity, MAX_QTY_PER_PRODUCT, product?.stockQuantity ?? 1),
  );
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `
      UPDATE vanta_cart_items
      SET quantity = ?, updated_at = ?
      WHERE customer_id = ? AND product_id = ?
    `,
    args: [capped, now, customerId, productId],
  });
  if (result.affectedRowCount === 0) {
    throw new ApiError(404, "CART_ITEM_NOT_FOUND", "Item is not in your cart.");
  }
  return getCart(customerId);
}

export async function removeFromCart(
  customerId: number,
  productId: number,
): Promise<CartSummary> {
  const db = await getStoreDb();
  await db.execute({
    sql: `DELETE FROM vanta_cart_items WHERE customer_id = ? AND product_id = ?`,
    args: [customerId, productId],
  });
  return getCart(customerId);
}

export async function clearCart(customerId: number): Promise<void> {
  const db = await getStoreDb();
  await db.execute({
    sql: `DELETE FROM vanta_cart_items WHERE customer_id = ?`,
    args: [customerId],
  });
}

export async function cartCount(customerId: number): Promise<number> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS cnt FROM vanta_cart_items WHERE customer_id = ?`,
    args: [customerId],
  });
  // Turso rows decode as strings here — coerce to a number
  return Number(result.rows[0]?.cnt ?? 0);
}
