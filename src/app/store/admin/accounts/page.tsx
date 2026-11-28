/** VANTA GARAGE — account credential import.
 * /store/admin/accounts
 * Admin: paste a .txt block of credentials and import them as PENDING units.
 */

"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { StoreShell } from "@/components/StoreShell";
import { AdminAccountsSkeleton } from "@/components/skeleton";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

/**
 * One line of the block is `email | password | notes`.
 * Lines starting with `#` and blank lines are ignored. This mirrors
 * parseUnitBlock in src/lib/store/accounts.ts — the server is the authority,
 * this only exists so the count below the box updates as you paste.
 */
function previewBlock(text: string): { units: number; comments: number; rejected: number } {
  let units = 0;
  let comments = 0;
  let rejected = 0;
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      if (line.startsWith("#")) comments++;
      continue;
    }
    const first = line.indexOf("|");
    if (first === -1) {
      units++; // email-only login, accepted with an empty password
    } else {
      const email = line.slice(0, first).trim();
      if (email) units++;
      else rejected++;
    }
  }
  return { units, comments, rejected };
}

type Product = {
  id: number;
  name: string;
  game: "cpm1" | "cpm2";
  stockQuantity: number;
};

type UnitRow = {
  id: number;
  emailMasked: string;
  status: string;
  orderId: string | null;
  notes: string;
};

type Counts = {
  pending: number;
  available: number;
  assigned: number;
  sold: number;
};

type ImportResult = {
  imported: number;
  duplicates: number;
  skipped: number;
  rejected: string[];
};

const FORMAT_HELP = `One unit per line:

buyer1@mail.com | the-password | 50M cash + 24k coins
buyer2@mail.com | another-pass | full garage

- Password is the 2nd field; anything after it is notes and may contain |
- Lines starting with # are comments
- Blank lines are skipped
- An email with no | is an email-only login`;

export default function AccountImportPage() {
  // null = the first load is still in flight (the skeleton shows until then)
  const [products, setProducts] = useState<Product[] | null>(null);
  const [productId, setProductId] = useState<number | null>(null);
  const [game, setGame] = useState<"cpm1" | "cpm2">("cpm2");
  const [block, setBlock] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [units, setUnits] = useState<UnitRow[]>([]);

  const loadUnits = useCallback(async (pid: number | null) => {
    if (pid === null) {
      setCounts(null);
      setUnits([]);
      return;
    }
    try {
      const res = await fetch(`/api/store/admin/accounts?productId=${pid}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setCounts(data.counts ?? null);
      setUnits(Array.isArray(data.units) ? data.units : []);
    } catch {
      // A failed refresh must not blank the counts the admin is looking at.
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/store/admin/products", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const accts = (Array.isArray(data.products) ? data.products : []).filter(
          (p: Product & { kind?: string }) => (p.kind ?? "car") === "account",
        );
        setProducts(accts);
        if (accts.length > 0) {
          setProductId(accts[0].id);
          setGame(accts[0].game ?? "cpm2");
          void loadUnits(accts[0].id);
        }
      } catch {
        // No product list yet — the paste box still works with no product
        // attached (units land in the pool awaiting assignment).
      }
    })();
  }, [loadUnits]);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!block.trim()) {
      setError("Paste at least one credential line.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/store/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId, game, block }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || "Import failed.");
      }
      const data = (await res.json()) as ImportResult;
      setResult(data);
      setBlock("");
      await loadUnits(productId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  const preview = previewBlock(block);

  if (products === null) {
    return (
      <StoreShell>
        <PageHeading folio="AD" title="Admin - Accounts" backHref="/store/admin" />
        <AdminAccountsSkeleton />
      </StoreShell>
    );
  }

  return (
    <StoreShell>
      <PageHeading folio="AC" title="Account Credentials" backHref="/store/admin" />

      {error && (
        <p className="mb-4 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {result && (
        <p className="mb-4 rounded-md border border-primary bg-primary px-3 py-2 text-xs text-primary">
          Imported {result.imported}
          {result.duplicates > 0 && ` · ${result.duplicates} already had`}
          {result.skipped > 0 && ` · ${result.skipped} skipped`}
          {result.rejected.length > 0 && ` · ${result.rejected.length} rejected`}
        </p>
      )}

      <section className="panel rounded-xl border border-border p-8 mb-8">
        <h3 className="text-sm font-semibold text-foreground mb-4">Import credentials</h3>
        <p className="text-[11px] text-muted-foreground mb-4">
          Paste a block of accounts. Passwords are encrypted the moment they arrive and are never
          shown again — this page only ever displays masked emails.
        </p>
        <form onSubmit={handleImport} className="space-y-3">
          {products.length > 0 && (
            <Field label="Account product" hint="Which listing these credentials belong to">
              <select
                className="w-full border border-input bg-background px-2 py-2 rounded text-sm text-foreground"
                value={productId ?? ""}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  setProductId(id);
                  const p = products.find((x) => x.id === id);
                  if (p) setGame(p.game);
                  void loadUnits(id);
                }}
              >
                <option value="">No product yet (pool only)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · stock {p.stockQuantity}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Game">
            <select
              className="w-full border border-input bg-background px-2 py-2 rounded text-sm text-foreground"
              value={game}
              onChange={(e) => setGame(e.target.value === "cpm1" ? "cpm1" : "cpm2")}
            >
              <option value="cpm2">CPM2</option>
              <option value="cpm1">CPM1</option>
            </select>
          </Field>

          <Field
            label="Credentials block"
            hint={
              block.trim()
                ? `${preview.units} unit(s)${preview.comments ? ` · ${preview.comments} comment line(s)` : ""}${
                    preview.rejected ? ` · ${preview.rejected} malformed` : ""
                  }`
                : FORMAT_HELP
            }
          >
            <textarea
              className="w-full min-h-[180px] border border-input bg-background px-3 py-2 rounded text-sm font-mono text-foreground"
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              placeholder={"buyer1@mail.com | password | notes"}
              spellCheck={false}
            />
          </Field>

          <Button type="submit" variant="primary" disabled={busy || !block.trim()}>
            {busy ? "Importing…" : "Import credentials"}
          </Button>
        </form>
      </section>

      {counts && (
        <section className="panel rounded-xl border border-border p-6 mb-8">
          <h3 className="text-sm font-semibold text-foreground mb-4">Stock by state</h3>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {(["pending", "available", "assigned", "sold"] as const).map((k) => (
              <div key={k} className="border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-[0.15em]">{k}</p>
                <p className="text-2xl font-bold text-foreground">{counts[k]}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {units.length > 0 && (
        <section className="panel rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Units (masked — passwords are never retrievable from here)
          </h3>
          <ul className="space-y-2">
            {units.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between border border-border rounded-lg px-3 py-2"
              >
                <span className="text-sm font-mono text-foreground">{u.emailMasked}</span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {u.orderId ? `sold · ${u.orderId}` : u.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {productId !== null && units.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No units imported for this product yet — paste a block above.
        </p>
      )}
    </StoreShell>
  );
}