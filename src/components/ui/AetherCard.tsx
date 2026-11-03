"use client";

import type { ReactNode } from "react";

type AetherCardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  float?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
};

const PADDING: Record<string, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function AetherCard({
  children,
  className = "",
  hover = true,
  float = false,
  padding = "md",
}: AetherCardProps) {
  return (
    <div
      className={`glass-card ${hover ? "" : "hover:none transition-none"} ${float ? "glass-card-float" : ""} ${PADDING[padding]} ${className}`}
    >
      {children}
    </div>
  );
}

export function AetherCardHeader({
  title,
  subtitle,
  className = "",
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`mb-4 ${className}`}>
      <span className="label-caps block mb-1">{title}</span>
      {subtitle ? (
        <p className="text-[13px] leading-relaxed text-ink-soft">{subtitle}</p>
      ) : null}
    </div>
  );
}
