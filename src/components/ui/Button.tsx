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
  primary: "bg-primary text-primary-foreground border border-primary hover:bg-racing hover:text-primary-foreground hover:border-primary",
  secondary: "bg-secondary text-secondary-foreground border border-secondary hover:bg-racing hover:text-primary-foreground hover:border-secondary",
  destructive: "bg-destructive text-destructive-foreground border border-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive",
  outline: "border border-input bg-background hover:border-primary hover:text-accent-foreground",
  ghost: "border border-input bg-background hover:border-primary hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
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
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-[transform,box-shadow,border-color,background-color] duration-160 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-secondary disabled:text-secondary-foreground active:scale-[0.97] hover:border-primary hover:text-primary-foreground",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
    </button>
  );
}
