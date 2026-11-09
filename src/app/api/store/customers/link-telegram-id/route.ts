/**
 * VANTA GARAGE — link Telegram ID manually (web guest).
 * POST /api/store/customers/link-telegram-id
 * Body: { telegramId: string }
 *
 * Links a manually-entered Telegram ID to a customer record.
 * Used when opening the store in a web browser (no Telegram WebApp initData).
 */

import { fail, ok, readJson } from "@/lib/route";
import { telegramBotToken } from "@/lib/telegram";
import { getCustomerByPlayerId, getCustomerByPlatformIdentity, linkPlatformIdentity, updateCustomer } from "@/lib/store/customers";
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

    // Verify the Telegram ID exists via Telegram's Bot API (getUser).
    // Advisory only — never blocks linking on Telegram API failure
    // (bad token, rate limit, network, etc.). On success, grab the real
    // Telegram username for the customer's display name.
    const token = telegramBotToken();
    let tgDisplayName: string | null = null;
    if (token) {
      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${token}/getUser?user_id=${encodeURIComponent(telegramUserId)}`,
        );
        const tgData = await tgRes.json();
        if (tgData.ok && tgData.result) {
          const { username, first_name, last_name } = tgData.result;
          tgDisplayName =
            username ?? first_name ?? last_name ?? `tg_${telegramUserId}`;
        }
      } catch {
        // Network error — proceed to link anyway.
      }
    }

    // Check if this Telegram ID is already linked to a customer
    const existing = await getCustomerByPlatformIdentity("telegram", telegramUserId);

    if (existing) {
      // If they linked before with a placeholder tg_XXX name, update to real name
      if (existing.customer.inGameName.startsWith("tg_") && tgDisplayName) {
        await updateCustomer(existing.customer.id, { inGameName: tgDisplayName });
      }
      return ok({
        customerId: existing.customer.id,
        inGameName: tgDisplayName ?? existing.customer.inGameName,
        message: "Telegram already linked to this account.",
      });
    }

    // Check if there's an existing customer via guest playerId
    // We can't know which customer this is without some identifier,
    // so create a new customer linked to this Telegram ID.
    const { createCustomer } = await import("@/lib/store/customers");
    const created = await createCustomer({
      inGameName: tgDisplayName ?? `tg_${telegramUserId}`,
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
