"use strict";

import { SkeletonBlock } from "./SkeletonBlock";

/**
 * Product page skeleton — mirrors the loaded product page:
 * hero carousel, meta row, spec rows.
 */
export function ProductSkeleton() {
  return (
    <div className="p-4 space-y-6">
      {/* Hero carousel skeleton */}
      <div className="relative rounded-[28px] border border-border bg-background overflow-hidden">
        <SkeletonBlock
          width="100%"
          height="420px"
          radius="28px"
          className="absolute inset-0"
        />
      </div>

      {/* Meta row */}
      <div className="flex items-baseline gap-3">
        <SkeletonBlock width="140px" height="22px" radius="0.5rem" />
        <SkeletonBlock width="100px" height="14px" radius="0.5rem" />
      </div>

      {/* Spec rows */}
      <div className="space-y-3">
        {[
          "Power",
          "Top speed",
          "0–100 km/h",
          "Drive",
          "Air suspension",
          "Bodykit unlocks",
        ].map((label, i) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <SkeletonBlock width="90px" height="18px" radius="0.25rem" />
            <SkeletonBlock width="160px" height="18px" radius="0.25rem" />
          </div>
        ))}
      </div>

      {/* Carousel nav buttons */}
      <div className="flex items-center justify-center gap-4">
        <SkeletonBlock width="40px" height="40px" radius="full" />
        <SkeletonBlock width="40px" height="40px" radius="full" />
      </div>
    </div>
  );
}
