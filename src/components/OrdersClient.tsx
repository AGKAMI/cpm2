"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { vantaApi, formatPrice, type VantaOrder } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { OrdersSkeleton } from "@/components/skeleton";
import { OrderProgressSlim, ORDER_LIFECYCLE, orderStepIndex, orderTerminal } from "@/components/OrderProgress";

function stageOrder(a: VantaOrder["orderState"], b: VantaOrder["orderState"]): number {
  // Sort by position on the real lifecycle (terminal states sink last).
  return orderStepIndex(b, "") - orderStepIndex(a, "");
}

export function OrdersClient() {
  const [orders, setOrders] = useState<VantaOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { orders: os } = await vantaApi.orders();
        setOrders(os.slice().sort((a, b) => stageOrder(b.orderState, a.orderState) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <StoreShell>
        <OrdersSkeleton />
      </StoreShell>
    );
  if (orders.length === 0)
    return (
      <StoreShell>
        <PageHeading folio="03" title="My Orders" backHref="/store" />
        <div className="panel rounded-xl border border-border p-10 text-center">
          <p className="text-foreground font-medium">No orders yet.</p>
          <p className="text-xs text-muted-foreground mt-2">
            Browse the catalogue and place your first order — the confirmation lands here.
          </p>
          <Link
            href="/store"
            className="inline-block mt-4 text-xs uppercase tracking-[0.15em] text-primary hover:underline underline-link cursor-pointer"
          >
            Back to the garage
          </Link>
        </div>
      </StoreShell>
    );

  return (
    <StoreShell>
      <PageHeading folio="03" title="My Orders" backHref="/store" />
      <div className="grid gap-3">
        {orders.map((order, index) => (
          <OrderCard key={order.id} order={order} index={index} />
        ))}
      </div>
    </StoreShell>
  );
}

function OrderCard({ order, index }: { order: VantaOrder; index: number }) {
  const terminal = orderTerminal(order.orderState);
  const active = !["completed", "cancelled"].includes(order.orderState);
  const step = orderStepIndex(order.orderState, order.paymentState);
  const label = terminal?.label ?? ORDER_LIFECYCLE[Math.max(step, 0)].label;

  return (
    <article className="group relative rounded-xl border border-border p-4 hover:border-primary stagger-item" style={{ animationDelay: `${index * 40}ms` }}>
      <Link
        href={`/store/orders/${order.id}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`View order ${order.id.slice(-8)}`}
      />
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="num text-xs text-muted-foreground">#{order.id.slice(-8)}</span>
        <span
          className={`text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded border ${
            active
              ? "border-primary text-primary"
              : order.orderState === "cancelled"
                ? "border-destructive text-destructive"
                : "border-border text-muted-foreground"
          }`}
        >
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="num text-sm font-medium text-foreground group-hover:text-primary transition-colors duration-200">
          {formatPrice(order.amountCents, order.currency)}
        </span>
        <span className="num text-xs text-muted-foreground">{order.paymentMethod.toUpperCase()}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] mb-3">
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Player</span>
        <span className="num text-foreground">{order.playerId}</span>
        <span className="text-muted-foreground" aria-hidden="true">/</span>
        <span className="text-foreground">{order.inGameName}</span>
      </div>

      {/* Live progress — slim animated bar against the real lifecycle */}
      <div className="mb-3">
        <OrderProgressSlim orderState={order.orderState} paymentState={order.paymentState} />
      </div>

      {order.paymentState === "pending" && order.paymentMethod === "eft" && (
        <div className="mt-3 p-3 rounded-md border border-destructive bg-destructive/10 text-xs text-destructive">
          Awaiting EFT proof — upload your payment receipt to move this order forward.
        </div>
      )}

      {order.appointmentId && (
        <div className="mt-3 p-3 rounded-md border border-border bg-background text-xs text-ink-soft">
          Delivery appointment: <span className="text-foreground font-medium">#{order.appointmentId.slice(-6)}</span>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground group-hover:text-foreground transition-colors duration-200">
          View order
        </span>
        <span aria-hidden="true" className="num text-[11px] text-muted-foreground group-hover:text-primary transition-colors duration-200">
          &rarr;
        </span>
      </div>
    </article>
  );
}
