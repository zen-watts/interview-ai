"use client";

import { useState } from "react";

import { useAppStore } from "@/src/components/providers/app-store-provider";
import { STORAGE_KEY } from "@/src/lib/storage/schema";

export function DevTools() {
  const [open, setOpen] = useState(false);
  const { store, patchDevSettings } = useAppStore();
  const showScriptOnConclusion = store.devSettings?.showInterviewerScriptOnConclusion ?? false;

  const resetAppData = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.href = "/";
  };

  const clearBrowserStorage = () => {
    window.localStorage.clear();
    window.location.href = "/";
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-50"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="rounded-paper border border-paper-border bg-paper-elevated p-2">
        <p className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted">Dev</p>
      </div>

      {open ? (
        <div className="mt-2 w-64 space-y-2 rounded-paper border border-paper-border bg-paper-bg p-3 shadow-sm">
          <p className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted">Developer Tools</p>
          <button
            type="button"
            className="w-full rounded-paper border border-paper-border px-3 py-2 text-left text-sm text-paper-softInk transition hover:border-paper-accent hover:text-paper-ink"
            onClick={() =>
              patchDevSettings({
                showInterviewerScriptOnConclusion: !showScriptOnConclusion,
              })
            }
          >
            {showScriptOnConclusion
              ? "Hide interviewer script on conclusion"
              : "Show interviewer script on conclusion"}
          </button>
          <button
            type="button"
            className="w-full rounded-paper border border-paper-border px-3 py-2 text-left text-sm text-paper-softInk transition hover:border-paper-accent hover:text-paper-ink"
            onClick={resetAppData}
          >
            Reset app data (restart onboarding)
          </button>
          <button
            type="button"
            className="w-full rounded-paper border border-paper-danger px-3 py-2 text-left text-sm text-paper-danger transition hover:opacity-90"
            onClick={clearBrowserStorage}
          >
            Clear all local storage
          </button>
        </div>
      ) : null}
    </div>
  );
}
