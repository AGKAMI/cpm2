/**
 * VANTA GARAGE — link Telegram ID manually (web guest).
 * POST /api/store/customers/link-telegram-id
 * Body: { telegramId: string }
 *
 * Links a manually-entered Telegram ID to a customer record.
 * Used when opening the store in a web browser (no Telegram WebApp initData).
 */

import { fail, readJson } from "@/lib/route";
import { telegramBotToken } from "@/lib/telegram";
import { getCustomerByPlatformIdentity } from "@/lib/store/customers";
import { NextResponse } from "next/server";
import { createSessionToken, sessionCookieOptions, currentUserId } from "@/lib/auth";
import { getStoreDb } from "@/lib/store-db";

export const dynamic = "force-dynamic";

const VERIFICATION_WINDOW_SECONDS = 120; // 2 minutes

function makeCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I
  let code = "";
  for (let i = 0; i < length; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function setSessionCookie(response: NextResponse, customerId: number, request: Request) {
  const token = createSessionToken(customerId, "store");
  response.cookies.set("cpm2_session", token, sessionCookieOptions(request));
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

Someone is trying to link Telegram ID <code>${telegramUserId}</code> to a VANTA GARAGE store account on the web.

<b>If this is YOU:</b> Click "Yes, it's me" below to confirm the link.

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

    // Already linked to SOMEONE — the caller may only be told "already yours"
    // when the session IS that customer. Anything else is refused: no session
    // is minted for another customer's account (that was the takeover), and a
    // session may not move an identity that belongs to a different customer.
    const existing = await getCustomerByPlatformIdentity("telegram", telegramUserId);
    const sessionUserId = currentUserId(request);
    if (existing) {
      if (sessionUserId && existing.customer.id === sessionUserId) {
        if (token) await sendVerificationDm(token, telegramUserId, sessionUserId);
        const response = NextResponse.json({
          customerId: sessionUserId,
          verificationPending: true,
          message: "Telegram is already linked to this account.",
        });
        setSessionCookie(response, sessionUserId, request);
        return response;
      }
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

    // Unlinked id — the only way to attach it is the DM proof.
    let customerId: number;
    const db = await getStoreDb();

    if (sessionUserId) {
      customerId = sessionUserId;
    } else {
      // Sessionless callers get a guest customer of their OWN — never the
      // account that already owns (or will own) this Telegram id. The
      // identity itself stays unattached until the DM confirmation.
      const now = new Date().toISOString();
      const created = await db.execute({
        sql: `INSERT INTO vanta_customers (in_game_name, player_id, currency_pref, created_at, updated_at)
              VALUES (?, '', 'ZAR', ?, ?)`,
        args: [tgDisplayName ?? `tg_${telegramUserId}`, now, now],
      });
      customerId = Number(created.lastInsertRowid);
    }

    await sendVerificationDm(token, telegramUserId, customerId);

    const response = NextResponse.json({
      customerId,
      verificationPending: true,
      message:
        "Check your Telegram, then confirm the 'Yes, it's me' button in the DM from the VANTA GARAGE bot to finish linking. The link expires in 2 minutes.",
    });
    setSessionCookie(response, customerId, request);
    return response;
  } catch (err) {
    return fail(err);
  }
}
