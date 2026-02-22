"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Card } from "@/src/components/ui/card";
import { Modal } from "@/src/components/ui/modal";
import { buildTimelineAnalysis, buildTranscriptHash } from "@/src/lib/analysis/timeline/engine";
import { readTimelineFromStorage, writeTimelineToStorage } from "@/src/lib/analysis/timeline/storage";
import type {
  TimelineAnalysisResult,
  TimelineMarker,
  TimelineMarkerCategory,
  TimelineMarkerType,
  TimelineTranscriptTurn,
} from "@/src/lib/analysis/timeline/types";
import type { TranscriptTurn } from "@/src/lib/types";

const FILTER_LIMIT = 8;
const WINDOW_MIN_SPAN = 12;
const DENSITY_BIN_COUNT = 52;

type TimelineFilter = "all" | "highlights" | "weak_points" | "follow_ups" | "pacing";
type TimelineLane = TimelineMarkerCategory;

const timelineFilterLabel: Record<TimelineFilter, string> = {
  all: "All",
  highlights: "Highlights",
  weak_points: "Weak Points",
  follow_ups: "Follow-ups",
  pacing: "Pacing",
};

const markerStyleByType: Record<
  TimelineMarkerType,
  {
    dotClass: string;
    borderClass: string;
    textClass: string;
    labelClass: string;
    hex: string;
    icon: string;
  }
> = {
  strong_answer: {
    dotClass: "bg-emerald-500",
    borderClass: "border-emerald-700",
    textClass: "text-emerald-50",
    labelClass: "text-emerald-900",
    hex: "#059669",
    icon: "▲",
  },
  weak_answer: {
    dotClass: "bg-amber-500",
    borderClass: "border-amber-700",
    textClass: "text-amber-50",
    labelClass: "text-amber-900",
    hex: "#d97706",
    icon: "▼",
  },
  deep_follow_up: {
    dotClass: "bg-sky-500",
    borderClass: "border-sky-700",
    textClass: "text-sky-50",
    labelClass: "text-sky-900",
    hex: "#0284c7",
    icon: "◎",
  },
  confidence_dip: {
    dotClass: "bg-rose-500",
    borderClass: "border-rose-700",
    textClass: "text-rose-50",
    labelClass: "text-rose-900",
    hex: "#e11d48",
    icon: "!",
  },
  pause_latency: {
    dotClass: "bg-violet-500",
    borderClass: "border-violet-700",
    textClass: "text-violet-50",
    labelClass: "text-violet-900",
    hex: "#7c3aed",
    icon: "⏸",
  },
  standout_quote: {
    dotClass: "bg-cyan-500",
    borderClass: "border-cyan-700",
    textClass: "text-cyan-50",
    labelClass: "text-cyan-900",
    hex: "#0891b2",
    icon: "✦",
  },
};

const laneOrder: TimelineLane[] = ["highlight", "weak_point", "follow_up", "confidence", "pacing"];

const categoryPalette: Record<TimelineMarkerCategory, string> = {
  highlight: "#059669",
  weak_point: "#d97706",
  follow_up: "#0284c7",
  confidence: "#e11d48",
  pacing: "#7c3aed",
};

const laneY: Record<TimelineLane, number> = {
  highlight: 28,
  weak_point: 46,
  follow_up: 64,
  confidence: 82,
  pacing: 100,
};

interface DensityBin {
  index: number;
  intensity: number;
  dominantCategory: TimelineMarkerCategory | null;
}

interface InterviewTimelineCardProps {
  sessionId: string;
  transcript: TranscriptTurn[];
  onJumpToTranscript?: (startTurnIndex: number, endTurnIndex: number) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function compareBySeverity(a: TimelineMarker, b: TimelineMarker) {
  if (b.severity !== a.severity) {
    return b.severity - a.severity;
  }

  return a.eventTurnIndex - b.eventTurnIndex;
}

function compareBySequence(a: TimelineMarker, b: TimelineMarker) {
  if (a.eventTurnIndex !== b.eventTurnIndex) {
    return a.eventTurnIndex - b.eventTurnIndex;
  }

  return b.severity - a.severity;
}

function parseCreatedAtMs(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function shortEvidence(value: string, maxLength = 92) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function formatAxisValue(mode: "time" | "turn", value: number) {
  if (mode === "time") {
    return `${Math.round(value)}s`;
  }

  return `Turn ${Math.max(1, Math.round(value) + 1)}`;
}

function markerMatchesFilter(marker: TimelineMarker, filter: TimelineFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "highlights") {
    return marker.category === "highlight";
  }

  if (filter === "weak_points") {
    return marker.category === "weak_point";
  }

  if (filter === "follow_ups") {
    return marker.category === "follow_up";
  }

  return marker.category === "pacing" || marker.category === "confidence";
}

function markerActionTitle(marker: TimelineMarker) {
  if (marker.type === "strong_answer" || marker.type === "standout_quote") {
    return "How to repeat this moment";
  }

  return "Actionable improvement";
}

function markerDotSize(marker: TimelineMarker) {
  return Math.round(8 + marker.severity * 1.4);
}

function buildAxisValues(turns: TimelineTranscriptTurn[]) {
  const rawTimestamps = turns.map((turn) => {
    if (typeof turn.timestampMs === "number" && Number.isFinite(turn.timestampMs)) {
      return turn.timestampMs;
    }

    return parseCreatedAtMs(turn.createdAt);
  });

  const firstTimestamp = rawTimestamps.find((value): value is number => value !== null) ?? null;
  const hasEnoughTimestamps = firstTimestamp !== null && rawTimestamps.filter((value) => value !== null).length >= 2;

  if (!hasEnoughTimestamps) {
    return {
      mode: "turn" as const,
      values: turns.map((_, index) => index),
    };
  }

  const values: number[] = [];
  rawTimestamps.forEach((timestamp, index) => {
    const rawValue = timestamp === null ? null : (timestamp - firstTimestamp) / 1000;
    let safeValue = rawValue === null ? (values[index - 1] ?? 0) + 1 : Math.max(0, rawValue);

    if (index > 0 && safeValue <= values[index - 1]) {
      safeValue = values[index - 1] + 0.25;
    }

    values.push(safeValue);
  });

  if (values[values.length - 1] <= values[0]) {
    return {
      mode: "turn" as const,
      values: turns.map((_, index) => index),
    };
  }

  return {
    mode: "time" as const,
    values,
  };
}

function buildSparklinePath(points: Array<{ xPct: number; value: number }>, height: number) {
  if (points.length < 2) {
    return "";
  }

  const topPadding = 5;
  const usableHeight = height - topPadding * 2;

  return points
    .map((point, index) => {
      const x = clamp(point.xPct, 0, 100);
      const y = topPadding + usableHeight - (clamp(point.value, 0, 100) / 100) * usableHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function defaultAllMarkers(markers: TimelineMarker[]) {
  const ranked = [...markers].sort(compareBySeverity);
  const selected: TimelineMarker[] = [];
  const seen = new Set<string>();

  const pick = (predicate: (marker: TimelineMarker) => boolean, limit: number) => {
    const next = ranked.filter(predicate).slice(0, limit);
    next.forEach((marker) => {
      if (seen.has(marker.id)) {
        return;
      }

      seen.add(marker.id);
      selected.push(marker);
    });
  };

  pick((marker) => marker.category === "highlight", 2);
  pick((marker) => marker.category === "weak_point", 2);
  pick((marker) => marker.category === "follow_up", 1);
  pick((marker) => marker.category === "pacing" || marker.category === "confidence", 1);

  ranked.forEach((marker) => {
    if (selected.length >= FILTER_LIMIT || seen.has(marker.id)) {
      return;
    }

    seen.add(marker.id);
    selected.push(marker);
  });

  return selected;
}

function buildDensityBins(markers: TimelineMarker[], toGlobalPct: (turnIndex: number) => number): DensityBin[] {
  const bins = Array.from({ length: DENSITY_BIN_COUNT }, (_, index) => ({
    index,
    weight: 0,
    byCategory: {
      highlight: 0,
      weak_point: 0,
      follow_up: 0,
      confidence: 0,
      pacing: 0,
    } as Record<TimelineMarkerCategory, number>,
  }));

  markers.forEach((marker) => {
    const pct = toGlobalPct(marker.eventTurnIndex);
    const binIndex = clamp(Math.floor((pct / 100) * DENSITY_BIN_COUNT), 0, DENSITY_BIN_COUNT - 1);
    const bin = bins[binIndex];
    const weight = marker.severity * (0.6 + marker.confidence * 0.5);

    bin.weight += weight;
    bin.byCategory[marker.category] += weight;
  });

  const maxWeight = Math.max(1, ...bins.map((bin) => bin.weight));

  return bins.map((bin) => {
    let dominantCategory: TimelineMarkerCategory | null = null;
    let dominantWeight = 0;

    laneOrder.forEach((category) => {
      const categoryWeight = bin.byCategory[category];
      if (categoryWeight > dominantWeight) {
        dominantWeight = categoryWeight;
        dominantCategory = category;
      }
    });

    return {
      index: bin.index,
      intensity: clamp(bin.weight / maxWeight, 0, 1),
      dominantCategory,
    };
  });
}

export function InterviewTimelineCard({ sessionId, transcript, onJumpToTranscript }: InterviewTimelineCardProps) {
  const [analysis, setAnalysis] = useState<TimelineAnalysisResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>("all");
  const [selectedMarker, setSelectedMarker] = useState<TimelineMarker | null>(null);
  const [focusStartPct, setFocusStartPct] = useState(0);
  const [focusEndPct, setFocusEndPct] = useState(100);
  const [expandedByFilter, setExpandedByFilter] = useState<Record<TimelineFilter, boolean>>({
    all: false,
    highlights: false,
    weak_points: false,
    follow_ups: false,
    pacing: false,
  });

  const overviewRef = useRef<HTMLDivElement | null>(null);

  const timelineTurns = useMemo(
    () =>
      transcript.map((turn) => ({
        id: turn.id,
        role: turn.role,
        content: turn.content,
        createdAt: turn.createdAt,
        timestampMs: (turn as TranscriptTurn & { timestampMs?: number }).timestampMs,
        answerDurationSec: turn.answerDurationSec,
      })),
    [transcript],
  );

  const transcriptHash = useMemo(() => buildTranscriptHash(timelineTurns), [timelineTurns]);

  useEffect(() => {
    if (!sessionId || timelineTurns.length === 0) {
      setAnalysis(null);
      return;
    }

    const cached = readTimelineFromStorage(sessionId, transcriptHash);
    if (cached) {
      setAnalysis(cached);
      return;
    }

    const computed = buildTimelineAnalysis({
      sessionId,
      turns: timelineTurns,
    });

    setAnalysis(computed);
    writeTimelineToStorage(computed);
  }, [sessionId, timelineTurns, transcriptHash]);

  useEffect(() => {
    setFocusStartPct(0);
    setFocusEndPct(100);
  }, [sessionId, transcriptHash]);

  const axis = useMemo(() => buildAxisValues(timelineTurns), [timelineTurns]);

  if (!analysis || analysis.segments.length === 0) {
    return (
      <Card className="space-y-3">
        <h2 className="text-2xl font-semibold text-paper-ink">Interview Timeline: Moments that Mattered</h2>
        <p className="text-paper-softInk">Timeline appears after at least one interviewer question and response.</p>
      </Card>
    );
  }

  const turnCount = Math.max(1, timelineTurns.length);
  const axisMin = axis.values[0] ?? 0;
  const axisMax = Math.max(axisMin + 1, axis.values[axis.values.length - 1] ?? 1);
  const focusSpan = Math.max(WINDOW_MIN_SPAN, focusEndPct - focusStartPct);

  const toGlobalPct = (turnIndex: number) => {
    const clampedTurnIndex = clamp(turnIndex, 0, turnCount - 1);
    const axisValue = axis.values[clampedTurnIndex] ?? clampedTurnIndex;
    return clamp(((axisValue - axisMin) / (axisMax - axisMin)) * 100, 0, 100);
  };

  const toFocusPct = (globalPct: number) => ((globalPct - focusStartPct) / focusSpan) * 100;

  const allFilteredMarkers = analysis.markers.filter((marker) => markerMatchesFilter(marker, activeFilter));
  const expanded = expandedByFilter[activeFilter];
  const candidateMarkers =
    activeFilter === "all" ? defaultAllMarkers(allFilteredMarkers) : [...allFilteredMarkers].sort(compareBySeverity).slice(0, FILTER_LIMIT);
  const markersForChart = expanded ? [...allFilteredMarkers].sort(compareBySequence) : [...candidateMarkers].sort(compareBySequence);

  const topCallouts = [...allFilteredMarkers].sort(compareBySeverity).slice(0, 4);
  const topCalloutIds = new Set(topCallouts.map((marker) => marker.id));

  const focusMarkers = markersForChart.filter((marker) => {
    const globalPct = toGlobalPct(marker.eventTurnIndex);
    return globalPct >= focusStartPct && globalPct <= focusEndPct;
  });

  const positionedFocusMarkers = (() => {
    const lanePlacedX: Record<TimelineLane, number[]> = {
      highlight: [],
      weak_point: [],
      follow_up: [],
      confidence: [],
      pacing: [],
    };

    return [...focusMarkers].sort(compareBySequence).map((marker) => {
      const lane = marker.category;
      const baseX = toFocusPct(toGlobalPct(marker.eventTurnIndex));
      let x = baseX;
      let nudgeStep = 0;

      while (lanePlacedX[lane].some((existingX) => Math.abs(existingX - x) < 4) && nudgeStep < 12) {
        nudgeStep += 1;
        x = Math.min(98, baseX + nudgeStep * 1.8);
      }

      lanePlacedX[lane].push(x);

      return {
        marker,
        x,
        y: laneY[lane],
      };
    });
  })();

  const overviewBins = buildDensityBins(allFilteredMarkers, toGlobalPct);

  const segmentBandsOverview = analysis.segments.map((segment, index) => {
    const nextSegment = analysis.segments[index + 1] ?? null;
    const start = toGlobalPct(segment.startTurnIndex);
    const end = nextSegment ? toGlobalPct(nextSegment.startTurnIndex) : 100;

    return {
      id: segment.id,
      index,
      start,
      width: Math.max(1.2, end - start),
    };
  });

  const segmentBandsFocus = analysis.segments
    .map((segment, index) => {
      const nextSegment = analysis.segments[index + 1] ?? null;
      const globalStart = toGlobalPct(segment.startTurnIndex);
      const globalEnd = nextSegment ? toGlobalPct(nextSegment.startTurnIndex) : 100;
      const clippedStart = Math.max(focusStartPct, globalStart);
      const clippedEnd = Math.min(focusEndPct, globalEnd);

      if (clippedEnd <= clippedStart) {
        return null;
      }

      return {
        id: segment.id,
        index,
        start: toFocusPct(clippedStart),
        width: Math.max(1.4, toFocusPct(clippedEnd) - toFocusPct(clippedStart)),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const momentumInView = (() => {
    const sorted = [...analysis.momentumPoints].sort((a, b) => a.eventTurnIndex - b.eventTurnIndex);
    return sorted
      .map((point) => {
        const globalPct = toGlobalPct(point.eventTurnIndex);
        if (globalPct < focusStartPct || globalPct > focusEndPct) {
          return null;
        }

        return {
          xPct: toFocusPct(globalPct),
          value: point.value,
        };
      })
      .filter((point): point is { xPct: number; value: number } => point !== null);
  })();

  const focusSparklinePath = buildSparklinePath(momentumInView, 30);
  const overallMomentum = analysis.momentumPoints.length
    ? Math.round(analysis.momentumPoints.reduce((sum, point) => sum + point.value, 0) / analysis.momentumPoints.length)
    : 0;

  const hasMoreMarkers = allFilteredMarkers.length > candidateMarkers.length;

  return (
    <>
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-paper-ink">Interview Timeline: Moments that Mattered</h2>
            <p className="text-paper-softInk">Interview at a glance first, then drill into a focus window.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(timelineFilterLabel) as TimelineFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`rounded-paper border px-3 py-1 font-sans text-xs uppercase tracking-[0.08em] transition ${
                  activeFilter === filter
                    ? "border-paper-accent bg-paper-elevated text-paper-ink"
                    : "border-paper-border text-paper-muted hover:text-paper-ink"
                }`}
              >
                {timelineFilterLabel[filter]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-paper border border-paper-border bg-paper-elevated px-3 py-2">
            <p className="font-sans text-[10px] uppercase tracking-[0.1em] text-paper-muted">Moments</p>
            <p className="text-lg font-semibold text-paper-ink">{allFilteredMarkers.length}</p>
          </div>
          <div className="rounded-paper border border-paper-border bg-paper-elevated px-3 py-2">
            <p className="font-sans text-[10px] uppercase tracking-[0.1em] text-paper-muted">Window</p>
            <p className="text-lg font-semibold text-paper-ink">
              {formatAxisValue(axis.mode, axisMin + ((axisMax - axisMin) * focusStartPct) / 100)} -{" "}
              {formatAxisValue(axis.mode, axisMin + ((axisMax - axisMin) * focusEndPct) / 100)}
            </p>
          </div>
          <div className="rounded-paper border border-paper-border bg-paper-elevated px-3 py-2">
            <p className="font-sans text-[10px] uppercase tracking-[0.1em] text-paper-muted">Momentum</p>
            <p className="text-lg font-semibold text-paper-ink">{overallMomentum}/100</p>
          </div>
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-sans text-xs uppercase tracking-[0.09em] text-paper-muted">Overview</p>
            <p className="font-sans text-[10px] uppercase tracking-[0.08em] text-paper-muted">Click strip to move focus</p>
          </div>

          <div
            ref={overviewRef}
            className="relative h-24 overflow-hidden rounded-paper border border-paper-border bg-paper-bg"
            onClick={(event) => {
              if (!overviewRef.current) {
                return;
              }

              const rect = overviewRef.current.getBoundingClientRect();
              if (rect.width <= 0) {
                return;
              }

              const clickPct = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
              const nextStart = clamp(clickPct - focusSpan / 2, 0, 100 - focusSpan);
              setFocusStartPct(nextStart);
              setFocusEndPct(nextStart + focusSpan);
            }}
          >
            {segmentBandsOverview.map((band) => (
              <div
                key={`overview-band-${band.id}`}
                className={band.index % 2 === 0 ? "absolute inset-y-0 bg-paper-elevated/30" : "absolute inset-y-0 bg-paper-bg"}
                style={{
                  left: `${band.start}%`,
                  width: `${band.width}%`,
                }}
                aria-hidden
              />
            ))}

            <div
              className="absolute inset-0 grid items-end gap-[2px] px-[2px] pb-[2px] pt-2"
              style={{ gridTemplateColumns: `repeat(${DENSITY_BIN_COUNT}, minmax(0, 1fr))` }}
              aria-hidden
            >
              {overviewBins.map((bin) => {
                const color = bin.dominantCategory ? categoryPalette[bin.dominantCategory] : "#b8ab99";
                const height = 20 + bin.intensity * 80;
                return (
                  <div key={`bin-${bin.index}`} className="flex h-full items-end">
                    <span
                      className="block w-full rounded-[5px]"
                      style={{
                        height: `${height}%`,
                        backgroundColor: color,
                        opacity: 0.18 + bin.intensity * 0.72,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div
              className="pointer-events-none absolute inset-y-1 rounded-[10px] border border-paper-accent bg-paper-accent/12"
              style={{
                left: `${focusStartPct}%`,
                width: `${focusSpan}%`,
              }}
              aria-hidden
            />
          </div>

          <div className="space-y-2 rounded-paper border border-paper-border bg-paper-elevated px-3 py-2">
            <div className="flex items-center justify-between font-sans text-[10px] uppercase tracking-[0.08em] text-paper-muted">
              <span>Focus start</span>
              <span>{formatAxisValue(axis.mode, axisMin + ((axisMax - axisMin) * focusStartPct) / 100)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100 - WINDOW_MIN_SPAN}
              step={1}
              value={focusStartPct}
              onChange={(event) => {
                const nextStart = clamp(Number(event.target.value), 0, focusEndPct - WINDOW_MIN_SPAN);
                setFocusStartPct(nextStart);
              }}
              className="w-full"
            />
            <div className="flex items-center justify-between font-sans text-[10px] uppercase tracking-[0.08em] text-paper-muted">
              <span>Focus end</span>
              <span>{formatAxisValue(axis.mode, axisMin + ((axisMax - axisMin) * focusEndPct) / 100)}</span>
            </div>
            <input
              type="range"
              min={WINDOW_MIN_SPAN}
              max={100}
              step={1}
              value={focusEndPct}
              onChange={(event) => {
                const nextEnd = clamp(Number(event.target.value), focusStartPct + WINDOW_MIN_SPAN, 100);
                setFocusEndPct(nextEnd);
              }}
              className="w-full"
            />
          </div>
        </section>

        {topCallouts.length > 0 ? (
          <section className="space-y-2">
            <p className="font-sans text-xs uppercase tracking-[0.09em] text-paper-muted">Top moments</p>
            <div className="grid gap-2 md:grid-cols-2">
              {topCallouts.map((marker) => {
                const markerStyle = markerStyleByType[marker.type];
                return (
                  <button
                    key={`callout-${marker.id}`}
                    type="button"
                    className="rounded-paper border border-paper-border bg-paper-elevated px-3 py-2 text-left hover:border-paper-accent"
                    onClick={() => {
                      const center = toGlobalPct(marker.eventTurnIndex);
                      const nextStart = clamp(center - focusSpan / 2, 0, 100 - focusSpan);
                      setFocusStartPct(nextStart);
                      setFocusEndPct(nextStart + focusSpan);
                      setSelectedMarker(marker);
                    }}
                  >
                    <p className={`font-sans text-[11px] uppercase tracking-[0.09em] ${markerStyle.labelClass}`}>{marker.shortLabel}</p>
                    <p className="mt-1 text-sm text-paper-softInk">{shortEvidence(marker.evidenceSnippet)}</p>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-sans text-xs uppercase tracking-[0.09em] text-paper-muted">Focus window</p>
            <p className="font-sans text-[10px] uppercase tracking-[0.08em] text-paper-muted">
              {focusMarkers.length} moment{focusMarkers.length === 1 ? "" : "s"} in view
            </p>
          </div>

          <div className="relative h-[190px] overflow-visible">
            <div className="absolute inset-0 overflow-hidden rounded-paper border border-paper-border bg-paper-bg">
              {segmentBandsFocus.map((band) => (
                <div
                  key={`focus-band-${band.id}`}
                  className={band.index % 2 === 0 ? "absolute inset-y-0 bg-paper-elevated/24" : "absolute inset-y-0 bg-paper-bg"}
                  style={{
                    left: `${band.start}%`,
                    width: `${band.width}%`,
                  }}
                  aria-hidden
                />
              ))}

              {laneOrder.map((lane) => (
                <div
                  key={`lane-${lane}`}
                  className="absolute left-0 right-0 border-t border-paper-border/25"
                  style={{ top: `${laneY[lane]}px` }}
                  aria-hidden
                />
              ))}

              <div className="absolute left-0 right-0 border-t border-paper-border/75" style={{ top: "116px" }} aria-hidden />

              <svg
                aria-hidden
                className="absolute left-0 right-0"
                style={{ top: "128px", width: "100%", height: "30px" }}
                viewBox="0 0 100 30"
                preserveAspectRatio="none"
              >
                <path d={focusSparklinePath} fill="none" stroke="rgba(124,106,88,0.95)" strokeWidth="0.8" strokeLinecap="round" />
              </svg>

              <div className="absolute left-2 top-[166px] font-sans text-[10px] uppercase tracking-[0.08em] text-paper-muted">
                {formatAxisValue(axis.mode, axisMin + ((axisMax - axisMin) * focusStartPct) / 100)}
              </div>
              <div className="absolute right-2 top-[166px] font-sans text-[10px] uppercase tracking-[0.08em] text-paper-muted">
                {formatAxisValue(axis.mode, axisMin + ((axisMax - axisMin) * focusEndPct) / 100)}
              </div>
            </div>

            <div className="absolute inset-0 z-20 overflow-visible">
              {positionedFocusMarkers.map(({ marker, x, y }) => {
                const markerStyle = markerStyleByType[marker.type];
                const dotSize = markerDotSize(marker);
                const showMicroLabel = topCalloutIds.has(marker.id);

                return (
                  <button
                    key={marker.id}
                    type="button"
                    className="group absolute"
                    style={{ left: `${x}%`, top: `${y}px`, transform: "translate(-50%, -50%)" }}
                    onClick={() => setSelectedMarker(marker)}
                  >
                    <span
                      className={`flex items-center justify-center rounded-full border text-[9px] font-semibold shadow-sm ${markerStyle.dotClass} ${markerStyle.borderClass} ${markerStyle.textClass}`}
                      style={{
                        width: `${dotSize}px`,
                        height: `${dotSize}px`,
                        borderStyle: marker.confidence >= 0.72 ? "solid" : "dashed",
                        opacity: 0.82 + marker.confidence * 0.18,
                      }}
                    >
                      {dotSize >= 13 ? markerStyle.icon : ""}
                    </span>

                    {showMicroLabel ? (
                      <span
                        className={`pointer-events-none absolute left-[calc(100%+5px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-paper bg-paper-bg/90 px-1.5 py-0.5 text-[10px] font-semibold ${markerStyle.labelClass}`}
                      >
                        {marker.shortLabel}
                      </span>
                    ) : null}

                    <span className="pointer-events-none absolute left-1/2 top-0 z-40 hidden w-72 -translate-x-1/2 -translate-y-[118%] rounded-paper border border-paper-border bg-paper-bg p-3 text-left text-sm leading-snug text-paper-softInk shadow-lg group-hover:block">
                      <span className="block font-semibold text-paper-ink">{marker.shortLabel}</span>
                      <span className="mt-1 block">{marker.evidenceSnippet}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {hasMoreMarkers ? (
          <div>
            <button
              type="button"
              className="rounded-paper border border-paper-border px-3 py-1 font-sans text-xs uppercase tracking-[0.08em] text-paper-muted hover:text-paper-ink"
              onClick={() =>
                setExpandedByFilter((current) => ({
                  ...current,
                  [activeFilter]: !current[activeFilter],
                }))
              }
            >
              {expanded ? "Show fewer moments" : "Show more moments"}
            </button>
          </div>
        ) : null}
      </Card>

      {selectedMarker ? (
        <Modal title={selectedMarker.shortLabel} onClose={() => setSelectedMarker(null)}>
          <div className="space-y-4">
            <section className="space-y-1">
              <h3 className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">What happened</h3>
              <p className="text-paper-softInk">{selectedMarker.rationale}</p>
            </section>

            <section className="space-y-1">
              <h3 className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">Why it matters</h3>
              <p className="text-paper-softInk">{selectedMarker.whyItMatters}</p>
            </section>

            <section className="space-y-1">
              <h3 className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">Evidence</h3>
              <blockquote className="rounded-paper border border-paper-border bg-paper-elevated px-3 py-2 text-paper-softInk">
                {selectedMarker.evidenceSnippet}
              </blockquote>
              <p className="font-sans text-xs uppercase tracking-[0.08em] text-paper-muted">
                Transcript turns {selectedMarker.turnStartIndex + 1} to {selectedMarker.turnEndIndex + 1}
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">{markerActionTitle(selectedMarker)}</h3>
              <p className="text-paper-softInk">{selectedMarker.actionableImprovement}</p>
            </section>

            {onJumpToTranscript ? (
              <button
                type="button"
                className="rounded-paper border border-paper-accent px-3 py-2 font-sans text-xs uppercase tracking-[0.08em] text-paper-ink"
                onClick={() => {
                  onJumpToTranscript(selectedMarker.turnStartIndex, selectedMarker.turnEndIndex);
                  setSelectedMarker(null);
                }}
              >
                Jump to transcript
              </button>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
