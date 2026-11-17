"use strict";

import { SkeletonBlock } from "./SkeletonBlock";

/**
 * Categories page skeleton — mirrors the loaded catalogue grid:
 * the `id="res"` grid of product cards (image + name + price).
 */
export function CategoriesSkeleton() {
  return (
    <div className="p-4 space-y-6">
      {/* Filter bar skeleton */}
      <div className="flex items-center gap-2">
        <SkeletonBlock width="120px" height="24px" radius="0.25rem" />
        <SkeletonBlock width="80px" height="10px" radius="2px" />
        <SkeletonBlock width="120px" height="24px" radius="0.25rem" />
      </div>

      {/* Search input skeleton */}
      <div className="px-4 mt-3">
        <SkeletonBlock width="380px" height="46px" radius="15px" />
      </div>

      {/* Result count + sort */}
      <div className="flex items-center justify-between px-4">
        <SkeletonBlock width="80px" height="20px" radius="0.25rem" />
        <SkeletonBlock width="160px" height="32px" radius="0.25rem" />
      </div>

      {/* Product grid — the `id="res"` 5-column catalogue */}
      <div id="res" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 px-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <a
            key={i}
            className="product-card group block col-span-1"
            aria-hidden="true"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="relative overflow-hidden rounded-[24px] border border-border mb-4 aspect-[4/5]">
              <SkeletonBlock width="100%" height="100%" radius="24px" />
            </div>
            <div className="mt-3 px-1">
              <SkeletonBlock width="full" height="18px" radius="2px" />
              <div className="flex items-baseline flex-wrap gap-2 mt-2">
                <SkeletonBlock width="90px" height="14px" radius="0.25rem" />
                <SkeletonBlock width="80px" height="14px" radius="0.25rem" />
                <SkeletonBlock width="80px" height="14px" radius="0.25rem" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
