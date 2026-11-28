"use strict";

import { SkeletonBlock, SkeletonRows, SkeletonStats, SkeletonPanel, SkeletonForm } from "./SkeletonBlock";

/**
 * Admin Product Manager skeleton — mirrors the CURRENT admin layout, not the
 * old stacked page: the EFT action row, then the three-card section menu
 * (Categories / Promotions / Catalogue) that opens one card at a time.
 * PageHeading is rendered by the page itself, so it never pops in.
 */
export function AdminSkeleton() {
  return (
    <div aria-busy="true">
      {/* Top actions — EFT review */}
      <div className="mb-6 flex items-center gap-2">
        <SkeletonBlock width="130px" height="38px" radius="4px" />
      </div>

      {/* Section menu — three doorway cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border-2 border-border bg-background p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <SkeletonBlock width="55%" height="16px" radius="4px" />
              <SkeletonBlock width="64px" height="11px" radius="4px" />
            </div>
            <SkeletonBlock width="90%" height="12px" radius="4px" />
            <SkeletonBlock width="70%" height="12px" radius="4px" className="mt-1.5" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading admin…</span>
    </div>
  );
}

/** Catalogue view skeleton — the game picker comes FIRST (choosing which
 *  game's catalogue to customise is the entry step), then filters + rows. */
export function AdminCatalogueSkeleton() {
  return (
    <div aria-busy="true">
      <div className="mb-6 flex items-center gap-2">
        <SkeletonBlock width="130px" height="38px" radius="4px" />
      </div>
      <SkeletonBlock width="150px" height="36px" radius="8px" className="mb-4" />
      <section className="admin-section panel rounded-xl border border-border p-4">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} width="100%" height="72px" radius="12px" />
          ))}
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <SkeletonBlock width="40%" height="10px" radius="4px" />
              <SkeletonBlock width="100%" height="40px" radius="6px" />
            </div>
          ))}
        </div>
        <SkeletonRows rows={6} />
      </section>
      <span className="sr-only">Loading catalogue…</span>
    </div>
  );
}

/** Generic admin subpage skeleton: stats row + two stacked panels — the
 *  shared shape of dashboard / analytics / deliveries / support pages. */
export function AdminStatsSkeleton() {
  return (
    <div aria-busy="true">
      <SkeletonStats count={4} />
      <SkeletonPanel lines={4} className="mb-8" />
      <SkeletonPanel lines={3} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Admin list skeleton: heading stats + row list (accounts, EFT, tickets…). */
export function AdminListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true">
      <SkeletonPanel lines={2} className="mb-8" />
      <SkeletonRows rows={rows} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Admin form skeleton: one panel carrying a field grid (config, bulk…). */
export function AdminFormSkeleton() {
  return (
    <div aria-busy="true">
      <section className="panel rounded-xl border border-border p-6 sm:p-8">
        <SkeletonForm fields={6} />
        <SkeletonBlock width="180px" height="42px" radius="8px" className="mt-6" />
      </section>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
