/**
 * VANTA GARAGE — store auth helper.
 * Maps a Telegram Mini App initData signature to a VANTA customer
 * via the platform-identity link. Returns null when no customer is linked
 * yet (caller shows onboarding).
 */

import { assertTelegramAuth } from "../telegram";
import { getCustomerByPlatformIdentity } from "./customers";
import type { Platform } from "../store-types";

export async function getStoreCustomer(request: Request) {
  const telegramUserId = await assertTelegramAuth(request);
  if (telegramUserId === null) return null;

  return await getCustomerByPlatformIdentity("telegram", String(telegramUserId));
}

export async function requireStoreCustomer(request: Request) {
  const customer = await getStoreCustomer(request);
  if (!customer) {
    throw new Error("NO_CUSTOMER");
  }
  return customer;
}

/** Admin gate — owner (STORE_ADMIN_TELEGRAM_ID) or any active admin row can manage products/pricing. */
import { resolveAdminStatus } from "./admin-service";

export async function requireStoreAdmin(request: Request) {
  const status = await resolveAdminStatus(request);
  if (!status.isAdmin) {
    throw new Error("NOT_ADMIN");
  }
  return { telegramUserId: status.telegramUserId, isAdmin: true, isOwner: status.isOwner };
}
