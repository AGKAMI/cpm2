"use strict";

import { SkeletonBlock } from "./SkeletonBlock";

/**
 * Store home skeleton — mirrors the hub as it actually renders:
 * wallet identity card + balance card, the 3-tile game picker, then
 * category / promotion shelves. (The previous skeleton showed a product
 * carousel and grids — the hub renders no products at all.)
 */
export function StoreHomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24" aria-busy="true">
      {/* Wallet identity card */}
      <div className="flex items-center gap-3 rounded-3xl border border-border bg-secondary p-4">
        <SkeletonBlock width="44px" height="44px" radius="full" className="shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <SkeletonBlock width="45%" height="15px" radius="4px" />
          <SkeletonBlock width="30%" height="10px" radius="4px" />
        </div>
      </div>

      {/* Balance card */}
      <div className="mt-3 rounded-3xl border border-border bg-secondary p-5">
        <SkeletonBlock width="40%" height="11px" radius="4px" />
        <div className="mt-3 flex items-end justify-between gap-3">
          <SkeletonBlock width="120px" height="36px" radius="8px" />
          <SkeletonBlock width="110px" height="42px" radius="9999px" />
        </div>
      </div>

      {/* Game picker — 3 tiles */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-secondary px-3 py-6 ${i === 2 ? "col-span-2 sm:col-span-1" : ""}`}
          >
            <SkeletonBlock width="26px" height="26px" radius="6px" />
            <SkeletonBlock width="52px" height="13px" radius="4px" />
          </div>
        ))}
      </div>

      {/* Shelves */}
      {[0, 1].map((s) => (
        <div key={s} className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <SkeletonBlock width="150px" height="13px" radius="4px" />
            <SkeletonBlock width="60px" height="11px" radius="4px" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} width="100%" height="46px" radius="12px" />
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only">Loading store…</span>
    </div>
  );
}
