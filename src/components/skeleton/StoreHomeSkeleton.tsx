"use strict";

import { SkeletonBox } from "./SkeletonBox";

export function StoreHomeSkeleton() {
  return (
    <div className="space-y-6 p-4">
      {/* Promo banner skeleton */}
      <SkeletonBox width="full" height="48px" radius="0.75rem" className="mb-4" />

      {/* Featured carousel skeleton */}
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonBox key={i} width="220px" height="300px" className="flex-shrink-0" />
        ))}
      </div>

      {/* Section headings + product grids */}
      {[1, 2].map((section) => (
        <div key={section} className="space-y-3">
          <div className="flex items-center gap-2">
            <SkeletonBox width="140px" height="24px" radius="0.25rem" />
            <SkeletonBox width="60px" height="10px" radius="2px" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonBox key={`${section}-${i}`} width="full" height="360px" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
