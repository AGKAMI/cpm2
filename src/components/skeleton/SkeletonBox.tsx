"use strict";

import { cn } from "@/lib/utils";

export function SkeletonBox({
  className,
  width = "100%",
  height = "100%",
  radius = "0.5rem",
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
  radius?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius)] bg-muted animate-pulse",
        className,
      )}
      style={{ width, height, borderRadius: radius }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          background:
            "linear-gradient(115deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
          backgroundSize: "200% 200%",
          animation: "skeleton-shine 3.2s ease-in-out infinite",
        }}
      />
    </div>
  );
}
