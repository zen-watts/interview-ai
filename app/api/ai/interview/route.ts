import { NextResponse } from "next/server";
import { z } from "zod";

import { getOpenAIClient, getOpenAIModel } from "@/src/lib/ai/openai";
import { mapTranscriptToMessages, buildInterviewSystemPrompt } from "@/src/lib/ai/prompts/interview";
import { interviewTurnOutputSchema } from "@/src/lib/ai/schemas";
import { extractJsonObject, parseJson } from "@/src/lib/ai/server-utils";
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

      return NextResponse.json({
        response: "Thanks for your time. We have completed this interview.",
        question: END_TOKEN,
        message: "Thanks for your time. We have completed this interview.",
        isEnd: true,
      });
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

    const outputText = response.output_text?.trim() || "";

    if (!outputText) {
      logger.error("Interview turn generation returned an empty response.", { responseId: response.id });
      return NextResponse.json({ error: "Model returned an empty interviewer turn" }, { status: 502 });
    }

    const jsonText = extractJsonObject(outputText);
    const parsedTurn = interviewTurnOutputSchema.parse(parseJson<unknown>(jsonText));
    const responseText = parsedTurn.response.trim();
    const questionText = parsedTurn.question.trim();
    const isEnd = questionText === END_TOKEN;
    const message = isEnd
      ? responseText
      : [`Response: ${responseText}`, `Question: ${questionText}`].join("\n");

    logger.info("Interview turn generated successfully.", {
      responseId: response.id,
      isEnd,
      responseLength: responseText.length,
      questionLength: questionText.length,
    });

    return NextResponse.json({
      response: responseText,
      question: questionText,
      message,
      isEnd,
    });
  } catch (error) {
    if (
      error instanceof z.ZodError ||
      (error instanceof Error &&
        (error.message.includes("Invalid JSON returned by model") ||
          error.message.includes("Model output does not contain a JSON object")))
    ) {
      logger.error("Interview turn output did not match required JSON contract.", {
        message: error instanceof Error ? error.message : "Unknown output parse error",
      });

      return NextResponse.json(
        { error: "Model returned invalid interview turn format" },
        { status: 502 },
      );
    }

    logger.error("Interview turn request failed.", {
      message: error instanceof Error ? error.message : "Unknown server error",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Interview turn generation failed" },
      { status: 500 },
    );
  }
}
