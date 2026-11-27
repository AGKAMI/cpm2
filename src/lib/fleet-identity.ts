/**
 * VANTA GARAGE — fleet identity resolution.
 *
 * The fleet gates every account row on a single user id. The fleet owner has
 * signed up with several emails over time (test logins), so a stale email
 * session can resolve to a DIFFERENT user id than the one the fleet rows were
 * created under — and then every create/delete/edit 403s or 404s on the
 * owner's own accounts ("at times I can't create accounts" is exactly that).
 *
 * Resolution order — the first that resolves wins:
 *   1. Telegram identity: a valid initData whose user id maps to a users row
 *      (the owner's real login, telegram_user_id 7036681178). Inside the mini
 *      app this is ALWAYS present, so the fleet lands on the same user no
 *      matter which email session the browser still holds.
 *   2. The console session cookie (the email login path).
 *   3. The fleet owner fallback: FLEET_OWNER_TELEGRAM_ID / the store admin id,
 *      so an owner request with no resolvable identity still reaches the
 *      owner's fleet instead of an accidental empty one.
 *
 * Never loosens the per-user ownership gate: it only makes the CALLER's
 * identity stable, so the gate compares against the right user.
 */

import { assertTelegramAuth } from "@/lib/telegram";
import { currentUserId } from "@/lib/auth";
import { getUserByTelegramId } from "@/lib/service-turso";

/** The fleet owner's Telegram id (same identity as the store admin). */
function ownerTelegramId(): number | null {
  const raw =
    process.env.FLEET_OWNER_TELEGRAM_ID ??
    process.env.STORE_ADMIN_TELEGRAM_ID ??
    "";
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export type FleetIdentity = {
  userId: number;
  source: "telegram" | "session" | "owner";
};

/**
 * Resolve which fleet user a request acts as. Throws only when the Telegram
 * signature is present but INVALID (a forged header must not silently fall
 * through to another identity).
 */
export async function resolveFleetUser(request: Request): Promise<FleetIdentity | null> {
  // 1. Telegram — the stable identity inside the mini app.
  let telegramUserId: number | null = null;
  try {
    telegramUserId = await assertTelegramAuth(request);
  } catch {
    // A bad signature must not be treated as "no identity": refuse.
    throw new Error("Telegram signature did not verify — reopen the app from Telegram.");
  }
  if (telegramUserId !== null) {
    const user = await getUserByTelegramId(telegramUserId);
    if (user) return { userId: Number(user.id), source: "telegram" };
  }

  // 2. The console session (email login).
  const sessionUserId = currentUserId(request);
  if (sessionUserId !== undefined) {
    return { userId: sessionUserId, source: "session" };
  }

  // 3. Owner fallback — the fleet owner is a single person.
  const owner = ownerTelegramId();
  if (owner !== null) {
    const ownerUser = await getUserByTelegramId(owner);
    if (ownerUser) return { userId: Number(ownerUser.id), source: "owner" };
  }

  return null;
}