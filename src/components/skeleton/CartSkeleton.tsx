"use strict";

import { SkeletonBlock } from "./SkeletonBlock";

export function CartSkeleton() {
  return (
    <div className="p-4 space-y-6">
      {/* Cart header */}
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-2">
          <SkeletonBlock width="200px" height="32px" radius="0.25rem" />
          <SkeletonBlock width="120px" height="20px" radius="2px" />
        </div>
        <SkeletonBlock width="100px" height="100px" radius="0.75rem" className="flex-shrink-0" />
      </div>

      {/* Cart items */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center p-3 border rounded-xl">
            <SkeletonBlock width="full" height="120px" className="lg:col-span-1" />
            <div className="lg:col-span-2 space-y-2">
              <SkeletonBlock width="220px" height="20px" radius="2px" />
              <SkeletonBlock width="140px" height="16px" radius="2px" />
              <SkeletonBlock width="100px" height="14px" radius="2px" />
            </div>
            <SkeletonBlock width="full" height="40px" className="lg:col-span-1" />
          </div>
        ))}
      </div>

      {/* Summary */}
      <SkeletonBlock width="full" height="200px" radius="0.75rem" />
    </div>
  );
}
