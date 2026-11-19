"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { vantaApi, formatPrice } from "@/lib/store/client";
import { discountedPriceCents } from "@/lib/store/pricing";
import { CartSkeleton } from "@/components/skeleton";
import {
  addToCartLocal,
  cartCountLocal,
  loadServerCart,
  removeFromCartLocal,
  subscribeCart,
  updateCartQuantityLocal,
} from "@/lib/store/cart-client";
import { StoreShell } from "@/components/StoreShell";
import { Button } from "@/components/ui/Button";

type CartItem = {
  productId: number;
  name: string;
  coverImage: string | null;
  basePriceCents: number;
  discountPercent: number;
  currency: string;
  stockQuantity: number;
  quantity: number;
  exclusivity: string;
};

export function CartClient() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const subtotalCents = items.reduce(
    (sum, i) => sum + discountedPriceCents(i.basePriceCents, i.discountPercent) * i.quantity,
    0,
  );

  const fetchCart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/store/cart", { credentials: "include" });
      if (!res.ok) {
        // Not linked (guest outside Telegram) — fall back to local cart.
        const local = await loadServerCart();
        setItems(
          (local?.items ?? []).map((it) => ({
            productId: it.productId,
            name: "",
            coverImage: null,
            basePriceCents: 0,
        // LocalStorage fallback cart carries only productId + quantity — no price
        // data at all, so no discount is knowable there.
        discountPercent: 0,
            currency: "ZAR",
            stockQuantity: 0,
            quantity: it.quantity,
            exclusivity: "standard",
          })),
        );
        setError(
          "Open the store from Telegram to link your account and sync your cart.",
        );
        return;
      }
      const data = (await res.json()) as { cart?: { items?: unknown[] } };
      const serverItems = (data.cart?.items ?? []) as Array<{
        productId?: number;
        name?: string;
        coverImage?: string | null;
        basePriceCents?: number;
        discountPercent?: number;
        currency?: string;
        stockQuantity?: number;
        quantity?: number;
        exclusivity?: string;
      }>;
      setItems(
        serverItems.map((i) => ({
          productId: i.productId ?? 0,
          name: i.name ?? "",
          coverImage: i.coverImage ?? null,
          basePriceCents: i.basePriceCents ?? 0,
        discountPercent: Number(i.discountPercent ?? 0),
          currency: i.currency ?? "ZAR",
          stockQuantity: i.stockQuantity ?? 0,
          quantity: i.quantity ?? 1,
          exclusivity: i.exclusivity ?? "standard",
        })),
      );
      setError(null);
    } catch {
      setError("Couldn't load your cart. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
    const unsub = subscribeCart((next) => {
      // Merge local-only qty changes with server-known item metadata.
      setItems((curr) =>
        next.map((n) => {
          const cur = curr.find((c) => c.productId === n.productId);
          return cur
            ? { ...cur, quantity: n.quantity }
            : {
                productId: n.productId,
                name: "",
                coverImage: null,
                basePriceCents: 0,
                discountPercent: 0,
                currency: "ZAR",
                stockQuantity: 0,
                quantity: n.quantity,
                exclusivity: "standard",
              };
        }),
      );
    });
    return () => unsub();
  }, [fetchCart]);

  const inc = (productId: number, stock: number) => {
    if (busy.has(productId)) return;
    setBusy((s) => new Set([...s, productId]));
    addToCartLocal(productId, 1);
    setBusy((s) => new Set([...s].filter((id) => id !== productId)));
  };

  const dec = (productId: number) => {
    if (busy.has(productId)) return;
    setBusy((s) => new Set([...s, productId]));
    updateCartQuantityLocal(productId, items.find((i) => i.productId === productId)?.quantity ?? 1 - 1);
    setBusy((s) => new Set([...s].filter((id) => id !== productId)));
  };

  const remove = (productId: number) => {
    setBusy((s) => new Set([...s, productId]));
    removeFromCartLocal(productId);
    setBusy((s) => new Set([...s].filter((id) => id !== productId)));
  };

  const currency = items[0]?.currency ?? "ZAR";

  const handleCheckoutAll = async () => {
    if (items.length === 0) return;
    setCheckoutBusy(true);
    try {
      const playerId = window.localStorage.getItem("vanta_player_id") ?? "";
      const inGameName = window.localStorage.getItem("vanta_ingame_name") ?? "";
      // Store details for the bulk checkout page to pick up.
      window.localStorage.setItem("vanta_bulk_cart", "1");
      if (typeof window !== "undefined") {
        window.location.href = `/store/cart/checkout?playerId=${encodeURIComponent(playerId)}&inGameName=${encodeURIComponent(inGameName)}`;
      }
    } finally {
      setCheckoutBusy(false);
    }
  };

  if (loading)
    return (
      <StoreShell>
        <div className="panel rounded-xl border border-border p-6">
          <CartSkeleton />
        </div>
      </StoreShell>
    );

  if (items.length === 0)
    return (
      <StoreShell>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
          <div className="w-16 h-16 rounded-full bg-background border border-border flex items-center justify-center mb-4">
            <img src="/cart-xmark.svg" alt="Empty cart" className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Your cart is empty</h2>
          <p className="text-muted-foreground mb-6">
            No vehicles yet. Add cars to your cart and buy them together.
          </p>
          <Link href="/store">
            <Button variant="primary">Continue shopping</Button>
          </Link>
        </div>
      </StoreShell>
    );

  return (
    <StoreShell>
      <div className="flex items-center justify-between px-4 sm:px-6 mb-6">
        <h1 className="text-xl font-bold text-foreground">Your Cart</h1>
        <p className="text-[10px] text-muted-foreground">
          {items.length} item{items.length > 1 ? "s" : ""} •
          {formatPrice(subtotalCents, currency)}
        </p>
      </div>

      {error && (
        <div className="px-4 sm:px-6 mb-4">
          <div className="rounded-md border border-destructive bg-background px-4 py-3 text-xs text-destructive">
            {error}
          </div>
        </div>
      )}

      <section className="px-4 sm:px-6 space-y-4">
        {items.map((item) => (
          <section
            key={item.productId}
            className="panel rounded-xl border border-border p-4"
          >
            <div className="grid grid-cols-4 gap-4 items-center mb-2">
              <div className="col-span-2 relative aspect-[4/5] rounded-lg bg-background overflow-hidden">
                {item.coverImage ? (
                  <Image
                    src={item.coverImage}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    width={300}
                    height={375}
                    style={{ objectFit: "cover" }}
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] text-ink-soft">
                    No photo
                  </span>
                )}
              </div>
              <div className="col-span-2 text-right">
                <Link
                  href={`/store/products/${item.productId}`}
                  className="text-sm font-semibold text-foreground hover:underline underline-link block mb-1"
                >
                  {item.name}
                </Link>
                <span className="text-[10px] text-muted-foreground block mb-3">
                  {item.stockQuantity === 0
                    ? "Sold out"
                    : `${item.stockQuantity} left`}
                </span>
                <span className="text-lg font-bold text-primary block">
                  {formatPrice(discountedPriceCents(item.basePriceCents, item.discountPercent) * item.quantity, currency)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2 border border-border rounded-md">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => dec(item.productId)}
                  disabled={busy.has(item.productId) || item.quantity <= 1}
                  aria-label={`Decrease ${item.name}`}
                >
                  −
                </Button>
                <span className="px-2 text-xs font-medium text-foreground">
                  {item.quantity}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => inc(item.productId, item.stockQuantity)}
                  disabled={
                    busy.has(item.productId) ||
                    item.quantity >= Math.min(5, item.stockQuantity)
                  }
                  aria-label={`Increase ${item.name}`}
                >
                  +
                </Button>
              </div>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => remove(item.productId)}
                disabled={busy.has(item.productId)}
                aria-label={`Remove ${item.name}`}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                </svg>
              </Button>
            </div>
          </section>
        ))}
      </section>

      <section className="px-4 sm:px-6 mt-8">
        <div className="panel rounded-xl border border-border p-6">
          <div className="flex justify-between items-baseline gap-2 mb-6">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="text-xl font-bold text-foreground">
              {formatPrice(subtotalCents, currency)}
            </span>
          </div>
          <div className="space-y-3">
            <Button
              variant="primary"
              onClick={handleCheckoutAll}
              disabled={checkoutBusy || subtotalCents <= 0}
              className="w-full h-12 text-lg font-bold"
            >
              {checkoutBusy ? "Processing…" : "Checkout all"}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Bulk checkout — one payment covers every vehicle in your cart.
            </p>
          </div>
        </div>
      </section>
    </StoreShell>
  );
}
