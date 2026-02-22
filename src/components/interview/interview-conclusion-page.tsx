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

export function InterviewConclusionPage({ roleId, attemptId }: { roleId: string; attemptId: string }) {
  const { store, setAttemptStatus, setAttemptAnalysis, patchDevSettings } = useAppStore();
  const router = useRouter();

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showScript, setShowScript] = useState(store.devSettings.showInterviewerScriptOnConclusion);

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
    setShowScript(store.devSettings.showInterviewerScriptOnConclusion);
  }, [store.devSettings.showInterviewerScriptOnConclusion]);

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

  const isDevMode = process.env.NODE_ENV !== "production";
  const canShowScriptToggle = isDevMode && Boolean(attempt.script);

  return (
    <main className="space-y-8 pb-12">
      <header className="space-y-3">
        <Link
          href={`/roles/${role.id}`}
          className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted hover:text-paper-ink"
        >
          {role.title}
        </Link>
        <h1 className="text-4xl leading-tight">Analysis Mode</h1>
        <p className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">
          Status: {statusCopy[attempt.status] || attempt.status}
        </p>
      </header>

      {attempt.analysis ? (
        <section className="grid gap-4">
          <Card className="space-y-3">
            <h2 className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted">High-level impression</h2>
            <p className="leading-relaxed text-paper-softInk">{attempt.analysis.impression_short}</p>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted">Blunt analysis</h2>
            <p className="leading-relaxed text-paper-softInk">{attempt.analysis.impression_long}</p>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted">Specific red flags</h2>
            {attempt.analysis.red_flags.length === 0 ? (
              <p className="text-paper-softInk">No major red flags identified in this run.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-6 text-paper-softInk">
                {attempt.analysis.red_flags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted">Number one thing to improve</h2>
            <p className="leading-relaxed text-paper-softInk">{attempt.analysis.top_improvement}</p>
          </Card>
        </section>
      ) : (
        <Card className="space-y-4">
          <h2 className="text-2xl">Analysis in progress</h2>
          <p className="text-paper-softInk">
            {attempt.status === "analysis_pending" || loadingAnalysis
              ? "Generating your report now."
              : "Analysis has not been generated yet for this attempt."}
          </p>
        </Card>
      )}

      {attempt.script && attempt.transcript.length > 0 ? (
        <div>
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
        </div>
      ) : null}

      {error ? <Notice tone="error" message={error} /> : null}
      {attempt.lastError && !error ? <Notice tone="error" message={attempt.lastError} /> : null}

      <section className="space-y-4 border-t border-paper-border/80 pt-6">
        <h2 className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted">Additional interview data</h2>

        <div className="space-y-3">
          <Button type="button" variant="ghost" onClick={() => setShowTranscript((current) => !current)}>
            {showTranscript ? "Hide Transcript [Toggle]" : "Show Transcript [Toggle]"}
          </Button>

          {showTranscript ? (
            <Card className="space-y-3">
              {attempt.transcript.length === 0 ? (
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
          ) : null}
        </div>

        {canShowScriptToggle ? (
          <div className="space-y-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const next = !showScript;
                setShowScript(next);
                patchDevSettings({ showInterviewerScriptOnConclusion: next });
              }}
            >
              {showScript ? "Hide Interviewer Script [Toggle]" : "Show Interviewer Script [Toggle]"}
            </Button>

            {showScript && attempt.script ? (
              <Card className="space-y-2">
                <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-paper-softInk">
                  {attempt.script}
                </pre>
              </Card>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="pt-3">
        <Link href={`/roles/${role.id}`}>
          <Button>Return</Button>
        </Link>
      </div>
    </main>
  );
}
