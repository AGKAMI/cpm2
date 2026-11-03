"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "racing-btn racing-btn-primary",
  outline: "racing-btn",
  ghost:
    "racing-btn border-transparent hover:bg-mix(in srgb, var(--color-ink) 8%, transparent) hover:text-ink",
};

const SIZES: Record<Size, string> = {
  sm: "racing-btn-sm",
  md: "racing-btn-md",
  icon: "racing-btn-icon",
};

type AetherButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
  loading?: boolean;
};

export function AetherButton({
  variant = "outline",
  size = "md",
  className = "",
  children,
  loading = false,
  ...props
}: AetherButtonProps) {
  return (
    <button
      {...props}
      disabled={loading}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full font-sans font-semibold disabled:opacity-45 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      aria-busy={loading}
    >
      {loading ? (
        <>
          <span className="glass-loader" style={{ width: 14, height: 14, borderWidth: 2 }} />
          <span className="sr-only">Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
