/**
 * VANTA GARAGE — PayFast checkout initiation.
 * Builds the hosted PayFast checkout URL for an order.
 */

import { createHash } from "node:crypto";
import type { Order } from "../store-types";

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID ?? "";
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY ?? "";
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE ?? "";

const PAYFAST_BASE = "https://sandbox.payfast.co.za/eng/process"; // sandbox; flip to live via env

export function isPayFastConfigured(): boolean {
  return Boolean(PAYFAST_MERCHANT_ID && PAYFAST_MERCHANT_KEY && PAYFAST_PASSPHRASE);
}

export function buildPayFastCheckoutUrl(
  order: Order,
  returnUrl: string,
  cancelUrl: string,
  notifyUrl: string,
): { url: string; configured: boolean } {
  if (!isPayFastConfigured()) {
    return { url: "", configured: false };
  }

  const amountZar = (order.amountCents / 100).toFixed(2);

  const params: Record<string, string> = {
    merchant_id: PAYFAST_MERCHANT_ID,
    merchant_key: PAYFAST_MERCHANT_KEY,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    amount: amountZar,
    item_name: `VANTA GARAGE — ${order.productId}`,
    item_description: `Player: ${order.playerId} — ${order.inGameName}`,
    custom_str1: order.id,
    name_first: "VANTA",
    name_last: "Customer",
    email_address: "checkout@vanta-garage.local",
  };

  // PayFast signature: MD5 of sorted param string + passphrase
  const sortedKeys = Object.keys(params).sort();
  const dataString = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  // PayFast signature: MD5 of (sorted param string + passphrase)
  const signature = createHash("md5")
    .update(`${dataString}${PAYFAST_PASSPHRASE}`)
    .digest("hex");

  const checkoutParams: Record<string, string> = { ...params, signature };
  const qs = Object.entries(checkoutParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  return { url: `${PAYFAST_BASE}?${qs}`, configured: true };
}

export function getPayFastBaseUrl(): string {
  return process.env.PAYFAST_BASE_URL ?? PAYFAST_BASE;
}
