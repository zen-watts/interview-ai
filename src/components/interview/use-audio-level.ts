"use client";

import { useEffect, useState } from "react";

import { createLogger } from "@/src/lib/logger";

const logger = createLogger("audio-level");

/**
 * Tracks microphone intensity using Web Audio APIs for lightweight visual feedback.
 */
export function useAudioLevel(enabled: boolean) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLevel(0);
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      logger.warn("Audio level meter unavailable: getUserMedia not supported.");
      setLevel(0);
      return;
    }

    let disposed = false;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let frameId: number | null = null;

    const sample = () => {
      if (disposed || !analyser) {
        return;
      }

      const values = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(values);

      let sumSquares = 0;
      for (const value of values) {
        sumSquares += value * value;
      }

      const rms = Math.sqrt(sumSquares / values.length);
      const normalized = Math.min(1, rms * 8);

      setLevel((current) => current * 0.74 + normalized * 0.26);
      frameId = window.requestAnimationFrame(sample);
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        audioContext = new AudioContext();
        source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.85;
        source.connect(analyser);

        logger.info("audio.level.started");
        sample();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Microphone access failed.";
        logger.warn("audio.level.failed", { message });
        setLevel(0);
      }
    };

    void start();

    return () => {
      disposed = true;

      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      source?.disconnect();
      analyser?.disconnect();
      stream?.getTracks().forEach((track) => track.stop());

      if (audioContext) {
        void audioContext.close();
      }

      setLevel(0);
      logger.info("audio.level.stopped");
    };
  }, [enabled]);

  return level;
}
