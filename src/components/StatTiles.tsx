"use client";

import { LIMITS, formatNumber } from "@/lib/constants";
import type { FleetStats } from "@/lib/types";

function SpecCell({
  index,
  label,
  value,
  sub,
  accent = false,
}: {
  index: string;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="spec-cell">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label-caps">{label}</span>
        <span className="num text-[10px] text-ink-faint/70">{index}</span>
      </div>
      <p className={`spec-value mt-1.5 ${accent ? "spec-value-accent" : ""}`}>{value}</p>
      <p className="mt-1.5 text-[11px] leading-tight text-ink-faint">{sub}</p>
    </div>
  );
}

export function StatTiles({ stats }: { stats: FleetStats | null }) {
  const s = stats;
  return (
    <>
      <section className="spec-strip">
        <SpecCell
          index="01"
          label="Accounts"
          value={s ? formatNumber(s.accounts) : "—"}
          sub={s ? `${s.accountsFull} garage${s.accountsFull === 1 ? "" : "s"} full` : "loading fleet"}
        />
        <SpecCell
          index="02"
          label="Total cash"
          value={s ? formatNumber(s.totalCash) : "—"}
          sub={s ? `avg ${formatNumber(s.averageCash)} per account` : "loading fleet"}
          accent
        />
        <SpecCell
          index="03"
          label="Total coins"
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
          value={s ? `${formatNumber(s.totalCars)}/${formatNumber(s.totalCapacity)}` : "—"}
          sub={s ? `${s.totalSlots} extra slot${s.totalSlots === 1 ? "" : "s"} owned` : "loading fleet"}
        />
      </section>
      <p className="sr-only">
        Caps: cash {LIMITS.MAX_CASH}, coins {LIMITS.MAX_COINS}, {LIMITS.BASE_CAR_SLOTS} base car slots,
        {LIMITS.MAX_PURCHASED_SLOTS} purchasable slots at {LIMITS.SLOT_COST_COINS} coins each.
      </p>
    </>
  );
}
