import { NextResponse } from "next/server";
import { z } from "zod";

import { getOpenAIClient, getOpenAIModel } from "@/src/lib/ai/openai";
import { buildResumeSystemPrompt, buildResumeUserPrompt } from "@/src/lib/ai/prompts/resume";
import { resumeOutputSchema } from "@/src/lib/ai/schemas";
import { extractJsonObject, parseJson } from "@/src/lib/ai/server-utils";
import { createLogger } from "@/src/lib/logger";

const logger = createLogger("api.resume");

const bodySchema = z.object({
  resumeText: z.string().min(50),
});

/**
 * Summarizes uploaded resume text and returns profile autofill suggestions.
 */
export async function POST(request: Request) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      logger.warn("request.invalid", { issues: parsed.error.issues });
      return NextResponse.json({ error: "Resume text is too short to summarize" }, { status: 400 });
    }

    const client = getOpenAIClient();
    const model = getOpenAIModel();

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: buildResumeSystemPrompt(),
        },
        {
          role: "user",
          content: buildResumeUserPrompt(parsed.data.resumeText),
        },
      ],
    });

    const outputText = response.output_text?.trim() || "";

    if (!outputText) {
      logger.error("response.empty", { responseId: response.id });
      return NextResponse.json({ error: "Model returned empty resume summary" }, { status: 502 });
    }

    const jsonText = extractJsonObject(outputText);
    const summary = resumeOutputSchema.parse(parseJson<unknown>(jsonText));

    logger.info("response.success", {
      responseId: response.id,
      hasName: Boolean(summary.name),
      hasTargetJob: Boolean(summary.targetJob),
    });

    return NextResponse.json(summary);
  } catch (error) {
    logger.error("request.failed", {
      message: error instanceof Error ? error.message : "Unknown server error",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Resume summary failed" },
      { status: 500 },
    );
  }
}
