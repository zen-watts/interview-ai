"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { useAppStore } from "@/src/components/providers/app-store-provider";
import { useSpeechRecognition } from "@/src/components/interview/use-speech-recognition";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Notice } from "@/src/components/ui/notice";
import { Textarea } from "@/src/components/ui/textarea";
import { requestInterviewAnalysis, requestInterviewTurn } from "@/src/lib/ai/client-api";
import { createLogger } from "@/src/lib/logger";
import { END_TOKEN, type TranscriptTurn } from "@/src/lib/types";
import { createId } from "@/src/lib/utils/id";
import { formatDateTime, formatDuration, nowIso } from "@/src/lib/utils/time";

const logger = createLogger("interview-attempt-page");

const statusCopy: Record<string, string> = {
  script_pending: "Generating script",
  ready: "Ready to start",
  in_progress: "In progress",
  analysis_pending: "Generating analysis",
  complete: "Complete",
  error: "Needs attention",
};

function findLatestAssistantQuestion(transcript: TranscriptTurn[]) {
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const turn = transcript[index];
    if (turn.role === "assistant") {
      return turn.content;
    }
  }

  return "";
}

export function InterviewAttemptPage({ roleId, attemptId }: { roleId: string; attemptId: string }) {
  const {
    store,
    replaceTranscript,
    appendTranscriptTurn,
    setAttemptStatus,
    setAttemptAnalysis,
  } = useAppStore();

  const [draftAnswer, setDraftAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingTurn, setLoadingTurn] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const role = useMemo(() => store.roles.find((item) => item.id === roleId) ?? null, [roleId, store.roles]);
  const attempt = useMemo(
    () => store.attempts.find((item) => item.roleId === roleId && item.id === attemptId) ?? null,
    [attemptId, roleId, store.attempts],
  );

  const handleFinalTranscript = useCallback((text: string) => {
    setDraftAnswer((current) => (current ? `${current} ${text}` : text));
  }, []);

  const speech = useSpeechRecognition(handleFinalTranscript);

  if (!role || !attempt) {
    return (
      <main className="space-y-6">
        <Card className="space-y-3">
          <h1 className="text-3xl">Interview attempt not found</h1>
          <p className="text-paper-softInk">This interview attempt does not exist in local storage.</p>
          <Link href="/">
            <Button>Back to home</Button>
          </Link>
        </Card>
      </main>
    );
  }

  const latestQuestion = findLatestAssistantQuestion(attempt.transcript);

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
      setAttemptStatus(attempt.id, "error", message);
      setError(message);
      logger.error("analysis.failed", { message, attemptId: attempt.id });
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const requestNextTurn = async (transcript: TranscriptTurn[]) => {
    if (!attempt.script) {
      setError("Interviewer script is missing.");
      return;
    }

    setLoadingTurn(true);
    setError(null);

    try {
      const next = await requestInterviewTurn({
        script: attempt.script,
        transcript,
        primaryQuestionCount: attempt.config.primaryQuestionCount,
      });

      if (next.isEnd || next.message.trim() === END_TOKEN) {
        setAttemptStatus(attempt.id, "analysis_pending");
        await runAnalysis(transcript);
        return;
      }

      const assistantTurn: TranscriptTurn = {
        id: createId(),
        role: "assistant",
        content: next.message.trim(),
        createdAt: nowIso(),
      };

      appendTranscriptTurn(attempt.id, assistantTurn);
      setAttemptStatus(attempt.id, "in_progress");
    } catch (turnError) {
      const message = turnError instanceof Error ? turnError.message : "Failed to generate next question.";
      setAttemptStatus(attempt.id, "error", message);
      setError(message);
      logger.error("turn.failed", { message, attemptId: attempt.id });
    } finally {
      setLoadingTurn(false);
    }
  };

  const startInterview = async () => {
    if (!attempt.script) {
      setError("Script not generated yet.");
      return;
    }

    if (attempt.transcript.length > 0) {
      return;
    }

    setAttemptStatus(attempt.id, "in_progress");
    await requestNextTurn([]);
  };

  const submitAnswer = async () => {
    const answerFromInterim = speech.interimText.trim();
    const combinedAnswer = [draftAnswer.trim(), answerFromInterim].filter(Boolean).join(" ").trim();

    if (!combinedAnswer) {
      setError("Please say or type your answer before submitting.");
      return;
    }

    let durationSeconds = 0;
    if (speech.listening) {
      durationSeconds = speech.stop();
    }

    const userTurn: TranscriptTurn = {
      id: createId(),
      role: "user",
      content: combinedAnswer,
      createdAt: nowIso(),
      answerDurationSec: durationSeconds > 0 ? durationSeconds : undefined,
    };

    const nextTranscript = [...attempt.transcript, userTurn];
    replaceTranscript(attempt.id, nextTranscript);

    setDraftAnswer("");
    speech.reset();

    await requestNextTurn(nextTranscript);
  };

  return (
    <main className="space-y-8 pb-12">
      <header className="space-y-2">
        <Link href={`/roles/${role.id}`} className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted hover:text-paper-ink">
          {role.title}
        </Link>
        <h1 className="text-4xl leading-tight">Interview session</h1>
        <p className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">
          Status: {statusCopy[attempt.status] || attempt.status}
        </p>
      </header>

      <Card className="space-y-4">
        <h2 className="text-3xl leading-tight">{latestQuestion || "Start interview when you are ready."}</h2>
        {!latestQuestion ? (
          <Button onClick={startInterview} disabled={loadingTurn || attempt.status === "script_pending" || !attempt.script}>
            {attempt.status === "script_pending" ? "Generating script..." : "Start interview"}
          </Button>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={speech.start} disabled={!speech.supported || speech.listening || loadingTurn || loadingAnalysis}>
            Start mic
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={speech.stop}
            disabled={!speech.supported || !speech.listening || loadingTurn || loadingAnalysis}
          >
            Stop mic
          </Button>
          <p className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">
            Talk time {formatDuration(speech.elapsedSec)}
          </p>
        </div>

        {!speech.supported ? (
          <Notice
            tone="neutral"
            message="Speech recognition is not available in this browser. You can still type answers manually."
          />
        ) : null}

        {speech.lastError ? <Notice tone="error" message={speech.lastError} /> : null}

        {speech.interimText ? (
          <p className="rounded-paper border border-paper-border px-3 py-2 text-sm text-paper-softInk">
            Live transcript: {speech.interimText}
          </p>
        ) : null}

        <div className="space-y-2">
          <Textarea
            value={draftAnswer}
            onChange={(event) => setDraftAnswer(event.target.value)}
            rows={6}
            placeholder="Type here, or speak and edit before submitting"
            disabled={loadingTurn || loadingAnalysis}
          />
          <Button onClick={submitAnswer} disabled={loadingTurn || loadingAnalysis}>
            {loadingTurn ? "Waiting for next question..." : "Submit answer"}
          </Button>
        </div>

        {error ? <Notice tone="error" message={error} /> : null}
        {attempt.lastError && !error ? <Notice tone="error" message={attempt.lastError} /> : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl">Transcript</h2>

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

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl">Analysis</h2>
          {attempt.script && attempt.transcript.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              disabled={loadingAnalysis || loadingTurn}
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
          <p className="text-paper-softInk">Complete an interview to generate analysis.</p>
        )}
      </Card>

      {attempt.script ? (
        <Card className="space-y-3">
          <h2 className="text-2xl">Interviewer script</h2>
          <p className="text-paper-softInk">
            Stored locally for this attempt and reused during turn-by-turn interviewing.
          </p>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-paper border border-paper-border bg-paper-elevated p-4 text-sm leading-relaxed text-paper-softInk">
            {attempt.script}
          </pre>
        </Card>
      ) : null}
    </main>
  );
}
