"use client";

import { LIMITS } from "@/lib/constants";

export function CapacityGauge({
  cars,
  capacity,
  compact = false,
}: {
  cars: number;
  capacity: number;
  compact?: boolean;
}) {
  const slots = Math.max(0, Math.min(LIMITS.MAX_PURCHASED_SLOTS, capacity - LIMITS.BASE_CAR_SLOTS));
  const atCapacity = cars >= capacity;

  return (
    <div className="flex items-center gap-2">
      <div className={`gauge-track ${compact ? "h-1" : "h-1.5"}`}>
        {Array.from({ length: capacity }).map((_, index) => {
          const filled = index < cars;
          const purchased = index >= LIMITS.BASE_CAR_SLOTS;
          return (
            <span
              key={index}
              title={`Slot ${index + 1}`}
              className={`gauge-tick ${
                filled ? (atCapacity ? "gauge-tick-full" : purchased ? "gauge-tick-bought" : "gauge-tick-filled") : "gauge-tick-free"
              }`}
            />
          );
        })}
      </div>
      <span className={`num shrink-0 text-[11px] ${atCapacity ? "text-oxblood" : "text-ink-soft"}`}>
        {cars}/{capacity}
        {slots > 0 ? <span className="text-brass"> +{slots}</span> : null}
      </span>
      {atCapacity ? (
        <span className="shrink-0 rounded-[2px] border border-oxblood/45 px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-oxblood">
          Full
        </span>
      ) : null}
    </div>
  );
}
