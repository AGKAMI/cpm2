"use strict";

import { SkeletonBlock } from "./SkeletonBlock";

export function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} width="full" height="120px" radius="0.75rem" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonBlock width="full" height="400px" className="lg:col-span-2" radius="0.75rem" />
        <SkeletonBlock width="full" height="400px" radius="0.75rem" />
      </div>
    </div>
  );
}
