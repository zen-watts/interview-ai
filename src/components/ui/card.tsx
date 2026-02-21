import type { ReactNode } from "react";

import { cn } from "@/src/lib/utils/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-paper border border-paper-border bg-paper-elevated p-5", className)}>
      {children}
    </div>
  );
}
