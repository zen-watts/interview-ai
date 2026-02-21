"use client";

import type { ReactNode } from "react";

import { cn } from "@/src/lib/utils/cn";

export function Modal({
  title,
  children,
  onClose,
  widthClassName = "max-w-2xl",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  widthClassName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4" role="dialog" aria-modal>
      <div className={cn("w-full rounded-paper border border-paper-border bg-paper-bg p-6", widthClassName)}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-2xl text-paper-ink">{title}</h2>
          <button
            type="button"
            className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted hover:text-paper-ink"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
