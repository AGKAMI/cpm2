"use client";

import type { ReactNode } from "react";

type AetherLoaderProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
};

const SIZES: Record<string, string> = {
  sm: "w-10 h-10 border-2",
  md: "w-14 h-14 border-3",
  lg: "w-20 h-20 border-4",
};

export function AetherLoader({
  label,
  size = "md",
}: AetherLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <span className={`aether-loader ${SIZES[size]}`} aria-hidden="true" />
      {label ? (
        <span className="aether-loader-text">{label}</span>
      ) : null}
    </div>
  );
}
