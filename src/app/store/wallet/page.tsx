/**
 * VANTA GARAGE — Wallet.
 * Buy in-app credits up-front (PayFast EFT, exactly like a product checkout)
 * and spend them as a payment method on any order. The ledger shows every
 * movement — top-ups, order payments, refunds and admin adjustments.
 */

"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { vantaApi, formatPrice } from "@/lib/store/client";

const PRESETS_CENTS = [5000, 10000, 20000, 50000]; // R50 / R100 / R200 / R500

const TYPE_LABELS: Record<string, string> = {
  topup: "Top-up",
  order_payment: "Order payment",
  admin_credit: "Credit (admin)",
  admin_debit: "Debit (admin)",
  refund: "Refund",
};

const STATUS_STYLES: Record<string, string> = {
  completed: "text-ok",
  pending: "text-gold",
  failed: "text-destructive",
};

type WalletResponse = {
  wallet: { balanceCents: number; currency: string };
  transactions: {
    id: string;
    type: string;
    amountCents: number;
    balanceAfterCents: number;
    status: string;
    reference: string | null;
    note: string | null;
    createdAt: string;
  }[];
};

function WalletPageInner() {
  const search = useSearchParams();
  const topupState = search.get("topup");
  const [data, setData] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [starting, setStarting] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await vantaApi.wallet());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your wallet.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function topUp(amountCents: number) {
    setStarting(amountCents);
    setError(null);
    try {
      const res = await vantaApi.topUpWallet({ amountCents });
      window.location.assign(res.redirectUrl); // PayFast EFT, like checkout
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the top-up.");
      setStarting(null);
    }
  }

  const customCents = Math.round(Number(custom.replace(",", ".")) * 100);

  return (
    <StoreShell>
      <PageHeading folio="W" title="Wallet" backHref="/store" />
      <main className="mx-auto w-full max-w-2xl px-4 pb-24">
        {topupState === "cancelled" && (
          <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            Top-up cancelled — nothing was charged.
          </p>
        )}
        {topupState === "pending" && (
          <p className="mb-4 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-xs text-gold">
            Payment received? Credits appear once PayFast confirms — refresh in a moment.
          </p>
        )}

        {/* Balance */}
        <section className="panel rounded-xl border border-border p-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Available credits
          </p>
          <p className="mt-2 text-4xl font-bold tabular-nums text-primary">
            {loading ? "—" : formatPrice(data?.wallet.balanceCents ?? 0, data?.wallet.currency ?? "ZAR")}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Spend these at checkout like any other payment method.
          </p>
        </section>

        {/* Buy credits */}
        <section className="panel mt-4 rounded-xl border border-border p-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Buy credits
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Paid by EFT via PayFast, exactly like a product checkout. Credits are added once
            payment is confirmed.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESETS_CENTS.map((cents) => (
              <Button
                key={cents}
                variant="outline"
                onClick={() => topUp(cents)}
                disabled={starting !== null}
              >
                {starting === cents ? "Opening…" : `R ${(cents / 100).toFixed(2)}`}
              </Button>
            ))}
          </div>
          <div className="mt-3 flex items-end gap-2">
            <label className="flex-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Custom amount (R10–R1000)
              </span>
              <input
                inputMode="decimal"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="150.00"
                className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
              />
            </label>
            <Button
              onClick={() => topUp(customCents)}
              disabled={starting !== null || !customCents || customCents < 1000 || customCents > 100000}
            >
              {starting === customCents ? "Opening…" : "Top up"}
            </Button>
          </div>
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
          <Link
            href="/store/support"
            className="mt-3 inline-block text-[11px] text-muted-foreground underline hover:text-foreground"
          >
            Need help with a top-up?
          </Link>
        </section>

        {/* Ledger */}
        <section className="panel mt-4 rounded-xl border border-border p-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            History
          </h3>
          {loading ? (
            <p className="mt-3 text-xs text-muted-foreground">Loading…</p>
          ) : !data || data.transactions.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No movements yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {data.transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-xs">
                  <span className="min-w-0">
                    <span className="block font-bold text-foreground">
                      {TYPE_LABELS[t.type] ?? t.type}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {t.note ?? "—"} · {new Date(t.createdAt).toLocaleString("en-ZA")}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`block font-bold tabular-nums ${
                        t.type === "order_payment" || t.type === "admin_debit"
                          ? "text-destructive"
                          : "text-ok"
                      }`}
                    >
                      {t.type === "order_payment" || t.type === "admin_debit" ? "−" : "+"}
                      {formatPrice(t.amountCents, data.wallet.currency)}
                    </span>
                    <span className={`block text-[9px] uppercase tracking-[0.12em] ${STATUS_STYLES[t.status] ?? "text-muted-foreground"}`}>
                      {t.status}
                    </span>
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

export default function WalletPage() {
  // useSearchParams() must sit inside a Suspense boundary for static
  // prerendering; the store hub wraps its own content the same way.
  return (
    <Suspense
      fallback={
        <StoreShell>
          <PageHeading folio="W" title="Wallet" backHref="/store" />
          <main className="mx-auto w-full max-w-2xl px-4 pb-24">
            <p className="text-xs text-muted-foreground">Loading…</p>
          </main>
        </StoreShell>
      }
    >
      <WalletPageInner />
    </Suspense>
  );
}
