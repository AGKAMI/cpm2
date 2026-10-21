"use client";

import Link from "next/link";
import { useFleet } from "@/components/FleetProvider";
import { StatTiles } from "@/components/StatTiles";
import { ActivityFeed } from "@/components/ActivityFeed";
import { CashBars, CapacityBars, CoinLedger } from "@/components/charts";
import { formatNumber } from "@/lib/constants";

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel rounded-[4px] p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="label-caps">{title}</h2>
        {hint ? <span className="num text-[10px] text-ink-faint">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

export default function OverviewPage() {
  const fleet = useFleet();

  const atCashCap = fleet.accounts.filter((account) => account.cash >= 50_000_000);
  const atCoinCap = fleet.accounts.filter((account) => account.coins >= 30_000);
  const full = fleet.accounts.filter((account) => account.cars >= account.capacity);
  const spenders = [...fleet.accounts]
    .filter((account) => account.coinsSpentOnCars > 0)
    .sort((a, b) => b.coinsSpentOnCars - a.coinsSpentOnCars);

  return (
    <div className="flex flex-col gap-5">
      <StatTiles stats={fleet.stats} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel title="Cash by account" hint="top holdings">
            <CashBars accounts={fleet.accounts} />
          </Panel>

          <Panel title="Garage utilisation" hint="cars / capacity">
            <CapacityBars accounts={fleet.accounts} />
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Coin ledger" hint={fleet.stats ? `${formatNumber(fleet.stats.totalCoins)} coins` : undefined}>
            {fleet.stats ? <CoinLedger stats={fleet.stats} /> : <p className="text-sm text-ink-faint">Loading…</p>}
          </Panel>

          <Panel title="Needs attention">
            <ul className="flex flex-col gap-2.5">
              <Attention
                count={atCashCap.length}
                label="account at the cash cap"
                href="/fleet?filter=cash-cap"
              />
              <Attention
                count={atCoinCap.length}
                label="account at the coin cap"
                href="/fleet?filter=coin-cap"
              />
              <Attention count={full.length} label="garage full" href="/fleet?filter=full" />
              <Attention
                count={fleet.archived.length}
                label="account archived"
                href="/fleet?view=archived"
              />
            </ul>
            {spenders.length > 0 ? (
              <div className="mt-4 border-t border-ink/10 pt-3">
                <p className="label-caps">Coins spent on cars</p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {spenders.slice(0, 4).map((account) => (
                    <li key={account.id} className="flex items-baseline justify-between gap-2">
                      <Link
                        href={`/accounts/${account.id}`}
                        className="num truncate text-[11px] text-ink-soft hover:text-racing"
                      >
                        {account.email}
                      </Link>
                      <span className="num text-[11px] text-ink">
                        {formatNumber(account.coinsSpentOnCars)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>

          <Panel title="Go to">
            <ul className="flex flex-col">
              <Jump href="/fleet" label="The fleet register" hint={`${fleet.accounts.length} accounts`} />
              <Jump
                href="/fleet?view=archived"
                label="Archived accounts"
                hint={`${fleet.archived.length} filed`}
              />
              <Jump href="/activity" label="The activity log" hint={`${fleet.events.length} entries`} />
              <Jump href="/settings" label="Settings & backup" hint="limits, paths, theme" />
            </ul>
          </Panel>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="label-caps">Latest activity</h2>
          <Link href="/activity" className="num text-[10px] text-racing hover:underline">
            open the full log →
          </Link>
        </div>
        {fleet.events.length === 0 ? (
          <div className="panel rounded-[4px] px-6 py-10 text-center text-sm text-ink-faint">
            Nothing has happened yet.
          </div>
        ) : (
          <ActivityFeed events={fleet.events.slice(0, 6)} />
        )}
      </section>
    </div>
  );
}

function Jump({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <li className="border-b border-ink/8 last:border-0">
      <Link href={href} className="flex items-baseline justify-between gap-3 py-2 hover:text-racing">
        <span className="text-[12px] text-ink">{label}</span>
        <span className="num text-[10px] text-ink-faint">{hint} →</span>
      </Link>
    </li>
  );
}

function Attention({ count, label, href }: { count: number; label: string; href: string }) {
  return (
    <li className="flex items-baseline justify-between gap-2">
      <span className="text-[12px] text-ink-soft">
        <span className={`num ${count > 0 ? "text-oxblood" : "text-ink-faint"}`}>{count}</span> {label}
      </span>
      {count > 0 ? (
        <Link href={href} className="num text-[10px] text-racing hover:underline">
          show
        </Link>
      ) : null}
    </li>
  );
}
