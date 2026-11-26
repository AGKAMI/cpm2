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
export function approxStarsForCents(cents: number, zarPerStar?: number): number {
  // Nearest 5 Stars — identical rule to starsForCents() so what the buyer
  // sees on a card is exactly what the invoice charges.
  //
  // The caller that KNOWS the configured rate must pass it (the products API
  // passes stars.ts's zarPerStar(), which honours STARS_ZAR_PER_STAR). It
  // used to be a second hardcoded 0.24 here, so setting the env made the
  // displayed quote and the charged invoice diverge. Stay pure for client
  // components — never read env in this module.
  const rate = zarPerStar ?? 0.36; // R36 : 100 Stars
  const exact = Math.ceil((cents / 100) / rate);
  return Math.max(5, Math.round(exact / 5) * 5);
}

/** True when a discount is actually in force for this product. */
export function hasDiscount(product: { basePriceCents: number; discountPercent: number }): boolean {
  return product.discountPercent > 0 && discountedPriceCents(product.basePriceCents, product.discountPercent) < product.basePriceCents;
}
