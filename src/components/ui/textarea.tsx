import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/src/lib/utils/cn";

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-paper border border-paper-border bg-paper-elevated px-3 py-2 text-paper-ink",
        "placeholder:text-paper-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper-accent/30",
        className,
      )}
      {...rest}
    />
  );
}
