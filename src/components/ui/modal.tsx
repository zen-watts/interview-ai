"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/src/lib/utils/cn";

export function Modal({
  title,
  children,
  onClose,
  widthClassName = "max-w-2xl",
  showHeader = true,
  showClose = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  widthClassName?: string;
  showHeader?: boolean;
  showClose?: boolean;
}) {
  const [isClosing, setIsClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center bg-black/25 px-4 py-4",
        overlayClassName
      )}
      role="dialog"
      aria-modal
    >
      <div
        className={cn(
          "relative z-[70] w-full max-h-[90vh] overflow-y-auto rounded-paper border border-paper-border bg-paper-bg p-6",
          panelClassName,
          widthClassName
        )}
      >
        {showHeader ? (
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl text-paper-ink">{title}</h2>
            {showClose ? (
              <button
                type="button"
                className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted hover:text-paper-ink"
                onClick={handleClose}
              >
                Close
              </button>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>,
    document.body
  );
}
