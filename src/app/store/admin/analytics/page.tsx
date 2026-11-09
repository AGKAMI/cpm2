/** VANTA GARAGE — admin analytics & financial reporting UI.
 * /store/admin/analytics
 * Revenue trends, best sellers, conversion, CSV export.
 */

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/store/client";

type RevenuePoint = { date: string; amountCents: number; orders: number };
type BestSeller = { name: string; units: number; revenueCents: number };

export default function AnalyticsPage() {
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [bestSellers, setBestSellers] = useState<BestSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    loadAnalytics();
  }, [range]);

  async function loadAnalytics() {
    try {
      setLoading(true);
      const [revRes, sellersRes] = await Promise.all([
        fetch(`/api/store/admin/analytics/revenue?range=${range}`),
        fetch(`/api/store/admin/analytics/best-sellers?range=${range}`),
      ]);
      if (!revRes.ok) throw new Error("Failed to load revenue");
      if (!sellersRes.ok) throw new Error("Failed to load best sellers");
      const revData = await revRes.json();
      const sellersData = await sellersRes.json();
      setRevenue(revData.revenue ?? []);
      setBestSellers(sellersData.bestSellers ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }

  const totalRevenue = revenue.reduce((sum, r) => sum + r.amountCents, 0);
  const totalOrders = revenue.reduce((sum, r) => sum + r.orders, 0);

  if (loading) {
    return (
      <StoreShell>
        <PageHeading folio="AN" title="Analytics & Financial" backHref="/store/admin" />
        <p className="text-muted-foreground">Loading analytics…</p>
      </StoreShell>
    );
  }

  return (
    <StoreShell>
      <PageHeading folio="AN" title="Analytics & Financial" backHref="/store/admin" />

      {error && (
        <p className="mb-4 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          label="Total Revenue"
          value={formatPrice(totalRevenue)}
          sublabel={`Last ${range === "7d" ? "7 days" : range === "30d" ? "30 days" : "90 days"}`}
          icon="home"
        />
        <StatCard
          label="Orders"
          value={String(totalOrders)}
          sublabel="Completed orders"
          icon="list"
        />
        <StatCard
          label="Avg Order Value"
          value={
            totalOrders > 0
              ? formatPrice(Math.round(totalRevenue / totalOrders))
              : "R0.00"
          }
          sublabel="Revenue ÷ orders"
          icon="grid"
        />
        <StatCard
          label="Best Sellers"
          value={String(bestSellers.length)}
          sublabel="Top products this period"
          icon="person"
        />
      </div>

      {/* Range selector */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Period:</span>
          <div className="flex border border-border rounded-lg">
            {["7d", "30d", "90d"].map((r) => (
              <Button
                key={r}
                variant={range === r ? "primary" : "outline"}
                size="sm"
                onClick={() => setRange(r as "7d" | "30d" | "90d")}
              >
                {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue chart (text-based sparkline) */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Trend</h3>
        <div className="panel rounded-xl border border-border p-6 h-48 flex items-end gap-1">
          {revenue.map((point, i) => {
            const max = Math.max(...revenue.map((r) => r.amountCents));
            const height = max > 0 ? (point.amountCents / max) * 100 : 0;
            return (
              <div
                key={i}
                className="flex flex-col items-center justify-end w-full h-full gap-1"
                style={{ flex: 1 }}
              >
                <div
                  className="w-full bg-gold rounded-t"
                  style={{ height: `${Math.max(height, 10)}%` }}
                />
                <span className="text-[9px] text-muted-foreground">
                  {point.date}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Daily revenue (ZAR)
        </p>
      </section>

      {/* Best sellers table */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Best Sellers</h3>
          <Button variant="outline" size="sm" onClick={() => exportCSV(revenue, range)}>
            Export CSV
          </Button>
        </div>
        <div className="panel rounded-xl border border-border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-deep">
              <tr>
                <th className="px-4 py-3 text-[10px] text-muted-foreground uppercase font-bold">
                  Vehicle
                </th>
                <th className="px-4 py-3 text-[10px] text-muted-foreground uppercase font-bold text-right">
                  Units
                </th>
                <th className="px-4 py-3 text-[10px] text-muted-foreground uppercase font-bold text-right">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody>
              {bestSellers.map((s) => (
                <tr key={s.name} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground">{s.name}</td>
                  <td className="px-4 py-3 text-right text-foreground">{s.units}</td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {formatPrice(s.revenueCents)}
                  </td>
                </tr>
              ))}
              {bestSellers.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground">
                    No sales data yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </StoreShell>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  icon,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: string;
}) {
  return (
    <article className="panel rounded-xl border border-border p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.15em]">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-[10px] text-muted-foreground">{sublabel}</p>
        </div>
        <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-surface-deep">
          <span className="w-4 h-4 shrink-0" dangerouslySetInnerHTML={{ __html: ICONS[icon] }} />
        </span>
      </div>
    </article>
  );
}

function exportCSV(rev: RevenuePoint[], rng: string) {
  const csv =
    "date,amount_cents,orders\n" +
    rev
      .map((r) => `${r.date},${r.amountCents},${r.orders}`)
      .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vanta-revenue-${rng}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const ICONS: Record<string, string> = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" ry="1"/><rect x="14" y="3" width="7" height="7" rx="1" ry="1"/><rect x="14" y="14" width="7" height="7" rx="1" ry="1"/><rect x="3" y="14" width="7" height="7" rx="1" ry="1"/></svg>`,
  person: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"><circle cx="12" cy="7" r="4"/></path></svg>`,
};
