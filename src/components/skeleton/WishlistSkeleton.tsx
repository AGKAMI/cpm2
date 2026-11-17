"use strict";

import { SkeletonBlock } from "./SkeletonBlock";

/**
 * Wishlist page skeleton — mirrors the loaded wishlist:
 * the saved-vehicles grid (image + name + price).
 */
export function WishlistSkeleton() {
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <SkeletonBlock width="100px" height="20px" radius="0.25rem" />
        <SkeletonBlock width="80px" height="20px" radius="0.25rem" />
      </div>

      {/* Empty-state heading */}
      <div className="text-center">
        <SkeletonBlock width="200px" height="24px" radius="0.25rem" className="mx-auto mb-3" />
        <SkeletonBlock width="140px" height="14px" radius="0.25rem" className="mx-auto" />
      </div>

      {/* Saved vehicles grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="panel rounded-xl border border-border p-4 flex flex-col h-full"
            aria-hidden="true"
          >
            <div className="flex items-start justify-between mb-3">
              <SkeletonBlock width="120px" height="18px" radius="0.25rem" />
              <SkeletonBlock width="60px" height="28px" radius="0.5rem" />
            </div>
            <SkeletonBlock width="100%" height="64px" radius="12px" className="mb-3" />
            <SkeletonBlock width="full" height="12px" radius="0.25rem" className="mb-2" />
            <SkeletonBlock width="120px" height="12px" radius="0.25rem" className="mb-2" />
            <SkeletonBlock width="80px" height="12px" radius="0.25rem" className="mb-2" />
            <SkeletonBlock width="100px" height="12px" radius="0.25rem" />
          </div>
        ))}
      </div>
    </div>
  );
}
