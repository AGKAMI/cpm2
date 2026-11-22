/**
 * VANTA GARAGE — daily activity feed.
 * GET /api/store/activity — today's verified purchases (UTC day), enriched
 * with masked customer name (Telegram username or in-game name) and product name.
 * Public endpoint — social proof, no sensitive data exposed.
 */

import { fail, ok } from "@/lib/route";
import { getStoreDb } from "@/lib/store-db";

export const dynamic = "force-dynamic";

interface ActivityItem {
  customerName: string; // pre-masked server-side: first 2 + ••• + last 2
  productName: string;
  amountCents: number;
  currency: string;
  createdAt: string;
}

function maskName(name: string): string {
  const len = name.length;
  if (len <= 3) return name;
  return name.slice(0, 2) + "•••" + name.slice(len - 2);
}

export async function GET(request: Request) {
  try {
    const db = await getStoreDb();

    // Today's window in UTC (server time).
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ).toISOString();
    const todayEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    ).toISOString();

    const result = await db.execute({
      sql: `
        SELECT
          o.amount_cents,
          o.currency,
          o.created_at,
          c.in_game_name,
          pi.platform_username AS telegram_username,
          p.name AS product_name
        FROM vanta_orders o
        LEFT JOIN vanta_customers c ON o.customer_id = c.id
        LEFT JOIN vanta_platform_identities pi
          ON c.id = pi.customer_id AND pi.platform = 'telegram'
        LEFT JOIN vanta_products p ON o.product_id = p.id
        WHERE o.created_at >= ? AND o.created_at < ?
          AND o.payment_state = 'verified'
        ORDER BY o.created_at DESC
        LIMIT 50
      `,
      args: [todayStart, todayEnd],
    });

    const activities: ActivityItem[] = (result.rows as unknown[]).map(
      (row) => {
        const r = row as Record<string, unknown>;
        const tg = (r.telegram_username as string | null)?.trim();
        const ign = (r.in_game_name as string | null)?.trim();
        const rawName = tg || ign || "Customer";
        return {
          customerName: maskName(rawName),
          productName: (r.product_name as string | null) ?? "Vehicle",
          amountCents: Number(r.amount_cents),
          currency: (r.currency as string) ?? "ZAR",
          createdAt: r.created_at as string,
        };
      },
    );

    return ok({ activities });
  } catch (err) {
    return fail(err);
  }
}
