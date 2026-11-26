"use client";
export const dynamic = "force-dynamic";

/**
 * VANTA GARAGE — bulk cart checkout.
 * /store/cart/checkout?playerId=&inGameName=
 *
 * Reads the buyer's player id / in-game name (from query or localStorage,
 * set by the cart page), submits every cart item as one bulk order via
 * POST /api/store/cart/checkout, then sends the buyer to the orders page.
 * Reads query params client-side only (useSearchParams breaks static
 * prerender on this page without a Suspense boundary).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { vantaApi, rememberOrderAccess } from "@/lib/store/client";
import { StarIcon } from "@/components/StarIcon";

export default function CartCheckoutPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>("");
  const [playerId, setPlayerId] = useState("");
  const [inGameName, setInGameName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"eft" | "stars">("eft");
  const autoFired = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const p = params.get("playerId") ?? "";
    const n = params.get("inGameName") ?? "";
    if (p) setPlayerId(p);
    else setPlayerId(window.localStorage.getItem("vanta_player_id") ?? "");
    if (n) setInGameName(n);
    else setInGameName(window.localStorage.getItem("vanta_ingame_name") ?? "");
  }, []);

  const submit = useCallback(async () => {
    const pid = playerId.trim();
    const name = inGameName.trim();

    if (!pid || !name) {
      setError("Please enter your Player ID and in-game name on the cart page first.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await vantaApi.cartCheckout({
        playerId: pid,
        inGameName: name,
        paymentMethod,
      });
      // Keep one capability per order from this bulk checkout, then open the
      // first order. The orders LIST remains account/Telegram-only because a
      // per-order capability must not become a whole-history credential.
      if (typeof window !== "undefined") {
        for (const item of res.orderAccessTokens ?? []) {
          rememberOrderAccess(item.orderId, item.token);
        }
        window.localStorage.removeItem("vanta_bulk_cart");
      }
      const first = res.orderIds?.[0];
      window.location.href = first
        ? `/store/orders/${encodeURIComponent(first)}?cart=1`
        : `/store/orders?cart=1&subtotal=${res.subtotalCents ?? 0}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk checkout failed. Try again.");
    } finally {
      setBusy(false);
    }
  }, [playerId, inGameName, paymentMethod]);

  useEffect(() => {
    // Only auto-submit when landed here from the cart page (marker set). Wait
    // until playerId/inGameName are hydrated from the URL/localStorage — the
    // old []-deps effect fired on mount with the initial EMPTY state (the
    // hydration effect's setState had not re-rendered yet), so submit() saw an
    // empty player id and showed "enter your Player ID first" despite valid
    // query params. Fire once, after the identity is present.
    const marker =
      typeof window !== "undefined"
        ? window.localStorage.getItem("vanta_bulk_cart")
        : null;
    if (marker === "1" && !autoFired.current && playerId.trim() && inGameName.trim()) {
      autoFired.current = true;
      void submit();
    }
  }, [playerId, inGameName, submit]);

  return (
    <StoreShell>
      <PageHeading folio="05" title="Checkout cart" backHref="/store/cart" />
      <div className="px-4 sm:px-6 py-8">
        {error && (
          <div className="rounded-md border border-destructive bg-background px-4 py-3 text-xs text-destructive mb-6">
            {error}
          </div>
        )}
        {busy ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <div className="animate-pulse rounded-full h-12 w-12 bg-border mb-4" />
            <p className="text-muted-foreground">Placing bulk order…</p>
          </div>
        ) : (
          <div className="max-w-sm mx-auto text-center">
            <h2 className="text-xl font-bold text-foreground mb-2">Bulk checkout</h2>
            <p className="text-muted-foreground mb-4">
              Submit every vehicle in your cart as one order. Each vehicle is
              reserved and paid for separately.
            </p>
            <div className="flex items-center justify-between gap-3 mb-6">
              <span className="text-xs font-medium text-muted-foreground">Pay with</span>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md border border-border hover:border-primary">
                  <input
                    type="radio"
                    name="bulkPayment"
                    value="eft"
                    checked={paymentMethod === "eft"}
                    onChange={() => setPaymentMethod("eft")}
                    className="accent-primary"
                  />
                  EFT
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md border border-border hover:border-primary">
                  <input
                    type="radio"
                    name="bulkPayment"
                    value="stars"
                    checked={paymentMethod === "stars"}
                    onChange={() => setPaymentMethod("stars")}
                    className="accent-primary"
                  />
                  <span className="flex items-center gap-1.5"><StarIcon className="w-3.5 h-3.5" />Telegram Stars</span>
                </label>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={submit}
              disabled={busy}
              className="w-full"
            >
              {busy ? "Processing…" : "Confirm bulk purchase"}
            </Button>
          </div>
        )}
      </div>
    </StoreShell>
  );
}
