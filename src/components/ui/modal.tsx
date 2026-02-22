"use client";

import { useMemo, useState } from "react";
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
  const [isClosing, setIsClosing] = useState(false);
  const animationDurationMs = 260;

  const overlayClassName = useMemo(
    () => (isClosing ? "modal-overlay-exit" : "modal-overlay-enter"),
    [isClosing]
  );
  const panelClassName = useMemo(
    () => (isClosing ? "modal-panel-exit" : "modal-panel-enter"),
    [isClosing]
  );

  const handleClose = () => {
    if (isClosing) {
      return;
    }
    setIsClosing(true);
    window.setTimeout(() => {
      onClose();
    }, animationDurationMs);
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/25 px-4 py-4",
        overlayClassName
      )}
      role="dialog"
      aria-modal
    >
      <div
        className={cn(
          "w-full max-h-[calc(100vh-2rem)] overflow-y-auto rounded-paper border border-paper-border bg-paper-bg p-6",
          panelClassName,
          widthClassName
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-2xl text-paper-ink">{title}</h2>
          <button
            type="button"
            className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted hover:text-paper-ink"
            onClick={handleClose}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
