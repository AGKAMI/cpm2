/**
 * VANTA GARAGE — Telegram notifications.
 * Sends order status updates and admin promotion notices via Telegram Bot API.
 * All messages are emojified.
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
        `✅ <b>Payment Verified</b>\n\n` +
        `Your EFT payment for <b>${order.productName}</b> has been verified by our team.\n` +
        `Order: <code>${order.id}</code>\n` +
        `Amount: ${formatPrice(order.amountCents, order.currency)}\n\n` +
        `Your order is now confirmed and being prepared for delivery. 🚗`
      );

    case "payment_rejected":
      return (
        `❌ <b>Payment Rejected</b>\n\n` +
        `Unfortunately, we couldn't verify your EFT payment for <b>${order.productName}</b>.\n` +
        `Order: <code>${order.id}</code>\n` +
        `Reason: ${order.reason || "Payment proof not valid or not received"}\n\n` +
        `Your stock reservation has been released. Please try again or contact support. ⚠️`
      );

    case "payment_confirmed_payfast":
      return (
        `✅ <b>Payment Confirmed</b>\n\n` +
        `Your PayFast payment for <b>${order.productName}</b> has been confirmed.\n` +
        `Order: <code>${order.id}</code>\n` +
        `Amount: ${formatPrice(order.amountCents, order.currency)}\n\n` +
        `Your order is now confirmed and being prepared for delivery. 🚗`
      );

    case "delivery_scheduled":
      return (
        `🚚 <b>Delivery Scheduled</b>\n\n` +
        `Your order <b>${order.productName}</b> is ready for delivery!\n` +
        `Order: <code>${order.id}</code>\n` +
        `Delivery proof: ${order.evidenceUrl || "Available in your orders"}\n\n` +
        `Our team will contact you in-game to arrange the handoff.`
      );

    case "delivery_verified":
      return (
        `✅ <b>Delivery Complete</b>\n\n` +
        `Your order <b>${order.productName}</b> has been successfully delivered.\n` +
        `Order: <code>${order.id}</code>\n\n` +
        `Enjoy your new ride! 🏎️`
      );

    case "order_cancelled":
      return (
        `⚠️ <b>Order Cancelled</b>\n\n` +
        `Your order for <b>${order.productName}</b> has been cancelled.\n` +
        `Order: <code>${order.id}</code>\n` +
        `Reason: ${order.reason || "Payment expired or rejected"}\n\n` +
        `If you have questions, please contact support.`
      );

    case "new_product":
      return (
        `🆕 <b>New Vehicle Added</b>\n\n` +
        `A new <b>${order.productName}</b> has been added to the catalog. Check it out now!\n` +
        `Order: <code>${order.id}</code>\n\n` +
        `Tap below to browse the store.`
      );

    case "promotion":
      return (
        `📢 <b>New Promotion</b>\n\n` +
        `${order.productName}\n` +
        `${order.reason || ""}\n\n` +
        `Check it out in the store!`
      );

    case "admin_promoted":
      return (
        `👑 <b>You've been promoted to Admin!</b>\n\n` +
        `KAMI has promoted you to admin on VANTA GARAGE.\n` +
        `You now have access to:\n` +
        `• Product management (add/edit vehicles)\n` +
        `• Pricing and stock control\n` +
        `• Order management and verification\n` +
        `• Promotion creation\n\n` +
        `Log in to the store admin panel to get started. 🚀`
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
