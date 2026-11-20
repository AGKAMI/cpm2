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
  localCartItems,
  removeFromCartLocal,
  subscribeCart,
  updateCartQuantityLocal,
} from "@/lib/store/cart-client";
import { StoreShell } from "@/components/StoreShell";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";

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
        // Not linked (guest outside Telegram) — the local cart is
        // authoritative, and we hydrate names/prices for it so the page is
        // still usable instead of showing a list of blanks.
        const local = localCartItems();
        if (local.length === 0) {
          setItems([]);
          setError(null);
          return;
        }
        const ids = local.map((i) => i.productId);
        const metaById = new Map<
          number,
          {
            name: string;
            coverImage: string | null;
            basePriceCents: number;
            discountPercent: number;
            currency: string;
            stockQuantity: number;
            exclusivity: string;
          }
        >();
        try {
          const [productsRes, coversRes] = await Promise.all([
            fetch("/api/store/products", { cache: "no-store" }),
            vantaApi.mediaCovers(ids).catch(() => ({ covers: {} as Record<string, string> })),
          ]);
          if (productsRes.ok) {
            const data = (await productsRes.json()) as {
              products?: Array<{
                id: number;
                name: string;
                basePriceCents: number;
                discountPercent: number;
                currency: string;
                stockQuantity: number;
                exclusivity: string;
              }>;
            };
            for (const p of data.products ?? []) {
              metaById.set(p.id, {
                name: p.name,
                coverImage: coversRes.covers[String(p.id)] ?? null,
                basePriceCents: p.basePriceCents,
                discountPercent: p.discountPercent ?? 0,
                currency: p.currency ?? "ZAR",
                stockQuantity: p.stockQuantity,
                exclusivity: p.exclusivity ?? "standard",
              });
            }
          }
        } catch {
          // Metadata is best-effort; ids still render.
        }
        setItems(
          local.map((it) => {
            const meta = metaById.get(it.productId);
            return {
              productId: it.productId,
              name: meta?.name ?? "",
              coverImage: meta?.coverImage ?? null,
              basePriceCents: meta?.basePriceCents ?? 0,
              discountPercent: meta?.discountPercent ?? 0,
              currency: meta?.currency ?? "ZAR",
              stockQuantity: meta?.stockQuantity ?? 0,
              quantity: it.quantity,
              exclusivity: meta?.exclusivity ?? "standard",
            };
          }),
        );
        setError(
          "Saved on this device. Open the store from Telegram to sync your cart.",
        );
        return;
      }
      const data = (await res.json()) as { items?: unknown[]; cart?: { items?: unknown[] } };
      // GET /api/store/cart returns getCart() = top-level { items }; only
      // POST/PATCH/DELETE wrap it as { cart }. Reading just data.cart.items
      // left every synced server cart rendering as empty. Read the GET shape
      // first, fall back to the wrapped shape for safety.
      const serverItems = (data.items ?? data.cart?.items ?? []) as Array<{
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

  // Guest identity for bulk checkout. The checkout page reads these from the
  // URL/localStorage; without inputs here the flow was a dead end ("enter your
  // Player ID on the cart page first" — but the cart page had no such field).
  const [playerId, setPlayerId] = useState("");
  const [inGameName, setInGameName] = useState("");
  const [playerIdError, setPlayerIdError] = useState<string | null>(null);
  const [inGameNameError, setInGameNameError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    setPlayerId(window.localStorage.getItem("vanta_player_id") ?? "");
    setInGameName(window.localStorage.getItem("vanta_ingame_name") ?? "");
  }, []);
  useEffect(() => {
    if (playerId.trim()) window.localStorage.setItem("vanta_player_id", playerId.trim());
  }, [playerId]);
  useEffect(() => {
    if (inGameName.trim()) window.localStorage.setItem("vanta_ingame_name", inGameName.trim());
  }, [inGameName]);

  const validatePlayerId = (pid: string): string | null => {
    const trimmed = pid.trim().toUpperCase();
    if (!trimmed) return "Player ID is required";
    if (!/^[A-Z]{2}\d{6}$/.test(trimmed)) return "Must be 2 letters + 6 digits (e.g. AB123456)";
    return null;
  };
  const validateInGameName = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return "In-game name is required";
    if (trimmed.length < 2) return "Name is too short";
    return null;
  };

  const currency = items[0]?.currency ?? "ZAR";

  const handleCheckoutAll = async () => {
    if (items.length === 0) return;
    const pErr = validatePlayerId(playerId);
    const nErr = validateInGameName(inGameName);
    setPlayerIdError(pErr);
    setInGameNameError(nErr);
    setAttempted(true);
    if (pErr || nErr) {
      const first = document.getElementById(pErr ? "cart-player-id" : "cart-ingame-name");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      first?.focus();
      return;
    }
    setCheckoutBusy(true);
    try {
      window.localStorage.setItem("vanta_player_id", playerId.trim());
      window.localStorage.setItem("vanta_ingame_name", inGameName.trim());
      window.localStorage.setItem("vanta_bulk_cart", "1");
      window.location.href = `/store/cart/checkout?playerId=${encodeURIComponent(playerId.trim())}&inGameName=${encodeURIComponent(inGameName.trim())}`;
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
            <Field label="Player ID" hint="2 letters + 6 digits (e.g. AB123456)" htmlFor="cart-player-id">
              <TextInput
                id="cart-player-id"
                value={playerId}
                onChange={(e) => {
                  const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                  const validated = raw.replace(/^([A-Z]{2})(\d{0,6}).*$/, "$1$2");
                  setPlayerId(validated);
                }}
                placeholder="e.g. AB123456"
                maxLength={8}
                className={
                  playerIdError
                    ? "border-destructive border-glow-red"
                    : !validatePlayerId(playerId)
                      ? "border-ok"
                      : attempted
                        ? "border-destructive border-glow-red"
                        : ""
                }
              />
              {playerIdError && (
                <p className="text-[10px] text-destructive mt-1">{playerIdError}</p>
              )}
            </Field>
            <Field label="In-game name" hint="Name shown in CPM2" htmlFor="cart-ingame-name">
              <TextInput
                id="cart-ingame-name"
                value={inGameName}
                onChange={(e) => setInGameName(e.target.value)}
                placeholder="e.g. Thino M"
                className={
                  inGameNameError
                    ? "border-destructive border-glow-red"
                    : !validateInGameName(inGameName)
                      ? "border-ok"
                      : attempted
                        ? "border-destructive border-glow-red"
                        : ""
                }
              />
              {inGameNameError && (
                <p className="text-[10px] text-destructive mt-1">{inGameNameError}</p>
              )}
            </Field>
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
