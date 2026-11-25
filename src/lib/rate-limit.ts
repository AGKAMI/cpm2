/**
 * Durable rate limiting — one Turso table shared by both apps.
 *
 * The in-memory limiter in auth.ts kept counters in process memory, and on
 * serverless every invocation is a fresh module instance, so the counters
 * never accumulated: an attacker could spread attempts across invocations
 * and throttle nothing. This limiter writes to `vanta_rate_limits` (same
 * Turso database both apps already use), so a window is real across
 * invocations and instances.
 *
 * Keying MUST come from trustedClientIp() — never a client-supplied header.
 */

import { getStoreDb } from "./store-db.ts";

const DDL = `CREATE TABLE IF NOT EXISTS vanta_rate_limits (
  bucket       TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
)`;

let tableReady: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      const db = await getStoreDb();
      await db.execute({ sql: DDL, args: [] });
    })().catch((err) => {
      tableReady = null; // retry on the next call — a transient boot error
      throw err;
    });
  }
  return tableReady;
}

const MAX_ROWS = 50_000;

/**
 * Records one attempt under `key`. Returns true when the caller is over the
 * limit (caller should refuse), false otherwise. Failures fail OPEN: a
 * limiter outage must not lock legitimate users out of their own accounts,
 * and the real defence here is that the counter is no longer per-process.
 */
export async function checkDurableRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs);
  try {
    await ensureTable();
    const db = await getStoreDb();
    await db.execute({
      sql: `INSERT INTO vanta_rate_limits (bucket, window_start, count)
            VALUES (?, ?, 1)
            ON CONFLICT(bucket, window_start) DO UPDATE SET count = count + 1`,
      args: [key, windowStart],
    });
    const row = await db.execute({
      sql: `SELECT count FROM vanta_rate_limits WHERE bucket = ? AND window_start = ?`,
      args: [key, windowStart],
    });
    const count = Number(row.rows[0]?.count ?? 1);
    // Opportunistic pruning: expired windows are dead rows. Sampled so a
    // hot key does not prune on every attempt.
    if (Math.random() < 0.02) {
      await db.execute({
        sql: `DELETE FROM vanta_rate_limits WHERE window_start < ?`,
        args: [Math.floor((now - windowMs * 10) / windowMs)],
      }).catch(() => {});
      const total = await db.execute({ sql: `SELECT COUNT(*) c FROM vanta_rate_limits`, args: [] });
      if (Number(total.rows[0]?.c ?? 0) > MAX_ROWS) {
        await db.execute({
          sql: `DELETE FROM vanta_rate_limits WHERE rowid NOT IN (SELECT rowid FROM vanta_rate_limits ORDER BY window_start DESC LIMIT ?)`,
          args: [MAX_ROWS],
        }).catch(() => {});
      }
    }
    return count > maxAttempts;
  } catch {
    return false; // fail open
  }
}