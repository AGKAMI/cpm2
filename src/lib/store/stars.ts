/**
 * VANTA GARAGE — Telegram Stars (XTR) payments.
 *
 * Stars are Telegram's in-app currency for DIGITAL goods. The flow:
 *   1. Server creates an invoice link (createInvoiceLink, currency "XTR").
 *   2. The mini app opens it with Telegram.WebApp.openInvoice — the user pays
 *      from their Stars balance, natively, no card, no redirect.
 *   3. Telegram sends pre_checkout_query (must be answered within 10s) and
 *      then message.successful_payment — the ONLY proof of payment.
 *
 * Bot API reference: https://core.telegram.org/bots/api#payments
 * Stars are whole numbers, 1–10 000 per invoice.
 */

import { telegramBotToken } from "../telegram.ts";

/** ZAR per single Star. The store's real-world ratio: R36 buys 100 Stars,
 *  i.e. R0.36 per Star. Tunable without a redeploy via STARS_ZAR_PER_STAR. */
export function zarPerStar(): number {
  const raw = process.env.STARS_ZAR_PER_STAR;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.36;
}

/** Whole Stars to charge for a ZAR amount (in cents), always ≥ 1. */
export function starsForCents(cents: number): number {
  // Rounded to the nearest 5 Stars so the invoiced amount matches the
  // displayed approximation exactly (approxStarsForCents uses the same rule).
  const exact = Math.ceil((cents / 100) / zarPerStar());
  return Math.max(5, Math.round(exact / 5) * 5);
}

/** Create a Stars invoice link for one order. `payload` carries the order id. */
export async function createStarsInvoiceLink(opts: {
  title: string;
  description: string;
  payload: string;
  starAmount: number;
}): Promise<string> {
  const token = telegramBotToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  if (!Number.isInteger(opts.starAmount) || opts.starAmount < 1) {
    throw new Error(`Invalid Stars amount: ${opts.starAmount}`);
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: opts.title.slice(0, 32),
      description: opts.description.slice(0, 255),
      payload: opts.payload,
      currency: "XTR",
      prices: [{ label: "Payment", amount: opts.starAmount }],
    }),
  });
  const data = (await response.json()) as { ok?: boolean; result?: string; description?: string };
  if (!data.ok || !data.result) {
    throw new Error(`createInvoiceLink failed: ${data.description ?? "unknown error"}`);
  }
  return data.result;
}

/** Answer the pre-checkout gate. MUST happen within 10 seconds of the query. */
export async function answerPreCheckoutQuery(
  preCheckoutQueryId: string,
  ok: boolean,
  errorMessage?: string,
): Promise<void> {
  const token = telegramBotToken();
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerPreCheckoutQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pre_checkout_query_id: preCheckoutQueryId,
      ok,
      ...(ok ? {} : { error_message: (errorMessage ?? "This order is no longer available.").slice(0, 255) }),
    }),
  });
}

/** Refund a settled Stars payment — the charge id comes from successful_payment. */
export async function refundStarPayment(userId: number, telegramPaymentChargeId: string): Promise<boolean> {
  const token = telegramBotToken();
  if (!token) return false;
  const response = await fetch(`https://api.telegram.org/bot${token}/refundStarPayment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, telegram_payment_charge_id: telegramPaymentChargeId }),
  });
  const data = (await response.json()) as { ok?: boolean };
  return data.ok === true;
}

/** Sum of Stars received across all transactions (for payout tracking). */
export async function starTransactionCount(): Promise<number | null> {
  const token = telegramBotToken();
  if (!token) return null;
  const response = await fetch(`https://api.telegram.org/bot${token}/getStarTransactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await response.json()) as { ok?: boolean; result?: { transactions?: unknown[] } };
  return data.ok ? (data.result?.transactions?.length ?? 0) : null;
}
