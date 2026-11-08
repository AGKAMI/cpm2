import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({
  className,
  ...props
}: React.ComponentPropsWithRef<"label"> & {
  className?: string;
}) {
  return (
    <label
      className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:text-muted-foreground", className)}
      {...props}
    />
  );
}
