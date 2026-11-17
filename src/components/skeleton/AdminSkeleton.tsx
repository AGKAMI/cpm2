"use strict";

import { SkeletonBlock } from "./SkeletonBlock";

/**
 * Admin page skeleton — mirrors the loaded admin layout:
 * top actions row, category card, product form card, catalogue card.
 */
export function AdminSkeleton() {
  return (
    <div className="p-4 space-y-6">
      {/* Top actions row (EFT review + back) */}
      <div className="flex items-center gap-2">
        <SkeletonBlock width="120px" height="34px" radius="0.25rem" />
        <SkeletonBlock width="110px" height="34px" radius="0.25rem" />
      </div>

      {/* Category management card */}
      <div className="admin-section panel rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <SkeletonBlock width="100px" height="18px" radius="0.25rem" />
          <SkeletonBlock width="110px" height="32px" radius="0.25rem" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonBlock key={i} width="full" height="44px" radius="0.375rem" />
          ))}
        </div>
      </div>

      {/* Product form card */}
      <div className="admin-section panel rounded-xl border border-border p-6">
        <SkeletonBlock width="140px" height="20px" radius="0.25rem" />
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonBlock key={i} width="full" height="44px" radius="0.375rem" />
          ))}
        </div>
      </div>

      {/* Catalogue card */}
      <div className="admin-section panel rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <SkeletonBlock width="90px" height="18px" radius="0.25rem" />
          <SkeletonBlock width="110px" height="32px" radius="0.25rem" />
        </div>
        <SkeletonBlock width="full" height="44px" radius="0.375rem" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <SkeletonBlock key={i} width="full" height="56px" radius="0.5rem" />
          ))}
        </div>
      </div>
    </div>
  );
}
