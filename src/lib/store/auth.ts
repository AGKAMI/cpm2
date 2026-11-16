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
import { readRequestCookie, verifySessionToken, SESSION_COOKIE } from "../auth";
import { getCustomer, getCustomerByPlatformIdentity } from "./customers";
import type { Customer, PlatformIdentity } from "../store-types";

 export type StoreCustomer = {
   customer: Customer;
   identity: PlatformIdentity | null;
 };

 export async function getStoreCustomer(request: Request): Promise<StoreCustomer | null> {
   const telegramUserId = await assertTelegramAuth(request);
   if (telegramUserId !== null) {
     return await getCustomerByPlatformIdentity("telegram", String(telegramUserId));
   }

   // Web session fallback — the customer logged in with email + password.
   const sessionUserId = verifySessionToken(readRequestCookie(request, SESSION_COOKIE));
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
