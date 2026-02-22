"use client";

import { useState } from "react";

import { InterviewTimelineCard } from "@/src/components/interview/interview-timeline-card";
import { Card } from "@/src/components/ui/card";
import { mockTimelineTranscript } from "@/src/lib/analysis/timeline/mock-fixture";

export default function TimelineDemoPage() {
  const [focusRange, setFocusRange] = useState<{ start: number; end: number } | null>(null);

  return (
    <main className="space-y-6 pb-12">
      <header className="space-y-2">
        <h1 className="text-4xl leading-tight">Timeline Demo</h1>
        <p className="text-paper-softInk">
          Mock fixture rendering of the Interview Timeline: Moments that Mattered module.
        </p>
      </header>

      <InterviewTimelineCard
        sessionId="mock-session"
        transcript={mockTimelineTranscript}
        onJumpToTranscript={(startTurnIndex, endTurnIndex) => {
          setFocusRange({
            start: startTurnIndex,
            end: endTurnIndex,
          });
        }}
      />

      <Card className="space-y-3">
        <h2 className="text-2xl font-semibold text-paper-ink">Fixture Transcript</h2>
        <div className="space-y-2">
          {mockTimelineTranscript.map((turn, index) => {
            const isFocused =
              focusRange !== null && index >= focusRange.start && index <= focusRange.end;

            return (
              <div
                key={turn.id}
                className={`rounded-paper border px-3 py-2 ${
                  isFocused ? "ring-2 ring-paper-accent/45" : ""
                } ${turn.role === "assistant" ? "border-paper-border" : "border-paper-accent/45"}`}
              >
                <p className="mb-1 font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">
                  {turn.role === "assistant" ? "Interviewer" : "Candidate"}
                </p>
                <p className="text-paper-softInk">{turn.content}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </main>
  );
}
