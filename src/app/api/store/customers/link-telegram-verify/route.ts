/**
 * VANTA GARAGE — Telegram link verification gate.
 * POST /api/store/customers/link-telegram-verify
 * Body: { telegramId: string, customerId: number }
 *
 * Creates a pending verification record (2-minute expiry) and sends a
 * warning/cautious DM to the entered Telegram ID with inline keyboard
 * buttons ("Yes it's me" / "No it's not me"). Returns { verificationId }.
 *
 * The bot must have its webhook set to /api/telegram/webhook for the
 * button callbacks to be received. See setWebhook below.
 */

import { NextRequest, NextResponse } from "next/server";
import { readJson } from "@/lib/route";
import { telegramBotToken } from "@/lib/telegram";
import { getStoreDb } from "@/lib/store-db";
import { currentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VERIFICATION_WINDOW_SECONDS = 120; // 2 minutes

function makeCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I
  let code = "";
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** Send a Telegram message with inline keyboard buttons. */
async function sendTelegramMessageWithKeyboard(
  token: string,
  chatId: number | string,
  text: string,
  buttons: { text: string; callback_data: string }[][],
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: buttons },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await readJson(request)) as { telegramId?: string; customerId?: number };
    const telegramUserId = body.telegramId?.trim();
    const customerId = body.customerId;

    if (!telegramUserId || !/^\d+$/.test(telegramUserId)) {
      return NextResponse.json(
        { error: { code: "INVALID_TELEGRAM_ID", message: "Please enter a valid Telegram ID (numbers only)." } },
        { status: 400 },
      );
    }

    const sessionUserId = currentUserId(request);
    if (!sessionUserId || sessionUserId !== customerId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "You must be logged in to link a Telegram ID." } },
        { status: 401 },
      );
    }

    const token = telegramBotToken();
    if (!token) {
      return NextResponse.json(
        { error: { code: "BOT_NOT_CONFIGURED", message: "Telegram bot is not configured." } },
        { status: 500 },
      );
    }

    const db = await getStoreDb();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + VERIFICATION_WINDOW_SECONDS * 1000);
    const code = makeCode();

    // Create pending verification record
    const result = await db.execute({
      sql: `INSERT INTO vanta_telegram_verifications
            (customer_id, telegram_user_id, verification_code, status, expires_at, created_at)
            VALUES (?, ?, ?, 'pending', ?, ?)`,
      args: [
        customerId,
        telegramUserId,
        code,
        expiresAt.toISOString(),
        now.toISOString(),
      ],
    });
    const verificationId = Number(result.lastInsertRowid);
    if (verificationId === null) throw new Error("Verification insert returned no id");

    // Build the warning/cautious DM
    const warningText = `
🚨 <b>VANTA GARAGE — Link Verification</b> 🚨

Someone is trying to link Telegram ID <code>${telegramUserId}</code> to a VANTA GARAGE store account on the web.

<b>If this is YOU:</b> Click "Yes, it's me" below to confirm the link.

<b>If this is NOT YOU:</b> Click "No, it's not me" to reject. Your Telegram ID will NOT be linked to any account, and no action will be taken against you.

⚠️ <b>This verification expires in 2 minutes.</b> If you do nothing, the link request will expire automatically.

You received this because someone entered your Telegram ID on vanta-garage.store. If you never did this, simply ignore this message — the request will expire.
    `.trim();

    const buttons = [
      [
        { text: "✅ Yes, it's me", callback_data: `tg_verify_yes_${verificationId}` },
        { text: "❌ No, it's not me", callback_data: `tg_verify_no_${verificationId}` },
      ],
    ];

    const sent = await sendTelegramMessageWithKeyboard(token, telegramUserId, warningText, buttons);

    return NextResponse.json({
      verificationId,
      messageSent: sent,
      expiresInSeconds: VERIFICATION_WINDOW_SECONDS,
    });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json(
      { error: { code: "VERIFY_FAILED", message: "Could not start verification." } },
      { status: 500 },
    );
  }
}
