/**
 * VANTA GARAGE store database client.
 * Shares the existing Turso connection (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN)
 * but uses isolated `vanta_` tables — logical separation from the CPM2 fleet schema.
 */

import type { TursoHttpClient } from "./db-turso.ts";
import { VANTA_SCHEMA } from "./store-schema.ts";

let _store: TursoHttpClient | null = null;

export async function getStoreDb(): Promise<TursoHttpClient> {
  if (_store) return _store;

  const { createTursoClient } = await import("./db-turso.ts");
  _store = await createTursoClient();

  // Apply the VANTA schema idempotently on first boot
  const statements = VANTA_SCHEMA.trim()
    .split(";")
    .filter((s) => s.trim())
    .map((s) => s.trim() + ";");

  await _store.batch(statements);

  // Migration: add cpm2_car_code to existing vanta_products tables
  // (CREATE TABLE IF NOT EXISTS won't add columns to existing tables)
  try {
    await _store.execute({
      sql: `ALTER TABLE vanta_products ADD COLUMN cpm2_car_code INTEGER`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  return _store;
}

export async function closeStoreDb(): Promise<void> {
  _store = null;
}
