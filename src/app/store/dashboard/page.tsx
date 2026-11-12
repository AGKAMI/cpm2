/** VANTA GARAGE — customer dashboard.
 * /store/dashboard
 * Customer-gated: active orders + recent purchase history.
 */

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { vantaApi, formatPrice, type VantaOrder } from "@/lib/store/client";

type OrderCardProps = {
  order: VantaOrder;
};

function OrderCard({ order }: OrderCardProps) {
  const isActive =
    order.orderState !== "completed" &&
    order.orderState !== "cancelled" &&
    order.orderState !== "refunded";
  const statusColor =
    order.orderState === "completed"
      ? "text-primary"
      : order.paymentState === "rejected"
        ? "text-destructive"
        : "text-ink-faint";
  return (
    <article className="panel rounded-xl border border-border p-4 mb-3">
      <div className="flex items-baseline justify-between mb-2">
        <Link
          href={`/store/orders/${order.id}`}
          className="font-semibold text-foreground hover:underline"
        >
          Order #{order.id.slice(-6)}
        </Link>
        <span className={`text-xs font-bold ${statusColor}`}>
          {order.orderState.replace(/_/g, " ").toUpperCase()}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm text-muted-foreground">
          {order.inGameName} · {order.playerId}
        </p>
        <span className="text-sm font-bold text-foreground">
          {formatPrice(order.amountCents, order.currency)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-faint">
          Payment: {order.paymentState.replace(/_/g, " ").toUpperCase()}
        </span>
        <span className="text-xs text-ink-faint">
          Delivery: {order.deliveryState.replace(/_/g, " ").toUpperCase()}
        </span>
        <span className="text-xs text-ink-faint">
          {new Date(order.createdAt).toLocaleDateString()}
        </span>
      </div>
      {isActive && (
        <p className="text-xs text-ink-faint mt-1">
          Awaiting your action — check order details for next steps.
        </p>
      )}
    </article>
  );
}

export default function CustomerDashboardPage() {
  const [orders, setOrders] = useState<VantaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadOrders() {
    try {
      const res = await vantaApi.orders();
      setOrders(res.orders ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders();
  }, []);

  const activeOrders = orders.filter(
    (o) =>
      o.orderState !== "completed" &&
      o.orderState !== "cancelled" &&
      o.orderState !== "refunded"
  );
  const recentOrders = orders.filter(
    (o) => o.orderState === "completed"
  ).slice(0, 5);

  if (loading) {
    return (
      <StoreShell>
        <PageHeading folio="CD" title="Customer Dashboard" />
        <p className="text-muted-foreground">Loading your orders…</p>
      </StoreShell>
    );
  }

  return (
    <StoreShell>
      <PageHeading folio="CD" title="Customer Dashboard" backHref="/store" />

      {error && (
        <p className="mb-4 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Active orders */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">
            Active Orders
          </h3>
          <Link
            href="/store/orders"
            className="text-xs text-primary hover:underline"
          >
            View all orders →
          </Link>
        </div>
        {activeOrders.length === 0 ? (
          <p className="text-muted-foreground">
            No active orders. Start browsing at the store.
          </p>
        ) : (
          <div className="space-y-0">{activeOrders.map((o) => <OrderCard key={o.id} order={o} />)}</div>
        )}
      </section>

      {/* Recent purchases */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">
            Recent Purchases
          </h3>
          <Link
            href="/store/orders"
            className="text-xs text-primary hover:underline"
          >
            Order history →
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-muted-foreground">
            No completed purchases yet. Your first ride awaits.
          </p>
        ) : (
          <div className="space-y-0">{recentOrders.map((o) => <OrderCard key={o.id} order={o} />)}</div>
        )}
      </section>

      {/* Quick links */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Link href="/store/categories">
          <Button variant="outline" className="w-full flex flex-col items-center gap-2 px-4 py-4">
            <span className="flex items-center justify-center w-6 h-6 shrink-0" dangerouslySetInnerHTML={{ __html: ICONS.grid }} />
            <span className="text-[10px] uppercase tracking-[0.15em]">Browse Vehicles</span>
          </Button>
        </Link>
        <Link href="/store/profile">
          <Button variant="outline" className="w-full flex flex-col items-center gap-2 px-4 py-4">
            <span className="flex items-center justify-center w-6 h-6 shrink-0" dangerouslySetInnerHTML={{ __html: ICONS.person }} />
            <span className="text-[10px] uppercase tracking-[0.15em]">My Profile</span>
          </Button>
        </Link>
      </section>
    </StoreShell>
  );
}

const ICONS: Record<string, string> = {
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" ry="1"/><rect x="14" y="3" width="7" height="7" rx="1" ry="1"/><rect x="14" y="14" width="7" height="7" rx="1" ry="1"/><rect x="3" y="14" width="7" height="7" rx="1" ry="1"/></svg>`,
  person: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"><circle cx="12" cy="7" r="4"/></path></svg>`,
};
