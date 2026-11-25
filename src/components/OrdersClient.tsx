"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { vantaApi, formatPrice, type VantaOrder, type VantaProduct } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { OrdersSkeleton } from "@/components/skeleton";
import { List } from "lucide-react";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Status badge — the reference reads a green COMPLETED pill; ours follows the
 *  real lifecycle (completed / cancelled / in-flight). */
function StatusBadge({ order }: { order: VantaOrder }) {
  if (order.orderState === "completed") {
    return (
      <span className="rounded-full border border-ok/40 bg-ok/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-ok">
        Completed
      </span>
    );
  }
  if (order.orderState === "cancelled") {
    return (
      <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-destructive">
        Cancelled
      </span>
    );
  }
  return (
    <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
      {order.orderState.replace(/_/g, " ")}
    </span>
  );
}

/** Order Center — the purchase history: one row per order, name + qty, order
 *  number + date, and the live status. Our style, the reference's shape. */
export function OrdersClient() {
  const [orders, setOrders] = useState<VantaOrder[]>([]);
  const [products, setProducts] = useState<VantaProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [{ orders: os }, prods] = await Promise.all([
          vantaApi.orders(),
          vantaApi.products({}),
        ]);
        setOrders(os.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setProducts(prods.products ?? []);
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

  const nameOf = (id: number) => products.find((p) => p.id === id)?.name ?? "Item";

  return (
    <StoreShell>
      <section className="px-1">
        {/* Header — title + explanation + the cube glyph */}
        <div className="flex items-start gap-4 py-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-border bg-secondary text-ink-soft">
            <List className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold uppercase tracking-[0.16em] text-foreground">
              Order center
            </h1>
            <p className="mt-1 text-lg font-bold text-foreground">Your purchases.</p>
            <p className="mt-1 text-xs text-ink-soft">
              Approved orders and their delivery status land here — track every purchase from
              payment to handover.
            </p>
          </div>
        </div>

        {/* Purchase history */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">
            Purchase history
          </h2>
          <span className="text-[11px] text-ink-faint">{orders.length} shown</span>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-xl border border-border bg-background p-10 text-center">
            <p className="text-foreground font-medium">No purchases yet.</p>
            <p className="mt-2 text-xs text-ink-soft">
              Browse the catalogue and place your first order — the confirmation lands here.
            </p>
            <Link
              href="/store"
              className="mt-4 inline-block text-xs font-bold uppercase tracking-[0.16em] text-primary hover:underline"
            >
              Back to the garage
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/store/orders/${order.id}`}
                  className="block rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {nameOf(order.productId)}
                        <span className="ml-1 font-normal text-ink-soft">
                          × {order.quantity ?? 1}
                        </span>
                      </p>
                      <p className="mt-1 text-[11px] text-ink-faint">
                        #{order.id.slice(-6)} · {fmtDate(order.createdAt)}
                      </p>
                    </div>
                    <StatusBadge order={order} />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="num text-sm font-bold text-foreground">
                      {formatPrice(order.amountCents, order.currency)}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.15em] text-ink-soft">
                      View order →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </StoreShell>
  );
}
