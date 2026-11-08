/** VANTA GARAGE — admin & owner management.
 *
 * Owner = STORE_ADMIN_TELEGRAM_ID env var (you, hardcoded).
 * Admins = rows in vanta_admins table, added/removed by the owner.
 */

import { getStoreDb } from "../store-db.ts";
import { assertTelegramAuth } from "../telegram";

export type AdminRecord = {
  id: number;
  telegramUserId: string;
  telegramUsername: string;
  role: "owner" | "admin";
  addedBy: string | null;
  addedAt: string;
  isActive: boolean;
};

function rowToAdmin(row: Record<string, unknown>): AdminRecord {
  return {
    id: Number(row.id),
    telegramUserId: String(row.telegram_user_id),
    telegramUsername: String(row.telegram_username ?? ""),
    role: (row.role as "owner" | "admin") ?? "admin",
    addedBy: row.added_by ? String(row.added_by) : null,
    addedAt: String(row.added_at ?? ""),
    isActive: Number(row.is_active ?? 0) === 1,
  };
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

/** Add an admin (owner only). Returns the new record. */
export async function addAdmin(
  telegramUserId: string,
  telegramUsername: string,
  addedBy: string,
): Promise<AdminRecord> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO vanta_admins (telegram_user_id, telegram_username, role, added_by, added_at, is_active)
          VALUES (?, ?, 'admin', ?, ?, 1)`,
    args: [telegramUserId, telegramUsername, addedBy, now],
  });
  const id = result.lastInsertRowid;
  if (id === null) throw new Error("Admin insert returned no id");
  return rowToAdmin({
    id,
    telegram_user_id: telegramUserId,
    telegram_username: telegramUsername,
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
export async function resolveAdminStatus(request: Request): Promise<{
  isAdmin: boolean;
  isOwner: boolean;
  telegramUserId: string | null;
  role: "owner" | "admin" | null;
}> {
  const telegramUserId = await assertTelegramAuth(request);
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

  // Web fallback: check X-Owner-Email header against STORE_OWNER_EMAIL env var
  const ownerEmail = request.headers.get("x-owner-email");
  const ownerEmailEnv = process.env.STORE_OWNER_EMAIL ?? "";
  if (ownerEmail && ownerEmailEnv && ownerEmail.toLowerCase() === ownerEmailEnv.toLowerCase()) {
    return { isAdmin: true, isOwner: true, telegramUserId: null, role: "owner" };
  }

  return { isAdmin: false, isOwner: false, telegramUserId: null, role: null };
}
