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
import { getCustomerByPlatformIdentity, linkPlatformIdentity } from "@/lib/store/customers";
import { confirmPayment, getOrder } from "@/lib/store/checkout";
import { constantTimeEquals } from "@/lib/auth";
import { recordPayment } from "@/lib/store/payments";
import { ledgerEntry } from "@/lib/store/ledger";
import { notifyCustomer } from "@/lib/store/notifications";
import { getCustomerTelegramId } from "@/lib/store/notifications";
import { answerPreCheckoutQuery, starsForCents } from "@/lib/store/stars";

export const dynamic = "force-dynamic";

/** Answer a callback_query to remove the "loading" state on the button. */
async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        ...(text ? { text, show_alert: false } : {}),
      }),
    });
  } catch {
    // Non-fatal
  }
}

/** Replace a sent message's text + keyboard (retire a callback keyboard). */
async function editMessageText(
  token: string,
  chatId: number | string,
  messageId: number,
  text: string,
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [] },
      }),
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
    // Authenticate the caller as TELEGRAM, not as anyone who found the URL.
    // The webhook is registered with a secret_token; Telegram replays it in
    // this header on every update. When TELEGRAM_WEBHOOK_SECRET is configured,
    // a missing or wrong value is refused — without this check anyone could
    // POST a fabricated successful_payment and mark an order paid.
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret) {
      const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
      if (!provided || !constantTimeEquals(provided, secret)) {
        return NextResponse.json({ error: { code: "WEBHOOK_FORBIDDEN" } }, { status: 403 });
      }
    }
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
      const deliveryConfirmPrefix = "tg_delivery_confirm_";

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
          // Proof of possession: only the Telegram id the DM was sent to may
          // confirm it. Inline keyboards can be forwarded, and callback_data
          // ids are sequential — without this a third party could claim the
          // link. The generated verification_code is not exposed in the DM.
          if (String(from?.id ?? "") !== String(row.telegram_user_id)) {
            await sendFollowup(token, chatId, "⚠️ This verification belongs to a different Telegram account.");
            return NextResponse.json({ ok: true });
          }
          const now = new Date();
          if (String(row.status) === "pending" && new Date(String(row.expires_at)) > now) {
            // Never steal an id that has since been bound to another customer.
            const holder = await getCustomerByPlatformIdentity("telegram", String(row.telegram_user_id));
            if (holder && holder.customer.id !== Number(row.customer_id)) {
              await sendFollowup(token, chatId, "⚠️ This Telegram ID is already linked to another store account.");
              return NextResponse.json({ ok: true });
            }

            await db.execute({
              sql: `UPDATE vanta_telegram_verifications SET status = 'confirmed', confirmed_at = ? WHERE id = ?`,
              args: [now.toISOString(), verificationId],
            });

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
        const pending = await db.execute({
          sql: `SELECT telegram_user_id FROM vanta_telegram_verifications WHERE id = ?`,
          args: [verificationId],
        });
        if (
          pending.rows.length === 0 ||
          String(pending.rows[0].telegram_user_id) !== String(from?.id ?? "")
        ) {
          await sendFollowup(token, chatId, "⚠️ This verification belongs to a different Telegram account.");
          return NextResponse.json({ ok: true });
        }

        await db.execute({
          sql: `UPDATE vanta_telegram_verifications SET status = 'rejected' WHERE id = ?`,
          args: [verificationId],
        });

        await sendFollowup(token, chatId, "❌ <b>Rejected.</b> The link request was cancelled. No Telegram ID was linked to any account.");
        return NextResponse.json({ ok: true });
      } else if (data && data.startsWith(deliveryConfirmPrefix)) {
        const orderId = data.slice(deliveryConfirmPrefix.length);
        const db = await getStoreDb();
        const order = await getOrder(orderId);
        if (!order) {
          await answerCallbackQuery(token, callbackQueryId, "Order not found.");
          return NextResponse.json({ ok: true });
        }
        const telegramId = await getCustomerTelegramId(order.customerId);
        if (!telegramId || String(telegramId) !== String(from.id)) {
          await answerCallbackQuery(token, callbackQueryId, "This delivery isn't yours to confirm.");
          return NextResponse.json({ ok: true });
        }
        if (order.paymentState !== "verified") {
          await answerCallbackQuery(token, callbackQueryId, "Payment isn't verified yet.");
          return NextResponse.json({ ok: true });
        }
        if (order.deliveryState !== "scheduled" && order.deliveryState !== "in_progress") {
          await answerCallbackQuery(token, callbackQueryId, "No active delivery to confirm.");
          return NextResponse.json({ ok: true });
        }
        await db.execute({
          sql: `UPDATE vanta_orders SET delivery_state = 'completed', order_state = 'completed', updated_at = ? WHERE id = ?`,
          args: [new Date().toISOString(), orderId],
        });
        await ledgerEntry({
          orderId,
          type: "adjustment",
          amountCents: order.amountCents,
          currency: order.currency,
          relatedPaymentId: "",
        });
        await answerCallbackQuery(token, callbackQueryId, "Delivery confirmed ✓ — thanks!");
        await editMessageText(
          token,
          chatId,
          (message as unknown as { message_id: number }).message_id,
          `✅ <b>Delivery confirmed</b>\n\nOrder ${order.id} — ${order.inGameName} — marked delivered.`,
        );
        return NextResponse.json({ ok: true });
      }
    }

    // --- Telegram Stars payments (digital goods, currency XTR) ---
    // 1) Pre-checkout gate: Telegram demands an answer within 10 seconds.
    //    Re-validate the order server-side; only Stars invoices we created.
    if (body.pre_checkout_query) {
      const pq = body.pre_checkout_query as {
        id: string;
        from: { id: number };
        currency: string;
        total_amount: number;
        invoice_payload: string;
      };
      try {
        const order = pq.invoice_payload ? await getOrder(String(pq.invoice_payload)) : null;
        const expected = order ? starsForCents(order.amountCents) : null;
        const ok = Boolean(
          order &&
            order.paymentMethod === "stars" &&
            order.paymentState !== "verified" &&
            pq.currency === "XTR" &&
            expected !== null &&
            Number(pq.total_amount) === expected,
        );
        await answerPreCheckoutQuery(
          pq.id,
          ok,
          ok ? undefined : "This order is no longer available — start a new checkout.",
        );
      } catch (err) {
        console.error("pre_checkout_query handling failed:", err);
        // Answer with an error so the user's Stars are never charged on a
        // server-side failure.
        await answerPreCheckoutQuery(pq.id, false, "Checkout is temporarily unavailable. Try again.");
      }
      return NextResponse.json({ ok: true });
    }

    // 2) Settlement: message.successful_payment is the ONLY proof of payment.
    //    Never trust the client; mark the order paid only from this update.
    const message = body.message as {
      from?: { id: number };
      successful_payment?: {
        invoice_payload: string;
        telegram_payment_charge_id: string;
        total_amount: number;
        currency: string;
      };
    } | undefined;
    if (message?.successful_payment) {
      const sp = message.successful_payment;
      const orderId = String(sp.invoice_payload ?? "");
      const order = orderId ? await getOrder(orderId) : null;
      // Everything the pre_checkout gate re-validates must ALSO hold at
      // settlement: this update is the only proof of payment, so an order we
      // never invoiced, a non-XTR currency, an amount that does not match the
      // order, or a payer who is not the order's customer must never settle.
      const expectedStars = order ? starsForCents(order.amountCents) : null;
      const customerTgId = order ? await getCustomerTelegramId(order.customerId) : null;
      const settled =
        order !== null &&
        order.paymentMethod === "stars" &&
        order.paymentState !== "verified" &&
        String(sp.currency ?? "") === "XTR" &&
        expectedStars !== null &&
        Number(sp.total_amount) === expectedStars &&
        customerTgId !== null &&
        String(customerTgId) === String(message.from?.id ?? "");
      if (settled && order) {
        const amountCents = order.amountCents;
        await recordPayment({
          orderId: order.id,
          provider: "telegram_stars",
          providerRef: String(sp.telegram_payment_charge_id ?? ""),
          amountCents,
          currency: order.currency,
          status: "verified",
        });
        // The shared race-safe path: flips state with a conditional UPDATE and
        // deducts stock exactly once. Calling updatePaymentState directly (as
        // before) skipped confirmStockDeduction entirely.
        await confirmPayment(order.id);
        await ledgerEntry({
          orderId: order.id,
          type: "payment",
          amountCents,
          currency: order.currency,
          relatedPaymentId: String(sp.telegram_payment_charge_id ?? ""),
        });
        notifyCustomer(order.customerId, "payment_confirmed_payfast", {
          id: order.id,
          productId: order.productId,
          amountCents,
          currency: order.currency,
          inGameName: order.inGameName,
          playerId: order.playerId,
        }).catch((err) => console.error("Stars notification failed:", err));
      } else if (order) {
        console.error(
          `Stars settlement refused for ${order.id}: currency=${sp.currency} amount=${sp.total_amount} expected=${expectedStars} payer=${message.from?.id} customer=${customerTgId}`,
        );
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: { code: "WEBHOOK_FAILED", message: String(err) } }, { status: 500 });
  }
}
