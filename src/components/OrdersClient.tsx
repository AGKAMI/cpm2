"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { vantaApi, formatPrice, type VantaOrder } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";

const ORDER_STAGES: Array<{
  key: VantaOrder["orderState"];
  label: string;
  hint: string;
}> = [
  { key: "pending_payment", label: "Payment pending", hint: "Awaiting your EFT proof or PayFast confirmation" },
  { key: "paid", label: "Payment confirmed", hint: "Payment received — build is being prepared" },
  { key: "preparing", label: "Preparing vehicle", hint: "Custom build in the garage" },
  { key: "ready_for_delivery", label: "Ready for delivery", hint: "Vehicle ready — delivery appointment pending" },
  { key: "delivered", label: "Delivered", hint: "Vehicle delivered to your garage" },
  { key: "completed", label: "Completed", hint: "Order fulfilled" },
  { key: "cancelled", label: "Cancelled", hint: "Order was cancelled" },
];

function stageOrder(a: VantaOrder["orderState"], b: VantaOrder["orderState"]): number {
  const order = ORDER_STAGES.map((s) => s.key);
  return order.indexOf(a) - order.indexOf(b);
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
        <PageHeading folio="03" title="My Orders" backHref="/store" />
        <div className="space-y-3" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="panel rounded-xl border border-border p-4 stagger-item stagger-{i+1}">
              <div className="h-2 w-24 rounded-sm bg-background mb-3 animate-pulse" />
              <div className="h-3 w-32 rounded-sm bg-background animate-pulse" />
            </div>
          ))}
        </div>
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
            className="inline-block mt-4 text-xs uppercase tracking-[0.15em] text-primary hover:underline cursor-pointer"
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
  const stage = ORDER_STAGES.find((s) => s.key === order.orderState);
  const active = !["completed", "cancelled"].includes(order.orderState);
  const stageIndex = ORDER_STAGES.findIndex((s) => s.key === order.orderState);

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
          {stage?.label ?? order.orderState.replace("_", " ")}
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

      {/* Progress timeline */}
      <div className="relative mb-3">
        <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
        {ORDER_STAGES.map((s, i) => (
          <div key={s.key} className="relative flex items-center gap-2 pl-10">
            {i < ORDER_STAGES.length - 1 && (
              <div className={`absolute left-2 top-3 bottom-3 w-px ${i < stageIndex ? "bg-gold" : "bg-border"}`} />
            )}
            <div
              className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                i <= stageIndex
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border"
              }`}
            >
              {i <= stageIndex ? "✓" : ""}
            </div>
            <span className={`text-[10px] ${i <= stageIndex ? "text-foreground font-medium" : "text-ink-soft"}`}>
              {s.label}
            </span>
            {i < ORDER_STAGES.length - 1 && s.hint && (
              <span className="text-[9px] text-ink-faint">{s.hint}</span>
            )}
          </div>
        ))}
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
