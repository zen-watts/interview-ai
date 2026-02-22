"use client";

import { useMemo } from "react";

import { ResponseBarChart } from "@/src/components/interview/charts/response-bar-chart";
import { StatPill } from "@/src/components/interview/charts/stat-pill";
import { TalkRatioRing } from "@/src/components/interview/charts/talk-ratio-ring";
import { Card } from "@/src/components/ui/card";
import { computeTranscriptMetrics } from "@/src/lib/utils/transcript-metrics";
import type { TranscriptTurn } from "@/src/lib/types";

interface ConclusionDashboardProps {
  transcript: TranscriptTurn[];
}

export function ConclusionDashboard({ transcript }: ConclusionDashboardProps) {
  const metrics = useMemo(() => computeTranscriptMetrics(transcript), [transcript]);

  if (metrics.isTooShort) {
    return null;
  }

  return (
    <Card className="space-y-5">
      <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.08em] text-paper-ink">
        Response metrics
      </h2>

      <TalkRatioRing userRatio={metrics.talkRatioUser} />
      <p className="text-center font-sans text-[10px] uppercase tracking-[0.12em] text-paper-muted">
        Talk ratio
      </p>

      <div className="grid grid-cols-2 gap-3">
        <StatPill value={String(metrics.avgResponseWords)} label="Avg words" sublabel="per response" />
        <StatPill
          value={metrics.fillerRate > 0 ? `${metrics.fillerRate}%` : "0"}
          label="Filler rate"
          sublabel="per 100 words"
        />
        {metrics.hasSpeechData && metrics.avgWpm !== null ? (
          <StatPill value={`${metrics.avgWpm}`} label="Avg WPM" />
        ) : null}
        {metrics.hasSpeechData && metrics.avgDurationSec !== null ? (
          <StatPill value={`${metrics.avgDurationSec}s`} label="Avg duration" sublabel="per response" />
        ) : null}
        {metrics.avgLatencySec !== null ? (
          <StatPill value={`${metrics.avgLatencySec}s`} label="Think time" sublabel="avg before responding" />
        ) : null}
        <StatPill value={String(metrics.responseCount)} label="Responses" />
      </div>

      {metrics.perResponse.length > 1 ? (
        <div className="space-y-2 border-t border-paper-border pt-4">
          <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-paper-muted">
            Words per response
          </h3>
          <ResponseBarChart responses={metrics.perResponse} hasSpeechData={metrics.hasSpeechData} />
        </div>
      ) : null}
    </Card>
  );
}
