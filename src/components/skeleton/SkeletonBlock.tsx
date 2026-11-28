"use strict";

import { cn } from "@/lib/utils";

/**
 * THE skeleton primitive for the whole app. Every page skeleton is built
 * from this one block, so a restyle here propagates everywhere — there is
 * deliberately no second skeleton component (the old SkeletonBox duplicated
 * this with a hard-coded light-slate fill that rendered as a white slab on
 * the night theme).
 *
 * The fill is theme-aware via the `.skel-block` / `.skel-shimmer` classes in
 * globals.css (color-mix of --foreground over --background), so night, paper
 * and every palette get a correct loader automatically.
 */
export interface SkeletonBlockProps {
  className?: string;
  /** Width of the block (default full). "full" is accepted as 100%. */
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
      className={cn("skel-block relative overflow-hidden", shimmer && "skel-shimmer", className)}
      style={{
        width: width === "full" ? "100%" : width,
        height,
        borderRadius: radius === "full" ? "9999px" : radius,
      }}
      aria-hidden="true"
    />
  );
}

/** A stack of text-line blocks — the skeleton twin of a paragraph block. */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          width={i === lines - 1 ? "62%" : "100%"}
          height="13px"
          radius="4px"
        />
      ))}
    </div>
  );
}

/** Skeleton twin of PageHeading: same title block + double rule, so the
 *  heading never pops in after the content arrives. */
export function SkeletonHeading() {
  return (
    <div className="mb-1" aria-hidden="true">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <SkeletonBlock width="min(420px, 70%)" height="40px" radius="8px" />
      </div>
      <div className="rule-double mt-4" />
    </div>
  );
}

/** Skeleton twin of a `.panel` card with a title row and body lines. */
export function SkeletonPanel({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <section className={cn("panel rounded-xl border border-border p-4 sm:p-6", className)} aria-hidden="true">
      <div className="mb-4 flex items-center justify-between gap-3">
        <SkeletonBlock width="150px" height="18px" radius="4px" />
        <SkeletonBlock width="92px" height="30px" radius="6px" />
      </div>
      <SkeletonLines lines={lines} />
    </section>
  );
}

/** Skeleton twin of a list of rows (catalogue rows, tickets, orders…). */
export function SkeletonRows({ rows = 5, height = "56px" }: { rows?: number; height?: string }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{ minHeight: height }}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <SkeletonBlock width="55%" height="14px" radius="4px" />
            <SkeletonBlock width="38%" height="10px" radius="4px" />
          </div>
          <SkeletonBlock width="64px" height="32px" radius="6px" className="shrink-0" />
          <SkeletonBlock width="64px" height="32px" radius="6px" className="shrink-0" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Skeleton twin of a stat-card grid. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel rounded-xl border border-border p-4 space-y-3">
          <SkeletonBlock width="60%" height="11px" radius="4px" />
          <SkeletonBlock width="45%" height="24px" radius="6px" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton twin of a form: label + field pairs in a responsive grid. */
export function SkeletonForm({ fields = 6 }: { fields?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-hidden="true">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <SkeletonBlock width="40%" height="10px" radius="4px" />
          <SkeletonBlock width="100%" height="42px" radius="6px" />
        </div>
      ))}
    </div>
  );
}
