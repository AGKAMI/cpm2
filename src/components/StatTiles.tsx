"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LIMITS, formatNumber } from "@/lib/constants";
import type { FleetStats } from "@/lib/types";

type Accent = "amber" | "mint" | "cyan";

const ACCENTS: Record<Accent, { text: string; glow: string }> = {
  amber: { text: "text-amber-glow", glow: "rgba(255,183,3,0.5)" },
  mint: { text: "text-mint-glow", glow: "rgba(70,224,160,0.45)" },
  cyan: { text: "text-cyan-glow", glow: "rgba(76,201,240,0.45)" },
};

/** Sweeps a number up like a needle: eased count from the previous target to the new one. */
function useRevUp(target: number, durationMs = 900): number {
  const [display, setDisplay] = useState(0);
  const valueRef = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const from = reduce ? target : valueRef.current;
    const duration = reduce ? 1 : durationMs;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      const value = Math.round(from + (target - from) * eased);
      valueRef.current = value;
      setDisplay(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return display;
}

function StatTile({
  index,
  label,
  sub,
  accent,
  delay,
  target,
  suffix,
}: {
  index: string;
  label: string;
  sub: string;
  accent: Accent;
  delay: number;
  target: number;
  suffix?: string;
}) {
  const tone = ACCENTS[accent];
  const value = useRevUp(target);
  return (
    <div
      className="animate-rise gauge-dial carbon-weave panel corner-ticks group relative overflow-hidden rounded-xl px-4 py-4"
      style={{ animationDelay: `${delay}ms`, "--dial": tone.glow } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="label-caps text-ash-300">{label}</span>
        <span className="num text-[10px] tracking-widest text-white/20">{index}</span>
      </div>
      <p
        className={`num mt-2 font-bold leading-none tabular-nums text-[clamp(1.3rem,2.5vw,1.8rem)] ${tone.text}`}
      >
        {suffix ? "" : formatNumber(value)}
        {suffix ? (
          <>
            {formatNumber(value)}
            <span className="text-ash-500">/</span>
            {suffix}
          </>
        ) : null}
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
        target={s ? s.accounts : 0}
        sub={s ? `${s.accountsFull} garage${s.accountsFull === 1 ? "" : "s"} full` : "loading fleet"}
        delay={40}
      />
      <StatTile
        index="02"
        label="Total cash"
        accent="mint"
        target={s ? s.totalCash : 0}
        sub={s ? `avg ${formatNumber(s.averageCash)} per account` : "loading fleet"}
        delay={90}
      />
      <StatTile
        index="03"
        label="Total coins"
        accent="amber"
        target={s ? s.totalCoins : 0}
        sub={
          s
            ? `${formatNumber(s.coinsLockedInSlots)} locked in slots · ${formatNumber(s.totalCoinsSpentOnCars)} spent on cars`
            : "loading fleet"
        }
        delay={140}
      />
      <StatTile
        index="04"
        label="Fleet capacity"
        accent="cyan"
        target={s ? s.totalCars : 0}
        suffix={s ? formatNumber(s.totalCapacity) : undefined}
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
