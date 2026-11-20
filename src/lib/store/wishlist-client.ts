/**
 * Shared client-side wishlist sync.
 *
 * HeartToggle instances are many-per-page; this module guarantees ONE
 * server fetch per page-load (module-level promise) and mirrors the
 * server wishlist into localStorage keys (`vanta_wishlist_${productId}`)
 * so hearts render instantly and stay correct for guests (no customer
 * linked / opened outside Telegram) too.
 */

const LISTENER_KEY = "__vantaWishlistListeners";

type Listener = (ids: Set<number>) => void;

const listeners: Set<Listener> =
  ((globalThis as Record<string, unknown>)[LISTENER_KEY] as Set<Listener>) ??
  new Set<Listener>();
(globalThis as Record<string, unknown>)[LISTENER_KEY] = listeners;

let serverIds: Set<number> | null = null;
let serverIdsPromise: Promise<Set<number>> | null =
  ((globalThis as Record<string, unknown>)[LISTENER_KEY + "Promise"] as
    | Promise<Set<number>>
    | null) ?? null;
(globalThis as Record<string, unknown>)[LISTENER_KEY + "Promise"] =
  serverIdsPromise;

function localKey(productId: number) {
  return `vanta_wishlist_${productId}`;
}

function readLocalSet(): Set<number> {
  const ids = new Set<number>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("vanta_wishlist_") && localStorage.getItem(key) === "true") {
        const id = Number(key.slice("vanta_wishlist_".length));
        if (Number.isFinite(id)) ids.add(id);
      }
    }
  } catch {
    // storage unavailable — treat as empty
  }
  return ids;
}

/** One shared fetch of the server wishlist; resolves empty on 401/guest. */
export function loadServerWishlist(): Promise<Set<number>> {
  if (!serverIdsPromise) {
    serverIdsPromise = (async () => {
      try {
        const res = await fetch("/api/store/wishlist", { credentials: "include" });
        if (!res.ok) return readLocalSet();
        const data = (await res.json()) as { items?: Array<{ productId: number }> };
        const ids = new Set<number>((data.items ?? []).map((i) => i.productId));
        serverIds = ids;
        // Mirror into localStorage so hearts are right even before React hydrates.
        for (const id of ids) localStorage.setItem(localKey(id), "true");
        return ids;
      } catch {
        return readLocalSet();
      }
    })();
    (globalThis as Record<string, unknown>)[LISTENER_KEY + "Promise"] = serverIdsPromise;
  }
  return serverIdsPromise;
}

export function subscribeWishlist(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Toggle wishlist membership for a product. Optimistic; the server call is
 * fire-and-forget — guests (401) simply keep the localStorage-only state.
 */
export function toggleWishlist(productId: number, next: boolean): void {
  localStorage.setItem(localKey(productId), String(next));
  // Invalidate the cached server promise so hearts mounted later (or the
  // twin card of the same product) never read a pre-toggle snapshot, and
  // keep the cached set in step with the optimistic write.
  serverIdsPromise = null;
  if (serverIds) {
    if (next) serverIds.add(productId);
    else serverIds.delete(productId);
  }
  // Best-effort server sync (only works when a customer is linked).
  void (async () => {
    try {
      if (next) {
        await fetch("/api/store/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ productId }),
        });
      } else {
        await fetch(`/api/store/wishlist/${productId}`, {
          method: "DELETE",
          credentials: "include",
        });
      }
    } catch {
      // offline / flaky — local state remains authoritative until next load
    }
  })();
  for (const listener of listeners) listener(new Set([productId]));
}
