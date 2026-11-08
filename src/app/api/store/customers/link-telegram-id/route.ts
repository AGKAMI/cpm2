/**
 * VANTA GARAGE — link Telegram ID manually (web guest).
 * POST /api/store/customers/link-telegram-id
 * Body: { telegramId: string }
 *
 * Links a manually-entered Telegram ID to a customer record.
 * Used when opening the store in a web browser (no Telegram WebApp initData).
 */

import { fail, ok, readJson } from "@/lib/route";
import { getCustomerByPlayerId, getCustomerByPlatformIdentity, linkPlatformIdentity } from "@/lib/store/customers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as { telegramId?: string };
    const telegramUserId = body.telegramId?.trim();

    if (!telegramUserId || !/^\d+$/.test(telegramUserId)) {
      return NextResponse.json(
        { error: { code: "INVALID_TELEGRAM_ID", message: "Please enter a valid Telegram ID (numbers only)." } },
        { status: 400 },
      );
    }

    // Check if this Telegram ID is already linked to a customer
    const existing = await getCustomerByPlatformIdentity("telegram", telegramUserId);

    if (existing) {
      return ok({
        customerId: existing.customer.id,
        inGameName: existing.customer.inGameName,
        message: "Telegram already linked to this account.",
      });
    }

    // Check if there's an existing customer via guest playerId
    // We can't know which customer this is without some identifier,
    // so create a new customer linked to this Telegram ID.
    const { createCustomer } = await import("@/lib/store/customers");
    const created = await createCustomer({
      inGameName: `tg_${telegramUserId}`,
      playerId: "",
      currencyPref: "ZAR",
    });

    await linkPlatformIdentity(created.id, "telegram", telegramUserId, "");

    return ok({
      customerId: created.id,
      inGameName: created.inGameName,
      message: "Telegram linked successfully.",
    });
  } catch (err) {
    return fail(err);
  }
}
