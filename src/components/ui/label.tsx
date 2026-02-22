import type { LabelHTMLAttributes } from "react";

import { cn } from "@/src/lib/utils/cn";

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  hint?: string;
}

export function Label({ className, children, hint, ...rest }: LabelProps) {
  return (
    <label
      className={cn("font-sans text-xs uppercase tracking-[0.12em] text-paper-muted", className)}
      {...rest}
    >
      {hint ? (
        <span className="group/hint relative inline-flex cursor-help items-center gap-1.5">
          {children}
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-paper-muted text-[9px] leading-none normal-case tracking-normal opacity-60 transition-opacity group-hover/hint:opacity-100">
            ?
          </span>
          <span className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-52 rounded-paper border border-paper-border bg-paper-elevated px-3 py-2 font-sans text-xs normal-case tracking-normal text-paper-softInk opacity-0 shadow-sm transition-opacity group-hover/hint:opacity-100">
            {hint}
          </span>
        </span>
      ) : (
        children
      )}
    </label>
  );
}
