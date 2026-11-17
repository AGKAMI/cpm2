"use strict";

import { cn } from "@/lib/utils";

/**
 * Reusable skeleton block: a copy of a real page block, but with no text or
 * data — just the block shape. Pairs a breathing pulse with a moving shine
 * sweep so the loader reads as "loading" at a glance.
 */
export interface SkeletonBlockProps {
  className?: string;
  /** Width of the block (default full) */
  width?: string | number;
  /** Height of the block (default full) */
  height?: string | number;
  /** Border radius (default rounded-md) */
  radius?: string;
  /** Show the moving shine sweep (default true) */
  shimmer?: boolean;
}

export function SkeletonBlock({
  className,
  width = "100%",
  height = "100%",
  radius = "0.5rem",
  shimmer = true,
}: SkeletonBlockProps) {
  return (
    <div
      className={cn(
        "t-skel-skeleton relative overflow-hidden rounded-[var(--radius)]",
        className,
      )}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    >
      {/* Block fill — the breathing skeleton shape */}
      <div
        className="t-skel-skeleton absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, #e2e8f0 25%, #f8fafc 50%, #e2e8f0 75%)",
          backgroundSize: "200% 100%",
          animation: "t-skel-pulse 1s ease-in-out 1",
        }}
      />
      {/* Shine sweep — the diagonal moving glare that signals loading */}
      {shimmer && (
        <div
          className="shine-sweep absolute inset-0"
          style={{
            background:
              "linear-gradient(115deg, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0) 38%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0) 62%, rgba(255,255,255,0.40) 100%)",
          }}
        />
      )}
    </div>
  );
}
