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
      <div className={`flex ${compact ? "h-1" : "h-1.5"} flex-1 items-center gap-[2px]`}>
        {Array.from({ length: capacity }).map((_, index) => {
          const filled = index < cars;
          const purchased = index >= LIMITS.BASE_CAR_SLOTS;
          return (
            <span
              key={index}
              title={`Slot ${index + 1}`}
              className={`h-full flex-1 rounded-[1px] transition-colors ${
                filled
                  ? purchased
                    ? "bg-amber-glow"
                    : "bg-cyan-glow"
                  : purchased
                    ? "bg-amber-glow/25"
                    : "bg-white/10"
              }`}
            />
          );
        })}
      </div>
      <span
        className={`num shrink-0 text-[11px] ${atCapacity ? "text-red-glow" : "text-ash-500"}`}
        title={`${cars} of ${capacity} slots used`}
      >
        {cars}/{capacity}
        {slots > 0 ? <span className="text-amber-glow/70"> +{slots}</span> : null}
      </span>
      {atCapacity ? (
        <span className="shrink-0 rounded border border-red-glow/40 px-1.5 py-0.5 font-display text-[9px] uppercase tracking-[0.16em] text-red-glow">
          Full
        </span>
      ) : null}
    </div>
  );
}
