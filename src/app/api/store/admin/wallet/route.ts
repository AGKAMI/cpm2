/**
 * VANTA GARAGE — admin wallet tool.
 * GET /api/store/admin/wallet?q= — every wallet balance (optionally filtered
 * by customer name / email / player id) plus the recent store-wide ledger.
 * Admin-gated: this is the "load balance" desk the support flow always
 * pointed at but never had.
 */

import { fail, ok } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStoreAdmin(request);
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const db = await getStoreDb();
    const like = `%${q}%`;

    const balances = await db.execute({
      sql: `SELECT w.customer_id, w.balance_cents, w.updated_at,
                   c.in_game_name, c.email, c.player_id
            FROM vanta_wallet w
            LEFT JOIN vanta_customers c ON c.id = w.customer_id
            WHERE (? = '' OR c.in_game_name LIKE ? OR c.email LIKE ? OR c.player_id LIKE ?)
            ORDER BY w.balance_cents DESC, w.customer_id DESC
            LIMIT 200`,
      args: [q, like, like, like],
    });

    const txns = await db.execute({
      sql: `SELECT t.id, t.customer_id, t.type, t.amount_cents, t.balance_after_cents,
                   t.status, t.reference, t.note, t.created_at,
                   c.in_game_name, c.email, c.player_id
            FROM vanta_wallet_txns t
            LEFT JOIN vanta_customers c ON c.id = t.customer_id
            ORDER BY datetime(t.created_at) DESC, t.id DESC
            LIMIT 100`,
      args: [],
    });

    return ok({
      balances: balances.rows.map((row) => ({
        customerId: String(row.customer_id),
        balanceCents: Number(row.balance_cents ?? 0),
        name: row.in_game_name === null ? null : String(row.in_game_name),
        email: row.email === null ? null : String(row.email),
        playerId: row.player_id === null ? null : String(row.player_id),
        updatedAt: String(row.updated_at ?? ""),
      })),
      transactions: txns.rows.map((row) => ({
        id: String(row.id),
        customerId: String(row.customer_id),
        type: String(row.type),
        amountCents: Number(row.amount_cents ?? 0),
        balanceAfterCents: Number(row.balance_after_cents ?? 0),
        status: String(row.status),
        reference: row.reference === null ? null : String(row.reference),
        note: row.note === null ? null : String(row.note),
        createdAt: String(row.created_at ?? ""),
        name: row.in_game_name === null ? null : String(row.in_game_name),
      })),
    });
  } catch (err) {
    return fail(err);
  }
}
