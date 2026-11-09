/** VANTA GARAGE — admin dashboard alerts API.
 * GET /api/store/admin/dashboard/alerts — critical alerts requiring attention.
 * Admin-gated via requireStoreAdmin.
 */

import { fail, ok } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { getStoreDb } from "../../../../../../lib/store-db.ts";

export const dynamic = "force-dynamic";

type Alert = {
  id: string;
  type: "payment_rejected" | "low_stock" | "out_of_stock" | "expired_reservation";
  severity: "high" | "medium";
  title: string;
  description: string;
  entityId: string;
  createdAt: string;
};

export async function GET(request: Request) {
  try {
    await requireStoreAdmin(request);
    const db = await getStoreDb();
    const alerts: Alert[] = [];

    // Rejected payments needing attention
    const rejected = await db.execute({
      sql: `SELECT id, amount_cents, currency, player_id, in_game_name, updated_at
            FROM vanta_orders
            WHERE payment_state = 'rejected'
            ORDER BY updated_at DESC
            LIMIT 10`,
      args: [],
    });
    for (const row of rejected.rows as Record<string, unknown>[]) {
      alerts.push({
        id: `rej_${String(row.id)}`,
        type: "payment_rejected",
        severity: "high",
        title: "Payment rejected",
        description: `EFT payment for ${String(row.in_game_name)} (${String(row.player_id)}) was rejected. Review proof or contact customer.`,
        entityId: String(row.id),
        createdAt: String(row.updated_at),
      });
    }

    // Expired reservations (awaiting_payment with past reserved_until)
    const now = new Date().toISOString();
    const expired = await db.execute({
      sql: `SELECT id, player_id, in_game_name, reserved_until
            FROM vanta_orders
            WHERE order_state = 'awaiting_payment'
              AND payment_state = 'pending'
              AND reserved_until < ?
            ORDER BY reserved_until DESC
            LIMIT 10`,
      args: [now],
    });
    for (const row of expired.rows as Record<string, unknown>[]) {
      alerts.push({
        id: `exp_${String(row.id)}`,
        type: "expired_reservation",
        severity: "medium",
        title: "Reservation expired",
        description: `Order for ${String(row.in_game_name)} (${String(row.player_id)}) — reservation lapsed without payment. Stock released.`,
        entityId: String(row.id),
        createdAt: String(row.reserved_until),
      });
    }

    // Low stock products (published, stock between 1 and 2)
    const lowStock = await db.execute({
      sql: `SELECT id, name, stock_quantity
            FROM vanta_products
            WHERE is_published = 1 AND stock_quantity > 0 AND stock_quantity <= 2
            ORDER BY stock_quantity ASC
            LIMIT 10`,
      args: [],
    });
    for (const row of lowStock.rows as Record<string, unknown>[]) {
      alerts.push({
        id: `ls_${String(row.id)}`,
        type: "low_stock",
        severity: "medium",
        title: "Low stock",
        description: `${String(row.name)} has only ${String(row.stock_quantity)} unit(s) left. Restock soon.`,
        entityId: String(row.id),
        createdAt: "",
      });
    }

    // Out of stock products (published, stock = 0)
    const outOfStock = await db.execute({
      sql: `SELECT id, name
            FROM vanta_products
            WHERE is_published = 1 AND stock_quantity = 0
            ORDER BY name ASC
            LIMIT 10`,
      args: [],
    });
    for (const row of outOfStock.rows as Record<string, unknown>[]) {
      alerts.push({
        id: `oos_${String(row.id)}`,
        type: "out_of_stock",
        severity: "high",
        title: "Out of stock",
        description: `${String(row.name)} is out of stock. Customers cannot purchase.`,
        entityId: String(row.id),
        createdAt: "",
      });
    }

    // Sort by severity (high first) then by createdAt
    alerts.sort((a, b) => {
      const sevOrder = { high: 0, medium: 1 };
      const sa = sevOrder[a.severity];
      const sb = sevOrder[b.severity];
      if (sa !== sb) return sa - sb;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

    return ok({ alerts });
  } catch (err) {
    return fail(err);
  }
}
