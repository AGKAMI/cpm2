"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { vantaApi, formatPrice, type VantaOrder } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";

export function OrdersClient() {
  const [orders, setOrders] = useState<VantaOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { orders: os } = await vantaApi.orders();
        setOrders(os);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <StoreShell>
      <PageHeading folio="03" title="My Orders" />
      {loading ? (
        <p className="text-muted-foreground">Loading orders…</p>
      ) : (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <p className="text-muted-foreground">No orders yet. Browse the catalogue to place your first.</p>
          ) : (
            <div className="grid gap-3">
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
      )}
    </StoreShell>
  );
}

function OrderRow({ order }: { order: VantaOrder }) {
  return (
    <article className="panel rounded-xl border border-border p-4">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-muted-foreground">#{order.id.slice(-8)}</span>
        <span className="text-xs text-muted-foreground capitalize">{order.orderState.replace("_", " ")}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium text-foreground">{formatPrice(order.amountCents, order.currency)}</span>
        <span className="text-xs text-muted-foreground ml-2">{order.paymentMethod}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">Player</span>
        <span className="text-[11px] text-foreground">{order.playerId}</span>
        <span className="text-[10px] text-muted-foreground">·</span>
        <span className="text-[11px] text-foreground">{order.inGameName}</span>
      </div>
      <Link href={`/store/orders/${order.id}`} className="mt-3 block">
        <Button variant="outline" size="sm">View order</Button>
      </Link>
    </article>
  );
}
