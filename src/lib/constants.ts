/**
 * CPM2 economy + account rules.
 * Single source of truth for every limit enforced by the API, the DB and the UI.
 */

export const LIMITS = {
  /** Maximum in-game cash a single account can hold. */
  MAX_CASH: 50_000_000,
  /** Maximum in-game coins a single account can hold. */
  MAX_COINS: 30_000,
  /** Free car slots every account starts with. */
  BASE_CAR_SLOTS: 20,
  /** Maximum extra car slots a single account can own. */
  MAX_PURCHASED_SLOTS: 15,
  /** Coin price of one extra car slot. */
  SLOT_COST_COINS: 100,
  MAX_EMAIL_LENGTH: 254,
  MIN_PASSWORD_LENGTH: 1,
  MAX_PASSWORD_LENGTH: 128,
  MAX_NOTES_LENGTH: 500,
  /** Maximum rows accepted by a single bulk import request. */
  MAX_IMPORT_ROWS: 1000,
} as const;

/** Total garage capacity for an account that owns `purchasedSlots` extra slots. */
export function carCapacity(purchasedSlots: number): number {
  return LIMITS.BASE_CAR_SLOTS + Math.max(0, Math.trunc(purchasedSlots || 0));
}

/** Absolute ceiling on cars an account can ever hold. */
export const MAX_CARS = carCapacity(LIMITS.MAX_PURCHASED_SLOTS);

/** Coins that are locked up in purchased slots across every account. */
export function slotsLockedValue(purchasedSlots: number): number {
  return Math.max(0, Math.trunc(purchasedSlots || 0)) * LIMITS.SLOT_COST_COINS;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
