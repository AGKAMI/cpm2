export type AccountSummary = {
  id: number;
  email: string;
  cash: number;
  coins: number;
  cars: number;
  baseSlots: number;
  slots: number;
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
  | "archived"
  | "deleted"
  | "export_performed"
  | "password_revealed"
  | "trophies_updated";

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

export type ImportReport = {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  results: ImportRowResult[];
};
