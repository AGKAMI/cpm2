"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "aether-btn aether-btn-primary",
  outline: "aether-btn",
  ghost:
    "aether-btn border-transparent hover:bg-mix(in srgb, var(--aether-text) 8%, transparent) hover:text-aether-text",
};

const SIZES: Record<Size, string> = {
  sm: "aether-btn-sm",
  md: "aether-btn-md",
  icon: "aether-btn-icon",
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
          <span className="aether-loader" style={{ width: 14, height: 14, borderWidth: 2 }} />
          <span className="sr-only">Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
