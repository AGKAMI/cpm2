"use client";

import type { ReactNode } from "react";
import { LIMITS, formatNumber } from "@/lib/constants";
import type { FleetStats } from "@/lib/types";

function SpecCell({
  index,
  label,
  value,
  sub,
  icon,
  accent = false,
}: {
  index: string;
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="spec-cell">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-racing/20 bg-racing/10 text-racing">
          {icon}
        </span>
        <span className="num text-[10px] text-ink-faint">{index}</span>
      </div>
      <p className="label-caps mt-3">{label}</p>
      <p className={`spec-value mt-1 ${accent ? "spec-value-accent" : ""}`}>{value}</p>
      <p className="mt-1.5 text-[11px] leading-tight text-ink-faint">{sub}</p>
    </div>
  );
}

const ICONS = {
  accounts: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19c.6-3 2.8-4.7 5.5-4.7s4.9 1.7 5.5 4.7" strokeLinecap="round" />
      <path d="M16 5.8a3 3 0 010 5.6M17.5 14.6c2 .5 3.2 2.1 3.5 4.4" strokeLinecap="round" />
    </svg>
  ),
  cash: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="6.5" width="18" height="11" rx="2.6" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.5 9.5v.1M17.5 14.4v.1" strokeLinecap="round" />
    </svg>
  ),
  coins: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <ellipse cx="12" cy="7" rx="6.5" ry="2.6" />
      <path d="M5.5 7v5c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6V7" />
      <path d="M5.5 12v5c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6v-5" />
    </svg>
  ),
  capacity: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 13l1.5-4.5A2 2 0 017.4 7h9.2a2 2 0 011.9 1.5L20 13" strokeLinecap="round" />
      <path d="M3.5 13h17v4.5h-17z" strokeLinejoin="round" />
      <circle cx="7" cy="17.5" r="1.6" />
      <circle cx="17" cy="17.5" r="1.6" />
    </svg>
  ),
};

export function StatTiles({ stats }: { stats: FleetStats | null }) {
  const s = stats;
  return (
    <>
      <section className="spec-strip">
        <SpecCell
          index="01"
          label="Accounts"
          icon={ICONS.accounts}
          value={s ? formatNumber(s.accounts) : "—"}
          sub={s ? `${s.accountsFull} garage${s.accountsFull === 1 ? "" : "s"} full` : "loading fleet"}
        />
        <SpecCell
          index="02"
          label="Total cash"
          icon={ICONS.cash}
          value={s ? formatNumber(s.totalCash) : "—"}
          sub={s ? `avg ${formatNumber(s.averageCash)} per account` : "loading fleet"}
          accent
        />
        <SpecCell
          index="03"
          label="Total coins"
          icon={ICONS.coins}
          value={s ? formatNumber(s.totalCoins) : "—"}
          sub={
            s
              ? `${formatNumber(s.coinsLockedInSlots)} locked in slots · ${formatNumber(s.totalCoinsSpentOnCars)} spent on cars`
              : "loading fleet"
          }
        />
        <SpecCell
          index="04"
          label="Fleet capacity"
          icon={ICONS.capacity}
          value={s ? `${formatNumber(s.totalCars)}/${formatNumber(s.totalCapacity)}` : "—"}
          sub={
            s
              ? `${s.totalSlots} coin slot${s.totalSlots === 1 ? "" : "s"} owned · CPM1 holds every model`
              : "loading fleet"
          }
        />
      </section>
      <p className="sr-only">
        Caps: cash {LIMITS.MAX_CASH}, coins {LIMITS.MAX_COINS}. CPM1 has no car slots and holds one of
        each model; CPM2 holds {LIMITS.BASE_CAR_SLOTS} free slots, the 21st for {LIMITS.SLOT_COST_COINS}{" "}
        coins, plus {LIMITS.NEW_GARAGE_SLOTS} slots with the {LIMITS.NEW_GARAGE_PRICE} garage.
      </p>
    </>
  );
}
