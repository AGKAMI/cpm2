/**
 * VANTA GARAGE — client-side cart sync.
 *
 * Mirrors wishlist-client.ts pattern: one module-level promise for the
 * server cart (GET /api/store/cart), optimistic local writes, fire-and-
 * forget server sync. Guests (401) keep localStorage-only state so cart
 * buttons still work outside Telegram.
 */

const CART_PREFIX = "vanta_cart_";
const LISTENER_KEY = "__vantaCartListeners";

type Listener = (cart: { productId: number; quantity: number }[]) => void;

const listeners: Set<Listener> =
  ((globalThis as Record<string, unknown>)[LISTENER_KEY] as Set<Listener>) ??
  new Set<Listener>();
(globalThis as Record<string, unknown>)[LISTENER_KEY] = listeners;

let serverCartPromise: Promise<{ items: Array<{ productId: number; quantity: number }> } | null> | null =
  ((globalThis as Record<string, unknown>)[LISTENER_KEY + "Promise"] as
    | Promise<{ items: Array<{ productId: number; quantity: number }> } | null>
    | null) ?? null;
(globalThis as Record<string, unknown>)[LISTENER_KEY + "Promise"] =
  serverCartPromise;

function localKey(productId: number) {
  return `${CART_PREFIX}${productId}`;
}

function readLocalCart(): { productId: number; quantity: number }[] {
  const items: { productId: number; quantity: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CART_PREFIX)) {
        const qty = Number(localStorage.getItem(key));
        const id = Number(key.slice(CART_PREFIX.length));
        if (Number.isFinite(id) && Number.isFinite(qty) && qty > 0) {
          items.push({ productId: id, quantity: qty });
        }
      }
    }
  } catch {
    // storage unavailable — treat as empty
  }
  return items;
}

/** One shared fetch of the server cart; resolves null on 401/guest. */
export function loadServerCart(): Promise<
  { items: Array<{ productId: number; quantity: number }> } | null
> {
  if (!serverCartPromise) {
    serverCartPromise = (async () => {
      try {
        const res = await fetch("/api/store/cart", { credentials: "include" });
        if (!res.ok) return null;
        const data = (await res.json()) as { cart?: { items?: unknown[] } };
        const items = (data.cart?.items ?? []).map((i) => ({
          productId: Number((i as { productId?: number }).productId),
          quantity: Number((i as { quantity?: number }).quantity ?? 1),
        }));
        // Mirror into localStorage so cart buttons render before hydration.
        for (const it of items)
          localStorage.setItem(localKey(it.productId), String(it.quantity));
        return { items };
      } catch {
        return null;
      }
    })();
    (globalThis as Record<string, unknown>)[LISTENER_KEY + "Promise"] =
      serverCartPromise;
  }
  return serverCartPromise;
}

export function subscribeCart(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Add a product to cart. Optimistic local write; server sync best-effort. */
export function addToCartLocal(productId: number, quantity = 1): void {
  const current = readLocalCart();
  const existing = current.find((i) => i.productId === productId);
  const nextQty = existing ? existing.quantity + quantity : quantity;
  const capped = Math.min(nextQty, 5);
  localStorage.setItem(localKey(productId), String(capped));
  for (const listener of listeners)
    listener(readLocalCart().map((i) => ({ ...i })));
  void (async () => {
    try {
      await fetch("/api/store/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId, quantity }),
      });
      // Refresh local cart from server so qty caps/stock limits apply.
      const refreshed = await loadServerCart();
      if (refreshed) {
        for (const it of refreshed.items)
          localStorage.setItem(localKey(it.productId), String(it.quantity));
        for (const listener of listeners) listener([...refreshed.items]);
      }
    } catch {
      // offline — local state remains authoritative until next load
    }
  })();
}

/** Set quantity for a product (0 removes). */
export function updateCartQuantityLocal(
  productId: number,
  quantity: number,
): void {
  if (quantity <= 0) {
    localStorage.removeItem(localKey(productId));
  } else {
    localStorage.setItem(localKey(productId), String(Math.min(quantity, 5)));
  }
  for (const listener of listeners)
    listener(readLocalCart().map((i) => ({ ...i })));
  void (async () => {
    try {
      await fetch("/api/store/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId, quantity }),
      });
      const refreshed = await loadServerCart();
      if (refreshed) {
        for (const it of refreshed.items)
          localStorage.setItem(localKey(it.productId), String(it.quantity));
        for (const listener of listeners) listener([...refreshed.items]);
      }
    } catch {
      // offline — local state remains authoritative
    }
  })();
}

/** Remove a product from cart. */
export function removeFromCartLocal(productId: number): void {
  localStorage.removeItem(localKey(productId));
  for (const listener of listeners)
    listener(readLocalCart().map((i) => ({ ...i })));
  void (async () => {
    try {
      await fetch(`/api/store/cart?productId=${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const refreshed = await loadServerCart();
      if (refreshed) {
        for (const it of refreshed.items)
          localStorage.setItem(localKey(it.productId), String(it.quantity));
        for (const listener of listeners) listener([...refreshed.items]);
      }
    } catch {
      // offline
    }
  })();
}

export function clearCartLocal(): void {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CART_PREFIX)) localStorage.removeItem(key);
    }
  } catch {}
  for (const listener of listeners) listener([]);
  // Server DELETE removes one item per call; clear each cart item server-side.
  void (async () => {
    const items = readLocalCart();
    for (const it of items) {
      try {
        await fetch(`/api/store/cart?productId=${it.productId}`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch {}
    }
    const refreshed = await loadServerCart();
    if (refreshed) {
      for (const listener of listeners) listener([...refreshed.items]);
    }
  })();
}

/** Cart item count badge total. */
export function cartCountLocal(): number {
  return readLocalCart().reduce((sum, i) => sum + i.quantity, 0);
}
