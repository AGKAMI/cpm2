/**
 * VANTA GARAGE — customer wishlist item removal.
 * DELETE /api/store/wishlist/[id] — remove a wishlist item by product ID.
 * Customer-gated via requireStoreCustomer.
 */

import { fail, ok } from "@/lib/route";
import { requireStoreCustomer } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const customer = await requireStoreCustomer(request);
    const db = await getStoreDb();

    const { id } = await params;
    const productId = Number(id);
    if (!productId) {
      return fail({ status: 400, body: { error: { code: "missing_product_id", message: "productId required." } } });
    }

    await db.execute({
      sql: `DELETE FROM vanta_wishlist WHERE customer_id = ? AND product_id = ?`,
      args: [customer.customer.id, productId],
    });

    return ok({ removed: true });
  } catch (err) {
    return fail(err);
  }
}
