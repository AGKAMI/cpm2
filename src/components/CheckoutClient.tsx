"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { vantaApi, formatPrice, type VantaProduct } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";

export function CheckoutClient({ productId }: { productId: number }) {
  const [product, setProduct] = useState<VantaProduct | null>(null);
  const [media, setMedia] = useState<{ publicUrl: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [playerId, setPlayerId] = useState("");
  const [inGameName, setInGameName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"eft" | "payfast">("eft");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofFileName, setProofFileName] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eftDetailsOpen, setEftDetailsOpen] = useState(false);

  // Per-field validation state
  const [playerIdError, setPlayerIdError] = useState<string | null>(null);
  const [inGameNameError, setInGameNameError] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  // Load product data on mount.
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const [pRes, mRes] = await Promise.all([
          vantaApi.products({}),
          vantaApi.media(productId),
        ]);
        const p = pRes.products.find((x) => x.id === productId);
        if (!p) {
          setLoading(false);
          return;
        }
        setProduct(p);
        setMedia(mRes.media.map((m) => ({ publicUrl: m.publicUrl })));
      } catch {
        setLoading(false);
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [productId]);

  // Stash the guest player ID so Orders can scope by it.
  useEffect(() => {
    if (playerId.trim() && typeof window !== "undefined") {
      window.localStorage.setItem("vanta_player_id", playerId.trim());
    }
  }, [playerId]);

  const subtotal = product?.basePriceCents ?? 0;
  const discountCents = 2500;
  const deliveryFeeCents = 0;
  const totalCents = Math.max(0, subtotal - discountCents + deliveryFeeCents);

  // Validation helpers
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

  const validateProof = (method: string, file: File | null): string | null => {
    if (method === "eft" && !file) return "Please upload EFT proof of payment";
    return null;
  };

  const validateAll = (): boolean => {
    const pIdErr = validatePlayerId(playerId);
    const nameErr = validateInGameName(inGameName);
    const proofErr = validateProof(paymentMethod, proofFile);

    setPlayerIdError(pIdErr);
    setInGameNameError(nameErr);
    setProofError(proofErr);

    return !pIdErr && !nameErr && !proofErr;
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    if (!validateAll()) {
      const firstInvalid = document.querySelector(".border-destructive") as HTMLElement | null;
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      }
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
        if (typeof window !== "undefined") {
          window.location.href = payfastUrl;
        }
        return;
      }

      if (typeof window !== "undefined") {
        window.location.href = `/store/orders/${order.id}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setCheckoutBusy(false);
    }
  };

  const isFormValid =
    !validatePlayerId(playerId) &&
    !validateInGameName(inGameName) &&
    !validateProof(paymentMethod, proofFile);

  if (loading)
    return (
      <StoreShell>
        <div className="panel rounded-xl border border-border p-6">
          <div className="h-3 w-1/2 rounded-sm bg-background mb-4 animate-pulse" />
          <div className="h-3 w-1/3 rounded-sm bg-background mb-2 animate-pulse" />
          <div className="h-3 w-2/3 rounded-sm bg-background mb-4 animate-pulse" />
          <div className="space-y-3">
            <div className="h-4 w-24 rounded-sm bg-background animate-pulse" />
            <div className="h-4 w-32 rounded-sm bg-background animate-pulse" />
          </div>
        </div>
      </StoreShell>
    );
  if (!product) return <StoreShell><p className="text-muted-foreground">Vehicle not found.</p></StoreShell>;

  const cover = media[0]?.publicUrl;

  return (
    <StoreShell>
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 mb-6">
        <Link href="/store" className="flex items-center gap-2 text-primary hover:underline cursor-pointer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="w-4 h-4"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back
        </Link>
        <h1 className="text-xl font-medium text-foreground">Checkout</h1>
        <Button variant="ghost" size="icon" aria-label="More options">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="w-4 h-4"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </Button>
      </div>

      {/* Selected vehicle */}
      <section className="panel rounded-xl border border-border p-4 mb-6">
        <div className="relative aspect-[4/3] rounded-lg bg-background overflow-hidden mb-3">
          {cover ? (
            <Image src={cover} alt={product.name} className="h-full w-full object-cover" loading="eager" width={400} height={300} style={{ objectFit: "cover" }} />
          ) : (
            <span className="num text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              No photo yet
            </span>
          )}
        </div>
        <h2 className="text-sm font-medium text-foreground mb-1">{product.name}</h2>
        <p className="text-[11px] text-muted-foreground mb-3">Custom · Purple · Coupe</p>
        <div className="flex items-baseline gap-2">
          <span className="num text-xl font-semibold text-primary">{formatPrice(product.basePriceCents, product.currency)}</span>
        </div>
      </section>

      <form onSubmit={handleConfirm} className="space-y-6">
        {/* Contact Details */}
        <section className="panel rounded-xl border border-border p-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Contact Details
          </h3>
          <Field label="Player ID" hint="2 letters + 6 digits (e.g. AB123456)" htmlFor="checkout-player-id">
            <TextInput
              id="checkout-player-id"
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
                  ? "border-destructive"
                  : playerId.trim().length === 0
                    ? "border-destructive"
                    : playerId.trim().length <= 2
                      ? "border-destructive"
                      : playerId.trim().length <= 4
                        ? "border-yellow"
                        : playerId.trim().length <= 6
                          ? "border-orange"
                          : playerId.trim().length >= 8 && !validatePlayerId(playerId)
                            ? "border-ok"
                            : "border-ok"
              }
            />
            {playerIdError && (
              <p className="text-[10px] text-destructive mt-1">{playerIdError}</p>
            )}
          </Field>
          <Field label="In-game name" hint="Name shown in CPM2" htmlFor="checkout-ingame-name">
            <TextInput
              id="checkout-ingame-name"
              value={inGameName}
              onChange={(e) => setInGameName(e.target.value)}
              placeholder="e.g. Thino M"
              className={
                inGameNameError
                  ? "border-destructive"
                  : inGameName.trim() && !validateInGameName(inGameName)
                    ? "border-destructive"
                    : inGameName.trim()
                      ? "border-ok"
                      : "border-destructive"
              }
            />
            {inGameNameError && (
              <p className="text-[10px] text-destructive mt-1">{inGameNameError}</p>
            )}
          </Field>
        </section>

        {/* Payment Method */}
        <section className="panel rounded-xl border border-border p-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Payment Method
          </h3>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-md border border-border hover:border-primary hover:text-primary-foreground hover:border-primary transition-colors">
              <input type="radio" name="paymentMethod" value="eft" checked={paymentMethod === "eft"} onChange={() => setPaymentMethod("eft")} className="accent-primary" />
              <div className="flex-1">
                <div className="text-xs font-medium text-foreground">EFT Bank Transfer</div>
                <div className="text-[10px] text-muted-foreground">Pay via bank transfer. Upload proof after payment.</div>
              </div>
            </label>
</div>
        </section>

        {/* EFT Proof Upload */}
        {paymentMethod === "eft" && (
          <>
            <section className="panel rounded-xl border border-border p-6">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
                EFT Proof Upload
              </h3>
              <div className="flex flex-col gap-3">
                <label className={`flex items-center gap-3 cursor-pointer border border-dashed rounded-md p-4 text-center transition-colors ${proofFileName ? "border-ok hover:border-ok" : "border-destructive hover:border-destructive"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="w-5 h-5 text-primary"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span className="text-xs font-medium text-foreground">Choose file</span>
                  <input type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setProofFile(file);
                    setProofFileName(file?.name ?? "");
                  }} />
                </label>
                {proofFileName && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="num">{proofFileName}</span>
                    <span>PNG, JPG or PDF · Max 5MB</span>
                  </div>
                )}
                {!proofFileName && (
                  <p className="text-[10px] text-muted-foreground">PNG, JPG or PDF · Max 5MB</p>
                )}
                {proofError && (
                  <p className="text-[10px] text-destructive mt-1">{proofError}</p>
                )}
              </div>
            </section>

            {/* EFT Bank Details */}
            <section className="panel rounded-xl border border-primary bg-primary/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">EFT Bank Details</h3>
                <Button variant="ghost" size="sm" onClick={(e) => {
                  e.preventDefault();
                  setEftDetailsOpen(!eftDetailsOpen);
                }}>
                  {eftDetailsOpen ? "Hide details" : "Show details"}
                </Button>
              </div>
              {eftDetailsOpen && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-md bg-background border border-border">
                    <span className="text-xs text-muted-foreground">Account name</span>
                    <span className="text-xs font-medium text-foreground">OJ Maluleke</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md bg-background border border-border">
                    <span className="text-xs text-muted-foreground">Bank</span>
                    <span className="text-xs font-medium text-foreground">Capitec Bank (Savings)</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md bg-background border border-border">
                    <span className="text-xs text-muted-foreground">Account number</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-foreground select-text">1548176727</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText("1548176727");
                        }}
                        aria-label="Copy account number"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="w-3 h-3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md bg-background border border-border">
                    <span className="text-xs text-muted-foreground">Branch code</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-foreground select-text">470010</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText("470010");
                        }}
                        aria-label="Copy branch code"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="w-3 h-3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md bg-background border border-border">
                    <span className="text-xs text-muted-foreground">SWIFT</span>
                    <span className="text-xs font-medium text-foreground">CABLZAJJ</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md bg-background border border-border">
                    <span className="text-xs text-muted-foreground">Reference</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-foreground select-text">VNT-{product.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`VNT-${product.name}`);
                        }}
                        aria-label="Copy reference"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="w-3 h-3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Use your CPM2 Player ID as the payment reference so we can match your payment. Daily online limit R50k.
                  </p>
                </div>
              )}
            </section>
          </>
        )}

        {/* Order Summary */}
        <section className="panel rounded-xl border border-border p-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Order Summary
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">{formatPrice(subtotal, product.currency)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-destructive">-{formatPrice(discountCents, product.currency)}</span>
            </div>
  <div className="pt-3 border-t border-border flex justify-between text-sm font-semibold text-foreground">
              <span>Total</span>
              <span className="text-primary">{formatPrice(totalCents, product.currency)}</span>
            </div>
          </div>
        </section>

        {error && (
          <p className="mt-3 rounded-md border border-destructive bg-background px-3 py-2 text-xs text-destructive">{error}</p>
        )}

        <Button
          variant="primary"
          type="submit"
          className="w-full"
          disabled={checkoutBusy || !isFormValid}
        >
          {checkoutBusy ? "Processing" : "Confirm Payment"}
        </Button>
      </form>

      <p className="mt-6 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" className="w-3 h-3"><path d="M12 22s8-4 12-16v8"/><path d="M9 12H3v20h18v-20H9z"/></svg>
        Secure Checkout
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" className="w-3 h-3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        256-bit SSL Encrypted
      </p>
    </StoreShell>
  );
}
