/**
 * VANTA GARAGE — Central configuration layer.
 * All system configuration stored in vanta_system_config table.
 * Sensitive values are never exposed via the public API.
 */

import { getStoreDb } from "../store-db.ts";

export type ConfigEntry = {
  key: string;
  value: string;
  type: string;
  isSensitive: boolean;
  updatedAt: string;
};

function rowToConfig(row: Record<string, unknown>): ConfigEntry {
  return {
    key: String(row.key),
    value: String(row.value),
    type: String(row.type ?? "string"),
    isSensitive: Number(row.is_sensitive ?? 0) === 1,
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function getConfig(key: string): Promise<string | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_system_config WHERE key = ?`,
    args: [key],
  });
  if (result.rows.length === 0) return null;
  return rowToConfig(result.rows[0]).value;
}

export async function getConfigRaw(key: string): Promise<ConfigEntry | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_system_config WHERE key = ?`,
    args: [key],
  });
  if (result.rows.length === 0) return null;
  return rowToConfig(result.rows[0]);
}

export async function setConfig(key: string, value: string, type: string = "string", isSensitive: boolean = false): Promise<void> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  // Upsert: delete then insert (simple upsert for SQLite without UPSERT support in older versions)
  await db.execute({
    sql: `DELETE FROM vanta_system_config WHERE key = ?`,
    args: [key],
  });
  await db.execute({
    sql: `INSERT INTO vanta_system_config (key, value, type, is_sensitive, updated_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [key, value, type, isSensitive ? 1 : 0, now],
  });
}

export async function deleteConfig(key: string): Promise<void> {
  const db = await getStoreDb();
  await db.execute({
    sql: `DELETE FROM vanta_system_config WHERE key = ?`,
    args: [key],
  });
}

export async function listConfigs(includeSensitive: boolean = false): Promise<ConfigEntry[]> {
  const db = await getStoreDb();
  const sql = includeSensitive
    ? `SELECT * FROM vanta_system_config ORDER BY key`
    : `SELECT * FROM vanta_system_config WHERE is_sensitive = 0 ORDER BY key`;
  const result = await db.execute({ sql, args: [] });
  return result.rows.map(rowToConfig);
}