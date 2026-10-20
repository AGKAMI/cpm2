"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-amber-glow text-carbon-950 hover:bg-[#ffc733] active:bg-[#e8a500] font-semibold shadow-[0_10px_30px_-14px_rgba(255,183,3,0.9)]",
  outline:
    "border border-white/12 bg-white/[0.03] text-ash-200 hover:border-amber-glow/50 hover:text-amber-glow",
  ghost: "text-ash-400 hover:bg-white/5 hover:text-ash-100",
  danger: "border border-red-glow/35 text-red-glow hover:bg-red-glow/10",
  subtle: "bg-carbon-800 text-ash-200 hover:bg-carbon-700",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[11px] tracking-[0.12em]",
  md: "h-10 px-4 text-xs tracking-[0.14em]",
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
      className={`inline-flex items-center gap-2 rounded-lg font-display uppercase transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  );
}
