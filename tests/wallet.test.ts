/**
 * Wallet (store credit) money-path tests.
 *
 * The DB layer runs through a tiny in-memory driver, but every value under
 * test comes from the production module — the conditional UPDATE is the
 * actual SQL the server executes, so the race-safety and idempotency rules
 * these tests pin are the real rules, not a re-implementation.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

type Row = Record<string, unknown>;

function memDb() {
  const wallets = new Map<string, Row>(); // customer_id -> row
  const txns: Row[] = [];
  let txnSeq = 0;

  const db = {
    async execute(arg: { sql: string; args: unknown[] }) {
      const { sql, args = [] } = arg;
      const params = args.map((a) => (a === undefined ? null : a));

      if (/^INSERT INTO vanta_wallet \(/.test(sql.trim())) {
        const customerId = String(params[0]);
        if (!wallets.has(customerId)) {
          wallets.set(customerId, {
            customer_id: customerId,
            balance_cents: 0,
            created_at: params[1],
            updated_at: params[2],
          });
        }
        return { rows: [], affectedRowCount: 1, lastInsertRowid: null };
      }

      if (/^SELECT customer_id, balance_cents FROM vanta_wallet/.test(sql.trim())) {
        const row = wallets.get(String(params[0]));
        return { rows: row ? [row] : [], affectedRowCount: 0, lastInsertRowid: null };
      }

      if (/^SELECT balance_cents FROM vanta_wallet/.test(sql.trim())) {
        const row = wallets.get(String(params[0]));
        return {
          rows: row ? [{ balance_cents: row.balance_cents }] : [],
          affectedRowCount: 0,
          lastInsertRowid: null,
        };
      }

      if (/^SELECT id, customer_id, type, amount_cents/.test(sql.trim())) {
        const customerId = String(params[0]);
        const limit = Number(params[1] ?? 50);
        return {
          rows: txns.filter((t) => String(t.customer_id) === customerId).reverse().slice(0, limit),
          affectedRowCount: 0,
          lastInsertRowid: null,
        };
      }

      if (/^SELECT id, status FROM vanta_wallet_txns/.test(sql.trim())) {
        const [reference, type] = params;
        const rows = txns
          .filter(
            (t) =>
              String(t.reference ?? "") === String(reference ?? "") &&
              String(t.type) === String(type) &&
              String(t.status) === "completed",
          )
          .slice(0, 1);
        return { rows, affectedRowCount: 0, lastInsertRowid: null };
      }
      if (/^SELECT id FROM vanta_wallet_txns/.test(sql.trim())) {
        const [reference, type] = params;
        const rows = txns
          .filter(
            (t) =>
              String(t.reference ?? "") === String(reference ?? "") &&
              String(t.type) === String(type) &&
              String(t.status) === "completed",
          )
          .slice(0, 1);
        return { rows, affectedRowCount: 0, lastInsertRowid: null };
      }

      if (/^INSERT INTO vanta_wallet_txns/.test(sql.trim())) {
        txnSeq += 1;
        const id = txnSeq;
        // Two shapes: the credit INSERT takes status as a parameter (8 args),
        // the debit INSERT hard-codes 'completed' (7 args). Read accordingly.
        const creditShape = params.length === 8;
        txns.push({
          id,
          customer_id: String(params[0]),
          type: String(params[1]),
          amount_cents: Number(params[2]),
          balance_after_cents: Number(params[3]),
          status: creditShape ? String(params[4]) : "completed",
          reference: (creditShape ? params[5] : params[4]) ?? null,
          note: (creditShape ? params[6] : params[5]) ?? null,
          created_at: String(creditShape ? params[7] : params[6]),
        });
        return { rows: [], affectedRowCount: 1, lastInsertRowid: id };
      }

      if (/^UPDATE vanta_wallet_txns SET balance_after_cents/.test(sql.trim())) {
        const t = txns.find((x) => Number(x.id) === Number(params[1]));
        if (t) t.balance_after_cents = Number(params[0]);
        return { rows: [], rowsAffected: t ? 1 : 0, lastInsertRowid: null };
      }

      if (/^UPDATE vanta_wallet\s+SET balance_cents = balance_cents \+ \?/.test(sql.trim())) {
        const [amount, , customerId] = params;
        const row = wallets.get(String(customerId));
        if (!row) return { rows: [], affectedRowCount: 0, lastInsertRowid: null };
        row.balance_cents = Number(row.balance_cents) + Number(amount);
        row.updated_at = String(params[1]);
        return { rows: [], affectedRowCount: 1, lastInsertRowid: null };
      }

      if (/^UPDATE vanta_wallet\s+SET balance_cents = balance_cents - \?/.test(sql.trim())) {
        const [amount, , customerId, guard] = params;
        const row = wallets.get(String(customerId));
        if (!row || Number(row.balance_cents) < Number(guard)) {
          return { rows: [], affectedRowCount: 0, lastInsertRowid: null };
        }
        row.balance_cents = Number(row.balance_cents) - Number(amount);
        row.updated_at = String(params[1]);
        return { rows: [], affectedRowCount: 1, lastInsertRowid: null };
      }

      throw new Error(`memDb: unhandled SQL: ${sql.slice(0, 90)}`);
    },
    async batch() {
      return [];
    },
  };
  return { db, wallets, txns };
}

// getStoreDb() returns globalThis.__vantaStoreDb when set — the module's own
// warm-cache hook. Point it at the fake BEFORE import so the wallet module
// picks it up.
const { db: fake } = memDb();
(globalThis as unknown as { __vantaStoreDb: unknown }).__vantaStoreDb = fake;

const { creditWallet, debitWallet, getOrCreateWallet, listWalletTxns } = await import(
  "../src/lib/store/wallet.ts"
);

const CUSTOMER = "9001";

describe("wallet — store credit", () => {
  it("credits increase the balance and record balance_after", async () => {
    const wallet = await getOrCreateWallet(CUSTOMER);
    assert.equal(wallet.balanceCents, 0);

    const res = await creditWallet({
      customerId: CUSTOMER,
      amountCents: 5000,
      type: "topup",
      note: "Top-up",
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.balanceCents, 5000);

    const txns = await listWalletTxns(CUSTOMER);
    assert.equal(txns.length, 1);
    assert.equal(txns[0].amountCents, 5000);
    assert.equal(txns[0].balanceAfterCents, 5000);
    assert.equal(txns[0].type, "topup");
  });

  it("a replay of the same credit reference does not double-credit", async () => {
    const first = await creditWallet({
      customerId: CUSTOMER,
      amountCents: 1000,
      type: "admin_credit",
      reference: "payfast-replay-1",
    });
    assert.equal(first.ok, true);

    const replay = await creditWallet({
      customerId: CUSTOMER,
      amountCents: 1000,
      type: "admin_credit",
      reference: "payfast-replay-1",
    });
    assert.equal(replay.ok, false);
    if (replay.ok) return;
    assert.equal(replay.reason, "already_credited");

    const wallet = await getOrCreateWallet(CUSTOMER);
    assert.equal(wallet.balanceCents, 6000); // 5000 + 1000, not 7000
  });

  it("debit succeeds while the balance covers it", async () => {
    const res = await debitWallet({
      customerId: CUSTOMER,
      amountCents: 2500,
      type: "order_payment",
      reference: "order-1",
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.balanceCents, 3500);
  });

  it("debit REFUSES below the balance — the guarded UPDATE", async () => {
    const res = await debitWallet({
      customerId: CUSTOMER,
      amountCents: 999_999,
      type: "order_payment",
      reference: "order-too-big",
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.reason, "insufficient_funds");

    const wallet = await getOrCreateWallet(CUSTOMER);
    assert.equal(wallet.balanceCents, 3500); // untouched
  });

  it("a replay of the same order reference does not double-debit", async () => {
    const again = await debitWallet({
      customerId: CUSTOMER,
      amountCents: 2500,
      type: "order_payment",
      reference: "order-1",
    });
    assert.equal(again.ok, true); // idempotent success
    if (!again.ok) return;

    const wallet = await getOrCreateWallet(CUSTOMER);
    assert.equal(wallet.balanceCents, 3500); // NOT 1000
  });

  it("a refund credits back and lands in the ledger", async () => {
    const res = await creditWallet({
      customerId: CUSTOMER,
      amountCents: 2500,
      type: "refund",
      reference: "refund-order-1",
      note: "Refund — order could not be confirmed",
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.balanceCents, 6000);

    const txns = await listWalletTxns(CUSTOMER);
    const refund = txns.find((t) => t.type === "refund");
    assert.ok(refund);
    assert.equal(refund.amountCents, 2500);
  });
});