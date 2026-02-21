"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createLogger } from "@/src/lib/logger";

const logger = createLogger("speech-recognition");

interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

interface RecognitionErrorEvent {
  error: string;
}

interface RecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => RecognitionInstance;

interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  interimText: string;
  elapsedSec: number;
  lastError: string | null;
  start: () => void;
  stop: () => number;
  reset: () => void;
}

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  const ctor = speechWindow.SpeechRecognition;
  const webkitCtor = speechWindow.webkitSpeechRecognition;

  return ctor || webkitCtor || null;
}

export function useSpeechRecognition(
  onFinalTranscript: (text: string) => void,
): UseSpeechRecognitionResult {
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const supported = useMemo(() => Boolean(getRecognitionConstructor()), []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    clearTimer();

    const startedAt = startedAtRef.current;
    startedAtRef.current = null;

    if (!startedAt) {
      return 0;
    }

    const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    setElapsedSec(durationSeconds);
    logger.info("Speech capture stopped.", { durationSeconds });

    return durationSeconds;
  }, [clearTimer]);

  useEffect(() => {
    if (!supported) {
      return;
    }

    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setListening(true);
      setInterimText("");
      setElapsedSec(0);
      startedAtRef.current = Date.now();
      clearTimer();
      timerRef.current = window.setInterval(() => {
        const startedAt = startedAtRef.current;
        if (!startedAt) {
          return;
        }

        setElapsedSec(Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
      }, 1000);
      logger.info("Speech capture started.");
    };

    recognition.onend = () => {
      setListening(false);
      setInterimText("");
      clearTimer();
      logger.debug("Speech capture ended.");
    };

    recognition.onerror = (event) => {
      setLastError(event.error || "Speech recognition error");
      logger.error("Speech recognition reported an error.", { error: event.error });
    };

    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const content = result[0]?.transcript || "";
        if (result.isFinal) {
          finalText += `${content} `;
        } else {
          interim += content;
        }
      }

      const normalizedFinal = finalText.trim();
      if (normalizedFinal) {
        onFinalTranscript(normalizedFinal);
      }

      setInterimText(interim.trim());
    };

    recognitionRef.current = recognition;

    return () => {
      clearTimer();
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onstart = null;
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [clearTimer, onFinalTranscript, supported]);

  const start = useCallback(() => {
    if (!supported || !recognitionRef.current) {
      setLastError("Speech recognition is not available in this browser.");
      return;
    }

    setLastError(null);

    try {
      recognitionRef.current.start();
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Could not start speech recognition.");
      logger.error("Speech capture could not be started.", {
        message: error instanceof Error ? error.message : "Unknown speech start error",
      });
    }
  }, [supported]);

  const reset = useCallback(() => {
    setInterimText("");
    setElapsedSec(0);
    setLastError(null);
    startedAtRef.current = null;
    clearTimer();
  }, [clearTimer]);

  return {
    supported,
    listening,
    interimText,
    elapsedSec,
    lastError,
    start,
    stop,
    reset,
  };
}
