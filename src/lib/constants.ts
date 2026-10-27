/**
 * CPM2 economy + account rules.
 * Single source of truth for every limit enforced by the API, the DB and the UI.
 */

/**
 * The fleet tracks BOTH Car Parking Multiplayer titles.
 *
 * Discriminator for EVERY car lookup and every account. It is not cosmetic:
 * car codes are not unique across games — CPM1 #13 is a 2007 Peugeot 308 while
 * CPM2 #13 is a HONDA CIVIC — so any lookup by code alone returns the wrong
 * car with no error. See src/lib/car-catalog.ts.
 */
export type GameType = "cpm1" | "cpm2";

export const GAMES = ["cpm1", "cpm2"] as const satisfies readonly GameType[];

export const GAME_LABELS: Record<GameType, string> = {
  cpm1: "CPM1",
  cpm2: "CPM2",
};

/** Narrows an arbitrary string to a GameType, or false when it is not one. */
export function isGameType(value: string): value is GameType {
  return (GAMES as readonly string[]).includes(value);
}

/**
 * The garage rules are PER GAME — one shared rule set would be wrong for both
 * titles.
 *
 * CPM1 has NO car slots: the garage is not a numbered grid, so every model in
 * the game can be owned — but only ONE of each model, because a duplicate model
 * cannot exist in the same garage.
 *
 * CPM2 is slot-based: the stock garage holds 20 free slots, the 21st slot is a
 * one-off unlock for 100 coins, and the purchasable second garage (R299.99)
 * adds 15 more slots on top (36 in total).
 */
export const GARAGE_RULES = {
  cpm1: {
    /** CPM1 has no slots at all — nothing to buy, nothing to unlock. */
    hasSlots: false,
    /** One of each model: the same car code cannot be parked twice. */
    allowDuplicateModels: false,
  },
  cpm2: {
    hasSlots: true,
    /** CPM2 garages hold duplicates — a fleet can own three of the same Supra. */
    allowDuplicateModels: true,
    /** Free slots in the stock garage. */
    freeSlots: 20,
    /** The 21st slot is the only one the game sells for coins. */
    coinSlotsMax: 1,
    /** Coin price of that one slot. */
    coinSlotCost: 100,
    /** Slots added by the purchasable second garage. */
    newGarageSlots: 15,
    /** What the second garage costs outside the game. */
    newGaragePrice: "R299.99",
  },
} as const;

export const LIMITS = {
  /** Maximum in-game cash a single account can hold. */
  MAX_CASH: 50_000_000,
  /** Maximum in-game coins a single account can hold. */
  MAX_COINS: 30_000,
  /** Free car slots in a CPM2 garage (editable per account). CPM1 has none. */
  BASE_CAR_SLOTS: GARAGE_RULES.cpm2.freeSlots,
  /** Upper bound for the per-account base garage size. */
  MAX_BASE_CAR_SLOTS: 999,
  /** Coin-bought slots per account — CPM2's 21st slot, one only. */
  MAX_COIN_SLOTS: GARAGE_RULES.cpm2.coinSlotsMax,
  /** Coin price of the one coin-bought slot. */
  SLOT_COST_COINS: GARAGE_RULES.cpm2.coinSlotCost,
  /** Slots the purchasable CPM2 garage adds. */
  NEW_GARAGE_SLOTS: GARAGE_RULES.cpm2.newGarageSlots,
  /** Price of the purchasable CPM2 garage (real money, not coins). */
  NEW_GARAGE_PRICE: GARAGE_RULES.cpm2.newGaragePrice,
  MAX_EMAIL_LENGTH: 254,
  MIN_PASSWORD_LENGTH: 1,
  MAX_PASSWORD_LENGTH: 128,
  MAX_NOTES_LENGTH: 500,
  /** Maximum rows accepted by a single bulk import request. */
  MAX_IMPORT_ROWS: 1000,
} as const;

/** Coins that are locked up in coin-bought slots across every account. */
export function slotsLockedValue(purchasedSlots: number): number {
  return Math.max(0, Math.trunc(purchasedSlots || 0)) * LIMITS.SLOT_COST_COINS;
}

/**
 * Absolute ceiling on the car counter of one account: the biggest CPM2 garage
 * (999 base + the coin slot + the second garage). CPM1's ceiling is its
 * catalog, which is far below this.
 */
export const MAX_CARS =
  LIMITS.MAX_BASE_CAR_SLOTS + LIMITS.MAX_COIN_SLOTS + LIMITS.NEW_GARAGE_SLOTS;

/** Drag racing classes, in the order they are shown. U is unlimited. */
export const TROPHY_CLASSES = ["U", "S9", "S10", "S11", "S12", "S13"] as const;

export type TrophyClass = (typeof TROPHY_CLASSES)[number];

/** Trophies exist in three metals, per class. */
export const TROPHY_METALS = ["gold", "silver", "bronze"] as const;

export type TrophyMetal = (typeof TROPHY_METALS)[number];

/** Human labels for the race classes. */
export const TROPHY_CLASS_LABELS: Record<TrophyClass, string> = {
  U: "U · Unlimited",
  S9: "S9",
  S10: "S10",
  S11: "S11",
  S12: "S12",
  S13: "S13",
};

/** Ceiling on trophies per class per metal (a sanity cap, not a game limit). */
export const MAX_TROPHIES_PER_CLASS = 999;

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
