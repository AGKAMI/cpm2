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

/** Admin gate — only the owner Telegram id can manage products/pricing. */
export async function requireStoreAdmin(request: Request) {
  const telegramUserId = await assertTelegramAuth(request);
  if (telegramUserId === null) {
    throw new Error("NO_TELEGRAM_AUTH");
  }
  const adminId = Number(process.env.STORE_ADMIN_TELEGRAM_ID ?? "7036681178");
  if (telegramUserId !== adminId) {
    throw new Error("NOT_ADMIN");
  }
  return { telegramUserId, isAdmin: true };
}
