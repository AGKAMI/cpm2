"use client";

import { GARAGE_RULES, type GameType } from "@/lib/constants";

/**
 * Garage gauge: a swept instrument dial rather than a row of boxes.
 * The arc is the whole garage, the needle points at the cars in it.
 *
 * The two games read differently on purpose. CPM2 is a slot grid (20 free, the
 * 21st bought for coins, 15 more with the second garage). CPM1 has no slots:
 * the dial is the whole catalog and one of each model fits.
 */
export function CapacityGauge({
  cars,
  capacity,
  baseSlots,
  game,
  compact = false,
}: {
  cars: number;
  capacity: number;
  baseSlots: number;
  game: GameType;
  compact?: boolean;
}) {
  const slotless = !GARAGE_RULES[game].hasSlots;
  const slots = slotless ? 0 : Math.max(0, capacity - baseSlots);
  const atCapacity = cars >= capacity;
  const safe = Math.max(1, capacity);
  const ratio = Math.min(1, cars / safe);

  // 220° sweep, starting bottom-left.
  const start = 160;
  const sweep = 220;
  const angle = start + ratio * sweep;
  const purchasedFrom = start + (Math.min(baseSlots, safe) / safe) * sweep;

  const arcPath = (from: number, to: number) => {
    const polar = (deg: number) => {
      const rad = (deg * Math.PI) / 180;
      return { x: 50 + Math.cos(rad) * 40, y: 50 + Math.sin(rad) * 40 };
    };
    const a = polar(from);
    const b = polar(to);
    const large = to - from > 180 ? 1 : 0;
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A 40 40 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  };

  const needle = {
    x: 50 + Math.cos((angle * Math.PI) / 180) * 30,
    y: 50 + Math.sin((angle * Math.PI) / 180) * 30,
  };

  return (
    <div className="flex items-center gap-2.5">
      {!compact ? (
        <svg viewBox="0 0 100 100" className="h-9 w-9 shrink-0" aria-hidden>
          <path
            d={arcPath(start, start + sweep)}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className="stroke-ink/10"
          />
          {slots > 0 ? (
            <path
              d={arcPath(start, purchasedFrom)}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className="stroke-brass/35"
            />
          ) : null}
          <path
            d={arcPath(start, angle)}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={atCapacity ? "stroke-oxblood" : "stroke-racing"}
          />
          <line
            x1="50"
            y1="50"
            x2={needle.x.toFixed(2)}
            y2={needle.y.toFixed(2)}
            strokeWidth="3"
            strokeLinecap="round"
            className={atCapacity ? "stroke-oxblood" : "stroke-ink"}
          />
          <circle cx="50" cy="50" r="4" className="fill-ink" />
        </svg>
      ) : null}

      <div className="min-w-0 leading-tight">
        <span className={`num whitespace-nowrap text-[12px] ${atCapacity ? "text-racing" : "text-ink"}`}>
          {cars}/{capacity}
          {slots > 0 ? <span className="text-racing"> +{slots}</span> : null}
        </span>
        <span className={`num whitespace-nowrap text-[10px] text-ink-faint`}>
          {slotless
            ? atCapacity
              ? "every model owned"
              : `${capacity - cars} models free`
            : atCapacity
              ? "garage full"
              : `${capacity - cars} free`}
        </span>
      </div>

      {atCapacity ? (
        <span className="shrink-0 rounded-full border border-racing/40 px-2 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-racing">
          Full
        </span>
      ) : null}
    </div>
  );
}
