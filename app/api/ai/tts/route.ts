import { NextResponse } from "next/server";
import { z } from "zod";

import { createLogger } from "@/src/lib/logger";

const logger = createLogger("api.tts");

const MAX_TTS_TEXT_CHARS = 420;
const DEFAULT_ELEVENLABS_MODEL = "eleven_flash_v2_5";
const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

const bodySchema = z.object({
  text: z.string().min(1).max(MAX_TTS_TEXT_CHARS),
});

function sanitizeTtsText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function readUpstreamError(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: { message?: string }; message?: string };
    return payload.detail?.message || payload.message || `ElevenLabs request failed (${response.status})`;
  } catch {
    return `ElevenLabs request failed (${response.status})`;
  }
}

/**
 * Streams interviewer TTS audio from ElevenLabs for the provided question text.
 */
export async function POST(request: Request) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      logger.warn("tts.request.validation_failed", { issues: parsed.error.issues });
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
    const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_ELEVENLABS_MODEL;

    if (!apiKey || !voiceId) {
      logger.warn("tts.request.misconfigured", {
        hasApiKey: Boolean(apiKey),
        hasVoiceId: Boolean(voiceId),
      });
      return NextResponse.json({ error: "Interviewer voice is not configured." }, { status: 503 });
    }

    const text = sanitizeTtsText(parsed.data.text);
    if (!text) {
      return NextResponse.json({ error: "Text cannot be empty." }, { status: 400 });
    }

    logger.info("tts.request.started", {
      textLength: text.length,
      modelId,
    });

    const elevenLabsResponse = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.72,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
    });

    if (!elevenLabsResponse.ok) {
      const message = await readUpstreamError(elevenLabsResponse);
      logger.error("tts.request.upstream_failed", { message, status: elevenLabsResponse.status });
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const audioData = await elevenLabsResponse.arrayBuffer();
    if (!audioData.byteLength) {
      logger.error("tts.request.empty_audio", { textLength: text.length });
      return NextResponse.json({ error: "Interviewer voice returned empty audio." }, { status: 502 });
    }

    logger.info("tts.request.completed", {
      textLength: text.length,
      byteLength: audioData.byteLength,
    });

    return new Response(audioData, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("tts.request.failed", {
      message: error instanceof Error ? error.message : "Unknown server error",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Interviewer voice generation failed" },
      { status: 500 },
    );
  }
}
