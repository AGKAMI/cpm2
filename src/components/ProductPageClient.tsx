"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { vantaApi, formatPrice, type VantaProduct } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput } from "@/components/ui/Field";

export function ProductPageClient({ productId }: { productId: string }) {
  const [product, setProduct] = useState<VantaProduct | null>(null);
  const [media, setMedia] = useState<{ publicUrl: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [inGameName, setInGameName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"payfast" | "eft">("eft");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const [pRes, mRes] = await Promise.all([
          vantaApi.products({}),
          vantaApi.media(Number(productId)),
        ]);
        const p = pRes.products.find((x) => x.id === Number(productId));
        if (!p) return notFound();
        setProduct(p);
        setMedia(mRes.media.map((m) => ({ publicUrl: m.publicUrl })));
      } catch {
        return notFound();
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [productId]);

  if (loading) return <StoreShell><p className="text-muted-foreground">Loading vehicle…</p></StoreShell>;
  if (!product) return notFound();

  async function handleCheckout() {
    if (!product) return;
    setError(null);
    if (!playerId.trim() || !inGameName.trim()) {
      setError("Player ID and in-game name are required.");
      return;
    }
    setCheckoutBusy(true);
    try {
      const idempotencyKey = `checkout_${product.id}_${Date.now()}`;
      const { order, reservedUntil, payfastUrl } = await vantaApi.checkout({
        productId: product.id,
        quantity: 1,
        paymentMethod,
        playerId: playerId.trim(),
        inGameName: inGameName.trim(),
        idempotencyKey,
      });
      if (payfastUrl) {
        if (typeof window !== "undefined" && window.Telegram?.WebApp) {
          const webApp = window.Telegram.WebApp as { openLink?: (url: string) => void };
          if (typeof webApp.openLink === "function") {
            webApp.openLink(payfastUrl);
          } else {
            window.location.href = payfastUrl;
          }
        } else {
          window.location.href = payfastUrl;
        }
        setCheckoutOpen(false);
        return;
      }
      setCheckoutOpen(false);
      if (typeof window !== "undefined") {
        window.location.href = `/store/orders/${order.id}`;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed. Try again.";
      setError(message);
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <StoreShell>
      <PageHeading folio="02" title={product.name} />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="panel rounded-xl border border-border p-6">
          {media.length > 0 ? (
            <div className="aspect-video rounded-lg bg-muted overflow-hidden mb-4 relative">
              {media.map((m, i) => (
                <img
                  key={i}
                  src={m.publicUrl}
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                />
              ))}
            </div>
          ) : (
            <div className="aspect-video rounded-lg bg-muted overflow-hidden mb-4">
              <span className="block h-full w-full text-center text-[10px] text-muted-foreground">
                Vehicle image
              </span>
            </div>
          )}
          <h3 className="text-lg font-medium text-foreground">{product.name}</h3>
          <p className="text-[11px] text-muted-foreground line-clamp-3 mt-2">{product.description}</p>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-2xl text-primary font-semibold">{formatPrice(product.basePriceCents, product.currency)}</span>
            {product.exclusivity !== "standard" && (
              <span className="text-[10px] uppercase tracking-[0.15em] text-accent-foreground border border-accent px-2 py-0.5 rounded ml-2">
                {product.exclusivity.replace("_", " ")}
              </span>
            )}
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-xs text-muted-foreground">Stock</span>
            <span className={`text-sm font-medium ${product.stockQuantity === 0 ? "text-destructive" : "text-foreground"}`}>
              {product.stockQuantity === 0 ? "Sold out" : `${product.stockQuantity} left`}
            </span>
          </div>
          <div className="mt-6">
            <Button
              variant="primary"
              className="w-full"
              onClick={() => setCheckoutOpen(true)}
              disabled={product.stockQuantity === 0 || checkoutBusy}
            >
              {checkoutBusy ? "Placing order…" : "Buy now"}
            </Button>
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => {
                const text = `*VANTA GARAGE* — *${product.name}* — ${formatPrice(product.basePriceCents, product.currency)}\n${product.description}\n\nOrder here: ${typeof window !== "undefined" ? window.location.origin : ""}/store/products/${product.id}`;
                const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                if (typeof window !== "undefined") window.open(url, "_blank");
              }}
              disabled={checkoutBusy}
            >
              Share to WhatsApp
            </Button>
          </div>
        </div>
        <div className="panel rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Checkout</h3>
          <Field label="Player ID" hint="Your CPM2 player ID" htmlFor="player-id">
            <TextInput id="player-id" value={playerId} onChange={(e) => setPlayerId(e.target.value)} placeholder="e.g. 784123" />
          </Field>
          <Field label="In-game name" hint="Name shown in CPM2" htmlFor="ingame-name">
            <TextInput id="ingame-name" value={inGameName} onChange={(e) => setInGameName(e.target.value)} placeholder="e.g. Chief" />
          </Field>
          <Field label="Payment method" htmlFor="payment-method">
            <div className="flex items-center gap-2 rounded-md border border-input bg-background p-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="radio" name="paymentMethod" value="payfast" checked={paymentMethod === "payfast"} onChange={() => setPaymentMethod("payfast")} className="accent-primary" disabled />{" "}
                PayFast <span className="text-[10px] uppercase tracking-[0.15em] text-accent-foreground border border-accent px-2 py-0.5 rounded ml-2">coming soon</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="radio" name="paymentMethod" value="eft" checked={paymentMethod === "eft"} onChange={() => setPaymentMethod("eft")} className="accent-primary" />
                EFT (manual proof)
              </label>
            </div>
          </Field>
          {error && (
            <p className="mt-3 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Your order is reserved for 60 minutes. Complete payment before it expires or the vehicle goes back on sale.
          </p>
        </div>
      </div>

      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Confirm purchase" width="max-w-md">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">Vehicle</span>
            <span className="text-sm font-medium text-foreground">{product.name}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-sm text-primary font-semibold">{formatPrice(product.basePriceCents, product.currency)}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">Payment</span>
            <span className="text-sm text-foreground capitalize">{paymentMethod}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            You’ll need your Player ID and in-game name ready. Delivery is arranged after payment clears.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCheckoutOpen(false)} type="button">Cancel</Button>
            <Button variant="primary" onClick={handleCheckout} disabled={checkoutBusy} type="button">{checkoutBusy ? "Processing…" : "Confirm"}</Button>
          </div>
        </div>
      </Modal>
    </StoreShell>
  );
}
