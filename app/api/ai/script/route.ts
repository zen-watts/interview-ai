import { NextResponse } from "next/server";
import { z } from "zod";

import { createLogger } from "@/src/lib/logger";
import { getOpenAIClient, getOpenAIModel } from "@/src/lib/ai/openai";
import { assembleScriptGenerationCall } from "@/src/lib/ai/script-generation/assemble-script-generation-call";
import { EXPERIENCE_LEVEL_OPTIONS } from "@/src/lib/types";

const logger = createLogger("api.script");

const experienceValues = EXPERIENCE_LEVEL_OPTIONS.map((option) => option.value) as [
  (typeof EXPERIENCE_LEVEL_OPTIONS)[number]["value"],
  ...(typeof EXPERIENCE_LEVEL_OPTIONS)[number]["value"][],
];

const bodySchema = z.object({
  profile: z.object({
    name: z.string().min(1),
    targetJob: z.string().min(1),
    experienceLevel: z.enum(experienceValues),
    age: z.number().int().min(1).max(120).nullable().default(null),
    pronouns: z.string().default(""),
    resumeSummary: z.string(),
  }),
  role: z.object({
    title: z.string().min(1),
    organizationName: z.string(),
    organizationDescription: z.string(),
    fullJobDescription: z.string(),
  }),
  config: z.object({
    personaIntensity: z.number().min(0).max(100),
    followUpIntensity: z.number().min(0).max(100),
    primaryQuestionCount: z.number().min(1).max(10),
    category: z.enum(["Strictly Behavioral", "Mix", "Technical Concepts", "Unhinged"]),
    notes: z.string(),
  }),
});

/**
 * Generates a reusable interviewer script from candidate, role, and interview configuration context.
 */
export async function POST(request: Request) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      logger.warn("Script generation request validation failed.", { issues: parsed.error.issues });
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const client = getOpenAIClient();
    const model = getOpenAIModel();

    const response = await client.responses.create({
      model,
      input: assembleScriptGenerationCall(parsed.data),
    });

    const script = response.output_text?.trim();

    if (!script) {
      logger.error("Script generation returned an empty response.", {
        responseId: response.id,
      });
      return NextResponse.json({ error: "Model returned an empty script" }, { status: 502 });
    }

    logger.info("Interview script generated successfully.", {
      responseId: response.id,
      scriptLength: script.length,
    });

    return NextResponse.json({ script });
  } catch (error) {
    logger.error("Script generation request failed.", {
      message: error instanceof Error ? error.message : "Unknown server error",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Script generation failed" },
      { status: 500 },
    );
  }
}
