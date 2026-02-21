import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/src/lib/utils/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger";
}

export function Button({ children, className, variant = "primary", ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-paper border px-3 py-2 text-sm font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper-accent/30",
        variant === "primary" &&
          "border-paper-border bg-paper-ink text-paper-bg hover:border-paper-accent hover:bg-paper-softInk",
        variant === "ghost" &&
          "border-paper-border bg-transparent text-paper-softInk hover:border-paper-accent hover:text-paper-ink",
        variant === "danger" &&
          "border-paper-danger bg-paper-danger text-paper-bg hover:opacity-90",
        rest.disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
