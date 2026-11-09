"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HeartToggle } from "@/components/HeartToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { HealthStatus } from "@/components/HealthStatus";

/**
 * WhatsApp-order UI — confirmation after customer orders via WhatsApp .vanta command.
 * Shows order tracking and WhatsApp share.
 */
export function WhatsAppOrder({ orderId }: { orderId?: string }) {
  const [order, setOrder] = useState<{ id: string; name: string; price: string; state: string } | null>(null);

  useEffect(() => {
    if (!orderId) return;
    // Try fetching real order from Nemotron's API
    fetch(`/api/store/order?id=${encodeURIComponent(orderId)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("not found");
        const data = await r.json();
        setOrder({
          id: data.order?.id || orderId,
          name: data.order?.productId ? `Vehicle #${data.order.productId}` : "Your vehicle",
          price: data.order?.amountCents ? `R ${(data.order.amountCents / 100).toLocaleString()}` : "—",
          state: data.order?.orderState || "Pending payment",
        });
      })
      .catch(() => {
        // Fallback demo state
        setOrder({
          id: orderId,
          name: "Your vehicle",
          price: "—",
          state: "Pending payment",
        });
      });
  }, [orderId]);

  if (!orderId) {
    return (
      <section className="panel rounded-xl border border-border p-6 text-center">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">WhatsApp Order</h3>
        <p className="text-sm text-ink-soft mb-4">Send ".vanta" on WhatsApp to place an order.</p>
        <Link href="https://wa.me/?text=VANTA%20GARAGE%20ORDER" className="w-full h-10 rounded-lg border border-gold bg-gold text-ink font-bold text-sm uppercase tracking-[0.1em]">
          Start WhatsApp Order
        </Link>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="panel rounded-xl border border-border p-6 text-center">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">Loading Order</h3>
        <p className="text-sm text-ink-soft mb-4">Fetching order details…</p>
      </section>
    );
  }

  return (
    <section className="panel rounded-xl border border-border p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Order #{order.id}</h3>
        <span
          className={`text-xs font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded ${
            order.state === "Pending payment" ? "border-gold bg-black/60 text-gold" : "border-gold bg-black/60 text-gold"
          }`}
        >
          {order.state}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm mb-6">
        <div>
          <span className="text-xs text-ink-soft block mb-1">Vehicle</span>
          <span className="text-sm font-medium text-foreground">{order.name}</span>
        </div>
        <div>
          <span className="text-xs text-ink-soft block mb-1">Price</span>
          <span className="text-sm font-bold text-primary">{order.price}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2 h-2 rounded-full bg-gold" />
        <span className="text-sm text-ink-soft">Share your order on WhatsApp:</span>
      </div>
      <Link
        href={`https://wa.me/?text=VANTA%20GARAGE%20ORDER%20%23${order.id}%20-%20${encodeURIComponent(order.name)}%20-%20${encodeURIComponent(order.price)}`}
        className="w-full h-10 rounded-lg border border-gold bg-gold text-ink font-bold text-sm uppercase tracking-[0.1em]"
      >
        Share on WhatsApp
      </Link>
    </section>
  );
}
