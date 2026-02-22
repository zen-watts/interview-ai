"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AudioReactiveBlob } from "@/src/components/interview/audio-reactive-blob";
import { useAudioLevel } from "@/src/components/interview/use-audio-level";
import { useSpeechRecognition } from "@/src/components/interview/use-speech-recognition";
import { useAppStore } from "@/src/components/providers/app-store-provider";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Notice } from "@/src/components/ui/notice";
import { requestInterviewAnalysis, requestInterviewTurn } from "@/src/lib/ai/client-api";
import { createLogger } from "@/src/lib/logger";
import { END_TOKEN, type TranscriptTurn } from "@/src/lib/types";
import { createId } from "@/src/lib/utils/id";
import { formatDuration, nowIso } from "@/src/lib/utils/time";

const logger = createLogger("interview-attempt-page");

const QUESTION_FADE_MS = 280;
const COMPLETE_DELAY_MS = 3000;
const TYPING_INTERVAL_MS = 38;

type InterviewVisualPhase = "intro" | "transition" | "active" | "complete";

function findLatestAssistantQuestion(transcript: TranscriptTurn[]) {
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const turn = transcript[index];
    if (turn.role === "assistant") {
      return turn.content;
    }
  }

  return "";
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeOrganizationName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "this organization";
  }

  if (trimmed.length <= 72) {
    return trimmed;
  }

  return `${trimmed.slice(0, 69).trim()}...`;
}

function typingStepSize(contentLength: number) {
  if (contentLength <= 130) {
    return 1;
  }

  if (contentLength <= 220) {
    return 1;
  }

  return 2;
}

export function InterviewAttemptPage({ roleId, attemptId }: { roleId: string; attemptId: string }) {
  const { store, replaceTranscript, appendTranscriptTurn, setAttemptStatus, setAttemptAnalysis } = useAppStore();
  const router = useRouter();

  const [spokenDraft, setSpokenDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingTurn, setLoadingTurn] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [phase, setPhase] = useState<InterviewVisualPhase>("intro");
  const [questionText, setQuestionText] = useState("");
  const [visibleQuestionText, setVisibleQuestionText] = useState("");
  const [questionVisible, setQuestionVisible] = useState(false);
  const [typingInProgress, setTypingInProgress] = useState(false);
  const [foregroundVisible, setForegroundVisible] = useState(false);
  const [questionElapsedSec, setQuestionElapsedSec] = useState(0);
  const [questionCycle, setQuestionCycle] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const spokenAnswerRef = useRef("");
  const initializedRef = useRef(false);
  const completionStartedRef = useRef(false);
  const typingRunRef = useRef(0);
  const typingTimerRef = useRef<number | null>(null);

  const role = useMemo(() => store.roles.find((item) => item.id === roleId) ?? null, [roleId, store.roles]);
  const attempt = useMemo(
    () => store.attempts.find((item) => item.roleId === roleId && item.id === attemptId) ?? null,
    [attemptId, roleId, store.attempts],
  );

  const onFinalTranscript = useCallback((text: string) => {
    const next = [spokenAnswerRef.current, text].filter(Boolean).join(" ").trim();
    spokenAnswerRef.current = next;
    setSpokenDraft(next);
  }, []);

  const speech = useSpeechRecognition(onFinalTranscript);
  const {
    supported: speechSupported,
    listening: speechListening,
    interimText,
    lastError: speechError,
    start: startSpeech,
    stop: stopSpeech,
    reset: resetSpeech,
  } = speech;
  const audioLevel = useAudioLevel(phase === "active" && speechSupported && !speechError);

  const resetAnswerDraft = useCallback(() => {
    spokenAnswerRef.current = "";
    setSpokenDraft("");
    resetSpeech();
  }, [resetSpeech]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const shouldUseDarkMode = phase !== "intro";
    document.body.classList.toggle("interview-dark-mode", shouldUseDarkMode);

    return () => {
      document.body.classList.remove("interview-dark-mode");
    };
  }, [phase]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!attempt || initializedRef.current) {
      return;
    }

    const latestStoredQuestion = findLatestAssistantQuestion(attempt.transcript);

    if (latestStoredQuestion) {
      setQuestionText(latestStoredQuestion);
      setVisibleQuestionText(latestStoredQuestion);
      setTypingInProgress(false);
      setQuestionVisible(true);
      setForegroundVisible(true);
      setQuestionCycle((current) => current + 1);
      setPhase("active");
      logger.info("interview.question.restored", {
        attemptId: attempt.id,
        transcriptLength: attempt.transcript.length,
      });
    }

    initializedRef.current = true;
  }, [attempt]);

  useEffect(() => {
    if (!attempt) {
      return;
    }

    if ((attempt.status === "analysis_pending" || attempt.status === "complete") && !completionStartedRef.current) {
      router.replace(`/roles/${roleId}/attempts/${attemptId}/conclusion`);
    }
  }, [attempt, attemptId, roleId, router]);

  useEffect(() => {
    if (phase !== "active" || !foregroundVisible || !questionText || typingInProgress || !visibleQuestionText) {
      return;
    }

    const startedAt = Date.now();
    setQuestionElapsedSec(0);

    const timerId = window.setInterval(() => {
      setQuestionElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [phase, foregroundVisible, questionCycle, questionText, typingInProgress, visibleQuestionText]);

  useEffect(() => {
    if (phase !== "active") {
      return;
    }

    if (
      !questionText ||
      !visibleQuestionText ||
      typingInProgress ||
      !foregroundVisible ||
      loadingTurn ||
      loadingAnalysis ||
      !speechSupported ||
      speechError ||
      speechListening
    ) {
      return;
    }

    const timerId = window.setTimeout(() => {
      startSpeech();
      logger.info("interview.capture.started", { attemptId });
    }, 160);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    attemptId,
    loadingAnalysis,
    loadingTurn,
    phase,
    questionCycle,
    questionText,
    visibleQuestionText,
    typingInProgress,
    foregroundVisible,
    speechError,
    speechListening,
    speechSupported,
    startSpeech,
  ]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

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

  const organizationName = normalizeOrganizationName(role.organizationDescription);
  const voiceUnavailable = !speechSupported || Boolean(speechError);
  const liveTranscript = [spokenDraft.trim(), interimText.trim()].filter(Boolean).join(" ").trim();

  const typeQuestion = useCallback(async (question: string) => {
    if (typingTimerRef.current) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    const runId = typingRunRef.current + 1;
    typingRunRef.current = runId;
    setVisibleQuestionText("");
    setTypingInProgress(true);

    await new Promise<void>((resolve) => {
      let index = 0;
      const step = typingStepSize(question.length);

      typingTimerRef.current = window.setInterval(() => {
        if (typingRunRef.current !== runId) {
          if (typingTimerRef.current) {
            window.clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
          }
          resolve();
          return;
        }

        index = Math.min(question.length, index + step);
        setVisibleQuestionText(question.slice(0, index));

        if (index >= question.length) {
          if (typingTimerRef.current) {
            window.clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
          }
          resolve();
        }
      }, TYPING_INTERVAL_MS);
    });

    if (typingRunRef.current === runId) {
      setTypingInProgress(false);
    }
  }, []);

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

  const showNextQuestion = useCallback(
    async (question: string) => {
      setForegroundVisible(false);
      setQuestionVisible(false);
      setPhase("transition");

      await delay(QUESTION_FADE_MS);

      setQuestionText(question);
      setVisibleQuestionText("");
      setQuestionElapsedSec(0);
      setQuestionCycle((current) => current + 1);
      setQuestionVisible(true);
      setPhase("active");
      await typeQuestion(question);
      setForegroundVisible(true);

      logger.info("interview.question.displayed", {
        attemptId: attempt.id,
        questionLength: question.length,
      });
    },
    [attempt.id, typeQuestion],
  );

  const completeInterview = useCallback(
    async (transcript: TranscriptTurn[]) => {
      if (completionStartedRef.current) {
        return;
      }

      completionStartedRef.current = true;
      typingRunRef.current += 1;

      if (typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }

      if (speechListening) {
        stopSpeech();
      }

      resetAnswerDraft();
      setQuestionText("");
      setVisibleQuestionText("");
      setTypingInProgress(false);
      setForegroundVisible(false);
      setQuestionVisible(false);
      setPhase("complete");

      logger.info("interview.completed", {
        attemptId: attempt.id,
        transcriptLength: transcript.length,
      });

      await delay(COMPLETE_DELAY_MS);
      await runAnalysis(transcript);

      router.replace(`/roles/${roleId}/attempts/${attemptId}/conclusion`);
    },
    [attempt.id, attemptId, resetAnswerDraft, roleId, router, runAnalysis, speechListening, stopSpeech],
  );

  const requestNextTurn = useCallback(
    async (transcript: TranscriptTurn[]) => {
      if (!attempt.script) {
        setError("Interviewer script is missing.");
        return;
      }

      setLoadingTurn(true);
      setError(null);

      try {
        logger.info("interview.turn.request.started", {
          attemptId: attempt.id,
          transcriptLength: transcript.length,
        });

        const next = await requestInterviewTurn({
          script: attempt.script,
          transcript,
          primaryQuestionCount: attempt.config.primaryQuestionCount,
        });

        const nextMessage = next.message.trim();
        if (next.isEnd || nextMessage === END_TOKEN) {
          await completeInterview(transcript);
          return;
        }

        const assistantTurn: TranscriptTurn = {
          id: createId(),
          role: "assistant",
          content: nextMessage,
          createdAt: nowIso(),
        };

        appendTranscriptTurn(attempt.id, assistantTurn);
        setAttemptStatus(attempt.id, "in_progress");
        await showNextQuestion(nextMessage);

        logger.info("interview.turn.request.completed", {
          attemptId: attempt.id,
        });
      } catch (turnError) {
        const message = turnError instanceof Error ? turnError.message : "Failed to generate next question.";
        setAttemptStatus(attempt.id, "error", message);
        setError(message);
        logger.error("interview.turn.request.failed", { message, attemptId: attempt.id });
      } finally {
        setLoadingTurn(false);
      }
    },
    [appendTranscriptTurn, attempt, completeInterview, setAttemptStatus, showNextQuestion],
  );

  const submitAnswer = useCallback(
    async (answer: string, answerDurationSec?: number) => {
      const combinedAnswer = answer.trim();
      if (!combinedAnswer) {
        setError("Please respond before finishing this turn.");
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

      resetAnswerDraft();
      setTypingInProgress(false);
      setForegroundVisible(false);
      setQuestionVisible(false);
      setPhase("transition");

      await requestNextTurn(nextTranscript);
    },
    [attempt.id, attempt.transcript, replaceTranscript, requestNextTurn, resetAnswerDraft],
  );

  const startInterview = async () => {
    if (!attempt.script) {
      setError("Script not generated yet.");
      return;
    }

    if (attempt.transcript.length > 0) {
      return;
    }

    setAttemptStatus(attempt.id, "in_progress");
    setForegroundVisible(false);
    setQuestionVisible(false);
    setPhase("transition");
    await requestNextTurn([]);
  };

  const finishResponse = async () => {
    if (phase !== "active" || !foregroundVisible || voiceUnavailable || typingInProgress || loadingTurn || loadingAnalysis) {
      return;
    }

    const interimSnapshot = interimText.trim();
    const durationSeconds = speechListening ? stopSpeech() : 0;
    const combinedAnswer = [spokenAnswerRef.current.trim(), interimSnapshot].filter(Boolean).join(" ").trim();

    await submitAnswer(combinedAnswer, durationSeconds);
  };

  const retryVoiceCapture = () => {
    if (phase !== "active" || !foregroundVisible || typingInProgress || loadingTurn || loadingAnalysis) {
      return;
    }

    setError(null);
    resetSpeech();
    startSpeech();
    logger.info("interview.capture.retry", { attemptId: attempt.id });
  };

  const leaveInterview = () => {
    if (attempt.transcript.length > 0 && !completionStartedRef.current) {
      const confirmed = window.confirm("Leave this interview session? Progress is saved and you can return later.");
      if (!confirmed) {
        return;
      }
    }

    router.replace(`/roles/${role.id}`);
  };

  const toggleFullscreen = async () => {
    if (typeof document === "undefined") {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (fullscreenError) {
      const message = fullscreenError instanceof Error ? fullscreenError.message : "Fullscreen is unavailable.";
      setError("Fullscreen is unavailable in this browser.");
      logger.warn("interview.fullscreen.failed", { message, attemptId: attempt.id });
    }
  };

  if (phase === "intro") {
    return (
      <main className="space-y-8 pb-12">
        <section className="flex min-h-[70vh] items-center justify-center">
          <div className="max-w-4xl space-y-8 text-center">
            <h1 className="text-balance text-4xl leading-tight md:text-6xl">
              Here&apos;s your {role.title} Interview for {organizationName}
            </h1>
            <Button
              className="min-w-36 px-8 py-3 text-base"
              onClick={startInterview}
              disabled={loadingTurn || loadingAnalysis || attempt.status === "script_pending"}
            >
              {loadingTurn || attempt.status === "script_pending" ? "Preparing..." : "Begin"}
            </Button>
            {error ? <Notice tone="error" message={error} className="mx-auto max-w-xl text-left" /> : null}
            {attempt.lastError && !error ? (
              <Notice tone="error" message={attempt.lastError} className="mx-auto max-w-xl text-left" />
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  if (phase === "complete") {
    return (
      <main className="relative left-1/2 -mb-10 -mt-10 min-h-screen w-screen -translate-x-1/2 bg-[#04070d] md:-mb-12 md:-mt-12">
        <section className="flex min-h-screen items-center justify-center px-6 text-center">
          <h1 className="text-5xl tracking-tight text-slate-100 md:text-6xl">Interview Complete</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="relative left-1/2 -mb-10 -mt-10 min-h-screen w-screen -translate-x-1/2 overflow-hidden bg-[#04070d] text-slate-100 md:-mb-12 md:-mt-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="interview-ambience-base" />
        <div className="interview-ambience-layer interview-ambience-layer-a" />
        <div className="interview-ambience-layer interview-ambience-layer-b" />
        <div className="interview-ambience-layer interview-ambience-layer-c" />
        <div className="interview-shape interview-shape-1" />
        <div className="interview-shape interview-shape-2" />
        <div className="interview-shape interview-shape-3" />
        <div className="interview-shape interview-shape-4" />
        <div className="interview-shape interview-shape-5" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 pb-3 pt-6 md:px-10">
        <button
          type="button"
          onClick={leaveInterview}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-500/70 bg-slate-900/50 text-base text-slate-100 transition hover:border-slate-300"
          aria-label="Exit interview"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6L18 18" />
            <path d="M18 6L6 18" />
          </svg>
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-500/70 bg-slate-900/50 text-slate-100 transition hover:border-slate-300"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 15H5v4" />
              <path d="M15 9h4V5" />
              <path d="M5 19l5-5" />
              <path d="M19 5l-5 5" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 3H3v6" />
              <path d="M15 21h6v-6" />
              <path d="M3 9l6-6" />
              <path d="M21 15l-6 6" />
            </svg>
          )}
        </button>
      </header>

      <section className="relative z-10 flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 pb-14 pt-2 md:px-10">
        <div
          className={`interview-question-text text-center transition-all duration-300 ${
            questionVisible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
          }`}
        >
          {visibleQuestionText}
        </div>

        {foregroundVisible ? (
          <div className="interview-support-enter flex w-full flex-col items-center">
            <AudioReactiveBlob className="mt-12" level={audioLevel} listening={speechListening} />

            <div className="mt-6 w-full max-w-2xl rounded-paper border border-slate-500/35 bg-slate-900/40 px-4 py-3 text-slate-100/75 backdrop-blur-sm">
              <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-slate-300/70">Live Transcription</p>
              <p className="mt-2 min-h-10 text-sm leading-relaxed">
                {liveTranscript || (speechListening ? "Listening..." : "Waiting for speech...")}
              </p>
            </div>

            <Button
              className="mt-7 min-w-48 border-slate-500/45 bg-slate-900/45 text-slate-100 backdrop-blur-sm hover:border-slate-300/70 hover:bg-slate-800/55"
              onClick={finishResponse}
              disabled={voiceUnavailable || typingInProgress || loadingTurn || loadingAnalysis}
            >
              {typingInProgress ? "Question typing..." : loadingTurn ? "Loading next question..." : "Finish Response"}
            </Button>

            {voiceUnavailable ? (
              <div className="mt-6 w-full max-w-2xl space-y-3">
                <Notice
                  className="w-full border-slate-500 text-slate-100"
                  tone="error"
                  message={
                    speechSupported
                      ? speechError || "Microphone permission is required for voice mode."
                      : "Voice mode requires browser speech recognition support."
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="border-slate-500/45 bg-slate-900/30 text-slate-100 hover:border-slate-300"
                  onClick={retryVoiceCapture}
                  disabled={typingInProgress || loadingTurn || loadingAnalysis}
                >
                  Retry microphone access
                </Button>
              </div>
            ) : null}

            {error ? <Notice className="mt-6 w-full max-w-2xl border-slate-500 text-slate-100" tone="error" message={error} /> : null}
            {attempt.lastError && !error ? (
              <Notice
                className="mt-6 w-full max-w-2xl border-slate-500 text-slate-100"
                tone="error"
                message={attempt.lastError}
              />
            ) : null}
          </div>
        ) : null}

        {foregroundVisible ? (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <div className="interview-support-enter text-center font-sans">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Time Spent</p>
              <p className="mt-1 text-lg font-medium text-slate-200">{formatDuration(questionElapsedSec)}</p>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
