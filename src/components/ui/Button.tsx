"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "racing-btn racing-btn-primary",
  outline: "racing-btn",
  ghost: "racing-btn border-transparent hover:bg-mix(in srgb, var(--color-ink) 8%, transparent) hover:text-ink",
  danger: "racing-btn border-mix(in srgb, var(--color-racing) 20%, transparent) hover:border-mix(in srgb, var(--color-racing) 50%, transparent) hover:bg-mix(in srgb, var(--color-racing) 15%, transparent) hover:text-racing",
  subtle: "racing-btn border-transparent hover:bg-mix(in srgb, var(--color-ink) 6%, transparent)",
};

const SIZES: Record<Size, string> = {
  sm: "racing-btn-sm",
  md: "racing-btn-md",
  icon: "racing-btn-icon",
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
