"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { vantaApi, formatPrice, getOrderAccessToken, type VantaOrder } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { OrderProgress } from "@/components/OrderProgress";

export function OrderPageClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<VantaOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const proofNotice =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("proof")
      : null;

  const uploadProof = async () => {
    if (!proofFile || !order) return;
    setProofBusy(true);
    setProofError(null);
    try {
      const form = new FormData();
      form.set("orderId", order.id);
      form.set("file", proofFile);
      const token = getOrderAccessToken(order.id);
      const res = await fetch(`/api/store/checkout/${order.productId}/proof`, {
        method: "POST",
        body: form,
        credentials: "same-origin",
        headers: token ? { "x-order-access": token } : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(data?.error?.message ?? "Upload failed. Please try again.");
      }
      window.location.href = `/store/orders/${order.id}`;
    } catch (err) {
      setProofError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setProofBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;
    let stopped = false;
    const load = async (showError = false) => {
      try {
        const { order: o } = await vantaApi.order(orderId);
        if (!alive) return;
        setOrder(o);
        // Terminal states never move again — stop polling for them.
        if (["completed", "cancelled", "refunded"].includes(o.orderState)) stopped = true;
      } catch {
        if (showError) notFound();
      } finally {
        if (alive) setLoading(false);
      }
    };
    load(true);
    // Live progression: re-poll while the order is still moving so the bar
    // advances in real time (stop once it reaches a terminal state).
    const timer = setInterval(() => {
      if (stopped) {
        clearInterval(timer);
        return;
      }
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void load(false);
    }, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
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
      <PageHeading folio="03" title={`Order ${order.id}`} backHref="/store/orders" />
      <Link href="/store/orders" className="mb-4 inline-flex items-center gap-1 text-[10px] text-gold underline underline-offset-4 hover:text-gold/80">
        <span>← Back to orders</span>
      </Link>
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
          <OrderProgress orderState={order.orderState} paymentState={order.paymentState} />
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground">Order</span>
              <span className="text-sm text-foreground capitalize">{order.orderState.replace(/_/g, " ")}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground">Payment</span>
              <span className={`text-sm font-medium ${order.paymentState === "verified" ? "text-primary" : "text-muted-foreground"}`}>
                {order.paymentState.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground">Delivery</span>
              <span className={`text-sm text-foreground capitalize`}>{order.deliveryState.replace(/_/g, " ")}</span>
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

      {proofNotice && (
        <p className="mt-4 rounded-lg border border-destructive/40 px-3 py-2 text-xs text-destructive">
          {proofNotice === "sign-in-required"
            ? "Your order was placed. Sign in to this account to attach proof of payment."
            : "Your order was placed, but the proof upload failed. Attach it below."}
        </p>
      )}

      {order.paymentMethod === "eft" && (
        <div className="panel mt-6 rounded-xl border border-border p-6 bg-background">
          <h3 className="text-sm font-semibold text-foreground mb-3">Proof of payment</h3>
          {order.eftProofUrl ? (
            <a href={order.eftProofUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline underline-offset-4">
              View uploaded proof ↗
            </a>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Proof of payment image"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                className="text-xs text-muted-foreground"
              />
              <Button onClick={uploadProof} disabled={!proofFile || proofBusy} size="sm">
                {proofBusy ? "Uploading…" : "Upload proof"}
              </Button>
            </div>
          )}
          {proofError && <p className="mt-2 text-xs text-destructive">{proofError}</p>}
        </div>
      )}
    </StoreShell>
  );
}
