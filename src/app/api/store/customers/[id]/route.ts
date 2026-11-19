/**
 * VANTA GARAGE — one customer record.
 * PATCH /api/store/customers/[id] — update your own profile fields.
 *
 * ProfileClient.saveCpm2Id() has always called this route to save the CPM2
 * (in-game) ID, and the route never existed: the request 404'd on prod, so the
 * profile's CPM2 ID field silently never saved. Scoped the same way as the
 * notifications routes - the signed session must match the URL id.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStoreDb } from "@/lib/store-db";
import { verifySessionToken, readRequestCookie, SESSION_COOKIE } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  playerId: z.string().trim().min(1).max(64).optional(),
  inGameName: z.string().trim().min(1).max(120).optional(),
  currencyPref: z.string().trim().length(3).optional(),
  notificationsEnabled: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const customerId = Number(id);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json(
        { error: { code: "invalid_id", message: "Invalid customer id." } },
        { status: 400 },
      );
    }

    const sessionToken = readRequestCookie(request, SESSION_COOKIE);
    const sessionUserId = verifySessionToken(sessionToken);
    if (!sessionUserId || sessionUserId !== customerId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authorized" } },
        { status: 401 },
      );
    }

    const body = patchSchema.parse(await request.json());
    const sets: string[] = [];
    const args: unknown[] = [];

    if (body.playerId !== undefined) {
      sets.push("player_id = ?");
      args.push(body.playerId);
    }
    if (body.inGameName !== undefined) {
      sets.push("in_game_name = ?");
      args.push(body.inGameName);
    }
    if (body.currencyPref !== undefined) {
      sets.push("currency_pref = ?");
      args.push(body.currencyPref);
    }
    if (body.notificationsEnabled !== undefined) {
      sets.push("notifications_enabled = ?");
      args.push(body.notificationsEnabled ? 1 : 0);
    }

    if (sets.length === 0) {
      return NextResponse.json(
        { error: { code: "nothing_to_update", message: "No fields to update." } },
        { status: 400 },
      );
    }

    const db = await getStoreDb();
    // Only ever update YOUR row: the session check above is the ownership gate.
    await db.execute({
      sql: `UPDATE vanta_customers SET ${sets.join(", ")} WHERE id = ?`,
      args: [...args, customerId],
    });

    const row = (
      await db.execute({
        sql: "SELECT id, in_game_name, player_id, currency_pref, notifications_enabled FROM vanta_customers WHERE id = ?",
        args: [customerId],
      })
    ).rows[0];

    return NextResponse.json({
      id: Number(row.id),
      inGameName: String(row.in_game_name ?? ""),
      playerId: String(row.player_id ?? ""),
      currencyPref: String(row.currency_pref ?? "ZAR"),
      notificationsEnabled: Number(row.notifications_enabled ?? 1) === 1,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "Some fields need fixing." } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: err instanceof Error ? err.message : "Update failed." } },
      { status: 500 },
    );
  }
}
