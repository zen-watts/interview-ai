import { NextResponse } from "next/server";
import { z } from "zod";

import { getOpenAIClient, getOpenAIModel } from "@/src/lib/ai/openai";
import {
  buildAnalysisSystemPrompt,
  buildAnalysisUserPrompt,
} from "@/src/lib/ai/prompts/analysis";
import { analysisOutputSchema } from "@/src/lib/ai/schemas";
import { extractJsonObject, parseJson } from "@/src/lib/ai/server-utils";
import { createLogger } from "@/src/lib/logger";

const logger = createLogger("api.analysis");

const bodySchema = z.object({
  script: z.string().min(1),
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
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeAnalysisText(value: string) {
  return sanitizePlainText(value).replace(/(^|\n)\s*(STAR|SITUATION|TASK|ACTION|RESULT)\s*:\s*/gi, "$1").trim();
}

/**
 * Produces direct no-score interview analysis from the script and full transcript.
 */
export async function POST(request: Request) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      logger.warn("Interview analysis request validation failed.", { issues: parsed.error.issues });
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const client = getOpenAIClient();
    const model = getOpenAIModel();

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: buildAnalysisSystemPrompt(),
        },
        {
          role: "user",
          content: buildAnalysisUserPrompt(parsed.data),
        },
      ],
    });

    const outputText = response.output_text?.trim() || "";

    if (!outputText) {
      logger.error("Interview analysis returned an empty response.", { responseId: response.id });
      return NextResponse.json({ error: "Model returned empty analysis" }, { status: 502 });
    }

    const jsonText = extractJsonObject(outputText);
    const parsedAnalysis = analysisOutputSchema.parse(parseJson<unknown>(jsonText));
    const analysis = {
      impression_short: normalizeAnalysisText(parsedAnalysis.impression_short),
      impression_long: normalizeAnalysisText(parsedAnalysis.impression_long),
      red_flags: parsedAnalysis.red_flags.map((flag) => normalizeAnalysisText(flag)),
      top_improvement: normalizeAnalysisText(parsedAnalysis.top_improvement),
    };

    logger.info("Interview analysis generated successfully.", {
      responseId: response.id,
      redFlagCount: analysis.red_flags.length,
    });

    return NextResponse.json(analysis);
  } catch (error) {
    logger.error("Interview analysis request failed.", {
      message: error instanceof Error ? error.message : "Unknown server error",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis generation failed" },
      { status: 500 },
    );
  }
}
