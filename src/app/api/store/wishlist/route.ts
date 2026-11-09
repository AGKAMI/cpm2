/**
 * VANTA GARAGE — customer wishlist.
 * GET    /api/store/wishlist — customer's wishlist.
 * POST   /api/store/wishlist — add product to wishlist.
 * DELETE /api/store/wishlist — remove product from wishlist.
 * Customer-gated via requireStoreCustomer.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreCustomer } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";
import { z } from "zod";

const wishlistItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const customer = await requireStoreCustomer(request);
    const db = await getStoreDb();

    const result = await db.execute({
      sql: `
        SELECT w.product_id, w.created_at,
               p.name, p.base_price_cents, p.currency, p.is_published, p.stock_quantity
        FROM vanta_wishlist w
        JOIN vanta_products p ON w.product_id = p.id
        WHERE w.customer_id = ?
        ORDER BY w.created_at DESC
      `,
      args: [customer.customer.id],
    });

    const items = result.rows.map((row) => ({
      productId: Number(row.product_id),
      name: String(row.name ?? ""),
      basePriceCents: Number(row.base_price_cents ?? 0),
      currency: String(row.currency ?? "ZAR"),
      isPublished: Number(row.is_published ?? 0) === 1,
      stockQuantity: Number(row.stock_quantity ?? 0),
      addedAt: String(row.created_at ?? ""),
    }));

    return ok({ items });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const customer = await requireStoreCustomer(request);
    const db = await getStoreDb();

    const body = wishlistItemSchema.parse(await readJson(request));
    const now = new Date().toISOString();

    await db.execute({
      sql: `
        INSERT OR IGNORE INTO vanta_wishlist (customer_id, product_id, created_at)
        VALUES (?, ?, ?)
      `,
      args: [customer.customer.id, body.productId, now],
    });

    return ok({ added: true });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const customer = await requireStoreCustomer(request);
    const db = await getStoreDb();

    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    if (!productId) {
      return fail({ status: 400, body: { error: { code: "missing_product_id", message: "productId required." } } });
    }

    await db.execute({
      sql: `DELETE FROM vanta_wishlist WHERE customer_id = ? AND product_id = ?`,
      args: [customer.customer.id, Number(productId)],
    });

    return ok({ removed: true });
  } catch (err) {
    return fail(err);
  }
}
