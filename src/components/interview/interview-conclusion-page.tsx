"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

/**
 * Post-interview page that contains analysis, transcript review, and stored script.
 */
export function InterviewConclusionPage({ roleId, attemptId }: { roleId: string; attemptId: string }) {
  const { store, setAttemptStatus, setAttemptAnalysis } = useAppStore();
  const router = useRouter();

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

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
      const analysis = await requestInterviewAnalysis({
        script: attempt.script,
        transcript,
      });

      setAttemptAnalysis(attempt.id, analysis);
    } catch (analysisError) {
      const message = analysisError instanceof Error ? analysisError.message : "Analysis failed.";
      setAttemptStatus(attempt.id, "analysis_pending", message);
      setError(message);
      logger.error("Interview analysis failed.", { message, attemptId: attempt.id });
    } finally {
      setLoadingAnalysis(false);
    }
  };

  return (
    <main className="space-y-8 pb-12">
      <header className="space-y-2">
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
      </header>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl">Analysis</h2>
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
        </div>

        {attempt.analysis ? (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">Short impression</h3>
              <p className="leading-relaxed text-paper-softInk">{attempt.analysis.impression_short}</p>
            </section>

            <section className="space-y-2">
              <h3 className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">Detailed impression</h3>
              <p className="leading-relaxed text-paper-softInk">{attempt.analysis.impression_long}</p>
            </section>

            <section className="space-y-2">
              <h3 className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">Red flags</h3>
              {attempt.analysis.red_flags.length === 0 ? (
                <p className="text-paper-softInk">No major red flags identified in this run.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-6 text-paper-softInk">
                  {attempt.analysis.red_flags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">Top improvement</h3>
              <p className="leading-relaxed text-paper-softInk">{attempt.analysis.top_improvement}</p>
            </section>
          </div>
        ) : attempt.status === "analysis_pending" || loadingAnalysis ? (
          <p className="text-paper-softInk">Analysis in progress...</p>
        ) : (
          <p className="text-paper-softInk">Analysis will appear here once generation completes.</p>
        )}

        {error ? <Notice tone="error" message={error} /> : null}
        {attempt.lastError && !error ? <Notice tone="error" message={attempt.lastError} /> : null}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl">Transcript</h2>
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
            {attempt.transcript.map((turn) => (
              <div
                key={turn.id}
                className={`rounded-paper border px-4 py-3 ${
                  turn.role === "assistant"
                    ? "border-paper-border bg-paper-bg text-paper-ink"
                    : "border-paper-accent/40 bg-paper-elevated text-paper-softInk"
                }`}
              >
                <p className="mb-2 font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">
                  {turn.role === "assistant" ? "Interviewer" : "You"} · {formatDateTime(turn.createdAt)}
                  {turn.answerDurationSec ? ` · ${turn.answerDurationSec}s` : ""}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{turn.content}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {store.devSettings.showInterviewerScriptOnConclusion && attempt.script ? (
        <Card className="space-y-3">
          <h2 className="text-2xl">Interviewer script</h2>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-paper border border-paper-border bg-paper-elevated p-4 text-sm leading-relaxed text-paper-softInk">
            {attempt.script}
          </pre>
        </Card>
      ) : null}
    </main>
  );
}
