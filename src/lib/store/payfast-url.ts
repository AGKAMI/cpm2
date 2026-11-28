/** PayFast endpoint helpers. Kept free of app imports so they can be unit
 * tested (and reused by the retry job) without pulling in the store DB. */

const PAYFAST_SANDBOX_ORIGIN = "https://sandbox.payfast.co.za";

/** Normalised PayFast origin. PAYFAST_BASE_URL has historically held either
 *  the bare origin or the full `/eng/process` checkout URL; both must work or
 *  retries build nonsense like `/eng/process/eng/query_transactions`. */
export function getPayFastBaseUrl(): string {
  const configured = process.env.PAYFAST_BASE_URL?.trim();
  if (!configured) return PAYFAST_SANDBOX_ORIGIN;
  return configured.replace(/\/eng\/process\/?$/, "").replace(/\/+$/, "") || PAYFAST_SANDBOX_ORIGIN;
}

export function getPayFastCheckoutUrl(): string {
  return `${getPayFastBaseUrl()}/eng/process`;
}

export function getPayFastQueryUrl(): string {
  return `${getPayFastBaseUrl()}/eng/query_transactions`;
}
