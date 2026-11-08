"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { vantaApi, formatPrice, type VantaOrder } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";

export function OrderPageClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<VantaOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { order: o } = await vantaApi.order(orderId);
        setOrder(o);
      } catch {
        notFound();
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  if (loading)
    return (
      <StoreShell>
        <PageHeading folio="03" title={`Order ${orderId}`} backHref="/store/orders" />
        <div className="panel rounded-xl border border-border p-6" aria-hidden="true">
          <div className="h-3 w-1/2 rounded-sm bg-background mb-3 animate-pulse" />
          <div className="h-3 w-2/3 rounded-sm bg-background animate-pulse" />
          <div className="h-2 w-1/3 rounded-sm bg-background mt-4 animate-pulse" />
        </div>
      </StoreShell>
    );
  if (!order) return notFound();

  return (
    <StoreShell>
      <PageHeading folio="03" title={`Order ${order.id}`} />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="panel rounded-xl border border-border p-6 bg-background">
          <h3 className="text-sm font-semibold text-foreground mb-4">Vehicle</h3>
          <p className="text-sm text-muted-foreground mb-4">{order.inGameName}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl text-primary font-semibold">{formatPrice(order.amountCents, order.currency)}</span>
          </div>
        </div>
        <div className="panel rounded-xl border border-border p-6 bg-background">
          <h3 className="text-sm font-semibold text-foreground mb-4">Status</h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground">Order</span>
              <span className="text-sm text-foreground capitalize">{order.orderState.replace("_", " ")}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground">Payment</span>
              <span className={`text-sm font-medium ${order.paymentState === "verified" ? "text-primary" : "text-muted-foreground"}`}>
                {order.paymentState.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground">Delivery</span>
              <span className={`text-sm text-foreground capitalize`}>{order.deliveryState.replace("_", " ")}</span>
            </div>
          </div>
          {order.reservedUntil && (
            <div className="mt-4 pt-4 border-t border-border">
              <span className="text-xs text-muted-foreground">Reserved until</span>
              <p className="text-sm text-foreground">{new Date(order.reservedUntil).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>
    </StoreShell>
  );
}
