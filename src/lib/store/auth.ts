/**
 * VANTA GARAGE — store auth helper.
 * Resolves the calling customer from either auth path:
 * 1. Telegram Mini App initData → linked customer (or null until onboarded).
 * 2. Web login session cookie (`cpm2_session`, set by the email/password
 *    login) → that customer. Without this fallback every cart/wishlist route
 *    was Telegram-only, which locked logged-in web customers out — the store
 *    is reachable in any browser, so the cart must be too.
 */

import { ApiError } from "../api.ts";
import { assertTelegramAuth } from "../telegram";
import {
  readRequestCookie,
  verifySessionToken,
  verifyOrderAccessToken,
  SESSION_COOKIE,
} from "../auth";
import { getCustomer, getCustomerByPlatformIdentity } from "./customers";
import type { Customer, PlatformIdentity } from "../store-types";

/** The storefront's user id, if any. A CONSOLE-scoped session must never
 *  resolve a store customer — the two apps share one cookie name. Every
 *  storefront route that needs an identity goes through this helper. */
export function currentStoreUserId(request: Request): number | undefined {
  return verifySessionToken(readRequestCookie(request, SESSION_COOKIE), "store") ?? undefined;
}

export type StoreCustomer = {
  customer: Customer;
  identity: PlatformIdentity | null;
};

 /**
 * Read access to ONE order: either a full store session for that customer, or
 * the signed per-order capability returned at checkout. Never a player id or
 * a console token.
 */
export function canAccessOrder(
  request: Request,
  order: { id: string; customerId: number },
): boolean {
  const viewer = currentStoreUserId(request);
  if (viewer === order.customerId) return true;
  return verifyOrderAccessToken(request.headers.get("x-order-access") ?? undefined, order.id, order.customerId);
}

export async function getStoreCustomer(request: Request): Promise<StoreCustomer | null> {
  // Telegram auth is optional here — the caller (checkout) decides whether it's
  // required based on payment method. Stars needs it; EFT/PayFast don't.
  //
  // A FAILED Telegram signature must not skip the web-session fallback: a
  // stale or malformed initData header used to return null here and lock
  // logged-in web customers out of cart/wishlist for no reason. Detect the
  // failure, then fall through to the session.
  // The catch flag is unused by name below on purpose: the fix is that a bad
  // signature no longer returns early, it falls through to the session.
  let telegramUserId: number | null = null;
  try {
    telegramUserId = await assertTelegramAuth(request);
  } catch {
    // fall through to the web-session check below
  }
  if (telegramUserId !== null) {
    return await getCustomerByPlatformIdentity("telegram", String(telegramUserId));
  }

  // Web session fallback — the customer logged in with email + password.
  // Store-scoped only (see currentStoreUserId).
  const sessionUserId = currentStoreUserId(request);
  if (sessionUserId) {
    const customer = await getCustomer(sessionUserId);
    if (customer) {
      return { customer, identity: null };
    }
  }

  return null;
}

export async function requireStoreCustomer(request: Request) {
  const customer = await getStoreCustomer(request);
  if (!customer) {
    throw new ApiError(401, "NO_CUSTOMER", "No customer linked. Open the store from Telegram to link your account.");
  }
  return customer;
}

/** Admin gate — owner (STORE_ADMIN_TELEGRAM_ID) or any active admin row can manage products/pricing. */
import { resolveAdminStatus } from "./admin-service";

export async function requireStoreAdmin(request: Request) {
  const status = await resolveAdminStatus(request);
  if (!status.isAdmin) {
    throw new ApiError(403, "NOT_ADMIN", "You are not authorized to access this resource.");
  }
  return { telegramUserId: status.telegramUserId, isAdmin: true, isOwner: status.isOwner };
}
