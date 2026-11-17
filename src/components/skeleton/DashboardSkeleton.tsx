"use strict";

import { SkeletonBox } from "./SkeletonBox";

export function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBox key={i} width="full" height="120px" radius="0.75rem" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonBox width="full" height="400px" className="lg:col-span-2" radius="0.75rem" />
        <SkeletonBox width="full" height="400px" radius="0.75rem" />
      </div>
    </div>
  );
}
