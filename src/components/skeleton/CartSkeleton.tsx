"use strict";

import { SkeletonBox } from "./SkeletonBox";

export function CartSkeleton() {
  return (
    <div className="p-4 space-y-6">
      {/* Cart header */}
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-2">
          <SkeletonBox width="200px" height="32px" radius="0.25rem" />
          <SkeletonBox width="120px" height="20px" radius="2px" />
        </div>
        <SkeletonBox width="100px" height="100px" radius="0.75rem" className="flex-shrink-0" />
      </div>

      {/* Cart items */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center p-3 border rounded-xl">
            <SkeletonBox width="full" height="120px" className="lg:col-span-1" />
            <div className="lg:col-span-2 space-y-2">
              <SkeletonBox width="220px" height="20px" radius="2px" />
              <SkeletonBox width="140px" height="16px" radius="2px" />
              <SkeletonBox width="100px" height="14px" radius="2px" />
            </div>
            <SkeletonBox width="full" height="40px" className="lg:col-span-1" />
          </div>
        ))}
      </div>

      {/* Summary */}
      <SkeletonBox width="full" height="200px" radius="0.75rem" />
    </div>
  );
}
