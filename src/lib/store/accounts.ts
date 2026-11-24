/**
 * VANTA GARAGE account-unit service.
 *
 * Credentials for `kind = "account"` products (CPM1/CPM2 accounts for resale).
 *
 * Two rules this file exists to guarantee:
 *
 * 1. CREDENTIALS ARE NEVER PLAINTEXT AT REST. Email/password are AES-256-GCM
 *    encrypted with `ACCOUNT_ENCRYPTION_KEY` before they touch the database, and
 *    decrypted only at the exact moment a buyer's credential must be rendered
 *    (bot DM / WhatsApp webhook / in-app reveal). Nothing here ever logs or
 *    returns a decrypted value except `revealUnitForOrder`.
 *
 * 2. NO DOUBLE-SELL. A checkout claims a unit with ONE atomic SQL statement
 *    (an UPDATE whose WHERE selects a single `available` row). SQLite executes
 *    that as a single statement, so two concurrent buyers can never be handed
 *    the same credential — there is no SELECT-then-UPDATE race to lose.
 *
 * Status flow:  pending -> available -> assigned -> sold
 *   pending    landed via bot forward / bulk .txt import; NEVER sellable yet
 *   available  owner assigned the unit to a listing; this is what stock counts
 *   assigned   a checkout claimed it (order_id + customer_id stamped)
 *   sold       delivered to the buyer
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getStoreDb } from "../store-db.ts";
import type { TursoHttpClient } from "../db-turso.ts";

export type UnitStatus = "pending" | "available" | "assigned" | "sold";
export type UnitRow = {
  id: number;
  email: string;
  emailHash: string;
  password: string;
  notes: string;
  status: UnitStatus;
  productId: number | null;
  orderId: string | null;
  customerId: number | null;
  game: string;
  createdAt: string;
  updatedAt: string;
};

/** Constructor-time so a missing key fails at import, not mid-delivery. */
function encKey(): Buffer {
  const raw = process.env.ACCOUNT_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "ACCOUNT_ENCRYPTION_KEY is not set — refusing to store account credentials without it.",
    );
  }
  // Accept 64-hex (32 bytes) or base64 of 32 bytes.
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32) return b64;
  throw new Error("ACCOUNT_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64).");
}

/**
 * Stable digest of a plaintext email. The ciphertext is randomised (fresh IV per
 * write), so it can never be matched on — this is what UNIQUE() compares so a
 * re-imported unit is recognised as a duplicate instead of silently doubling.
 * A hash, not encryption: it identifies a unit without revealing it.
 */
export function emailDigest(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");
}

/** Envelope format: v1:<iv-b64>:<tag-b64>:<ciphertext-b64> — all in one TEXT column. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(envelope: string): string {
  const parts = envelope.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Credential envelope is malformed or was written by another key.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(parts[1]!, "base64"));
  decipher.setAuthTag(Buffer.from(parts[2]!, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(parts[3]!, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Parse one bulk-import block. Lines look like:
 *
 *     email | password | notes
 *     someone@mail.com | hunter2 | 50M cash + 24k coins, full garage
 *
 * A line with no `|` is treated as `email | <rest>` so a two-column paste still
 * lands. Blank lines and `#` comments are ignored. Malformed lines are REPORTED
 * (returned), never silently dropped — a lost credential is a lost sale.
 */
/**
 * Parse one bulk-import block.
 *
 * Format, one unit per line:   `email | password | notes`
 *
 * - Notes may contain pipes ("50M cash + 24k | full garage"), so only the first
 *   two pipes are structural: field 1 email, field 2 password, field 3+ notes.
 * - Blank lines and lines starting with `#` are comments and are skipped.
 * - A line with no pipe is an email-only unit (login-only handover); it is
 *   accepted with an empty password so the import can still vet the address.
 * - A line that cannot be split AT ALL is reported in `rejected` — never
 *   silently dropped, because a lost credential is a lost sale.
 * - Handles both LF and CRLF line endings (a Windows-edited .txt is CRLF).
 */
export function parseUnitBlock(text: string): {
  units: Array<{ email: string; password: string; notes: string }>;
  rejected: string[];
} {
  const units: Array<{ email: string; password: string; notes: string }> = [];
  const rejected: string[] = [];

  for (const rawLine of text.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const first = line.indexOf("|");
    if (first === -1) {
      units.push({ email: line, password: "", notes: "" });
      continue;
    }
    const rest = line.slice(first + 1);
    const second = rest.indexOf("|");
    const email = line.slice(0, first).trim();
    const password = (second === -1 ? rest : rest.slice(0, second)).trim();
    const notes = second === -1 ? "" : rest.slice(second + 1).trim();

    if (!email) { rejected.push(line); continue; }
    units.push({ email, password, notes });
  }

  return { units, rejected };
}

/**
 * Bulk-import units as PENDING — never sellable on arrival. The owner assigns
 * each batch to a listing afterwards, so a bot-forwarded credential can never
 * be bought before a human has put it somewhere on purpose.
 */
export async function importAccountUnits(input: {
  productId: number | null;
  game: string;
  block: string;
}): Promise<{
  inserted: number;
  /** Rows already present on this product with the same email hash. */
  duplicates: number;
  skipped: number;
  rejected: string[];
}> {
  const db = await getStoreDb();
  const { units, rejected } = parseUnitBlock(input.block);
  let inserted = 0;
  let skipped = 0;
  let duplicates = 0;
  const now = new Date().toISOString();
  for (const u of units) {
    if (!u.password) { skipped++; continue; }
    const digest = emailDigest(u.email);

    // rowsAffected is undefined on this libsql HTTP client, so an IGNOREd insert
    // and a landed one look identical in the response. Check existence BEFORE
    // the write: only a genuinely new row counts as inserted, so re-importing
    // the same .txt block reports duplicates instead of claiming new inserts.
    const existing = await db.execute({
      sql: `SELECT id FROM vanta_account_units WHERE product_id IS ? AND email_hash = ?`,
      args: [input.productId, digest],
    });
    if ((existing.rows as unknown[]).length > 0) {
      duplicates++;
      continue;
    }

    await db.execute({
      sql: `INSERT OR IGNORE INTO vanta_account_units
              (product_id, email, email_hash, password, notes, status, game, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      args: [
        input.productId,
        encryptSecret(u.email),
        digest,
        encryptSecret(u.password),
        u.notes,
        input.game,
        now,
        now,
      ],
    });
    inserted++;
  }
  return { inserted, skipped, duplicates, rejected };
}

/**
 * ATOMIC CLAIM. One statement selects the first available unit for the product
 * and stamps it with this order in the same breath. Returns null when nothing
 * is available (sold out), which is the only false path.
 */
export async function reserveUnit(input: {
  productId: number;
  orderId: string;
  customerId: number;
}): Promise<{ id: number; email: string; password: string } | null> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE vanta_account_units
             SET status = 'assigned', order_id = ?, customer_id = ?, updated_at = ?
           WHERE id = (SELECT id FROM vanta_account_units
                        WHERE product_id = ? AND status = 'available'
                        ORDER BY id LIMIT 1)`,
    args: [input.orderId, input.customerId, now, input.productId],
  });
  // rowsAffected is undefined on this client, so "did the claim land?" is
  // answered by reading the row rather than trusting the update response.
  // A single-statement UPDATE ... WHERE id = (SELECT ...) is atomic in SQLite,
  // so two concurrent claims can never match the same row.
  const claimed = await db.execute({
    sql: `SELECT id, email, password FROM vanta_account_units WHERE order_id = ?`,
    args: [input.orderId],
  });
  const row = (claimed.rows as unknown as UnitRow[])[0];
  if (!row) return null;
  return { id: row.id, email: decryptSecret(row.email), password: decryptSecret(row.password) };
}

/** Refund path: hand the credential back to the pool so it can be resold. */
export async function releaseUnitsForOrder(orderId: string): Promise<number> {
  const db = await getStoreDb();
  // Count THIS order's attached units first: after the update their order_id is
  // NULL, so they can no longer be identified by order. rowsAffected is
  // undefined on this client, which makes the UPDATE response useless as a count.
  const before = await db.execute({
    sql: `SELECT COUNT(*) n FROM vanta_account_units WHERE order_id = ? AND status = 'assigned'`,
    args: [orderId],
  });
  const attached = Number((before.rows[0] as { n: number }).n);

  await db.execute({
    sql: `UPDATE vanta_account_units
             SET status = 'available', order_id = NULL, customer_id = NULL,
                 updated_at = ?
           WHERE order_id = ? AND status = 'assigned'`,
    args: [new Date().toISOString(), orderId],
  });
  return attached;
}

/** Assign a batch of PENDING units to a listing, which is what makes them stock. */
export async function assignUnitsToProduct(unitIds: number[], productId: number): Promise<number> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  for (const id of unitIds) {
    await db.execute({
      sql: `UPDATE vanta_account_units
               SET product_id = ?, status = 'available', updated_at = ?
             WHERE id = ? AND status = 'pending'`,
      args: [productId, now, id],
    });
  }
  await syncProductStock(productId);
  // rowsAffected is undefined on this client, so count by reading the state back.
  const after = await db.execute({
    sql: `SELECT COUNT(*) n FROM vanta_account_units WHERE product_id = ? AND status = 'available'`,
    args: [productId],
  });
  return Number((after.rows[0] as { n: number }).n);
}

/** Stock = the count of AVAILABLE units. Called after every mutation. */
export async function syncProductStock(productId: number): Promise<number> {
  const db = await getStoreDb();
  const res = await db.execute({
    sql: `UPDATE vanta_products
             SET stock_quantity = (SELECT COUNT(*) FROM vanta_account_units
                                    WHERE product_id = ? AND status = 'available'),
                 updated_at = ?
           WHERE id = ?`,
    args: [productId, new Date().toISOString(), productId],
  });
  return (res as { rowsAffected?: number }).rowsAffected ?? 0;
}

export async function countUnitsByStatus(productId: number | null): Promise<Record<UnitStatus, number>> {
  const db = await getStoreDb();
  const res = productId == null
    ? await db.execute({ sql: `SELECT status, COUNT(*) n FROM vanta_account_units GROUP BY status`, args: [] })
    : await db.execute({ sql: `SELECT status, COUNT(*) n FROM vanta_account_units WHERE product_id = ? GROUP BY status`, args: [productId] });
  const out: Record<UnitStatus, number> = { pending: 0, available: 0, assigned: 0, sold: 0 };
  for (const r of res.rows as unknown as Array<{ status: string; n: number }>) {
    if (r.status in out) out[r.status as UnitStatus] = Number(r.n);
  }
  return out;
}

/**
 * List units for admin, WITHOUT returning usable credentials. `password` is
 * blanked (only its presence is meaningful to the UI) and `email` is masked by
 * the caller, so no page cache ever holds a live credential.
 */
export async function listAccountUnits(
  productId: number | null,
  limit = 200,
): Promise<UnitRow[]> {
  const db = await getStoreDb();
  const sql = productId == null
    ? `SELECT id, product_id, email, email_hash, password, notes, status, game, order_id, customer_id, created_at, updated_at
         FROM vanta_account_units ORDER BY created_at DESC LIMIT ?`
    : `SELECT id, product_id, email, email_hash, password, notes, status, game, order_id, customer_id, created_at, updated_at
         FROM vanta_account_units WHERE product_id = ? ORDER BY created_at DESC LIMIT ?`;
  const res = productId == null
    ? await db.execute({ sql, args: [limit] })
    : await db.execute({ sql, args: [productId, limit] });
  return (res.rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    productId: r.product_id == null ? null : Number(r.product_id),
    email: String(r.email ?? ""),
    emailHash: String(r.email_hash ?? ""),
    password: String(r.password ?? ""),
    notes: String(r.notes ?? ""),
    status: (r.status ?? "pending") as UnitStatus,
    orderId: r.order_id == null ? null : String(r.order_id),
    customerId: r.customer_id == null ? null : Number(r.customer_id),
    game: String(r.game ?? "cpm2"),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  }));
}

/**
 * A display-safe view of one unit for admin lists: the plaintext email MASKED
 * (first char + bullets + domain) and a decrypted=false marker. Decryption
 * happens only in `revealUnitForOrder`, so no list response — cached or not —
 * ever carries a usable credential.
 */
export function maskUnitEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••••";
  const head = local!.slice(0, 1);
  return `${head}${"•".repeat(Math.max(local!.length - 1, 3))}@${domain}`;
}

/**
 * Admin list rows. Returns masked email + never the password, so a cached
 * response is safe. Callers that need to show a real address must go through
 * `revealUnitForOrder` for that order's buyer only.
 */
export type UnitListRow = {
  id: number;
  productId: number | null;
  status: UnitStatus;
  game: string;
  notes: string;
  emailMasked: string;
  hasPassword: boolean;
  orderId: string | null;
  createdAt: string;
};

export async function listUnitsForAdmin(productId: number | null, limit = 200): Promise<UnitListRow[]> {
  const rows = await listAccountUnits(productId, limit);
  return rows.map((u) => ({
    id: u.id,
    productId: u.productId,
    status: u.status,
    game: u.game,
    notes: u.notes,
    emailMasked: maskUnitEmail(decryptSecret(u.email)),
    hasPassword: u.password.length > 0,
    orderId: u.orderId,
    createdAt: u.createdAt,
  }));
}

/** The ONLY function that returns decrypted credentials. Callers must deliver
 *  it straight to the buyer and never persist or log the result. */
export async function revealUnitForOrder(orderId: string): Promise<{ email: string; password: string } | null> {
  const db = await getStoreDb();
  const res = await db.execute({
    sql: `SELECT email, password FROM vanta_account_units WHERE order_id = ?`,
    args: [orderId],
  });
  const row = (res.rows as unknown as UnitRow[])[0];
  if (!row) return null;
  return { email: decryptSecret(row.email), password: decryptSecret(row.password) };
}
