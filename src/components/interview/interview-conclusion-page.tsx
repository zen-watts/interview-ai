"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CompetencyCard } from "@/src/components/interview/charts/competency-card";
import { ConclusionDashboard } from "@/src/components/interview/conclusion-dashboard";
import { InterviewTimelineCard } from "@/src/components/interview/interview-timeline-card";
import { useAppStore } from "@/src/components/providers/app-store-provider";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Notice } from "@/src/components/ui/notice";
import { requestInterviewAnalysis } from "@/src/lib/ai/client-api";
import { createLogger } from "@/src/lib/logger";
import type { TranscriptTurn } from "@/src/lib/types";
import { formatDateTime } from "@/src/lib/utils/time";

const logger = createLogger("interview-conclusion-page");

const statusCopy: Record<string, string> = {
  analysis_pending: "Generating analysis",
  complete: "Complete",
  error: "Needs attention",
};

function sentenceList(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
}

function summaryCopy(shortText: string, longText: string) {
  const shortSentences = sentenceList(shortText);
  const longSentences = sentenceList(longText);
  const nextSentences = [...shortSentences];

  if (nextSentences.length < 2 && longSentences.length > 0) {
    const longFallback = longSentences[0];
    if (!nextSentences.includes(longFallback)) {
      nextSentences.push(longFallback);
    }
  }

  return nextSentences.slice(0, 4).join(" ");
}

export function InterviewConclusionPage({ roleId, attemptId }: { roleId: string; attemptId: string }) {
  const { store, setAttemptStatus, setAttemptAnalysis } = useAppStore();
  const router = useRouter();

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impressionExpanded, setImpressionExpanded] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [focusedRange, setFocusedRange] = useState<{ start: number; end: number } | null>(null);
  const impressionCardRef = useRef<HTMLDivElement | null>(null);
  const transcriptTurnRefs = useRef<Array<HTMLDivElement | null>>([]);

  const role = useMemo(() => store.roles.find((item) => item.id === roleId) ?? null, [roleId, store.roles]);
  const attempt = useMemo(
    () => store.attempts.find((item) => item.roleId === roleId && item.id === attemptId) ?? null,
    [attemptId, roleId, store.attempts],
  );

  useEffect(() => {
    if (!attempt || !role) {
      return;
    }

    if (attempt.status !== "analysis_pending" && attempt.status !== "complete") {
      router.replace(`/roles/${role.id}/attempts/${attempt.id}`);
    }
  }, [attempt, role, router]);

  useEffect(() => {
    if (!showTranscript || !focusedRange) {
      return;
    }

    const targetNode = transcriptTurnRefs.current[focusedRange.start];
    if (targetNode) {
      targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedRange, showTranscript]);

  if (!role || !attempt) {
    return (
      <main className="space-y-6">
        <Card className="space-y-3">
          <h1 className="text-3xl">Interview attempt not found</h1>
          <p className="text-paper-softInk">This practice session does not exist in local storage.</p>
          <Link href="/">
            <Button>Back to home</Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (attempt.status !== "analysis_pending" && attempt.status !== "complete") {
    return null;
  }

  const runAnalysis = async (transcript: TranscriptTurn[]) => {
    if (!attempt.script) {
      return;
    }

    setLoadingAnalysis(true);
    setError(null);
    setAttemptStatus(attempt.id, "analysis_pending");

    try {
      logger.info("analysis.request.started", {
        attemptId: attempt.id,
        transcriptLength: transcript.length,
      });

      const analysis = await requestInterviewAnalysis({
        script: attempt.script,
        transcript,
      });

      setAttemptAnalysis(attempt.id, analysis);
      logger.info("analysis.request.completed", {
        attemptId: attempt.id,
        redFlagCount: analysis.red_flags.length,
      });
    } catch (analysisError) {
      const message = analysisError instanceof Error ? analysisError.message : "Analysis failed.";
      setAttemptStatus(attempt.id, "analysis_pending", message);
      setError(message);
      logger.error("analysis.request.failed", { message, attemptId: attempt.id });
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const analysisFallbackMessage =
    attempt.status === "analysis_pending" || loadingAnalysis
      ? "Analysis in progress..."
      : "Analysis will appear here once generation completes.";

  const shortImpression = attempt.analysis?.impression_short || "";
  const detailedImpression = attempt.analysis?.impression_long || "";
  const collapsedSummary = summaryCopy(shortImpression, detailedImpression);
  const whatIsWorking =
    sentenceList(shortImpression)[0] || (attempt.analysis ? "You established a usable baseline in this attempt." : analysisFallbackMessage);
  const whatIsMissing = attempt.analysis
    ? attempt.analysis.red_flags[0] || "No major red flags were detected, but more specificity can still strengthen delivery."
    : analysisFallbackMessage;
  const whatToDoNext = attempt.analysis?.top_improvement || analysisFallbackMessage;

  return (
    <main className="space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href={`/roles/${role.id}`}
            className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted hover:text-paper-ink"
          >
            {role.title}
          </Link>
          <h1 className="text-4xl leading-tight">Interview conclusion</h1>
          <p className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">
            Status: {statusCopy[attempt.status] || attempt.status}
          </p>
        </div>

        {attempt.script && attempt.transcript.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            disabled={loadingAnalysis}
            onClick={async () => {
              await runAnalysis(attempt.transcript);
            }}
          >
            {loadingAnalysis ? "Analyzing..." : "Re-run analysis"}
          </Button>
        ) : null}
      </header>

      {error ? <Notice tone="error" message={error} /> : null}
      {attempt.lastError && !error ? <Notice tone="error" message={attempt.lastError} /> : null}

      <section className="grid gap-4 md:grid-cols-6">
        <div className="space-y-4 md:col-span-4">
          <div ref={impressionCardRef}>
            <Card className="space-y-3">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 text-left"
                onClick={() => {
                  const previousTop = impressionCardRef.current?.getBoundingClientRect().top ?? 0;
                  setImpressionExpanded((current) => !current);
                  requestAnimationFrame(() => {
                    const nextTop = impressionCardRef.current?.getBoundingClientRect().top ?? 0;
                    window.scrollBy({ top: nextTop - previousTop, left: 0, behavior: "auto" });
                  });
                }}
              >
                <div className="space-y-1">
                  <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.08em] text-paper-ink">Impression</h2>
                  <p className="font-sans text-xs uppercase tracking-[0.08em] text-paper-muted">
                    Summary, click to expand details
                  </p>
                </div>
                <span className="mt-0.5 font-sans text-xs uppercase tracking-[0.08em] text-paper-muted">
                  {impressionExpanded ? "Collapse details ▲" : "Expand details ▼"}
                </span>
              </button>

              {!impressionExpanded ? (
                <div className="space-y-3">
                  <p className="leading-relaxed text-paper-softInk">
                    {attempt.analysis ? collapsedSummary || shortImpression : analysisFallbackMessage}
                  </p>
                  <ul className="space-y-2 text-paper-softInk">
                    <li>
                      <span className="font-sans text-xs uppercase tracking-[0.08em] text-paper-muted">What&apos;s working</span>
                      <p className="mt-1 leading-relaxed">{whatIsWorking}</p>
                    </li>
                    <li>
                      <span className="font-sans text-xs uppercase tracking-[0.08em] text-paper-muted">What&apos;s missing</span>
                      <p className="mt-1 leading-relaxed">{whatIsMissing}</p>
                    </li>
                    <li>
                      <span className="font-sans text-xs uppercase tracking-[0.08em] text-paper-muted">What to do next</span>
                      <p className="mt-1 leading-relaxed">{whatToDoNext}</p>
                    </li>
                  </ul>
                </div>
              ) : (
                <p className="leading-relaxed text-paper-softInk">
                  {attempt.analysis?.impression_long || analysisFallbackMessage}
                </p>
              )}
            </Card>
          </div>

          {attempt.analysis?.competencies?.length ? (
            <CompetencyCard competencies={attempt.analysis.competencies} />
          ) : null}
          <InterviewTimelineCard
            sessionId={attempt.id}
            transcript={attempt.transcript}
            onJumpToTranscript={(startTurnIndex, endTurnIndex) => {
              setShowTranscript(true);
              setFocusedRange({
                start: startTurnIndex,
                end: endTurnIndex,
              });
            }}
          />

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-paper-ink">Transcript</h2>
              <Button type="button" variant="ghost" onClick={() => setShowTranscript((current) => !current)}>
                {showTranscript ? "Hide transcript" : "Show transcript"}
              </Button>
            </div>

            {!showTranscript ? (
              <p className="text-paper-softInk">Hidden by default for quicker scan of final analysis.</p>
            ) : attempt.transcript.length === 0 ? (
              <p className="text-paper-softInk">No turns yet.</p>
            ) : (
              <div className="space-y-3">
                {attempt.transcript.map((turn, index) => {
                  const isFocused =
                    focusedRange !== null && index >= focusedRange.start && index <= focusedRange.end;

                  return (
                    <div
                      key={turn.id}
                      ref={(node) => {
                        transcriptTurnRefs.current[index] = node;
                      }}
                      className={`rounded-paper border px-4 py-3 ${
                        turn.role === "assistant"
                          ? "border-paper-border bg-paper-bg text-paper-ink"
                          : "border-paper-accent/40 bg-paper-elevated text-paper-softInk"
                      } ${isFocused ? "ring-2 ring-paper-accent/45" : ""}`}
                    >
                      <p className="mb-2 font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">
                        {turn.role === "assistant" ? "Interviewer" : "You"} · {formatDateTime(turn.createdAt)}
                        {turn.answerDurationSec ? ` · ${turn.answerDurationSec}s` : ""}
                      </p>
                      <p className="whitespace-pre-wrap leading-relaxed">{turn.content}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4 md:col-span-2">
          <Card className="space-y-2">
            <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.08em] text-paper-ink">Red flags</h2>
            {!attempt.analysis ? (
              <p className="text-paper-softInk">{analysisFallbackMessage}</p>
            ) : attempt.analysis.red_flags.length === 0 ? (
              <p className="text-paper-softInk">No major red flags identified in this run.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-6 text-paper-softInk">
                {attempt.analysis.red_flags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="space-y-2">
            <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.08em] text-paper-ink">Top improvement</h2>
            <p className="leading-relaxed text-paper-softInk">
              {attempt.analysis?.top_improvement || analysisFallbackMessage}
            </p>
          </Card>

          <ConclusionDashboard transcript={attempt.transcript} />

          {store.devSettings?.showInterviewerScriptOnConclusion && attempt.script ? (
            <Card className="space-y-3">
              <h2 className="text-2xl font-semibold text-paper-ink">Interviewer script</h2>
              <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-paper border border-paper-border bg-paper-elevated p-4 text-sm leading-relaxed text-paper-softInk">
                {attempt.script}
              </pre>
            </Card>
          ) : null}
        </div>
      </section>

      <div className="pt-2">
        <Link href={`/roles/${role.id}`}>
          <Button>Return</Button>
        </Link>
      </div>
    </main>
  );
}
