"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-racing text-paper border border-racing hover:border-racing-deep hover:bg-racing-deep active:scale-[0.98]",
  outline:
    "border border-ink/15 bg-ink/[0.03] text-ink hover:border-racing/50 hover:bg-racing/10 hover:text-racing active:scale-[0.98]",
  ghost: "border border-transparent text-ink-soft hover:bg-ink/6 hover:text-ink",
  danger:
    "border border-oxblood/35 bg-transparent text-oxblood hover:border-oxblood hover:bg-oxblood hover:text-paper active:scale-[0.98]",
  subtle: "border border-ink/10 bg-ink/6 text-ink hover:bg-ink/10 active:scale-[0.98]",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-[11px]",
  md: "h-11 px-5 text-[12.5px]",
  icon: "h-10 w-10 justify-center",
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
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full font-sans font-semibold transition-[background-color,border-color,color,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  );
}
