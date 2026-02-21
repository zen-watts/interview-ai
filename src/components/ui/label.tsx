import type { LabelHTMLAttributes } from "react";

import { cn } from "@/src/lib/utils/cn";

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("font-sans text-xs uppercase tracking-[0.12em] text-paper-muted", className)}
      {...rest}
    />
  );
}
