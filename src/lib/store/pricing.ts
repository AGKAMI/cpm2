/**
 * VANTA GARAGE — product pricing with per-product discounts.
 * Pure math, no server deps — safe to import from client components.
 */

/** The price actually charged: base minus the discount percent (rounded). */
export function discountedPriceCents(basePriceCents: number, discountPercent: number): number {
  const pct = Math.min(Math.max(Math.round(discountPercent), 0), 90);
  if (pct === 0) return basePriceCents;
  return Math.round((basePriceCents * (100 - pct)) / 100);
}

/** Whole cents saved versus the original price. */
export function discountSavingsCents(basePriceCents: number, discountPercent: number): number {
  return basePriceCents - discountedPriceCents(basePriceCents, discountPercent);
}

/** Approximate Stars for a ZAR amount (whole Stars, ≥1). Client-side display
 *  only — the invoice is always created server-side with the same math. */
export function approxStarsForCents(cents: number, zarPerStar = 0.24): number {
  return Math.max(1, Math.ceil((cents / 100) / zarPerStar));
}

/** True when a discount is actually in force for this product. */
export function hasDiscount(product: { basePriceCents: number; discountPercent: number }): boolean {
  return product.discountPercent > 0 && discountedPriceCents(product.basePriceCents, product.discountPercent) < product.basePriceCents;
}
