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
import { requestInterviewAnalysis, requestInterviewTurn, requestInterviewerSpeech } from "@/src/lib/ai/client-api";
import { createLogger } from "@/src/lib/logger";
import { END_TOKEN, type TranscriptTurn } from "@/src/lib/types";
import { createId } from "@/src/lib/utils/id";
import { formatDuration, nowIso } from "@/src/lib/utils/time";

const logger = createLogger("interview-attempt-page");

const QUESTION_FADE_MS = 420;
const TYPING_WORD_INTERVAL_MS = 110;
const RESPONSE_SEND_ANIMATION_MS = 950;
const COMPLETE_FADE_IN_MS = 350;
const COMPLETE_HOLD_MS = 1000;
const COMPLETE_FADE_OUT_MS = 350;
const COMPLETE_SCENE_MS = COMPLETE_FADE_IN_MS + COMPLETE_HOLD_MS + COMPLETE_FADE_OUT_MS;
const EMPTY_RESPONSE_ERROR = "Please respond before finishing this turn.";

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

function splitQuestionWords(question: string) {
  return question.trim().split(/\s+/).filter(Boolean);
}

export function InterviewAttemptPage({ roleId, attemptId }: { roleId: string; attemptId: string }) {
  const { store, replaceTranscript, appendTranscriptTurn, setAttemptStatus, setAttemptAnalysis } = useAppStore();
  const router = useRouter();

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
  const [responseSendText, setResponseSendText] = useState("");
  const [responseSendActive, setResponseSendActive] = useState(false);
  const [responseSendKey, setResponseSendKey] = useState(0);
  const [errorFading, setErrorFading] = useState(false);
  const [interviewerVoiceEnabled, setInterviewerVoiceEnabled] = useState(true);
  const [interviewerSpeechActive, setInterviewerSpeechActive] = useState(false);

  const spokenAnswerRef = useRef("");
  const initializedRef = useRef(false);
  const completionStartedRef = useRef(false);
  const typingRunRef = useRef(0);
  const typingTimerRef = useRef<number | null>(null);
  const interviewerSpeechRunRef = useRef(0);
  const interviewerAudioRef = useRef<HTMLAudioElement | null>(null);
  const interviewerAudioUrlRef = useRef<string | null>(null);

  const role = useMemo(() => store.roles.find((item) => item.id === roleId) ?? null, [roleId, store.roles]);
  const attempt = useMemo(
    () => store.attempts.find((item) => item.roleId === roleId && item.id === attemptId) ?? null,
    [attemptId, roleId, store.attempts],
  );

  const onFinalTranscript = useCallback((text: string) => {
    const next = [spokenAnswerRef.current, text].filter(Boolean).join(" ").trim();
    spokenAnswerRef.current = next;
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
    resetSpeech();
  }, [resetSpeech]);

  const clearInterviewerAudioResources = useCallback(() => {
    if (interviewerAudioRef.current) {
      interviewerAudioRef.current.pause();
      interviewerAudioRef.current.onended = null;
      interviewerAudioRef.current.onerror = null;
      interviewerAudioRef.current.src = "";
      interviewerAudioRef.current = null;
    }

    if (interviewerAudioUrlRef.current) {
      URL.revokeObjectURL(interviewerAudioUrlRef.current);
      interviewerAudioUrlRef.current = null;
    }
  }, []);

  const cancelInterviewerSpeech = useCallback(() => {
    interviewerSpeechRunRef.current += 1;
    clearInterviewerAudioResources();
    setInterviewerSpeechActive(false);
  }, [clearInterviewerAudioResources]);

  const playInterviewerSpeech = useCallback(
    async (question: string) => {
      if (!interviewerVoiceEnabled || !question.trim()) {
        return;
      }

      const runId = interviewerSpeechRunRef.current + 1;
      interviewerSpeechRunRef.current = runId;
      clearInterviewerAudioResources();
      setInterviewerSpeechActive(true);

      logger.info("interviewer.tts.request.started", {
        attemptId,
        questionLength: question.length,
      });

      try {
        const audioBlob = await requestInterviewerSpeech({ text: question });
        if (interviewerSpeechRunRef.current !== runId) {
          return;
        }

        const objectUrl = URL.createObjectURL(audioBlob);
        interviewerAudioUrlRef.current = objectUrl;

        const audio = new Audio(objectUrl);
        audio.preload = "auto";
        interviewerAudioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            resolve();
          };

          audio.onerror = () => {
            reject(new Error("Interviewer voice playback failed."));
          };

          const playPromise = audio.play();
          if (playPromise) {
            playPromise.catch((playError) => {
              reject(playError instanceof Error ? playError : new Error("Interviewer voice playback failed."));
            });
          }
        });

        logger.info("interviewer.tts.playback.completed", {
          attemptId,
          questionLength: question.length,
        });
      } catch (ttsError) {
        if (interviewerSpeechRunRef.current === runId) {
          const message = ttsError instanceof Error ? ttsError.message : "Interviewer speech unavailable.";
          logger.warn("interviewer.tts.playback.failed", {
            attemptId,
            message,
          });
        }
      } finally {
        if (interviewerSpeechRunRef.current === runId) {
          clearInterviewerAudioResources();
          setInterviewerSpeechActive(false);
        }
      }
    },
    [attemptId, clearInterviewerAudioResources, interviewerVoiceEnabled],
  );

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
    if (error !== EMPTY_RESPONSE_ERROR) {
      setErrorFading(false);
      return;
    }

    const fadeTimer = window.setTimeout(() => {
      setErrorFading(true);
    }, 1000);

    const clearTimer = window.setTimeout(() => {
      setError(null);
      setErrorFading(false);
    }, 1320);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [error]);

  useEffect(() => {
    return () => {
      interviewerSpeechRunRef.current += 1;
      clearInterviewerAudioResources();

      if (typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [clearInterviewerAudioResources]);

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
      interviewerSpeechActive ||
      !foregroundVisible ||
      loadingTurn ||
      loadingAnalysis ||
      responseSendActive ||
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
    interviewerSpeechActive,
    foregroundVisible,
    responseSendActive,
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
  const questionSizeClass = useMemo(() => {
    const contentLength = questionText.trim().length || visibleQuestionText.trim().length;

    if (contentLength >= 260) {
      return "interview-question-text-compact";
    }

    if (contentLength >= 170) {
      return "interview-question-text-balanced";
    }

    return "";
  }, [questionText, visibleQuestionText]);

  const typeQuestion = useCallback(async (question: string) => {
    if (typingTimerRef.current) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    const runId = typingRunRef.current + 1;
    typingRunRef.current = runId;
    setVisibleQuestionText("");
    setTypingInProgress(true);
    const words = splitQuestionWords(question);

    if (words.length === 0) {
      setVisibleQuestionText(question.trim());
      setTypingInProgress(false);
      return;
    }

    await new Promise<void>((resolve) => {
      let index = 0;

      typingTimerRef.current = window.setInterval(() => {
        if (typingRunRef.current !== runId) {
          if (typingTimerRef.current) {
            window.clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
          }
          resolve();
          return;
        }

        index = Math.min(words.length, index + 1);
        setVisibleQuestionText(words.slice(0, index).join(" "));

        if (index >= words.length) {
          if (typingTimerRef.current) {
            window.clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
          }
          resolve();
        }
      }, TYPING_WORD_INTERVAL_MS);
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
      await Promise.all([typeQuestion(question), playInterviewerSpeech(question)]);
      setForegroundVisible(true);

      logger.info("interview.question.displayed", {
        attemptId: attempt.id,
        questionLength: question.length,
      });
    },
    [attempt.id, playInterviewerSpeech, typeQuestion],
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

      cancelInterviewerSpeech();
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

      await delay(COMPLETE_SCENE_MS);
      await runAnalysis(transcript);

      router.replace(`/roles/${roleId}/attempts/${attemptId}/conclusion`);
    },
    [attempt.id, attemptId, cancelInterviewerSpeech, resetAnswerDraft, roleId, router, runAnalysis, speechListening, stopSpeech],
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
        setError(EMPTY_RESPONSE_ERROR);
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

    cancelInterviewerSpeech();
    setAttemptStatus(attempt.id, "in_progress");
    setForegroundVisible(false);
    setQuestionVisible(false);
    setPhase("transition");
    await requestNextTurn([]);
  };

  const finishResponse = async () => {
    if (
      phase !== "active" ||
      !foregroundVisible ||
      voiceUnavailable ||
      interviewerSpeechActive ||
      typingInProgress ||
      loadingTurn ||
      loadingAnalysis ||
      responseSendActive
    ) {
      return;
    }

    setResponseSendActive(true);
    const interimSnapshot = interimText.trim();
    const durationSeconds = speechListening ? stopSpeech() : 0;
    const combinedAnswer = [spokenAnswerRef.current.trim(), interimSnapshot].filter(Boolean).join(" ").trim();
    if (!combinedAnswer) {
      setResponseSendActive(false);
      setError(EMPTY_RESPONSE_ERROR);
      return;
    }

    setResponseSendText(combinedAnswer);
    setResponseSendKey((current) => current + 1);
    await delay(RESPONSE_SEND_ANIMATION_MS);
    setResponseSendText("");
    try {
      await submitAnswer(combinedAnswer, durationSeconds);
    } finally {
      setResponseSendActive(false);
    }
  };

  const retryVoiceCapture = () => {
    if (phase !== "active" || !foregroundVisible || interviewerSpeechActive || typingInProgress || loadingTurn || loadingAnalysis) {
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

    cancelInterviewerSpeech();
    router.replace(`/roles/${role.id}`);
  };

  const toggleInterviewerVoice = () => {
    setInterviewerVoiceEnabled((current) => {
      const next = !current;
      logger.info("interviewer.tts.toggle", { attemptId: attempt.id, enabled: next });
      return next;
    });
  };

  useEffect(() => {
    if (!interviewerVoiceEnabled) {
      cancelInterviewerSpeech();
    }
  }, [cancelInterviewerSpeech, interviewerVoiceEnabled]);

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
        <section className="relative z-10 flex min-h-screen items-center justify-center px-6 text-center">
          <h1
            className="interview-complete-text text-5xl tracking-tight text-slate-100 md:text-6xl"
            style={{ animationDuration: `${COMPLETE_SCENE_MS}ms` }}
          >
            Interview Complete
          </h1>
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleInterviewerVoice}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-500/70 bg-slate-900/50 text-slate-100 transition hover:border-slate-300"
            aria-label={interviewerVoiceEnabled ? "Mute interviewer voice" : "Unmute interviewer voice"}
          >
            {interviewerVoiceEnabled ? (
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
                <path d="M11 5L6 9H3v6h3l5 4V5z" />
                <path d="M15.5 9.5a4 4 0 010 5" />
                <path d="M18.5 7a7.5 7.5 0 010 10" />
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
                <path d="M11 5L6 9H3v6h3l5 4V5z" />
                <path d="M15 9l6 6" />
                <path d="M21 9l-6 6" />
              </svg>
            )}
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
        </div>
      </header>

      <section className="relative z-10 flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 pb-14 pt-2 md:px-10">
        <div
          className={`pointer-events-none absolute left-1/2 top-12 w-full max-w-[min(92vw,72rem)] -translate-x-1/2 px-6 md:top-16 ${
            questionVisible ? "opacity-100 duration-[2500ms]" : "opacity-0 duration-300"
          } transition-opacity ease-in-out`}
        >
          <div className={`interview-question-text min-h-[3.6em] text-center ${questionSizeClass}`}>{visibleQuestionText}</div>
        </div>

        {foregroundVisible ? (
          <div className="interview-support-enter relative flex w-full flex-col items-center">
            <AudioReactiveBlob className="mt-20 md:mt-24" level={audioLevel} listening={speechListening} />

            <Button
              className="mt-7 min-w-48 border-slate-500/45 bg-slate-900/45 text-slate-100 opacity-50 backdrop-blur-sm hover:border-slate-300/70 hover:bg-slate-800/55"
              onClick={finishResponse}
              disabled={
                voiceUnavailable ||
                interviewerSpeechActive ||
                typingInProgress ||
                loadingTurn ||
                loadingAnalysis ||
                responseSendActive
              }
            >
              {typingInProgress
                ? "Question typing..."
                : loadingTurn
                  ? "Loading next question..."
                  : responseSendActive
                    ? "Sending..."
                    : "Finish Response"}
            </Button>

            {voiceUnavailable || error || attempt.lastError ? (
              <div className="pointer-events-none absolute top-[calc(100%+1.5rem)] w-full max-w-2xl px-2">
                <div className="pointer-events-auto space-y-3">
                  {voiceUnavailable ? (
                    <div className="space-y-3">
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
                        disabled={interviewerSpeechActive || typingInProgress || loadingTurn || loadingAnalysis}
                      >
                        Retry microphone access
                      </Button>
                    </div>
                  ) : null}

                  {error ? (
                    <div className={`transition-opacity duration-300 ${errorFading ? "opacity-0" : "opacity-100"}`}>
                      <Notice className="w-full border-slate-500 text-slate-100" tone="error" message={error} />
                    </div>
                  ) : null}

                  {attempt.lastError && !error ? (
                    <Notice className="w-full border-slate-500 text-slate-100" tone="error" message={attempt.lastError} />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {responseSendText ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center px-6">
            <div
              key={responseSendKey}
              className="interview-response-send mt-[48vh] w-full max-w-2xl rounded-paper border border-slate-400/45 bg-slate-900/65 px-5 py-4 text-sm leading-relaxed text-slate-100/88 shadow-[0_8px_28px_rgba(0,0,0,0.36)] backdrop-blur-sm"
            >
              {responseSendText}
            </div>
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
