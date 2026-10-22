"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "glass-accent text-paper border border-racing/40 hover:brightness-110 active:scale-[0.98]",
  outline:
    "glass-control text-ink hover:border-racing/45 hover:text-racing active:scale-[0.98]",
  ghost: "border border-transparent text-ink-soft hover:bg-ink/6 hover:text-ink",
  danger:
    "border border-oxblood/35 bg-transparent text-oxblood hover:border-oxblood hover:bg-oxblood hover:text-paper active:scale-[0.98]",
  subtle: "glass-control text-ink hover:border-ink/20 active:scale-[0.98]",
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
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full font-sans font-semibold transition-[background-color,border-color,color,transform,filter] duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  );
}
