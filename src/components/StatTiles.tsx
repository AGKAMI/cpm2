"use client";

import { LIMITS } from "@/lib/constants";
import type { FleetStats } from "@/lib/types";
import { formatNumber } from "@/lib/constants";

type Accent = "amber" | "mint" | "cyan";

const ACCENTS: Record<Accent, { text: string; glow: string }> = {
  amber: { text: "text-amber-glow", glow: "rgba(255,183,3,0.5)" },
  mint: { text: "text-mint-glow", glow: "rgba(70,224,160,0.45)" },
  cyan: { text: "text-cyan-glow", glow: "rgba(76,201,240,0.45)" },
};

function StatTile({
  index,
  label,
  value,
  sub,
  accent,
  delay,
}: {
  index: string;
  label: string;
  value: string;
  sub: string;
  accent: Accent;
  delay: number;
}) {
  const tone = ACCENTS[accent];
  return (
    <div
      className="animate-rise panel corner-ticks group relative overflow-hidden rounded-xl px-4 py-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="label-caps">{label}</span>
        <span className="num text-[10px] tracking-widest text-white/20">{index}</span>
      </div>
      <p
        className={`num mt-3 font-bold leading-none tabular-nums text-[clamp(1.2rem,2.3vw,1.65rem)] ${tone.text}`}
      >
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-tight text-ash-500">{sub}</p>
      <div
        className="absolute inset-x-0 bottom-0 h-px opacity-40 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${tone.glow}, transparent)` }}
      />
    </div>
  );
}

export function StatTiles({ stats }: { stats: FleetStats | null }) {
  const s = stats;
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        index="01"
        label="Accounts"
        accent="amber"
        value={s ? formatNumber(s.accounts) : "—"}
        sub={s ? `${s.accountsFull} garage${s.accountsFull === 1 ? "" : "s"} full` : "loading fleet"}
        delay={40}
      />
      <StatTile
        index="02"
        label="Total cash"
        accent="mint"
        value={s ? formatNumber(s.totalCash) : "—"}
        sub={s ? `avg ${formatNumber(s.averageCash)} per account` : "loading fleet"}
        delay={90}
      />
      <StatTile
        index="03"
        label="Total coins"
        accent="amber"
        value={s ? formatNumber(s.totalCoins) : "—"}
        sub={s ? `${formatNumber(s.coinsLockedInSlots)} locked in slots` : "loading fleet"}
        delay={140}
      />
      <StatTile
        index="04"
        label="Fleet capacity"
        accent="cyan"
        value={s ? `${formatNumber(s.totalCars)}/${formatNumber(s.totalCapacity)}` : "—"}
        sub={s ? `${s.totalSlots} extra slot${s.totalSlots === 1 ? "" : "s"} owned` : "loading fleet"}
        delay={190}
      />
      <p className="sr-only">
        Caps: cash {LIMITS.MAX_CASH}, coins {LIMITS.MAX_COINS}, {LIMITS.BASE_CAR_SLOTS} base car slots,
        {LIMITS.MAX_PURCHASED_SLOTS} purchasable slots at {LIMITS.SLOT_COST_COINS} coins each.
      </p>
    </section>
  );
}
