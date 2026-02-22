import { NextResponse } from "next/server";
import { z } from "zod";

import { getOpenAIClient, getOpenAIModel } from "@/src/lib/ai/openai";
import { mapTranscriptToMessages, buildInterviewSystemPrompt } from "@/src/lib/ai/prompts/interview";
import { createLogger } from "@/src/lib/logger";
import { END_TOKEN } from "@/src/lib/types";

const logger = createLogger("api.interview");

const bodySchema = z.object({
  script: z.string().min(1),
  primaryQuestionCount: z.number().min(1).max(10),
  transcript: z.array(
    z.object({
      id: z.string().min(1),
      role: z.enum(["assistant", "user"]),
      content: z.string(),
      createdAt: z.string(),
      answerDurationSec: z.number().optional(),
    }),
  ),
});

function hasEndToken(message: string) {
  return message
    .split("\n")
    .map((line) => line.trim())
    .includes(END_TOKEN);
}

function sanitizePlainText(text: string) {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/(^|\n)\s*(STAR|SITUATION|TASK|ACTION|RESULT)\s*:\s*/gi, "$1")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Returns the next interviewer message for an in-progress interview transcript.
 */
export async function POST(request: Request) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      logger.warn("Interview turn request validation failed.", { issues: parsed.error.issues });
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const assistantTurnCount = parsed.data.transcript.filter((turn) => turn.role === "assistant").length;
    const maxAssistantTurns = parsed.data.primaryQuestionCount * 5;

    if (assistantTurnCount >= maxAssistantTurns) {
      logger.warn("Interview reached turn safety limit and was force-ended.", {
        assistantTurnCount,
        maxAssistantTurns,
      });

      return NextResponse.json({ message: END_TOKEN, isEnd: true });
    }

    const client = getOpenAIClient();
    const model = getOpenAIModel();

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: buildInterviewSystemPrompt(parsed.data.script),
        },
        ...mapTranscriptToMessages(parsed.data.transcript),
      ],
    });

    const message = response.output_text?.trim() || "";

    if (!message) {
      logger.error("Interview turn generation returned an empty response.", { responseId: response.id });
      return NextResponse.json({ error: "Model returned an empty interviewer turn" }, { status: 502 });
    }

    const isEnd = message === END_TOKEN || hasEndToken(message);
    const sanitizedMessage = isEnd ? END_TOKEN : sanitizePlainText(message);

    if (!sanitizedMessage) {
      logger.error("Interview turn normalization produced an empty response.", { responseId: response.id });
      return NextResponse.json({ error: "Model returned an invalid interviewer turn" }, { status: 502 });
    }

    logger.info("Interview turn generated successfully.", {
      responseId: response.id,
      isEnd,
      messageLength: sanitizedMessage.length,
    });

    return NextResponse.json({
      message: sanitizedMessage,
      isEnd,
    });
  } catch (error) {
    logger.error("Interview turn request failed.", {
      message: error instanceof Error ? error.message : "Unknown server error",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Interview turn generation failed" },
      { status: 500 },
    );
  }
}
