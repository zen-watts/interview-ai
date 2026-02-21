"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useSpeechRecognition } from "@/src/components/interview/use-speech-recognition";
import { useAppStore } from "@/src/components/providers/app-store-provider";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Notice } from "@/src/components/ui/notice";
import { Textarea } from "@/src/components/ui/textarea";
import { requestInterviewAnalysis, requestInterviewTurn } from "@/src/lib/ai/client-api";
import { createLogger } from "@/src/lib/logger";
import { END_TOKEN, type TranscriptTurn } from "@/src/lib/types";
import { createId } from "@/src/lib/utils/id";
import { formatDuration, nowIso } from "@/src/lib/utils/time";

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

function streamStepSize(contentLength: number) {
  if (contentLength <= 60) {
    return 1;
  }

  if (contentLength <= 140) {
    return 2;
  }

  return 3;
}

export function InterviewAttemptPage({ roleId, attemptId }: { roleId: string; attemptId: string }) {
  const { store, replaceTranscript, appendTranscriptTurn, setAttemptStatus, setAttemptAnalysis } = useAppStore();
  const router = useRouter();

  const [draftAnswer, setDraftAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingTurn, setLoadingTurn] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [streamingQuestion, setStreamingQuestion] = useState("");
  const [streamingInProgress, setStreamingInProgress] = useState(false);
  const spokenAnswerRef = useRef("");
  const streamTimerRef = useRef<number | null>(null);

  const role = useMemo(() => store.roles.find((item) => item.id === roleId) ?? null, [roleId, store.roles]);
  const attempt = useMemo(
    () => store.attempts.find((item) => item.roleId === roleId && item.id === attemptId) ?? null,
    [attemptId, roleId, store.attempts],
  );

  const handleFinalTranscript = useCallback((text: string) => {
    const next = [spokenAnswerRef.current, text].filter(Boolean).join(" ").trim();
    spokenAnswerRef.current = next;
    setDraftAnswer(next);
  }, []);

  const speech = useSpeechRecognition(handleFinalTranscript);

  useEffect(() => {
    return () => {
      if (streamTimerRef.current) {
        window.clearInterval(streamTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!attempt) {
      return;
    }

    if (attempt.status === "analysis_pending" || attempt.status === "complete") {
      router.replace(`/roles/${roleId}/attempts/${attemptId}/conclusion`);
    }
  }, [attempt, attemptId, roleId, router]);

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

  const latestStoredQuestion = findLatestAssistantQuestion(attempt.transcript);
  const latestQuestion = streamingInProgress ? streamingQuestion : latestStoredQuestion;

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

  const streamAssistantMessage = async (message: string) => {
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    setStreamingQuestion("");
    setStreamingInProgress(true);

    await new Promise<void>((resolve) => {
      let index = 0;
      const chunkSize = streamStepSize(message.length);
      streamTimerRef.current = window.setInterval(() => {
        index = Math.min(index + chunkSize, message.length);
        setStreamingQuestion(message.slice(0, index));

        if (index >= message.length) {
          if (streamTimerRef.current) {
            window.clearInterval(streamTimerRef.current);
            streamTimerRef.current = null;
          }

          setStreamingInProgress(false);
          resolve();
        }
      }, 18);
    });
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

      const nextMessage = next.message.trim();
      await streamAssistantMessage(nextMessage);

      const assistantTurn: TranscriptTurn = {
        id: createId(),
        role: "assistant",
        content: nextMessage,
        createdAt: nowIso(),
      };

      appendTranscriptTurn(attempt.id, assistantTurn);
      setAttemptStatus(attempt.id, "in_progress");
    } catch (turnError) {
      const message = turnError instanceof Error ? turnError.message : "Failed to generate next question.";
      setAttemptStatus(attempt.id, "error", message);
      setError(message);
      logger.error("Fetching the next interviewer turn failed.", { message, attemptId: attempt.id });
    } finally {
      setLoadingTurn(false);
    }
  };

  const resetSpokenDraft = () => {
    spokenAnswerRef.current = "";
    setDraftAnswer("");
    speech.reset();
  };

  const submitAnswer = async (answer: string, answerDurationSec?: number) => {
    const combinedAnswer = answer.trim();

    if (!combinedAnswer) {
      setError("Please say or type your answer before submitting.");
      return;
    }

    const userTurn: TranscriptTurn = {
      id: createId(),
      role: "user",
      content: combinedAnswer,
      createdAt: nowIso(),
      answerDurationSec: answerDurationSec && answerDurationSec > 0 ? answerDurationSec : undefined,
    };

    const nextTranscript = [...attempt.transcript, userTurn];
    replaceTranscript(attempt.id, nextTranscript);

    resetSpokenDraft();
    await requestNextTurn(nextTranscript);
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

  const stopAndSendSpokenAnswer = async () => {
    const interimSnapshot = speech.interimText.trim();
    const durationSeconds = speech.listening ? speech.stop() : 0;
    const combinedAnswer = [spokenAnswerRef.current.trim(), interimSnapshot].filter(Boolean).join(" ").trim();
    await submitAnswer(combinedAnswer, durationSeconds);
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
        <h1 className="text-4xl leading-tight">Interview session</h1>
        <p className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">
          Status: {statusCopy[attempt.status] || attempt.status}
        </p>
      </header>

      <Card className="space-y-4">
        <p className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">Current interviewer prompt</p>
        <h2 className="text-3xl leading-tight">
          {latestQuestion || "Start interview when you are ready."}
          {streamingInProgress ? <span className="animate-pulse"> |</span> : null}
        </h2>
        {!latestQuestion ? (
          <Button onClick={startInterview} disabled={loadingTurn || attempt.status === "script_pending" || !attempt.script}>
            {attempt.status === "script_pending" ? "Generating script..." : "Start interview"}
          </Button>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-col items-center gap-4 py-2">
          <div
            className={`flex h-40 w-40 flex-col items-center justify-center rounded-full border text-center transition ${
              speech.listening ? "border-paper-accent bg-paper-elevated" : "border-paper-border bg-paper-bg"
            }`}
          >
            <p className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">
              {speech.listening ? "Recording" : loadingTurn ? "Thinking" : "Ready"}
            </p>
            <p className="mt-1 text-2xl">{formatDuration(speech.elapsedSec)}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              onClick={speech.start}
              disabled={!speech.supported || speech.listening || loadingTurn || loadingAnalysis || !latestQuestion}
            >
              Start recording
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={stopAndSendSpokenAnswer}
              disabled={(!speech.listening && !draftAnswer.trim() && !speech.interimText.trim()) || loadingTurn || loadingAnalysis}
            >
              {loadingTurn ? "Sending..." : "Stop and send answer"}
            </Button>
          </div>
        </div>

        {!speech.supported ? (
          <Notice
            tone="neutral"
            message="Speech recognition is not available in this browser. You can still type and submit your answer."
          />
        ) : null}

        {speech.lastError ? <Notice tone="error" message={speech.lastError} /> : null}

        {(draftAnswer || speech.interimText) && !loadingTurn ? (
          <div className="space-y-2">
            <p className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">Transcribed answer</p>
            <p className="rounded-paper border border-paper-border px-3 py-2 text-paper-softInk">
              {[draftAnswer.trim(), speech.interimText.trim()].filter(Boolean).join(" ").trim()}
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">Manual fallback</p>
          <Textarea
            value={draftAnswer}
            onChange={(event) => {
              const value = event.target.value;
              spokenAnswerRef.current = value;
              setDraftAnswer(value);
            }}
            rows={5}
            placeholder="Type an answer and send if you prefer manual input"
            disabled={loadingTurn || loadingAnalysis}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={async () => {
                await submitAnswer(draftAnswer);
              }}
              disabled={loadingTurn || loadingAnalysis || !draftAnswer.trim()}
            >
              {loadingTurn ? "Waiting for next question..." : "Send typed answer"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={resetSpokenDraft}
              disabled={loadingTurn || loadingAnalysis || (!draftAnswer && !speech.interimText)}
            >
              Clear draft
            </Button>
          </div>
        </div>

        {error ? <Notice tone="error" message={error} /> : null}
        {attempt.lastError && !error ? <Notice tone="error" message={attempt.lastError} /> : null}
      </Card>

    </main>
  );
}
