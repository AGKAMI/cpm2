"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-racing text-paper border border-racing hover:bg-racing-deep hover:border-racing-deep active:translate-y-px",
  outline:
    "border border-ink/25 bg-transparent text-ink hover:border-racing hover:text-racing active:translate-y-px",
  ghost: "border border-transparent text-ink-soft hover:bg-ink/6 hover:text-ink",
  danger:
    "border border-oxblood/40 bg-transparent text-oxblood hover:bg-oxblood hover:text-paper active:translate-y-px",
  subtle: "border border-ink/15 bg-paper-sunken text-ink hover:bg-ink/8 active:translate-y-px",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[10px] tracking-[0.14em]",
  md: "h-10 px-5 text-[11px] tracking-[0.15em]",
  icon: "h-9 w-9 justify-center",
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
      className={`inline-flex items-center gap-2 rounded-full font-sans font-semibold uppercase transition-[background-color,border-color,color,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  );
}
