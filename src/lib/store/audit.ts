/**
 * VANTA GARAGE — Audit logging.
 * Logs all state-changing operations for audit trail and compliance.
 */

import { getStoreDb } from "../store-db.ts";

export type AuditLogEntry = {
  id: number;
  actorTheme: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string;
  createdAt: string;
};

function rowToAuditLog(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: Number(row.id),
    actorTheme: String(row.actor_theme ?? ""),
    actorUserId: String(row.actor_user_id ?? ""),
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id ?? ""),
    details: String(row.details ?? "{}"),
    createdAt: String(row.created_at),
  };
}

export async function logAction(
  actorTheme: string | null,
  actorUserId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown>,
): Promise<void> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO vanta_audit_logs (actor_theme, actor_user_id, action, entity_type, entity_id, details, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [actorTheme, actorUserId, action, entityType, entityId ?? null, JSON.stringify(details), now],
  });
}