"use client";

import Link from "next/link";
import { formatNumber } from "@/lib/constants";
import type { AccountSummary, FleetStats } from "@/lib/types";

/** Horizontal bar chart: cash held per account. */
export function CashBars({ accounts }: { accounts: AccountSummary[] }) {
  if (accounts.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-ink-faint">No accounts to chart yet.</p>;
  }
  const top = [...accounts].sort((a, b) => b.cash - a.cash).slice(0, 8);
  const max = Math.max(...top.map((account) => account.cash), 1);

  return (
    <ul className="flex flex-col gap-2.5">
      {top.map((account) => (
        <li key={account.id} className="flex items-center gap-3">
          <Link
            href={`/accounts/${account.id}`}
            className="num w-[42%] shrink-0 truncate text-[11px] text-ink-soft hover:text-racing"
          >
            {account.email}
          </Link>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8">
            <span
              className="block h-full rounded-full bg-racing"
              style={{ width: `${Math.max(2, (account.cash / max) * 100)}%` }}
            />
          </span>
          <span className="num w-[84px] shrink-0 text-right text-[11px] text-ink">
            {formatNumber(account.cash)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Stacked coin ledger: free / locked in slots / spent on cars. */
export function CoinLedger({ stats }: { stats: FleetStats }) {
  const free = Math.max(0, stats.totalCoins - stats.coinsLockedInSlots);
  const locked = stats.coinsLockedInSlots;
  const spent = stats.totalCoinsSpentOnCars;
  const total = Math.max(1, free + locked + spent);
  const slices = [
    { label: "Free", value: free, className: "bg-racing" },
    { label: "Locked in slots", value: locked, className: "bg-brass" },
    { label: "Spent on cars", value: spent, className: "bg-blueprint" },
  ];

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink/8">
        {slices.map((slice) =>
          slice.value > 0 ? (
            <span
              key={slice.label}
              className={slice.className}
              style={{ width: `${(slice.value / total) * 100}%` }}
              title={`${slice.label}: ${formatNumber(slice.value)}`}
            />
          ) : null,
        )}
      </div>
      <dl className="mt-3 flex flex-col gap-1.5">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${slice.className}`} />
            <dt className="text-[11px] text-ink-soft">{slice.label}</dt>
            <dd className="num ml-auto text-[11px] text-ink">{formatNumber(slice.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Garage utilisation per account: used vs capacity. */
export function CapacityBars({ accounts }: { accounts: AccountSummary[] }) {
  if (accounts.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-ink-faint">No accounts to chart yet.</p>;
  }
  const rows = [...accounts].sort((a, b) => b.cars / b.capacity - a.cars / a.capacity).slice(0, 8);

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((account) => {
        const ratio = Math.min(1, account.cars / Math.max(1, account.capacity));
        const full = ratio >= 1;
        return (
          <li key={account.id} className="flex items-center gap-3">
            <Link
              href={`/accounts/${account.id}`}
              className="num w-[42%] shrink-0 truncate text-[11px] text-ink-soft hover:text-racing"
            >
              {account.email}
            </Link>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8">
              <span
                className={`block h-full rounded-full ${full ? "bg-oxblood" : "bg-blueprint"}`}
                style={{ width: `${Math.max(2, ratio * 100)}%` }}
              />
            </span>
            <span className="num w-[84px] shrink-0 text-right text-[11px] text-ink">
              {account.cars}/{account.capacity}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
