"use strict";

import { SkeletonBlock } from "./SkeletonBlock";

export function SettingsSkeleton() {
  return (
    <div className="p-4 space-y-6 max-w-2xl">
      <div className="space-y-4">
        <SkeletonBlock width="full" height="64px" radius="0.75rem" className="flex items-center px-4" />
        <SkeletonBlock width="full" height="56px" radius="0.5rem" />
        <SkeletonBlock width="full" height="56px" radius="0.5rem" />
        <SkeletonBlock width="full" height="56px" radius="0.5rem" />
        <SkeletonBlock width="full" height="56px" radius="0.5rem" />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="p-4 space-y-6 max-w-lg">
      <div className="flex flex-col items-center gap-4">
        <SkeletonBlock width="80px" height="80px" radius="full" className="flex-shrink-0" />
        <SkeletonBlock width="200px" height="32px" radius="0.25rem" />
        <SkeletonBlock width="160px" height="24px" radius="2px" />
      </div>
      <div className="space-y-3">
        <SkeletonBlock width="full" height="56px" radius="0.5rem" />
        <SkeletonBlock width="full" height="56px" radius="0.5rem" />
        <SkeletonBlock width="full" height="56px" radius="0.5rem" />
      </div>
    </div>
  );
}

export function AccountsSkeleton() {
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-4">
        <SkeletonBlock width="220px" height="40px" radius="0.5rem" />
        <SkeletonBlock width="120px" height="40px" radius="0.5rem" />
      </div>
      <div className="overflow-hidden rounded-xl border">
        <div className="p-2">
          <SkeletonBlock width="60px" height="20px" radius="2px" />
          <SkeletonBlock width="100px" height="16px" radius="2px" className="mt-1" />
        </div>
        <div className="h-64 overflow-y-auto">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3 p-3 border-b last:border-b-0">
              <SkeletonBlock width="48px" height="48px" radius="full" className="flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <SkeletonBlock width="200px" height="20px" radius="2px" />
                <SkeletonBlock width="140px" height="16px" radius="2px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
