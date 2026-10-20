import { LIMITS, slotsLockedValue } from "./constants.ts";
import type { AccountSummary, FleetStats } from "./types.ts";

/**
 * Pure fleet aggregation — used by the API and by the browser after a local
 * balance tweak, so the header tiles never disagree with the table.
 */
export function computeFleetStats(accounts: AccountSummary[]): FleetStats {
  const totals = accounts.reduce(
    (acc, account) => {
      acc.totalCash += account.cash;
      acc.totalCoins += account.coins;
      acc.totalCars += account.cars;
      acc.totalCapacity += account.capacity;
      acc.totalSlots += account.slots;
      return acc;
    },
    {
      totalCash: 0,
      totalCoins: 0,
      totalCars: 0,
      totalCapacity: 0,
      totalSlots: 0,
    },
  );

  return {
    accounts: accounts.length,
    totalCash: totals.totalCash,
    totalCoins: totals.totalCoins,
    totalCars: totals.totalCars,
    totalCapacity: totals.totalCapacity,
    totalSlots: totals.totalSlots,
    coinsLockedInSlots: slotsLockedValue(totals.totalSlots),
    averageCash: accounts.length ? Math.round(totals.totalCash / accounts.length) : 0,
    accountsAtCashCap: accounts.filter((a) => a.cash >= LIMITS.MAX_CASH).length,
    accountsAtCoinCap: accounts.filter((a) => a.coins >= LIMITS.MAX_COINS).length,
    accountsFull: accounts.filter((a) => a.cars >= a.capacity).length,
  };
}
