"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant =
  | "primary"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link";
type Size = "default" | "sm" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground border border-primary hover:bg-primary-hover hover:text-primary-foreground hover:border-primary active:bg-primary active:text-primary-foreground active:border-primary",
  secondary: "bg-secondary text-secondary-foreground border border-secondary hover:bg-muted hover:text-secondary-foreground hover:border-secondary active:bg-secondary active:text-secondary-foreground active:border-secondary",
  destructive: "bg-destructive text-destructive-foreground border border-destructive hover:bg-destructive/90 hover:text-destructive-foreground hover:border-destructive active:bg-destructive active:text-destructive-foreground active:border-destructive",
  outline: "border border-input bg-background hover:bg-muted hover:text-accent-foreground hover:border-primary active:bg-secondary active:text-accent-foreground active:border-primary",
  ghost: "border border-input bg-background hover:bg-muted hover:text-accent-foreground hover:border-primary active:bg-secondary active:text-accent-foreground active:border-primary",
  link: "text-primary underline-offset-4 hover:underline active:text-primary",
};

const SIZES: Record<Size, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3",
  lg: "h-11 px-8",
  icon: "h-10 w-10",
};

export function Button({
  variant = "outline",
  size = "default",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium cursor-pointer transition-[transform,box-shadow,border-color,background-color] duration-160 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-secondary disabled:text-secondary-foreground active:scale-[var(--scale-medium)]",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
    </button>
  );
}
