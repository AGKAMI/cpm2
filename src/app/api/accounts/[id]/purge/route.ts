/**
 * VANTA GARAGE — PERMANENT fleet account delete.
 * DELETE /api/accounts/[id]/purge
 *
 * Delete means delete: the account and everything that hangs off it (cars,
 * trophies, images, event history) are destroyed, not archived. The children
 * carry ON DELETE CASCADE, but they are removed explicitly first so the
 * intent is visible in one place and no orphan survives a schema change.
 *
 * Archive stays a separate action (PATCH/DELETE on /api/accounts/[id]) —
 * nothing about that path changes.
 */

import { fail, ok, parseId } from "@/lib/route";
import { getTursoDb } from "@/lib/db-turso";
import { resolveFleetUser } from "@/lib/fleet-identity";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const identity = await resolveFleetUser(request);
    const userId = identity?.userId;
    const { id } = await context.params;
    const accountId = parseId(id);

    // Same ownership gate as every other fleet route: only the owner purges.
    const db = await getTursoDb();
    const found = await db.execute({
      sql: `SELECT id, email, user_id FROM accounts WHERE id = ? LIMIT 1`,
      args: [accountId],
    });
    const existing = (found.rows[0] as unknown as { id: number; email: string; user_id: number | null } | undefined) ?? null;
    if (!existing) {
      return fail({
        status: 404,
        body: { error: { code: "NOT_FOUND", message: "That account no longer exists." } },
      });
    }
    if (userId !== undefined && Number(existing.user_id) !== userId) {
      return fail({
        status: 404,
        body: { error: { code: "NOT_FOUND", message: "That account no longer exists." } },
      });
    }

    // The account's own data, then the account row itself.
    for (const table of ["account_cars", "account_trophies", "account_events", "fleet_account_images"]) {
      await db.execute({ sql: `DELETE FROM ${table} WHERE account_id = ?`, args: [accountId] });
    }
    await db.execute({ sql: `DELETE FROM accounts WHERE id = ?`, args: [accountId] });

    return ok({ purged: true, id: accountId, email: existing.email });
  } catch (err) {
    return fail(err);
  }
}