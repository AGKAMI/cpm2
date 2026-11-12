/**
 * VANTA GARAGE — Telegram bot webhook.
 * POST /api/telegram/webhook
 *
 * Receives updates from the Telegram Bot API (inline keyboard button
 * callbacks from the link verification gate). Sets the webhook via
 * setWebhook on first call or manually.
 */

import { NextRequest, NextResponse } from "next/server";
import { readJson } from "@/lib/route";
import { telegramBotToken } from "@/lib/telegram";
import { getStoreDb } from "@/lib/store-db";
import { linkPlatformIdentity } from "@/lib/store/customers";

export const dynamic = "force-dynamic";

/** Answer a callback_query to remove the "loading" state on the button. */
async function answerCallbackQuery(token: string, callbackQueryId: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  } catch {
    // Non-fatal
  }
}

/** Send a follow-up message to the user after they click a button. */
async function sendFollowup(token: string, chatId: number | string, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // Non-fatal
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await readJson(request)) as Record<string, unknown>;
    const token = telegramBotToken();
    if (!token) {
      return NextResponse.json({ error: { code: "BOT_NOT_CONFIGURED" } }, { status: 500 });
    }

    // Handle callback_query from inline keyboard buttons
    if (body.callback_query) {
      const { id: callbackQueryId, data, from, message } = body.callback_query as { id: string; data: string; from: { id: number }; message: { chat: { id: number } } };
      const chatId = message?.chat?.id ?? from.id;

      await answerCallbackQuery(token, callbackQueryId);

      const yesPrefix = "tg_verify_yes_";
      const noPrefix = "tg_verify_no_";

      if (data && data.startsWith(yesPrefix)) {
        const verificationId = Number(data.slice(yesPrefix.length));
        const db = await getStoreDb();

        const result = await db.execute({
          sql: `SELECT status, customer_id, telegram_user_id, expires_at
                FROM vanta_telegram_verifications
                WHERE id = ?`,
          args: [verificationId],
        });

        if (result.rows.length > 0) {
          const row = result.rows[0];
          const now = new Date();
          if (String(row.status) === "pending" && new Date(String(row.expires_at)) > now) {
            await db.execute({
              sql: `UPDATE vanta_telegram_verifications SET status = 'confirmed', confirmed_at = ? WHERE id = ?`,
              args: [now.toISOString(), verificationId],
            });

            // Perform the actual link (relinkable — replaces any existing binding)
            const customerId = Number(row.customer_id);
            await linkPlatformIdentity(customerId, "telegram", String(row.telegram_user_id), "");

            await sendFollowup(token, chatId, `✅ <b>Linked!</b> Your Telegram ID <code>${row.telegram_user_id}</code> is now linked to your VANTA GARAGE web account.`);
            return NextResponse.json({ ok: true });
          } else {
            await sendFollowup(token, chatId, "⏰ <b>Expired.</b> This verification request has already expired. Start a new link from the store profile page.");
            return NextResponse.json({ ok: true });
          }
        }
      } else if (data && data.startsWith(noPrefix)) {
        const verificationId = Number(data.slice(noPrefix.length));
        const db = await getStoreDb();

        await db.execute({
          sql: `UPDATE vanta_telegram_verifications SET status = 'rejected' WHERE id = ?`,
          args: [verificationId],
        });

        await sendFollowup(token, chatId, "❌ <b>Rejected.</b> The link request was cancelled. No Telegram ID was linked to any account.");
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: { code: "WEBHOOK_FAILED", message: String(err) } }, { status: 500 });
  }
}
