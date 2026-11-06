import * as React from "react";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  checked,
  onCheckedChange,
  ...props
}: React.ComponentPropsWithRef<"input"> & {
  className?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      className={cn(
        "h-4 w-4 shrink-0 rounded-full border border-transparent bg-input",
        "checked:bg-primary checked:text-primary-foreground",
        className,
      )}
      {...props}
    />
  );
}
