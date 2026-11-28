/**
 * VANTA GARAGE — link Telegram ID manually (web guest).
 * POST /api/store/customers/link-telegram-id
 * Body: { telegramId: string }
 *
 * Links a manually-entered Telegram ID to the SIGNED-IN customer record.
 * Used when opening the store in a web browser (no Telegram WebApp initData).
 * A store session is required; this route never creates one.
 */

import { fail, readJson } from "@/lib/route";
import { NextResponse } from "next/server";
import { telegramBotToken } from "@/lib/telegram";
import { getCustomerByPlatformIdentity } from "@/lib/store/customers";
import { currentStoreUserId } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";

export const dynamic = "force-dynamic";

const VERIFICATION_WINDOW_SECONDS = 120; // 2 minutes

function makeCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I
  let code = "";
  for (let i = 0; i < length; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** Send the Yes/No verification DM to the claimed Telegram id. The actual
 *  linkPlatformIdentity happens in the webhook on a confirmed "yes" — never
 *  here. */
async function sendVerificationDm(
  token: string,
  telegramUserId: string,
  customerId: number,
): Promise<number | null> {
  const db = await getStoreDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VERIFICATION_WINDOW_SECONDS * 1000);
  const code = makeCode();

  const result = await db.execute({
    sql: `INSERT INTO vanta_telegram_verifications
          (customer_id, telegram_user_id, verification_code, status, expires_at, created_at)
          VALUES (?, ?, ?, 'pending', ?, ?)`,
    args: [customerId, telegramUserId, code, expiresAt.toISOString(), now.toISOString()],
  });
  const verificationId = Number(result.lastInsertRowid);

  const text = `
🚨 <b>VANTA GARAGE — Link Verification</b> 🚨

Store account #${customerId} is asking to link Telegram ID <code>${telegramUserId}</code> to its VANTA GARAGE profile.

<b>If this is YOU:</b> Click "Yes, it's me" below to confirm the link to account #${customerId}.

<b>If this is NOT YOU:</b> Click "No, it's not me" to reject. Your Telegram ID will NOT be linked to any account, and no action will be taken against you.

<b>This verification expires in 2 minutes.</b> If you do nothing, the link request will expire automatically.
    `.trim();

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramUserId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Yes, it's me", callback_data: `tg_verify_yes_${verificationId}` },
              { text: "❌ No, it's not me", callback_data: `tg_verify_no_${verificationId}` },
            ],
          ],
        },
      }),
    });
  } catch {
    // Non-fatal: the verification row exists; the user can start a new
    // attempt if the DM never arrived.
  }
  return verificationId;
}

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

    const token = telegramBotToken();

    // Identity check FIRST. This route used to let an anonymous caller enter
    // ANY Telegram id, create a customer and receive a store session before
    // the DM was confirmed. If the victim clicked "Yes", their Telegram id was
    // bound to the attacker's customer, whose session then read the victim's
    // future orders. Only a signed-in customer may start a link, and no
    // session is issued here.
    const sessionUserId = currentStoreUserId(request);
    if (!sessionUserId) {
      return NextResponse.json(
        {
          error: {
            code: "AUTH_REQUIRED",
            message: "Sign in to your store account before linking a Telegram ID.",
          },
        },
        { status: 401 },
      );
    }

    const existing = await getCustomerByPlatformIdentity("telegram", telegramUserId);
    if (existing && existing.customer.id !== sessionUserId) {
      return NextResponse.json(
        {
          error: {
            code: "ALREADY_LINKED",
            message:
              "That Telegram ID is already linked to another account. Sign in to that account, or use a different Telegram ID.",
          },
        },
        { status: 409 },
      );
    }

    if (!token) {
      return NextResponse.json(
        { error: { code: "BOT_NOT_CONFIGURED", message: "Telegram verification is unavailable right now." } },
        { status: 503 },
      );
    }

    // Unlinked id — the only way to attach it is the DM proof, sent to the
    // account that is already signed in.
    await sendVerificationDm(token, telegramUserId, sessionUserId);

    return NextResponse.json({
      customerId: sessionUserId,
      verificationPending: true,
      message:
        "Check your Telegram, then confirm the 'Yes, it's me' button in the DM from the VANTA GARAGE bot to finish linking. The link expires in 2 minutes.",
    });
  } catch (err) {
    return fail(err);
  }
}
