/**
 * VANTA GARAGE — in-app store credit ("wallet").
 *
 * Credits are bought up-front through a checkout-style flow (PayFast EFT,
 * exactly like a product purchase) and are then spendable as a payment
 * method on any order. The wallet is the customer's balance row plus an
 * append-only ledger of every movement.
 *
 * Money-safety rules encoded here:
 *   - A debit is ONE conditional UPDATE (balance_cents >= amount). Two
 *     concurrent spends cannot both succeed against the same cents — the
 *     loser reads the fresh balance and fails, exactly like confirmPayment's
 *     one-shot payment_state flip in checkout.ts.
 *   - A credit runs on the same conditional pattern in reverse, so a
 *     replayed PayFast ITN cannot credit twice.
 *   - Every movement records balance_after_cents so the ledger reconciles.
 */

import { getStoreDb } from "../store-db.ts";

export type WalletTxnType =
  | "topup"
  | "order_payment"
  | "admin_credit"
  | "admin_debit"
  | "refund";

export type WalletTxn = {
  id: string;
  customerId: string;
  type: WalletTxnType;
  amountCents: number;
  balanceAfterCents: number;
  status: "pending" | "completed" | "failed";
  reference: string | null;
  note: string | null;
  createdAt: string;
};

export type Wallet = {
  customerId: string;
  balanceCents: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

/** The customer's balance row, created on first touch (0 by default). */
/** Customer ids arrive as numbers everywhere else in the store — accept both. */
function id(input: string | number): string {
  return String(input);
}

export async function getOrCreateWallet(customerId: string | number): Promise<Wallet> {
  const db = await getStoreDb();
  const cid = id(customerId);
  const existing = await db.execute({
    sql: `SELECT customer_id, balance_cents FROM vanta_wallet WHERE customer_id = ?`,
    args: [cid],
  });
  if (existing.rows.length > 0) {
    return {
      customerId: String(existing.rows[0].customer_id),
      balanceCents: Number(existing.rows[0].balance_cents ?? 0),
    };
  }
  const now = nowIso();
  await db.execute({
    sql: `INSERT INTO vanta_wallet (customer_id, balance_cents, created_at, updated_at)
          VALUES (?, 0, ?, ?)
          ON CONFLICT(customer_id) DO NOTHING`,
    args: [cid, now, now],
  });
  return { customerId: cid, balanceCents: 0 };
}

export async function getWalletBalance(customerId: string | number): Promise<number> {
  const wallet = await getOrCreateWallet(customerId);
  return wallet.balanceCents;
}

export type CreditResult =
  | { ok: true; balanceCents: number; txnId: string }
  | { ok: false; reason: "already_credited" | "insert_failed" };

/**
 * Add credits. `reference` is the idempotency key for the movement (the
 * PayFast payment id for a top-up, the order id for a refund): a replay
 * with a COMPLETED ledger row of the same reference returns
 * already_credited instead of double-crediting.
 */
export async function creditWallet(input: {
  customerId: string | number;
  amountCents: number;
  type: WalletTxnType;
  reference?: string | null;
  note?: string | null;
  markCompleted?: boolean;
}): Promise<CreditResult> {
  const customerId = id(input.customerId);
  const { amountCents, type, reference = null, note = null } = input;
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Credit amount must be a positive integer of cents");
  }
  const db = await getStoreDb();
  await getOrCreateWallet(customerId);

  if (reference) {
    const prior = await db.execute({
      sql: `SELECT id, status FROM vanta_wallet_txns
            WHERE reference = ? AND type = ? AND status = 'completed'
            LIMIT 1`,
      args: [reference, type],
    });
    if (prior.rows.length > 0) {
      return { ok: false, reason: "already_credited" };
    }
  }

  // Race-free: the UPDATE only applies while the reference has no completed
  // row, so two simultaneous credits of the same reference cannot both land.
  const now = nowIso();
  const status = input.markCompleted === false ? "pending" : "completed";
  const inserted = await db.execute({
    sql: `INSERT INTO vanta_wallet_txns
            (customer_id, type, amount_cents, balance_after_cents, status, reference, note, created_at)
          VALUES (?, ?, ?, ?,
                  ?, ?, ?, ?)`,
    args: [
      customerId,
      type,
      amountCents,
      0, // filled by the balance UPDATE below
      status,
      reference,
      note,
      now,
    ],
  });
  const txnId = inserted.lastInsertRowid;
  if (txnId === null) return { ok: false, reason: "insert_failed" };

  const bumped = await db.execute({
    sql: `UPDATE vanta_wallet
          SET balance_cents = balance_cents + ?, updated_at = ?
          WHERE customer_id = ?`,
    args: [amountCents, now, customerId],
  });
  if (bumped.affectedRowCount === 0) {
    return { ok: false, reason: "insert_failed" };
  }
  const fresh = await db.execute({
    sql: `SELECT balance_cents FROM vanta_wallet WHERE customer_id = ?`,
    args: [customerId],
  });
  const balanceCents = Number(fresh.rows[0]?.balance_cents ?? 0);
  await db.execute({
    sql: `UPDATE vanta_wallet_txns SET balance_after_cents = ? WHERE id = ?`,
    args: [balanceCents, txnId],
  });
  return { ok: true, balanceCents, txnId: String(txnId) };
}

export type DebitResult =
  | { ok: true; balanceCents: number; txnId: string }
  | { ok: false; reason: "insufficient_funds" | "insert_failed" };

/**
 * Spend credits. ONE conditional UPDATE: only succeeds while the balance
 * covers the amount, so concurrent spends of the same cents cannot both
 * land. `reference` (the order id) keeps the ledger idempotent per order.
 */
export async function debitWallet(input: {
  customerId: string | number;
  amountCents: number;
  type: WalletTxnType;
  reference?: string | null;
  note?: string | null;
}): Promise<DebitResult> {
  const customerId = id(input.customerId);
  const { amountCents, type, reference = null, note = null } = input;
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Debit amount must be a positive integer of cents");
  }
  if (reference) {
    const prior = await (await getStoreDb()).execute({
      sql: `SELECT id FROM vanta_wallet_txns
            WHERE reference = ? AND type = ? AND status = 'completed'
            LIMIT 1`,
      args: [reference, type],
    });
    if (prior.rows.length > 0) {
      const wallet = await getOrCreateWallet(customerId);
      return { ok: true, balanceCents: wallet.balanceCents, txnId: String(prior.rows[0].id) };
    }
  }

  const db = await getStoreDb();
  const now = nowIso();
  const flipped = await db.execute({
    sql: `UPDATE vanta_wallet
          SET balance_cents = balance_cents - ?, updated_at = ?
          WHERE customer_id = ? AND balance_cents >= ?`,
    args: [amountCents, now, customerId, amountCents],
  });
  if (flipped.affectedRowCount === 0) {
    return { ok: false, reason: "insufficient_funds" };
  }
  const fresh = await db.execute({
    sql: `SELECT balance_cents FROM vanta_wallet WHERE customer_id = ?`,
    args: [customerId],
  });
  const balanceCents = Number(fresh.rows[0]?.balance_cents ?? 0);
  const inserted = await db.execute({
    sql: `INSERT INTO vanta_wallet_txns
            (customer_id, type, amount_cents, balance_after_cents, status, reference, note, created_at)
          VALUES (?, ?, ?, ?, 'completed', ?, ?, ?)`,
    args: [customerId, type, amountCents, balanceCents, reference, note, now],
  });
  const txnId = inserted.lastInsertRowid;
  if (txnId === null) return { ok: false, reason: "insert_failed" };
  return { ok: true, balanceCents, txnId: String(txnId) };
}

/** Mark a pending top-up completed (the PayFast ITN path credits via
 *  creditWallet, this only reconciles a stuck pending row). */
export async function completePendingTxn(
  txnId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const db = await getStoreDb();
  const res = await db.execute({
    sql: `UPDATE vanta_wallet_txns SET status = 'completed' WHERE id = ? AND status = 'pending'`,
    args: [txnId],
  });
  if (res.affectedRowCount === 0) {
    return { ok: false, reason: "not_pending" };
  }
  return { ok: true };
}

export async function failPendingTxn(txnId: string): Promise<void> {
  const db = await getStoreDb();
  await db.execute({
    sql: `UPDATE vanta_wallet_txns SET status = 'failed' WHERE id = ? AND status = 'pending'`,
    args: [txnId],
  });
}

/** Ledger for one customer, newest first. */
export async function listWalletTxns(
  customerId: string | number,
  limit = 50,
): Promise<WalletTxn[]> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT id, customer_id, type, amount_cents, balance_after_cents, status, reference, note, created_at
          FROM vanta_wallet_txns
          WHERE customer_id = ?
          ORDER BY datetime(created_at) DESC, id DESC
          LIMIT ?`,
    args: [customerId, limit],
  });
  return result.rows.map((row) => ({
    id: String(row.id),
    customerId: String(row.customer_id),
    type: String(row.type) as WalletTxnType,
    amountCents: Number(row.amount_cents ?? 0),
    balanceAfterCents: Number(row.balance_after_cents ?? 0),
    status: String(row.status ?? "pending") as WalletTxn["status"],
    reference: row.reference === null ? null : String(row.reference),
    note: row.note === null ? null : String(row.note),
    createdAt: String(row.created_at ?? ""),
  }));
}

/** A top-up record awaiting payment, keyed by its ledger reference. */
export async function getPendingTopup(
  txnId: string | number,
): Promise<{ txn: WalletTxn; wallet: Wallet } | null> {
  const db = await getStoreDb();
  const res = await db.execute({
    sql: `SELECT id, customer_id, type, amount_cents, balance_after_cents, status, reference, note, created_at
          FROM vanta_wallet_txns WHERE id = ? AND type = 'topup' LIMIT 1`,
    args: [txnId],
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  const wallet = await getOrCreateWallet(String(row.customer_id));
  return {
    txn: {
      id: String(row.id),
      customerId: String(row.customer_id),
      type: "topup",
      amountCents: Number(row.amount_cents ?? 0),
      balanceAfterCents: Number(row.balance_after_cents ?? 0),
      status: String(row.status ?? "pending") as WalletTxn["status"],
      reference: row.reference === null ? null : String(row.reference),
      note: row.note === null ? null : String(row.note),
      createdAt: String(row.created_at ?? ""),
    },
    wallet,
  };
}