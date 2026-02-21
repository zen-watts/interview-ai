import type { SelectHTMLAttributes } from "react";

import { cn } from "@/src/lib/utils/cn";

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-paper border border-paper-border bg-paper-elevated px-3 py-2 text-paper-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper-accent/30",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}
