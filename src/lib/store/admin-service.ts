/** VANTA GARAGE — admin & owner management.
 *
 * Owner = STORE_ADMIN_TELEGRAM_ID env var (you, hardcoded).
 * Admins = rows in vanta_admins table, added/removed by the owner.
 */

import { getStoreDb } from "../store-db.ts";
import { assertTelegramAuth } from "../telegram";
import {
  SESSION_COOKIE,
  consoleOwnerEmail,
  currentUserId,
  readRequestCookie,
  verifySessionToken,
} from "../auth.ts";
import { getUserById } from "../service-turso.ts";

export type AdminRecord = {
  id: number;
  telegramUserId: string;
  telegramUsername: string;
  nickname: string;
  role: "owner" | "admin";
  addedBy: string | null;
  addedAt: string;
  isActive: boolean;
  lastSeen: string | null;
};

function rowToAdmin(row: Record<string, unknown>): AdminRecord {
  return {
    id: Number(row.id),
    telegramUserId: String(row.telegram_user_id),
    telegramUsername: String(row.telegram_username ?? ""),
    nickname: String(row.nickname ?? ""),
    role: (row.role as "owner" | "admin") ?? "admin",
    addedBy: row.added_by ? String(row.added_by) : null,
    addedAt: String(row.added_at ?? ""),
    isActive: Number(row.is_active ?? 0) === 1,
    lastSeen: row.last_seen ? String(row.last_seen) : null,
  };
}

/** Heartbeat: mark an admin as online right now. */
export async function adminHeartbeat(telegramUserId: string): Promise<void> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE vanta_admins SET last_seen = ? WHERE telegram_user_id = ?`,
    args: [now, telegramUserId],
  });
}

/** List active admins (owner + admins). */
export async function listAdmins(): Promise<AdminRecord[]> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_admins WHERE is_active = 1 ORDER BY added_at ASC`,
    args: [],
  });
  return result.rows.map(rowToAdmin);
}

/** Update an admin's stored Telegram username (refreshed from the live profile). */
export async function updateAdminUsername(
  id: number,
  telegramUsername: string,
): Promise<void> {
  const db = await getStoreDb();
  await db.execute({
    sql: `UPDATE vanta_admins SET telegram_username = ? WHERE id = ?`,
    args: [telegramUsername, id],
  });
}

/** Add an admin (owner only). Returns the new record. */
export async function addAdmin(
  telegramUserId: string,
  telegramUsername: string,
  nickname: string,
  addedBy: string,
): Promise<AdminRecord> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  // If this Telegram ID is already an admin (even inactive), reactivate instead of duplicating
  const existing = await db.execute({
    sql: `SELECT id FROM vanta_admins WHERE telegram_user_id = ? LIMIT 1`,
    args: [telegramUserId],
  });
  if (existing.rows.length > 0) {
    await db.execute({
      sql: `UPDATE vanta_admins SET is_active = 1, role = 'admin', telegram_username = ?, nickname = ?, added_by = ?, added_at = ? WHERE telegram_user_id = ?`,
      args: [telegramUsername, nickname, addedBy, now, telegramUserId],
    });
    return rowToAdmin({
      id: Number(existing.rows[0].id),
      telegram_user_id: telegramUserId,
      telegram_username: telegramUsername,
      nickname,
      role: "admin",
      added_by: addedBy,
      added_at: now,
      is_active: true,
    });
  }
  const result = await db.execute({
    sql: `INSERT INTO vanta_admins (telegram_user_id, telegram_username, nickname, role, added_by, added_at, is_active)
          VALUES (?, ?, ?, 'admin', ?, ?, 1)`,
    args: [telegramUserId, telegramUsername, nickname, addedBy, now],
  });
  const id = result.lastInsertRowid;
  if (id === null) throw new Error("Admin insert returned no id");
  return rowToAdmin({
    id,
    telegram_user_id: telegramUserId,
    telegram_username: telegramUsername,
    nickname,
    role: "admin",
    added_by: addedBy,
    added_at: now,
    is_active: 1,
  });
}

/** Remove (deactivate) an admin by telegram user id. Owner cannot be removed. */
export async function removeAdmin(telegramUserId: string): Promise<boolean> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `UPDATE vanta_admins SET is_active = 0 WHERE telegram_user_id = ? AND role = 'admin'`,
    args: [telegramUserId],
  });
  return (result.affectedRowCount ?? 0) > 0;
}

/** Resolve the calling user's admin status from Telegram initData or owner email header.
 *  Returns { isAdmin: boolean, isOwner: boolean, telegramUserId, role }.
 */
/**
 * True only when the request carries a valid CONSOLE-scoped session cookie
 * (minted by the APP_PASSWORD login — the only way one is ever issued) whose
 * user's email matches the configured owner email. A store-scoped session,
 * a forged/absent cookie, or no owner email configured all answer false.
 */
export async function isSignedOwnerSession(request: Request): Promise<boolean> {
  const sessionUserId = currentUserId(request);
  if (!sessionUserId) return false;
  const ownerEmail = consoleOwnerEmail();
  if (!ownerEmail) return false;
  const user = await getUserById(sessionUserId);
  if (!user) return false;
  return String(user.email).toLowerCase() === ownerEmail;
}

export async function resolveAdminStatus(
  request: Request,
  options: { maxAgeSeconds?: number } = {},
): Promise<{
  isAdmin: boolean;
  isOwner: boolean;
  telegramUserId: string | null;
  role: "owner" | "admin" | null;
}> {
  // A stale or forged initData header must degrade to "not a Telegram admin",
  // not throw. assertTelegramAuth deliberately throws on a bad signature, and
  // callers such as requireStoreAdmin would surface that as a 500 on every
  // admin page instead of the correct 403/anonymous render. The signed web
  // session below still gets a chance to resolve the caller.
  let telegramUserId: number | null = null;
  try {
    telegramUserId = await assertTelegramAuth(request, options);
  } catch {
    telegramUserId = null;
  }
  if (telegramUserId !== null) {
    const ownerIdRaw = process.env.STORE_ADMIN_TELEGRAM_ID ?? "";
    const ownerId = ownerIdRaw ? Number(ownerIdRaw) : null;
    if (ownerId !== null && telegramUserId === ownerId) {
      return { isAdmin: true, isOwner: true, telegramUserId: String(telegramUserId), role: "owner" };
    }

    const db = await getStoreDb();
    const result = await db.execute({
      sql: `SELECT role FROM vanta_admins WHERE telegram_user_id = ? AND is_active = 1 LIMIT 1`,
      args: [telegramUserId],
    });
    if (result.rows.length > 0) {
      return {
        isAdmin: true,
        isOwner: false,
        telegramUserId: String(telegramUserId),
        role: String(result.rows[0].role ?? "admin") as "admin",
      };
    }

    return { isAdmin: false, isOwner: false, telegramUserId: String(telegramUserId), role: null };
  }

  // Web session fallback: a customer logged in via email/password whose
  // account has a linked Telegram identity resolves through that identity.
  // Storefront sessions are store-scoped; a console session is not a customer.
  const sessionUserId = verifySessionToken(
    readRequestCookie(request, SESSION_COOKIE),
    "store",
  );
  if (sessionUserId) {
    const db = await getStoreDb();
    const identity = await db.execute({
      sql: `SELECT platform_user_id FROM vanta_platform_identities WHERE platform = 'telegram' AND customer_id = ? LIMIT 1`,
      args: [sessionUserId],
    });
    if (identity.rows.length > 0) {
      const tgId = String(identity.rows[0].platform_user_id);
      const ownerIdRaw = process.env.STORE_ADMIN_TELEGRAM_ID ?? "";
      const ownerId = ownerIdRaw ? Number(ownerIdRaw) : null;
      if (ownerId !== null && Number(tgId) === ownerId) {
        return { isAdmin: true, isOwner: true, telegramUserId: tgId, role: "owner" };
      }
      const result = await db.execute({
        sql: `SELECT role FROM vanta_admins WHERE telegram_user_id = ? AND is_active = 1 LIMIT 1`,
        args: [tgId],
      });
      if (result.rows.length > 0) {
        return {
          isAdmin: true,
          isOwner: false,
          telegramUserId: tgId,
          role: String(result.rows[0].role ?? "admin") as "admin",
        };
      }
    }
  }

  // Owner by SIGNED session only. The header this replaces (`x-owner-email`
  // matched against STORE_OWNER_EMAIL) was a plain request value: the browser
  // stored the owner email in localStorage and replayed it on every call, so
  // anyone who learned the address — it was public in source — held owner.
  // Now the ONLY web owner path is the console-password session cookie
  // (HMAC-signed, console-scoped) whose user's email matches env
  // CONSOLE_OWNER_EMAIL/STORE_OWNER_EMAIL.
  if (await isSignedOwnerSession(request)) {
    return { isAdmin: true, isOwner: true, telegramUserId: null, role: "owner" };
  }

  // REMOVED — the unsigned-cookie admin fallback that used to live here.
  // It granted OWNER (isAdmin AND isOwner) from a plain, client-settable
  // `vanta_telegram_id` cookie. Proven live before removal:
  //   Cookie: vanta_telegram_id=<owner id>  ->  200 on /api/store/admin/orders,
  //   /api/store/pricing and /api/store/admin/admins
  // with no Telegram initData and no signed session — a full owner takeover
  // for anyone who knows the id.
  //
  // The cookie itself still exists: link-telegram-id uses it to attach a
  // Telegram id to a WEB CUSTOMER, and getStoreCustomer() is what reads it.
  // Admin authority now comes only from the two SIGNED paths above —
  // signature-verified Telegram initData, or an HMAC session cookie. The
  // x-owner-email fallback stays because its value is server-only and
  // cannot be learned by a caller.

  return { isAdmin: false, isOwner: false, telegramUserId: null, role: null };
}
