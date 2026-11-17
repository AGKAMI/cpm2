"use strict";

import { SkeletonBlock } from "./SkeletonBlock";

/**
 * Orders page skeleton — mirrors the loaded order list:
 * order cards with stage badge, amount, date.
 */
export function OrdersSkeleton() {
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <SkeletonBlock width="120px" height="20px" radius="0.25rem" />
        <SkeletonBlock width="140px" height="24px" radius="0.25rem" />
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="panel rounded-xl border border-border p-4 stagger-item stagger-{i+1}"
          aria-hidden="true"
        >
          <div className="flex items-center justify-between mb-3">
            <SkeletonBlock width="70px" height="18px" radius="0.25rem" />
            <SkeletonBlock width="100px" height="18px" radius="0.25rem" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <SkeletonBlock width="120px" height="20px" radius="0.25rem" />
            <SkeletonBlock width="90px" height="16px" radius="0.25rem" />
          </div>
          <div className="flex items-center gap-2 text-[11px] mb-3">
            <SkeletonBlock width="60px" height="14px" radius="0.25rem" />
            <SkeletonBlock width="100px" height="14px" radius="0.25rem" />
            <SkeletonBlock width="90px" height="14px" radius="0.25rem" />
          </div>
          <div className="flex items-center justify-between">
            <SkeletonBlock width="120px" height="16px" radius="0.25rem" />
            <SkeletonBlock width="80px" height="16px" radius="0.25rem" />
          </div>
        </div>
      ))}
    </div>
  );
}
