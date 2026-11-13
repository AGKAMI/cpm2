"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DockProps {
  className?: string;
  mode?: "night" | "paper";
  items: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href: string;
    active?: boolean;
  }[];
}

interface DockIconButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  active?: boolean;
  mode?: "night" | "paper";
  className?: string;
}

const DockIconButton = React.forwardRef<
  HTMLButtonElement,
  DockIconButtonProps
>(
  ({ icon: Icon, label, href, active, mode, className }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "relative group p-3 rounded-lg",
          active ? "bg-primary text-black dock-active" : "hover:bg-secondary transition-colors",
          className
        )}
        onClick={() => {
          if (href) window.location.href = href;
        }}
      >
        <Icon
          className={cn(
            "w-5 h-5",
            active
              ? mode === "night"
                ? "text-black"
                : "text-white"
              : "text-foreground"
          )}
        />
        <span
          className={cn(
            "absolute -top-8 left-1/2 -translate-x-1/2 z-20",
            "px-2 py-1 rounded text-xs",
            "bg-popover text-popover-foreground border border-border",
            "opacity-0 group-hover:opacity-100",
            "transition-opacity whitespace-nowrap pointer-events-none"
          )}
        >
          {label}
        </span>
      </button>
    );
  }
);
DockIconButton.displayName = "DockIconButton";

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  ({ items, className, mode }, ref) => {
    return (
      <div ref={ref} className={cn("fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-full flex items-center justify-center p-2 pointer-events-none", className)}>
        <div className="w-full max-w-4xl flex items-center justify-center relative pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1 p-2 rounded-2xl backdrop-blur-lg border shadow-lg bg-background/90 border-border hover:shadow-xl transition-shadow duration-300">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <DockIconButton
                  key={item.label}
                  icon={Icon}
                  label={item.label}
                  href={item.href}
                  active={item.active}
                  mode={mode}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);
Dock.displayName = "Dock";

export { Dock };
