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

  // Apply the VANTA schema idempotently on first boot — CREATE TABLE IF NOT EXISTS
  // is safe to run on every cold start (no-op when tables already exist).
  const statements = VANTA_SCHEMA.trim()
    .split(";")
    .filter((s) => s.trim())
    .map((s) => s.trim() + ";");

  await _store.batch(statements);

  // Run idempotent migrations (ALTER TABLE adds columns if missing; try/catch
  // makes this safe to re-run on every cold start — quickly no-ops when columns exist).
  await runStoreMigrations();

  return _store;
}

/** Run one-time schema migrations. Call once at deploy time, NOT on every cold start.
 *  Vercel serverless will hammer Turso if ALTER TABLE runs on every function invocation.
 */
export async function runStoreMigrations(): Promise<void> {
  const store = await getStoreDb();

  // Migration: add cpm2_car_code to existing vanta_products tables
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_products ADD COLUMN cpm2_car_code INTEGER`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add design-option columns (yes/no toggles, replace perf specs)
  for (const col of ['air_suspension', 'unlocked_bodykits']) {
    try {
      await store.execute({
        sql: `ALTER TABLE vanta_products ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`,
        args: [],
      });
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Migration: add spec columns (legacy — kept for old rows, no longer edited)
  for (const col of ['spec_hp', 'spec_top_speed', 'spec_zero_hundred', 'spec_drive']) {
    try {
      await store.execute({
        sql: `ALTER TABLE vanta_products ADD COLUMN ${col} ${col === 'spec_zero_hundred' || col === 'spec_drive' ? 'TEXT' : 'INTEGER'}`,
        args: [],
      });
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Migration: add email column to vanta_customers (if missing)
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_customers ADD COLUMN email TEXT NOT NULL DEFAULT ''`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add tag columns (is_new, is_sale) for corner badges
  for (const col of ['is_new', 'is_sale']) {
    try {
      await store.execute({
        sql: `ALTER TABLE vanta_products ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`,
        args: [],
      });
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Migration: add quantity column to vanta_orders (if missing)
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_orders ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add notifications_enabled column to vanta_customers (if missing)
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_customers ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }
}

export async function closeStoreDb(): Promise<void> {
  _store = null;
}
