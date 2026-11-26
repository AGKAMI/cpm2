/**
 * VANTA GARAGE — link Player ID manually (web guest).
 * POST /api/store/customers/link-player-id
 * Body: { playerId: string }
 *
 * Links a manually-entered Player ID to a customer record.
 * Used when opening the store in a web browser (no Telegram WebApp initData).
 */

import { fail, ok, readJson } from "@/lib/route";
import { createCustomer, getCustomerByPlayerId } from "@/lib/store/customers";
import { trustedClientIp } from "@/lib/auth";
import { checkDurableRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Public by design (guest onboarding in a browser with no Telegram
    // initData), but an unauthenticated caller could otherwise create customer
    // rows at will and probe whether a given playerId is already linked.
    // Proven on prod before this guard: a bare POST created customer #28.
    const ip = trustedClientIp(request);
    if (await checkDurableRateLimit(`link-player-id:${ip}`, 20, 60_000)) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many attempts - wait a minute and try again." } },
        { status: 429 },
      );
    }

    const body = (await readJson(request)) as { playerId?: string };
    const playerId = body.playerId?.trim();

    if (!playerId) {
      return NextResponse.json(
        { error: { code: "INVALID_PLAYER_ID", message: "Please enter a valid Player ID." } },
        { status: 400 },
      );
    }

    // Check if this Player ID is already linked to a customer
    const existing = await getCustomerByPlayerId(playerId);

    if (existing) {
      return ok({
        customerId: existing.id,
        inGameName: existing.inGameName,
        playerId: existing.playerId,
        message: "Player ID already linked to this account.",
      });
    }

    // Create a new customer linked to this Player ID
    const created = await createCustomer({
      inGameName: `Player ${playerId}`,
      playerId,
      currencyPref: "ZAR",
    });

    return ok({
      customerId: created.id,
      inGameName: created.inGameName,
      playerId: created.playerId,
      message: "Player ID linked successfully.",
    });
  } catch (err) {
    return fail(err);
  }
}
