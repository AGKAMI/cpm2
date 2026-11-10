/**
 * VANTA GARAGE — Telegram notifications.
 * Sends order status updates and admin promotion notices via Telegram Bot API.
 * All messages use box-drawing and special unicode characters.
 */

import { getStoreDb } from "@/lib/store-db";
import { telegramBotToken } from "@/lib/telegram";

export type OrderEvent =
  | "payment_verified"
  | "payment_rejected"
  | "payment_confirmed_payfast"
  | "delivery_scheduled"
  | "delivery_verified"
  | "order_cancelled"
  | "new_product"
  | "promotion"
  | "admin_promoted";

interface TelegramMessage {
  chat_id: number;
  text: string;
  parse_mode?: "HTML" | "Markdown";
  disable_web_page_preview?: boolean;
}

async function sendTelegramMessage(message: TelegramMessage): Promise<boolean> {
  const token = telegramBotToken();
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN not configured, skipping notification");
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      console.error("Telegram sendMessage failed:", res.status, error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Telegram sendMessage error:", err);
    return false;
  }
}

export async function sendNotification(chatId: number | string, text: string): Promise<boolean> {
  return sendTelegramMessage({ chat_id: Number(chatId), text, parse_mode: "HTML", disable_web_page_preview: true });
}

function formatPrice(cents: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(cents / 100);
}

function header(title: string): string {
  const line = "═".repeat(title.length);
  return `${line}\n${title}\n${line}\n\n`;
}

function formatMessage(event: OrderEvent, order: {
  id: string;
  inGameName: string;
  playerId: string;
  productName: string;
  amountCents: number;
  currency: string;
  evidenceUrl?: string;
  reason?: string;
}): string {
  switch (event) {
    case "payment_verified":
      return (
        header("PAYMENT VERIFIED") +
        `✦ Payment Verified ✦\n` +
        `▸ ${order.productName}\n` +
        `▸ Order: ${order.id}\n` +
        `▸ ${formatPrice(order.amountCents, order.currency)}\n\n` +
        `▶ Confirmed — being prepared for delivery.`
      );

    case "payment_rejected":
      return (
        header("PAYMENT REJECTED") +
        `✗ Payment Rejected ✗\n` +
        `▸ ${order.productName}\n` +
        `▸ Order: ${order.id}\n` +
        `▸ ${order.reason || "Payment proof not valid or not received"}\n\n` +
        `⚠ Stock released — try again or contact support.`
      );

    case "payment_confirmed_payfast":
      return (
        header("PAYMENT CONFIRMED") +
        `✦ Payment Confirmed ✦\n` +
        `▸ ${order.productName}\n` +
        `▸ Order: ${order.id}\n` +
        `▸ ${formatPrice(order.amountCents, order.currency)}\n\n` +
        `▶ Confirmed — being prepared for delivery.`
      );

    case "delivery_scheduled":
      return (
        header("DELIVERY SCHEDULED") +
        `▸ Delivery Scheduled ▸\n` +
        `▸ ${order.productName}\n` +
        `▸ Order: ${order.id}\n\n` +
        `▶ We'll contact you in-game to arrange handoff.`
      );

    case "delivery_verified":
      return (
        header("DELIVERY COMPLETE") +
        `✦ Delivery Complete ✦\n` +
        `▸ ${order.productName}\n` +
        `▸ Order: ${order.id}\n\n` +
        `▶ Enjoy your new ride!`
      );

    case "order_cancelled":
      return (
        header("ORDER CANCELLED") +
        `⚠ Order Cancelled ⚠\n` +
        `▸ ${order.productName}\n` +
        `▸ Order: ${order.id}\n` +
        `▸ ${order.reason || "Payment expired or rejected"}\n\n` +
        `▶ Questions? Contact support.`
      );

    case "new_product":
      return (
        header("NEW VEHICLE") +
        `✦ New Vehicle Added ✦\n` +
        `▸ ${order.productName}\n` +
        `▸ Order: ${order.id}\n\n` +
        `▶ Browse the store.`
      );

    case "promotion":
      return (
        header("NEW PROMOTION") +
        `▸ ${order.productName}\n` +
        `${order.reason ? `▸ ${order.reason}\n` : ``}` +
        `\n` +
        `▶ Check it out in the store!`
      );

    case "admin_promoted":
      return (
        header("ADMIN PROMOTED") +
        `✦ You are now an Admin ✦\n` +
        `▸ Add & edit vehicles\n` +
        `▸ Control pricing & stock\n` +
        `▸ Verify orders & payments\n` +
        `▸ Create promotions\n\n` +
        `▶ Log in to the admin panel.`
      );

    default:
      return `Order update: ${order.id}`;
  }
}

async function getCustomerTelegramId(customerId: number): Promise<number | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT platform_user_id FROM vanta_platform_identities WHERE customer_id = ? AND platform = 'telegram' LIMIT 1`,
    args: [customerId],
  });
  if (result.rows.length === 0) return null;
  return Number(result.rows[0].platform_user_id);
}

async function getCustomerNotificationsEnabled(customerId: number): Promise<boolean> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT notifications_enabled FROM vanta_customers WHERE id = ? LIMIT 1`,
    args: [customerId],
  });
  if (result.rows.length === 0) return true; // default enabled
  return Number(result.rows[0].notifications_enabled ?? 1) === 1;
}

async function getProductName(productId: number): Promise<string> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT name FROM vanta_products WHERE id = ? LIMIT 1`,
    args: [productId],
  });
  if (result.rows.length === 0) return "Unknown Vehicle";
  return String(result.rows[0].name ?? "Unknown Vehicle");
}

export async function notifyCustomer(
  customerId: number,
  event: OrderEvent,
  order: {
    id: string;
    productId: number;
    amountCents: number;
    currency: string;
    inGameName: string;
    playerId: string;
    evidenceUrl?: string;
    reason?: string;
  }
): Promise<void> {
  // Check if notifications are enabled
  const enabled = await getCustomerNotificationsEnabled(customerId);
  if (!enabled) return;

  // Get Telegram ID
  const telegramId = await getCustomerTelegramId(customerId);
  if (!telegramId) return; // No linked Telegram account

  // Get product name
  const productName = await getProductName(order.productId);

  // Build and send message
  const message = formatMessage(event, { ...order, productName });
  await sendTelegramMessage({
    chat_id: telegramId,
    text: message,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

/** Notify a Telegram user that they've been promoted to admin. */
export async function notifyAdminPromoted(telegramUserId: number, promotedBy: string): Promise<void> {
  const message = formatMessage("admin_promoted", {
    id: "",
    inGameName: promotedBy,
    playerId: "",
    productName: "",
    amountCents: 0,
    currency: "ZAR",
  });
  await sendTelegramMessage({
    chat_id: telegramUserId,
    text: message,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}
