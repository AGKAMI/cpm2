"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "aether-btn aether-btn-primary",
  outline: "aether-btn",
  ghost: "aether-btn border-transparent hover:bg-mix(in srgb, var(--aether-text) 8%, transparent) hover:text-aether-text",
  danger: "aether-btn border-mix(in srgb, var(--aether-accent) 20%, transparent) hover:border-mix(in srgb, var(--aether-accent) 50%, transparent) hover:bg-mix(in srgb, var(--aether-accent) 15%, transparent) hover:text-aether-accent",
  subtle: "aether-btn border-transparent hover:bg-mix(in srgb, var(--aether-text) 6%, transparent)",
};

const SIZES: Record<Size, string> = {
  sm: "aether-btn-sm",
  md: "aether-btn-md",
  icon: "aether-btn-icon",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
};

export function Button({
  variant = "subtle",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full font-sans font-semibold ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  );
}
