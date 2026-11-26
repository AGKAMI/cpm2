/**
 * VANTA GARAGE — Admin wallet desk.
 * The real "load balance" tool: see every customer's store credit, credit or
 * debit it manually, and watch the ledger across the store.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { request } from "@/lib/store/client";

type BalanceRow = {
  customerId: string;
  balanceCents: number;
  name: string | null;
  email: string | null;
  playerId: string | null;
  updatedAt: string;
};

type TxnRow = {
  id: string;
  customerId: string;
  type: string;
  amountCents: number;
  balanceAfterCents: number;
  status: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
  name: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  topup: "Top-up",
  order_payment: "Order payment",
  admin_credit: "Admin credit",
  admin_debit: "Admin debit",
  refund: "Refund",
};

export default function AdminWalletPage() {
  const [query, setQuery] = useState("");
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // the adjustment form
  const [customerId, setCustomerId] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      const data = await request<{ balances: BalanceRow[]; transactions: TxnRow[] }>(
        `/admin/wallet${qs}`,
      );
      setBalances(data.balances);
      setTxns(data.transactions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load wallets.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function adjust(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const cents = Math.round(Number(amount.replace(",", ".")) * 100);
      if (!customerId.trim() || !cents || cents <= 0) {
        throw new Error("Customer id and a positive amount are required.");
      }
      const res = await request<{ wallet: { balanceCents: number } }>("/admin/wallet/adjust", {
        method: "POST",
        body: JSON.stringify({
          customerId: customerId.trim(),
          direction,
          amountCents: cents,
          note: note.trim() || undefined,
        }),
      });
      setNotice(
        `Wallet updated — new balance R ${(res.wallet.balanceCents / 100).toFixed(2)}.`,
      );
      setAmount("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjustment failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <StoreShell>
      <PageHeading folio="AD" title="Admin - Wallet" backHref="/store" />
      <main className="mx-auto w-full max-w-3xl px-4 pb-24">
        <div className="mb-6 flex items-center gap-2">
          <Link
            href="/store/admin"
            className="inline-flex items-center gap-2 border-2 border-primary bg-primary px-4 py-2 text-[9px] font-bold uppercase tracking-[0.15em] whitespace-nowrap text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Catalogue
          </Link>
          <Link
            href="/store/admin/promotions"
            className="inline-flex items-center gap-2 border-2 border-primary bg-primary px-4 py-2 text-[9px] font-bold uppercase tracking-[0.15em] whitespace-nowrap text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Promotions
          </Link>
        </div>

        {/* Adjust */}
        <section className="panel rounded-xl border border-border p-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Load or adjust credit
          </h3>
          <form onSubmit={adjust} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Customer id
              </span>
              <input
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="123"
                className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Amount (ZAR)
              </span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
                className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Direction
              </span>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as "credit" | "debit")}
                className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
              >
                <option value="credit">Credit (add)</option>
                <option value="debit">Debit (remove)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Note
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Support load"
                className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Apply adjustment"}
              </Button>
            </div>
          </form>
          {notice && <p className="mt-3 text-xs text-ok">{notice}</p>}
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        </section>

        {/* Balances */}
        <section className="panel mt-4 rounded-xl border border-border p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Balances
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void load();
              }}
              className="flex gap-2"
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name / email / player id"
                className="w-56 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-foreground"
              />
              <Button variant="outline" size="sm" type="submit">
                Search
              </Button>
            </form>
          </div>
          {loading ? (
            <p className="mt-3 text-xs text-muted-foreground">Loading…</p>
          ) : balances.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No wallets yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {balances.map((b) => (
                <li key={b.customerId} className="flex items-center justify-between gap-3 py-3 text-xs">
                  <span className="min-w-0">
                    <span className="block font-bold text-foreground">{b.name ?? `Customer #${b.customerId}`}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      #{b.customerId}
                      {b.email ? ` · ${b.email}` : ""}
                      {b.playerId ? ` · ${b.playerId}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold tabular-nums text-foreground">
                      R {(b.balanceCents / 100).toFixed(2)}
                    </span>
                    <button
                      onClick={() => setCustomerId(b.customerId)}
                      className="text-[9px] uppercase tracking-[0.12em] text-primary underline"
                    >
                      Adjust
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Ledger */}
        <section className="panel mt-4 rounded-xl border border-border p-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Ledger (all customers)
          </h3>
          {txns.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No movements yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {txns.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-xs">
                  <span className="min-w-0">
                    <span className="block font-bold text-foreground">
                      {TYPE_LABELS[t.type] ?? t.type} · {t.name ?? `#${t.customerId}`}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {t.note ?? "—"} · {new Date(t.createdAt).toLocaleString("en-ZA")} · {t.status}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-bold tabular-nums ${
                      t.type === "order_payment" || t.type === "admin_debit" ? "text-destructive" : "text-ok"
                    }`}
                  >
                    {t.type === "order_payment" || t.type === "admin_debit" ? "−" : "+"}R{" "}
                    {(t.amountCents / 100).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </StoreShell>
  );
}
