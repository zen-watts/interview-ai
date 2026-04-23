import type { ReactNode } from "react";

import { cn } from "@/src/lib/utils/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-paper border border-paper-border bg-[var(--paper-card)] p-5 shadow-[0_6px_20px_rgba(78,61,44,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
