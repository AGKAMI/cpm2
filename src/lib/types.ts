import type { GameType } from "./constants.ts";

export type AccountSummary = {
  id: number;
  email: string;
  /** Which title this account belongs to. Drives which catalog its garage uses. */
  game: GameType;
  cash: number;
  coins: number;
  cars: number;
  /** Free slots (CPM2 only — CPM1 has no slots). */
  baseSlots: number;
  /** Coin-bought slots (CPM2's 21st slot only). */
  slots: number;
  /** CPM2 only: the account owns the purchasable second garage (R299.99). */
  newGarage: boolean;
  capacity: number;
  slotsValue: number;
  coinsSpentOnCars: number;
  notes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FleetEventType =
  | "created"
  | "updated"
  | "slots_removed"
  | "slots_purchased"
  | "garage_upgraded"
  | "archived"
  | "deleted"
  | "export_performed"
  | "password_revealed"
  | "trophies_updated"
  | "car_added"
  | "car_removed";

export type FleetEvent = {
  id: number;
  accountId: number | null;
  email: string;
  type: FleetEventType;
  summary: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  createdAt: string;
};

export type FleetStats = {
  accounts: number;
  totalCash: number;
  totalCoins: number;
  totalCars: number;
  totalCapacity: number;
  totalSlots: number;
  coinsLockedInSlots: number;
  totalCoinsSpentOnCars: number;
  averageCash: number;
  accountsAtCashCap: number;
  accountsAtCoinCap: number;
  accountsFull: number;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
};

export type ImportRowResult = {
  row: number;
  email?: string;
  status: "created" | "skipped" | "failed";
  code?: string;
  message?: string;
  fields?: Record<string, string>;
};

/** Trophies for one account in one drag racing class. */
export type TrophyRecord = {
  class: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  updatedAt: string;
};

/** Trophy totals for one account, with the per-class breakdown. */
export type TrophySummary = {
  accountId: number;
  email: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  byClass: TrophyRecord[];
};

/**
 * One car in one account's garage (references the static catalog by code).
 * `game` is required to resolve the name — the same code is a different car
 * per title, so (game, carCode) is the real identity of this record.
 */
export type CarRecord = {
  id: number;
  accountId: number;
  carCode: number;
  carName: string;
  game: GameType;
  notes: string;
  addedAt: string;
};

/** Garage inventory for one account. */
export type GarageSummary = {
  accountId: number;
  email: string;
  game: GameType;
  cars: CarRecord[];
  count: number;
  capacity: number;
};

/**
 * One account that holds a given car, for the "who owns this model" lookup.
 * `count` is how many of that code the account has — duplicates are allowed.
 */
export type CarOwner = {
  accountId: number;
  email: string;
  game: GameType;
  count: number;
};

/** Which accounts hold a given car code inside one game. */
export type CarOwners = {
  carCode: number;
  carName: string;
  game: GameType;
  owners: CarOwner[];
};

export type ImportReport = {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  results: ImportRowResult[];
};
